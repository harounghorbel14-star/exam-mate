import { afterAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { DEFAULT_MP_TIMINGS, GENERAL_QUIZ, MultiplayerClient, type MpTimings, type RoomSnapshot, type ServerMessage } from '@exammate/core';
import { createApp } from '../http/app.js';
import { RoomManager } from '../multiplayer/rooms.js';
import { attachMultiplayer } from '../multiplayer/ws.js';
import { pool } from '../db/pool.js';
import { makeUser, request, type TestUser } from './helpers.js';

const ORIGIN = 'http://localhost:4173';
const servers: Array<() => Promise<void>> = [];
afterAll(async () => { for (const s of servers) await s(); });

async function startServer(o: { timings?: Partial<MpTimings>; graceMs?: number; idleMs?: number } = {}) {
  const rooms = new RoomManager({ timings: { ...DEFAULT_MP_TIMINGS, ...o.timings }, graceMs: o.graceMs ?? 5000, idleMs: o.idleMs ?? 60_000 });
  const app = createApp({ rooms });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const mp = attachMultiplayer(server, rooms, { origins: [ORIGIN], authTimeoutMs: 1000 });
  const port = (server.address() as AddressInfo).port;
  let stopped = false;
  const stop = async () => { if (stopped) return; stopped = true; mp.close(); await rooms.shutdown(); await new Promise((r) => server.close(r)); };
  servers.push(stop);
  return { rooms, app, port, url: `ws://127.0.0.1:${port}/ws`, stop };
}

async function ticket(app: ReturnType<typeof createApp>, u: TestUser): Promise<string> {
  const r = await request(app).post('/api/mp/ticket').set({ Authorization: `Bearer ${u.token}` }).expect(201);
  return r.body.ticket;
}

let ids = 0;
/** A raw protocol client, as an independent device would be. */
class TC {
  ws!: WebSocket;
  msgs: ServerMessage[] = [];
  room: RoomSnapshot | null = null;
  closed: { code: number; reason: string } | null = null;
  private waiters: Array<() => void> = [];
  static async open(url: string, t: string | null, headers: Record<string, string> = {}): Promise<TC> {
    const c = new TC();
    c.ws = new WebSocket(url, { headers });
    c.ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMessage;
      c.msgs.push(m);
      if (m.type === 'room') c.room = m.room;
      if (m.type === 'left') c.room = null;
      c.waiters.forEach((w) => w());
    });
    c.ws.on('close', (code, reason) => { c.closed = { code, reason: reason.toString() }; c.waiters.forEach((w) => w()); });
    await new Promise<void>((res, rej) => { c.ws.once('open', () => res()); c.ws.once('error', rej); c.ws.once('unexpected-response', (_req, r) => rej(new Error(`HTTP ${r.statusCode}`))); });
    if (t !== null) { c.ws.send(JSON.stringify({ type: 'auth', ticket: t })); await c.until(() => c.msgs.some((m) => m.type === 'welcome') || !!c.closed); }
    return c;
  }
  until(pred: () => boolean, ms = 4000): Promise<void> {
    return new Promise((res, rej) => {
      if (pred()) return res();
      const timer = setTimeout(() => rej(new Error('timeout waiting for condition')), ms);
      const w = () => { if (pred()) { clearTimeout(timer); this.waiters = this.waiters.filter((x) => x !== w); res(); } };
      this.waiters.push(w);
    });
  }
  /** Sends an action and resolves with the matching ack or error. */
  async act(msg: Record<string, unknown>): Promise<ServerMessage> {
    const id = (msg.id as string) ?? `a${ids++}`;
    this.ws.send(JSON.stringify({ ...msg, id }));
    let found: ServerMessage | undefined;
    await this.until(() => !!(found = this.msgs.find((m) => (m.type === 'ack' || m.type === 'error') && m.id === id)));
    this.msgs = this.msgs.filter((m) => m !== found);
    return found!;
  }
  move(move: Record<string, unknown>, step = this.room!.view!.step) { return this.act({ type: 'move', step, move }); }
  close() { this.ws.close(); }
}

async function pair(o: Parameters<typeof startServer>[0] = {}, game = 'tic-tac-toe', max = 2) {
  const srv = await startServer(o);
  const [ua, ub] = [await makeUser(), await makeUser()];
  const a = await TC.open(srv.url, await ticket(srv.app, ua));
  const b = await TC.open(srv.url, await ticket(srv.app, ub));
  expect((await a.act({ type: 'create', game, maxPlayers: max })).type).toBe('ack');
  const code = a.room!.code;
  expect((await b.act({ type: 'join', code })).type).toBe('ack');
  await a.until(() => a.room!.players.length === 2);
  return { srv, ua, ub, a, b, code };
}

async function startGame(a: TC, b: TC) {
  await b.act({ type: 'ready', ready: true });
  expect((await a.act({ type: 'start' })).type).toBe('ack');
  await b.until(() => b.room?.status === 'playing');
}

describe('multiplayer authentication', () => {
  it('requires a valid single-use ticket and rejects foreign origins', async () => {
    const srv = await startServer();
    const u = await makeUser();
    expect((await request(srv.app).post('/api/mp/ticket')).status).toBe(401);
    const bad = await TC.open(srv.url, 'not-a-ticket');
    expect(bad.closed?.code).toBe(4001);
    const t = await ticket(srv.app, u);
    const ok = await TC.open(srv.url, t);
    expect(ok.msgs[0]).toMatchObject({ type: 'welcome', userId: u.id });
    const replay = await TC.open(srv.url, t); // same ticket again
    expect(replay.closed?.code).toBe(4001);
    const silent = await TC.open(srv.url, null);
    silent.ws.send(JSON.stringify({ type: 'create', id: 'x', game: 'trivia', maxPlayers: 3 }));
    await silent.until(() => !!silent.closed);
    expect(silent.closed?.code).toBe(4001);
    await expect(TC.open(srv.url, await ticket(srv.app, u), { Origin: 'https://evil.example' })).rejects.toThrow('HTTP 403');
    ok.close();
  });
});

describe('rooms and lobby', () => {
  it('creates rooms with short codes, joins, enforces capacity and unknown codes', async () => {
    const { srv, a, b, code } = await pair();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(a.room!.players.map((p) => p.host)).toEqual([true, false]);
    const c = await TC.open(srv.url, await ticket(srv.app, await makeUser()));
    expect(await c.act({ type: 'join', code })).toMatchObject({ type: 'error', code: 'room_full' });
    expect(await c.act({ type: 'join', code: 'ZZZZZZ' })).toMatchObject({ type: 'error', code: 'room_not_found' });
    const preview = await request(srv.app).get(`/api/mp/rooms/${code.toLowerCase()}`).set({ Authorization: `Bearer ${(await makeUser()).token}` }).expect(200);
    expect(preview.body.room).toEqual({ code, game: 'tic-tac-toe', status: 'lobby', players: 2, maxPlayers: 2 });
    [a, b, c].forEach((x) => x.close());
  });

  it('only the host controls the lobby; start requires everyone ready; host can kick', async () => {
    const srv = await startServer();
    const users = [await makeUser(), await makeUser(), await makeUser()];
    const [h, p1, p2] = await Promise.all(users.map(async (u) => TC.open(srv.url, await ticket(srv.app, u))));
    await h!.act({ type: 'create', game: 'trivia', maxPlayers: 4 });
    const code = h!.room!.code;
    await p1!.act({ type: 'join', code });
    await p2!.act({ type: 'join', code });
    expect(await p1!.act({ type: 'start' })).toMatchObject({ type: 'error', code: 'not_host' });
    expect(await p1!.act({ type: 'select', game: 'checkers' })).toMatchObject({ type: 'error', code: 'not_host' });
    expect(await h!.act({ type: 'select', game: 'checkers' })).toMatchObject({ type: 'error', code: 'room_full' }); // 3 players > 2
    expect(await h!.act({ type: 'start' })).toMatchObject({ type: 'error', code: 'not_ready' });
    await h!.act({ type: 'kick', userId: users[2]!.id });
    await p2!.until(() => p2!.msgs.some((m) => m.type === 'error' && m.code === 'kicked'));
    expect(p2!.room).toBeNull();
    await h!.until(() => h!.room!.players.length === 2);
    expect(await p2!.act({ type: 'ready', ready: true })).toMatchObject({ type: 'error', code: 'not_in_room' });
    await p1!.act({ type: 'ready', ready: true });
    expect((await h!.act({ type: 'start' })).type).toBe('ack');
    await p1!.until(() => p1!.room?.status === 'playing');
    expect(await p2!.act({ type: 'join', code })).toMatchObject({ type: 'error', code: 'already_started' });
    [h, p1, p2].forEach((x) => x!.close());
  });

  it('migrates the host when the host leaves', async () => {
    const { a, b, ub } = await pair();
    await a.act({ type: 'leave' });
    await b.until(() => b.room!.players.length === 1);
    expect(b.room!.hostId).toBe(ub.id);
    [a, b].forEach((x) => x.close());
  });
});

describe('server-authoritative play', () => {
  it('two independent clients complete a tic-tac-toe game; turns, stale steps, replays and concurrent moves are rejected', async () => {
    const { srv, a, b, code } = await pair();
    await startGame(a, b);
    expect(a.room!.mySeat).toBe(0);
    expect(await b.move({ cell: 0 })).toMatchObject({ type: 'error', code: 'not_your_turn' });
    // Replay: the same action id twice applies once.
    const first = await a.act({ type: 'move', id: 'dup-1', step: 0, move: { cell: 4 } });
    expect(first.type).toBe('ack');
    const again = await a.act({ type: 'move', id: 'dup-1', step: 0, move: { cell: 4 } });
    expect(again).toMatchObject({ type: 'ack', duplicate: true });
    await b.until(() => b.room!.view!.step === 1);
    // Stale: a move for an old step is refused.
    expect(await b.move({ cell: 0 }, 0)).toMatchObject({ type: 'error', code: 'stale' });
    // Client-side score tampering is not even representable.
    b.ws.send(JSON.stringify({ type: 'move', id: 'tamper', step: 1, move: { cell: 0, score: 100 } }));
    await b.until(() => b.msgs.some((m) => m.type === 'error' && m.code === 'bad_request'));
    // Concurrent duplicate submissions for the same step: exactly one applies.
    const results = await Promise.all([b.move({ cell: 0 }, 1), b.move({ cell: 1 }, 1)]);
    expect(results.filter((r) => r.type === 'ack')).toHaveLength(1);
    expect(results.filter((r) => r.type === 'error' && r.code === 'stale')).toHaveLength(1);
    await a.until(() => a.room!.view!.step === 2);
    const board = () => (a.room!.view as unknown as { board: Array<string | null> }).board;
    // Play out: X needs a line. Pick moves deterministically from the live board.
    const order = [2, 6, 3, 5, 7, 8, 1, 0];
    while (!a.room!.view!.over) {
      const mover = a.room!.view!.turn === 0 ? a : b;
      const cell = order.find((c) => !board()[c])!;
      const step = a.room!.view!.step;
      expect((await mover.move({ cell }, step)).type).toBe('ack');
      await a.until(() => a.room!.view!.step > step || a.room!.view!.over);
    }
    await b.until(() => b.room?.status === 'finished');
    expect(a.room!.status).toBe('finished');
    // The result row is written asynchronously after the final move.
    await expect.poll(async () => (await pool.query('SELECT 1 FROM mp_results WHERE room_code = $1', [code])).rowCount).toBe(1);
    const { rows } = await pool.query('SELECT winners FROM mp_results WHERE room_code = $1', [code]);
    expect(rows[0].winners).toEqual(a.room!.view!.winners);
    // Rematch returns everyone to the lobby.
    await a.act({ type: 'rematch' });
    await b.until(() => b.room?.status === 'lobby');
    expect(srv.rooms.preview(code)?.status).toBe('lobby');
    [a, b].forEach((x) => x.close());
  });

  it('rock paper scissors never reveals the opponent choice before both have chosen', async () => {
    const { a, b } = await pair({}, 'rock-paper-scissors');
    await startGame(a, b);
    await a.move({ choice: 'paper' });
    await b.until(() => (b.room!.view as unknown as { chosen: boolean[] }).chosen[0] === true);
    expect(JSON.stringify(b.room)).not.toContain('"paper"');
    await b.move({ choice: 'rock' });
    await a.until(() => a.room!.view!.scores[0] === 1);
    [a, b].forEach((x) => x.close());
  });

  it('a three-player trivia party is timed and scored by the server', async () => {
    const srv = await startServer({ timings: { triviaQuestionMs: 1500, revealMs: 100 } });
    const users = [await makeUser(), await makeUser(), await makeUser()];
    const cs = await Promise.all(users.map(async (u) => TC.open(srv.url, await ticket(srv.app, u))));
    await cs[0]!.act({ type: 'create', game: 'trivia', maxPlayers: 3 });
    for (const c of cs.slice(1)) { await c.act({ type: 'join', code: cs[0]!.room!.code }); await c.act({ type: 'ready', ready: true }); }
    await cs[0]!.act({ type: 'start' });
    type TV = { q: number; phase: string; total: number; question: { q: { en: string } } };
    for (let q = 0; q < 7; q++) {
      await cs[0]!.until(() => (cs[0]!.room!.view as unknown as TV).q === q && (cs[0]!.room!.view as unknown as TV).phase === 'question', 5000);
      const text = (cs[0]!.room!.view as unknown as TV).question.q.en;
      const answer = GENERAL_QUIZ.find((i) => i.q.en === text)!.answer;
      await cs[0]!.move({ choice: answer }); // always right
      await cs[1]!.move({ choice: (answer + 1) % 4 }); // always wrong
      // player 3 never answers: the server times the question out
    }
    await cs[0]!.until(() => cs[0]!.room!.status === 'finished', 8000);
    const v = cs[0]!.room!.view!;
    expect(v.winners).toEqual([0]);
    expect(v.scores[0]).toBeGreaterThanOrEqual(700);
    expect(v.scores[1]).toBe(0);
    expect(v.scores[2]).toBe(0);
    cs.forEach((c) => c.close());
  }, 30_000);
});

describe('party games over the wire', () => {
  it('reaction race: go time is server-controlled, early taps are penalised, rounds advance on the server clock', async () => {
    const t = await pair({ timings: { reactionMinMs: 200, reactionMaxMs: 300, reactionWindowMs: 400, revealMs: 50 } }, 'reaction-race', 2);
    await startGame(t.a, t.b);
    type RV = { phase: string; round: number; roundWinner: number | null; out: boolean[] };
    const rv = (c: TC) => c.room!.view as unknown as RV;
    expect(rv(t.a).phase).toBe('wait');
    expect(JSON.stringify(t.a.room)).not.toContain('goAt');
    await t.b.move({ tap: true }); // false start
    await t.a.until(() => t.a.room!.view!.scores[1] === -1);
    await t.a.until(() => rv(t.a).phase === 'go');
    await t.a.move({ tap: true });
    await t.b.until(() => rv(t.b).roundWinner === 0);
    await t.a.until(() => t.a.room!.status === 'finished', 8000);
    expect(t.a.room!.view!.scores[0]).toBeGreaterThanOrEqual(1);
    expect(t.a.room!.view!.winners).toEqual([0]);
    [t.a, t.b].forEach((x) => x.close());
  }, 15_000);

  it('memory challenge: face-down symbols are never sent to clients', async () => {
    const t = await pair({}, 'memory-challenge', 3);
    await startGame(t.a, t.b);
    type MV = { cards: Array<{ id: number; symbol: string | null }> };
    expect((t.b.room!.view as unknown as MV).cards.every((c) => c.symbol === null)).toBe(true);
    await t.a.move({ card: 0 });
    await t.b.until(() => (t.b.room!.view as unknown as MV).cards[0]!.symbol !== null);
    expect((t.b.room!.view as unknown as MV).cards.filter((c) => c.symbol !== null)).toHaveLength(1);
    expect(await t.b.move({ card: 1 })).toMatchObject({ type: 'error', code: 'not_your_turn' });
    [t.a, t.b].forEach((x) => x.close());
  });
});

describe('reliability', () => {
  it('a dropped player reconnects to the same seat and the game continues', async () => {
    const { srv, ua, a, b, code } = await pair();
    await startGame(a, b);
    await a.move({ cell: 4 });
    a.close();
    await b.until(() => b.room!.players.find((p) => p.userId === ua.id)!.connected === false);
    const a2 = await TC.open(srv.url, await ticket(srv.app, ua));
    await a2.act({ type: 'join', code });
    expect(a2.room!.mySeat).toBe(0);
    expect((a2.room!.view as unknown as { board: unknown[] }).board[4]).toBe('X');
    await b.until(() => b.room!.players.every((p) => p.connected));
    expect((await b.move({ cell: 0 })).type).toBe('ack');
    [a2, b].forEach((x) => x.close());
  });

  it('the core client reconnects automatically and rejoins its room', async () => {
    const srv = await startServer();
    const [ua, ub] = [await makeUser(), await makeUser()];
    const rooms: Array<RoomSnapshot | null> = [];
    const client = new MultiplayerClient({
      url: srv.url, backoff: [50],
      getTicket: () => ticket(srv.app, ua),
      createSocket: (u) => new WebSocket(u) as never,
      onRoom: (r) => rooms.push(r),
    });
    await client.connect();
    await client.create('connect-four', 2);
    const code = client.room!.code;
    const b = await TC.open(srv.url, await ticket(srv.app, ub));
    await b.act({ type: 'join', code });
    // Kill the client's socket from the server side.
    (client as unknown as { ws: WebSocket }).ws.terminate?.();
    await b.until(() => b.room!.players.some((p) => !p.connected));
    await b.until(() => b.room!.players.every((p) => p.connected), 5000);
    expect(client.state).toBe('online');
    expect(client.room?.code).toBe(code);
    client.close(); b.close();
  });

  it('an absent player forfeits after the grace period; turn timers forfeit idle players', async () => {
    const { ub, a, b } = await pair({ graceMs: 300 });
    await startGame(a, b);
    b.close();
    await a.until(() => a.room?.status === 'finished', 3000);
    expect(a.room!.view!.winners).toEqual([0]);
    expect(a.room!.view!.forfeit).toBe(1);
    expect(a.room!.players.find((p) => p.userId === ub.id)).toBeTruthy();
    a.close();
    const t = await pair({ timings: { turnMs: 300 } }, 'connect-four');
    await startGame(t.a, t.b);
    await t.a.until(() => t.a.room?.status === 'finished', 3000);
    expect(t.a.room!.view!.winners).toEqual([1]); // seat 0 never moved
    [t.a, t.b].forEach((x) => x.close());
  });

  it('abandoned rooms are closed by the sweeper', async () => {
    const { srv, a, b, code } = await pair({ idleMs: 50, graceMs: 60_000 });
    a.close(); b.close();
    await new Promise((r) => setTimeout(r, 150));
    expect(await srv.rooms.sweep()).toContain(code);
    expect(srv.rooms.preview(code)).toBeNull();
    const { rows } = await pool.query('SELECT status FROM mp_rooms WHERE code = $1', [code]);
    expect(rows[0].status).toBe('closed');
  });

  it('a game survives a server restart: rooms are restored from the database and players resume', async () => {
    const { srv, ua, ub, a, b, code } = await pair();
    await startGame(a, b);
    await a.move({ cell: 0 });
    await b.until(() => b.room!.view!.step === 1);
    a.close(); b.close();
    await srv.stop(); // simulated crash/restart
    const srv2 = await startServer();
    expect(await srv2.rooms.restore()).toBeGreaterThan(0);
    const a2 = await TC.open(srv2.url, await ticket(srv2.app, ua));
    const b2 = await TC.open(srv2.url, await ticket(srv2.app, ub));
    await a2.act({ type: 'join', code });
    await b2.act({ type: 'join', code });
    expect(b2.room!.status).toBe('playing');
    expect((b2.room!.view as unknown as { board: unknown[] }).board[0]).toBe('X');
    expect((await b2.move({ cell: 4 })).type).toBe('ack');
    [a2, b2].forEach((x) => x.close());
  });

  it('floods are rate limited', async () => {
    const srv = await startServer();
    const c = await TC.open(srv.url, await ticket(srv.app, await makeUser()));
    for (let i = 0; i < 60; i++) c.ws.send(JSON.stringify({ type: 'ping', id: `p${i}` }));
    await c.until(() => c.msgs.some((m) => m.type === 'error' && m.code === 'rate_limited'));
    c.close();
  });
});
