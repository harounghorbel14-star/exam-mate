import { isMpGameId, type MpGameId, type MpMove, type MpView } from './games.js';

/** Room codes avoid look-alike characters (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const isRoomCode = (x: unknown): x is string => typeof x === 'string' && new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(x);
export const normalizeRoomCode = (x: string) => x.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

export const MP_MAX_MESSAGE_BYTES = 4096;
export const MP_AVATARS = ['🦊', '🐼', '🐸', '🐙', '🦉', '🐯', '🐨', '🦄', '🐝', '🐳', '🦁', '🐧'];

export type ClientMessage =
  | { type: 'auth'; ticket: string }
  | { type: 'create'; id: string; game: MpGameId; maxPlayers: number }
  | { type: 'join'; id: string; code: string }
  | { type: 'leave'; id: string }
  | { type: 'ready'; id: string; ready: boolean }
  | { type: 'select'; id: string; game: MpGameId; maxPlayers?: number }
  | { type: 'kick'; id: string; userId: string }
  | { type: 'start'; id: string }
  | { type: 'move'; id: string; step: number; move: MpMove }
  | { type: 'rematch'; id: string }
  | { type: 'ping'; id: string };

export interface MpPlayer { userId: string; name: string; avatar: string; seat: number; ready: boolean; connected: boolean; host: boolean }
export interface RoomSnapshot {
  code: string;
  game: MpGameId;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  hostId: string;
  players: MpPlayer[];
  seq: number;
  mySeat: number | null;
  view: MpView | null;
  serverTime: number;
}

export type ServerMessage =
  | { type: 'welcome'; userId: string; name: string }
  | { type: 'room'; room: RoomSnapshot }
  | { type: 'ack'; id: string; duplicate?: boolean }
  | { type: 'error'; id?: string; code: MpErrorCode; message: string }
  | { type: 'left' }
  | { type: 'pong'; id: string; serverTime: number };

export type MpErrorCode =
  | 'unauthorized' | 'bad_request' | 'rate_limited' | 'room_not_found' | 'room_full' | 'already_started' | 'not_host'
  | 'not_in_room' | 'not_ready' | 'not_enough_players' | 'not_your_turn' | 'illegal_move' | 'stale' | 'game_over' | 'bad_move' | 'kicked';

const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;
const actionId = (v: unknown) => str(v, 40) && /^[\w-]+$/.test(v as string);

/** Strict structural validation of untrusted client input. Returns null for anything malformed. */
export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MP_MAX_MESSAGE_BYTES) return null;
  let m: Record<string, unknown>;
  try { m = JSON.parse(raw); } catch { return null; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const id = m.id;
  switch (m.type) {
    case 'auth': return str(m.ticket, 128) ? { type: 'auth', ticket: m.ticket as string } : null;
    case 'create': return actionId(id) && isMpGameId(m.game) && Number.isInteger(m.maxPlayers) ? { type: 'create', id: id as string, game: m.game, maxPlayers: m.maxPlayers as number } : null;
    case 'join': return actionId(id) && typeof m.code === 'string' && isRoomCode(normalizeRoomCode(m.code)) ? { type: 'join', id: id as string, code: normalizeRoomCode(m.code) } : null;
    case 'leave': case 'start': case 'rematch': case 'ping': return actionId(id) ? { type: m.type, id: id as string } : null;
    case 'ready': return actionId(id) && typeof m.ready === 'boolean' ? { type: 'ready', id: id as string, ready: m.ready } : null;
    case 'select': return actionId(id) && isMpGameId(m.game) && (m.maxPlayers === undefined || Number.isInteger(m.maxPlayers)) ? { type: 'select', id: id as string, game: m.game, maxPlayers: m.maxPlayers as number | undefined } : null;
    case 'kick': return actionId(id) && str(m.userId, 64) ? { type: 'kick', id: id as string, userId: m.userId as string } : null;
    case 'move': {
      if (!actionId(id) || !Number.isInteger(m.step) || !m.move || typeof m.move !== 'object' || Array.isArray(m.move)) return null;
      const mv = m.move as Record<string, unknown>;
      const keys = Object.keys(mv);
      const okNum = (k: string) => Number.isInteger(mv[k]) && (mv[k] as number) >= 0 && (mv[k] as number) < 100;
      const valid =
        (keys.length === 1 && keys[0] === 'cell' && okNum('cell')) ||
        (keys.length === 1 && keys[0] === 'col' && okNum('col')) ||
        (keys.length === 1 && keys[0] === 'card' && okNum('card')) ||
        (keys.length === 1 && keys[0] === 'tap' && mv.tap === true) ||
        (keys.length === 1 && keys[0] === 'choice' && (okNum('choice') || ['rock', 'paper', 'scissors'].includes(mv.choice as string))) ||
        (keys.length === 2 && okNum('from') && Array.isArray(mv.path) && mv.path.length >= 1 && mv.path.length <= 12 && (mv.path as unknown[]).every((p) => Number.isInteger(p) && (p as number) >= 0 && (p as number) < 64));
      return valid ? { type: 'move', id: id as string, step: m.step as number, move: mv as MpMove } : null;
    }
    default: return null;
  }
}

export function avatarFor(userId: string): string {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MP_AVATARS[h % MP_AVATARS.length]!;
}
