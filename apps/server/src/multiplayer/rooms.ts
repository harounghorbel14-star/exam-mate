import { randomInt } from 'node:crypto';
import {
  MP_GAMES, mpInit, mpApply, mpTick, mpView, mpWakeAt, mpForfeit, mpShiftTime, MpError, DEFAULT_MP_TIMINGS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, avatarFor,
  type ClientMessage, type MpGameId, type MpState, type MpTimings, type RoomSnapshot, type ServerMessage, type MpErrorCode,
} from '@exammate/core';
import { pool } from '../db/pool.js';
import { log } from '../logger.js';

export interface Conn { userId: string; name: string; send(msg: ServerMessage): void; close(code: number, reason: string): void }

interface Seat { userId: string; name: string; avatar: string; seat: number; ready: boolean; connected: boolean; left: boolean; lastSeen: number }
interface Room {
  code: string; hostId: string; game: MpGameId; maxPlayers: number; status: 'lobby' | 'playing' | 'finished';
  players: Seat[]; state: MpState | null; seq: number; updatedAt: number;
  recent: Map<string, string[]>; timer: ReturnType<typeof setTimeout> | null; graceTimers: Map<string, ReturnType<typeof setTimeout>>;
  saving: Promise<void>;
}

export interface RoomManagerOptions { timings?: MpTimings; graceMs?: number; idleMs?: number; now?: () => number; persist?: boolean }

class RoomError extends Error { constructor(public code: MpErrorCode, message?: string) { super(message ?? code); } }

/**
 * Authoritative room and game state. Every action is validated here; clients only send intents
 * (join, ready, move…) and receive per-player views. Node processes one message at a time, so
 * actions on a room are serialised: two concurrent moves cannot both apply.
 */
export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private conns = new Map<string, Set<Conn>>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private t: MpTimings; private graceMs: number; private idleMs: number; private now: () => number; private persist: boolean;

  constructor(o: RoomManagerOptions = {}) {
    this.t = o.timings ?? DEFAULT_MP_TIMINGS;
    this.graceMs = o.graceMs ?? 60_000;
    this.idleMs = o.idleMs ?? 15 * 60_000;
    this.now = o.now ?? Date.now;
    this.persist = o.persist ?? true;
  }

  // ---------------- lifecycle ----------------

  /** Reloads open rooms after a restart. Game clocks are shifted by the downtime so nobody times out while the server was away. */
  async restore(): Promise<number> {
    const { rows } = await pool.query("SELECT code, host_id, game, max_players, status, players, state, seq, extract(epoch from updated_at) * 1000 AS updated FROM mp_rooms WHERE status <> 'closed'");
    const now = this.now();
    for (const r of rows) {
      const downtime = Math.max(0, now - Number(r.updated));
      const room: Room = {
        code: r.code, hostId: r.host_id, game: r.game, maxPlayers: r.max_players, status: r.status, seq: r.seq + 1, updatedAt: now,
        players: (r.players as Seat[]).map((p) => ({ ...p, connected: false, lastSeen: now })),
        state: r.state ? mpShiftTime(r.state as MpState, downtime) : null,
        recent: new Map(), timer: null, graceTimers: new Map(), saving: Promise.resolve(),
      };
      this.rooms.set(room.code, room);
      for (const p of room.players) if (!p.left) this.startGrace(room, p.userId);
      this.arm(room);
    }
    return rows.length;
  }

  startSweeper(everyMs = 60_000) {
    this.sweeper = setInterval(() => void this.sweep(), everyMs);
    this.sweeper.unref?.();
  }

  /** Closes abandoned rooms: nobody connected and no activity for idleMs. */
  async sweep(): Promise<string[]> {
    const now = this.now(), closed: string[] = [];
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.connected) || now - room.updatedAt < this.idleMs) continue;
      closed.push(room.code);
      await this.closeRoom(room);
    }
    return closed;
  }

  shutdown() {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const r of this.rooms.values()) { if (r.timer) clearTimeout(r.timer); for (const g of r.graceTimers.values()) clearTimeout(g); }
    return Promise.all([...this.rooms.values()].map((r) => r.saving));
  }

  // ---------------- connections ----------------

  attach(conn: Conn) {
    const set = this.conns.get(conn.userId) ?? new Set();
    set.add(conn);
    this.conns.set(conn.userId, set);
  }

  detach(conn: Conn) {
    const set = this.conns.get(conn.userId);
    set?.delete(conn);
    if (set && set.size) return;
    this.conns.delete(conn.userId);
    const room = this.roomOf(conn.userId);
    if (!room) return;
    const p = room.players.find((x) => x.userId === conn.userId)!;
    p.connected = false; p.lastSeen = this.now();
    this.touch(room);
    this.startGrace(room, conn.userId);
  }

  connectionCount(userId: string) { return this.conns.get(userId)?.size ?? 0; }

  private roomOf(userId: string): Room | undefined {
    for (const r of this.rooms.values()) if (r.players.some((p) => p.userId === userId && !p.left)) return r;
    return undefined;
  }

  // ---------------- dispatch ----------------

  async handle(conn: Conn, msg: Exclude<ClientMessage, { type: 'auth' }>): Promise<void> {
    if (msg.type === 'ping') { conn.send({ type: 'pong', id: msg.id, serverTime: this.now() }); return; }
    // Replay protection: an action id is applied at most once per user and room.
    const before = this.roomOf(conn.userId);
    if (before?.recent.get(conn.userId)?.includes(msg.id)) { conn.send({ type: 'ack', id: msg.id, duplicate: true }); return; }
    try {
      switch (msg.type) {
        case 'create': await this.create(conn, msg.game, msg.maxPlayers); break;
        case 'join': await this.join(conn, msg.code); break;
        case 'leave': this.leave(conn.userId, false); conn.send({ type: 'left' }); break;
        case 'ready': this.ready(conn.userId, msg.ready); break;
        case 'select': this.select(conn.userId, msg.game, msg.maxPlayers); break;
        case 'kick': this.kick(conn.userId, msg.userId); break;
        case 'start': this.start(conn.userId); break;
        case 'rematch': this.rematch(conn.userId); break;
        case 'move': this.move(conn.userId, msg.step, msg.move); break;
      }
      const after = this.roomOf(conn.userId);
      if (after) after.recent.set(conn.userId, [...(after.recent.get(conn.userId) ?? []), msg.id].slice(-200));
      conn.send({ type: 'ack', id: msg.id });
    } catch (e) {
      const code = e instanceof RoomError || e instanceof MpError ? e.code : 'bad_request';
      if (!(e instanceof RoomError || e instanceof MpError)) log('error', 'multiplayer action failed', { message: (e as Error).message });
      conn.send({ type: 'error', id: msg.id, code, message: (e as Error).message });
    }
  }

  // ---------------- actions ----------------

  private async newCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      let code = '';
      for (let k = 0; k < ROOM_CODE_LENGTH; k++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (this.rooms.has(code)) continue;
      if (this.persist && (await pool.query('SELECT 1 FROM mp_rooms WHERE code = $1', [code])).rowCount) continue;
      return code;
    }
    throw new RoomError('bad_request', 'Could not allocate a room code');
  }

  private clampPlayers(game: MpGameId, n: number) {
    const spec = MP_GAMES[game];
    return Math.max(spec.min, Math.min(spec.max, Math.floor(n)));
  }

  private async create(conn: Conn, game: MpGameId, maxPlayers: number) {
    const existing = this.roomOf(conn.userId);
    if (existing) this.leave(conn.userId, false);
    const code = await this.newCode();
    const room: Room = {
      code, hostId: conn.userId, game, maxPlayers: this.clampPlayers(game, maxPlayers), status: 'lobby', state: null, seq: 0, updatedAt: this.now(),
      players: [this.seat(conn, 0)], recent: new Map(), timer: null, graceTimers: new Map(), saving: Promise.resolve(),
    };
    this.rooms.set(code, room);
    this.touch(room);
  }

  private seat(conn: Conn, seat: number): Seat {
    return { userId: conn.userId, name: conn.name, avatar: avatarFor(conn.userId), seat, ready: false, connected: true, left: false, lastSeen: this.now() };
  }

  private async join(conn: Conn, code: string) {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('room_not_found', 'No room with this code');
    const mine = room.players.find((p) => p.userId === conn.userId && !p.left);
    if (mine) {
      // Reconnect: same seat, same game.
      mine.connected = true; mine.lastSeen = this.now(); mine.name = conn.name;
      const g = room.graceTimers.get(conn.userId);
      if (g) { clearTimeout(g); room.graceTimers.delete(conn.userId); }
      this.touch(room);
      return;
    }
    if (room.status !== 'lobby') throw new RoomError('already_started', 'This game has already started');
    const active = room.players.filter((p) => !p.left);
    if (active.length >= room.maxPlayers) throw new RoomError('room_full', 'This room is full');
    const other = this.roomOf(conn.userId);
    if (other) this.leave(conn.userId, false);
    room.players = [...active, this.seat(conn, active.length)];
    this.touch(room);
  }

  /** Leaving (or being dropped after the reconnect grace period). Host role moves to the next player. */
  leave(userId: string, timedOut: boolean) {
    const room = this.roomOf(userId);
    if (!room) return;
    const p = room.players.find((x) => x.userId === userId && !x.left)!;
    const g = room.graceTimers.get(userId);
    if (g) { clearTimeout(g); room.graceTimers.delete(userId); }
    if (room.status === 'lobby') {
      room.players = room.players.filter((x) => x.userId !== userId).map((x, i) => ({ ...x, seat: i }));
    } else {
      p.left = true; p.connected = false;
      if (room.status === 'playing' && room.state) {
        const remaining = room.players.filter((x) => !x.left).length;
        if (room.state.seats === 2 || remaining < 2) this.setState(room, mpForfeit(room.state, p.seat));
      }
    }
    const active = room.players.filter((x) => !x.left);
    if (!active.length) { void this.closeRoom(room); return; }
    if (room.hostId === userId) room.hostId = (active.find((x) => x.connected) ?? active[0]!).userId;
    log('info', 'player left room', { room: room.code, timedOut });
    this.touch(room);
  }

  private startGrace(room: Room, userId: string) {
    const prev = room.graceTimers.get(userId);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      room.graceTimers.delete(userId);
      const p = room.players.find((x) => x.userId === userId && !x.left);
      if (p && !p.connected) this.leave(userId, true);
    }, this.graceMs);
    timer.unref?.();
    room.graceTimers.set(userId, timer);
  }

  private requireRoom(userId: string) {
    const room = this.roomOf(userId);
    if (!room) throw new RoomError('not_in_room', 'You are not in a room');
    return room;
  }
  private requireHost(room: Room, userId: string) {
    if (room.hostId !== userId) throw new RoomError('not_host', 'Only the host can do that');
  }

  private ready(userId: string, ready: boolean) {
    const room = this.requireRoom(userId);
    if (room.status !== 'lobby') throw new RoomError('already_started');
    room.players.find((p) => p.userId === userId)!.ready = ready;
    this.touch(room);
  }

  private select(userId: string, game: MpGameId, maxPlayers?: number) {
    const room = this.requireRoom(userId);
    this.requireHost(room, userId);
    if (room.status !== 'lobby') throw new RoomError('already_started');
    const max = this.clampPlayers(game, maxPlayers ?? room.maxPlayers);
    if (room.players.length > max) throw new RoomError('room_full', `This game allows at most ${MP_GAMES[game].max} players`);
    room.game = game; room.maxPlayers = max;
    room.players.forEach((p) => { p.ready = false; });
    this.touch(room);
  }

  private kick(userId: string, target: string) {
    const room = this.requireRoom(userId);
    this.requireHost(room, userId);
    if (room.status !== 'lobby' || target === userId) throw new RoomError('bad_request', 'Players can only be removed in the lobby');
    if (!room.players.some((p) => p.userId === target)) throw new RoomError('not_in_room');
    room.players = room.players.filter((p) => p.userId !== target).map((x, i) => ({ ...x, seat: i }));
    for (const c of this.conns.get(target) ?? []) { c.send({ type: 'error', code: 'kicked', message: 'The host removed you from the room' }); c.send({ type: 'left' }); }
    this.touch(room);
  }

  private start(userId: string) {
    const room = this.requireRoom(userId);
    this.requireHost(room, userId);
    if (room.status !== 'lobby') throw new RoomError('already_started');
    const spec = MP_GAMES[room.game];
    if (room.players.length < spec.min) throw new RoomError('not_enough_players', `At least ${spec.min} players are needed`);
    if (room.players.some((p) => p.userId !== room.hostId && (!p.ready || !p.connected))) throw new RoomError('not_ready', 'Everyone must be connected and ready');
    // Server-side randomness from a CSPRNG; clients never choose seeds.
    room.state = mpInit(room.game, room.players.length, randomInt(2 ** 31), this.now(), this.t);
    room.status = 'playing';
    this.touch(room);
    this.arm(room);
  }

  private rematch(userId: string) {
    const room = this.requireRoom(userId);
    this.requireHost(room, userId);
    if (room.status !== 'finished') throw new RoomError('bad_request', 'The game is not finished');
    room.players = room.players.filter((p) => !p.left).map((p, i) => ({ ...p, seat: i, ready: false }));
    room.state = null; room.status = 'lobby';
    this.touch(room);
  }

  private move(userId: string, step: number, move: Parameters<typeof mpApply>[2]) {
    const room = this.requireRoom(userId);
    if (room.status !== 'playing' || !room.state) throw new RoomError('game_over', 'No game in progress');
    const p = room.players.find((x) => x.userId === userId)!;
    this.setState(room, mpApply(room.state, p.seat, move, step, this.now(), this.t));
  }

  // ---------------- state, timers, persistence ----------------

  private setState(room: Room, state: MpState) {
    room.state = state;
    if (state.over && room.status === 'playing') {
      room.status = 'finished';
      if (this.persist) {
        void pool.query('INSERT INTO mp_results (room_code, game, players, winners, scores) VALUES ($1, $2, $3, $4, $5)',
          [room.code, room.game, JSON.stringify(room.players.map((p) => ({ userId: p.userId, seat: p.seat }))), JSON.stringify(state.winners ?? []), JSON.stringify(state.scores)])
          .catch((e) => log('error', 'saving multiplayer result failed', { message: (e as Error).message }));
      }
    }
    this.touch(room);
    this.arm(room);
  }

  private arm(room: Room) {
    if (room.timer) { clearTimeout(room.timer); room.timer = null; }
    if (room.status !== 'playing' || !room.state) return;
    const wake = mpWakeAt(room.state);
    if (wake === null) return;
    room.timer = setTimeout(() => {
      room.timer = null;
      if (!room.state || room.status !== 'playing') return;
      const next = mpTick(room.state, this.now(), this.t);
      if (next !== room.state) this.setState(room, next);
      else this.arm(room);
    }, Math.max(0, wake - this.now()));
    room.timer.unref?.();
  }

  /** Records a change: bumps the sequence number, persists, and broadcasts views. */
  private touch(room: Room) {
    room.seq++;
    room.updatedAt = this.now();
    this.save(room);
    this.broadcast(room);
  }

  private save(room: Room) {
    if (!this.persist) return;
    const snapshot = { players: JSON.stringify(room.players.map(({ lastSeen: _l, ...p }) => p)), state: room.state ? JSON.stringify(room.state) : null };
    room.saving = room.saving.then(() => pool.query(
      `INSERT INTO mp_rooms (code, host_id, game, max_players, status, players, state, seq, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (code) DO UPDATE SET host_id = $2, game = $3, max_players = $4, status = $5, players = $6, state = $7, seq = $8, updated_at = now()`,
      [room.code, room.hostId, room.game, room.maxPlayers, room.status, snapshot.players, snapshot.state, room.seq],
    ).then(() => undefined)).catch((e) => log('error', 'saving room failed', { message: (e as Error).message }));
  }

  private async closeRoom(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    for (const g of room.graceTimers.values()) clearTimeout(g);
    this.rooms.delete(room.code);
    for (const p of room.players) for (const c of this.conns.get(p.userId) ?? []) c.send({ type: 'left' });
    if (this.persist) { await room.saving; await pool.query("UPDATE mp_rooms SET status = 'closed', updated_at = now() WHERE code = $1", [room.code]); }
  }

  snapshot(room: Room, userId: string | null): RoomSnapshot {
    const me = room.players.find((p) => p.userId === userId && !p.left);
    return {
      code: room.code, game: room.game, maxPlayers: room.maxPlayers, status: room.status, hostId: room.hostId, seq: room.seq,
      players: room.players.filter((p) => !p.left || room.status !== 'lobby').map((p) => ({ userId: p.userId, name: p.name, avatar: p.avatar, seat: p.seat, ready: p.ready, connected: p.connected, host: p.userId === room.hostId })),
      mySeat: me ? me.seat : null,
      view: room.state ? mpView(room.state, me ? me.seat : null) : null,
      serverTime: this.now(),
    };
  }

  private broadcast(room: Room) {
    for (const p of room.players) {
      if (p.left) continue;
      const set = this.conns.get(p.userId);
      if (!set) continue;
      const msg: ServerMessage = { type: 'room', room: this.snapshot(room, p.userId) };
      for (const c of set) c.send(msg);
    }
  }

  /** Public, minimal info for invite links (no player identities). */
  preview(code: string) {
    const r = this.rooms.get(code);
    return r ? { code: r.code, game: r.game, status: r.status, players: r.players.filter((p) => !p.left).length, maxPlayers: r.maxPlayers } : null;
  }
}
