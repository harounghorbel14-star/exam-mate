import type { ClientMessage, RoomSnapshot, ServerMessage, MpErrorCode } from './protocol.js';
import type { MpGameId, MpMove } from './games.js';

/** Minimal WebSocket surface shared by browsers and React Native. */
export interface WsLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface MultiplayerClientOptions {
  url: string;
  /** Fetches a single-use WebSocket ticket from the authenticated REST API. */
  getTicket(): Promise<string>;
  createSocket(url: string): WsLike;
  onRoom?(room: RoomSnapshot | null): void;
  onState?(state: ConnectionState): void;
  onError?(code: MpErrorCode, message: string): void;
  /** Reconnect backoff schedule (ms). */
  backoff?: number[];
}

let counter = 0;
export const newActionId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Real-time client: authenticates with a one-time ticket, keeps the latest authoritative room
 * snapshot, and rejoins the room automatically after a dropped connection or server restart.
 */
export class MultiplayerClient {
  private ws: WsLike | null = null;
  private attempts = 0;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, { resolve(): void; reject(e: Error): void }>();
  room: RoomSnapshot | null = null;
  roomCode: string | null = null;
  state: ConnectionState = 'idle';
  userId: string | null = null;

  constructor(private opts: MultiplayerClientOptions) {}

  private setState(s: ConnectionState) { this.state = s; this.opts.onState?.(s); }

  async connect(): Promise<void> {
    this.stopped = false;
    this.setState(this.attempts ? 'reconnecting' : 'connecting');
    let ticket: string;
    try { ticket = await this.opts.getTicket(); } catch (e) { this.scheduleReconnect(); throw e; }
    return new Promise((resolve, reject) => {
      const ws = this.opts.createSocket(this.opts.url);
      this.ws = ws;
      let welcomed = false;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ticket } satisfies ClientMessage));
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try { msg = JSON.parse(String(ev.data)); } catch { return; }
        if (msg.type === 'welcome') {
          welcomed = true; this.attempts = 0; this.userId = msg.userId; this.setState('online'); resolve();
          if (this.roomCode) void this.send({ type: 'join', id: newActionId(), code: this.roomCode }).catch(() => undefined);
        } else this.handle(msg);
      };
      ws.onerror = () => undefined;
      ws.onclose = (ev) => {
        this.ws = null;
        for (const p of this.pending.values()) p.reject(new Error('disconnected'));
        this.pending.clear();
        if (!welcomed) reject(new Error(ev.reason || 'connection failed'));
        if (ev.code === 4001) { this.setState('offline'); this.opts.onError?.('unauthorized', ev.reason ?? 'unauthorized'); return; }
        if (!this.stopped) this.scheduleReconnect();
        else this.setState('idle');
      };
    });
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    const steps = this.opts.backoff ?? [500, 1000, 2000, 4000, 8000, 15000];
    const delay = steps[Math.min(this.attempts, steps.length - 1)]!;
    this.attempts++;
    this.setState('reconnecting');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.connect().catch(() => undefined); }, delay);
  }

  private handle(msg: ServerMessage) {
    switch (msg.type) {
      case 'room': this.room = msg.room; this.roomCode = msg.room.code; this.opts.onRoom?.(msg.room); break;
      case 'left': this.room = null; this.roomCode = null; this.opts.onRoom?.(null); break;
      case 'ack': this.pending.get(msg.id)?.resolve(); this.pending.delete(msg.id); break;
      case 'error':
        if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)!.reject(Object.assign(new Error(msg.message), { code: msg.code })); this.pending.delete(msg.id); }
        if (msg.code === 'kicked' || msg.code === 'room_not_found') { this.room = null; this.roomCode = null; this.opts.onRoom?.(null); }
        this.opts.onError?.(msg.code, msg.message);
        break;
      default: break;
    }
  }

  /** Sends an action and resolves when the server acknowledges it (rejects with the server error). */
  send(msg: Exclude<ClientMessage, { type: 'auth' }>): Promise<void> {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1) return Promise.reject(new Error('not connected'));
    return new Promise((resolve, reject) => {
      this.pending.set(msg.id, { resolve, reject });
      ws.send(JSON.stringify(msg));
    });
  }

  create(game: MpGameId, maxPlayers: number) { return this.send({ type: 'create', id: newActionId(), game, maxPlayers }); }
  join(code: string) { this.roomCode = code; return this.send({ type: 'join', id: newActionId(), code }); }
  leave() { const p = this.send({ type: 'leave', id: newActionId() }); this.roomCode = null; return p; }
  ready(ready: boolean) { return this.send({ type: 'ready', id: newActionId(), ready }); }
  select(game: MpGameId, maxPlayers?: number) { return this.send({ type: 'select', id: newActionId(), game, maxPlayers }); }
  kick(userId: string) { return this.send({ type: 'kick', id: newActionId(), userId }); }
  start() { return this.send({ type: 'start', id: newActionId() }); }
  rematch() { return this.send({ type: 'rematch', id: newActionId() }); }
  move(move: MpMove) { return this.send({ type: 'move', id: newActionId(), step: this.room?.view?.step ?? -1, move }); }

  close() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close(1000, 'bye');
    this.ws = null;
    this.setState('idle');
  }
}
