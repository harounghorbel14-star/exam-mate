import { mulberry32, shuffle } from '../exam/grading.js';

export const MEMORY_GRIDS = { '3x4': { cols: 4, rows: 3 }, '4x4': { cols: 4, rows: 4 }, '4x5': { cols: 5, rows: 4 }, '6x6': { cols: 6, rows: 6 } } as const;
export type MemoryGrid = keyof typeof MEMORY_GRIDS;
export const MEMORY_SYMBOLS = ['🍎', '🚀', '🐙', '🎈', '🌵', '🎲', '🦊', '⚽', '🍩', '🎸', '🐢', '🌈', '🍉', '🧩', '🦋', '🔔', '🍄', '⭐'];

export interface MMCard { id: number; symbol: string; matched: boolean }
export interface MMState {
  grid: MemoryGrid; cards: MMCard[]; open: number[]; moves: number; matches: number; misses: number;
  startedAt: number | null; finishedAt: number | null; players: number; turn: number; scores: number[];
}

export function mmNew(grid: MemoryGrid, seed: number, players = 1): MMState {
  const { cols, rows } = MEMORY_GRIDS[grid];
  const pairs = (cols * rows) / 2;
  const symbols = shuffle(MEMORY_SYMBOLS, mulberry32(seed)).slice(0, pairs);
  const cards = shuffle([...symbols, ...symbols], mulberry32(seed ^ 0x9e3779b9)).map((symbol, id) => ({ id, symbol, matched: false }));
  return { grid, cards, open: [], moves: 0, matches: 0, misses: 0, startedAt: null, finishedAt: null, players, turn: 0, scores: Array(players).fill(0) };
}

/**
 * Flip a card. When two cards are already open and unmatched, the next flip closes them first.
 * A "move" is counted for each pair attempt. In multi-player, a miss passes the turn.
 */
export function mmFlip(s: MMState, id: number, now: number): { state: MMState; match: boolean | null } {
  if (s.finishedAt !== null) return { state: s, match: null };
  let open = s.open.length >= 2 ? [] : s.open;
  const card = s.cards[id];
  if (!card || card.matched || open.includes(id)) return { state: s, match: null };
  open = [...open, id];
  const base = { ...s, open, startedAt: s.startedAt ?? now };
  if (open.length < 2) return { state: base, match: null };
  const [a, b] = open as [number, number];
  const match = s.cards[a]!.symbol === s.cards[b]!.symbol;
  const cards = match ? s.cards.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)) : s.cards;
  const scores = match ? s.scores.map((v, i) => (i === s.turn ? v + 1 : v)) : s.scores;
  const matches = s.matches + (match ? 1 : 0);
  const done = matches === s.cards.length / 2;
  return {
    state: { ...base, cards, open: match ? [] : open, moves: s.moves + 1, matches, misses: s.misses + (match ? 0 : 1), scores, turn: match ? s.turn : (s.turn + 1) % s.players, finishedAt: done ? now : null },
    match,
  };
}

/** Score for single player: fewer moves and less time is better. */
export function mmScore(s: MMState): number {
  if (s.finishedAt === null || s.startedAt === null) return 0;
  const pairs = s.cards.length / 2;
  const secs = (s.finishedAt - s.startedAt) / 1000;
  return Math.max(0, Math.round(pairs * 100 - (s.moves - pairs) * 10 - secs));
}
