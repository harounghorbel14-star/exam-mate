import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export interface MineCell { mine: boolean; adjacent: number; revealed: boolean; flagged: boolean }
export interface MinesState {
  w: number; h: number; mines: number; seed: number;
  /** Mines are placed lazily on the first reveal so the first click is always safe (and opens an area). */
  placed: boolean;
  cells: MineCell[];
  status: 'ready' | 'playing' | 'won' | 'lost';
  revealedCount: number;
  flags: number;
  exploded: number | null;
}

export const MINES_PRESETS: Record<ArcadeDifficulty, { w: number; h: number; mines: number }> = {
  easy: { w: 9, h: 9, mines: 10 },
  medium: { w: 12, h: 12, mines: 24 },
  hard: { w: 16, h: 16, mines: 40 },
};

export function minesNew(difficulty: ArcadeDifficulty, seed: number, custom?: { w: number; h: number; mines: number }): MinesState {
  const { w, h, mines } = custom ?? MINES_PRESETS[difficulty];
  if (w < 4 || h < 4 || mines < 1 || mines > w * h - 9) throw new Error('Invalid minefield size');
  return {
    w, h, mines, seed, placed: false, status: 'ready', revealedCount: 0, flags: 0, exploded: null,
    cells: Array.from({ length: w * h }, () => ({ mine: false, adjacent: 0, revealed: false, flagged: false })),
  };
}

export function minesNeighbors(s: Pick<MinesState, 'w' | 'h'>, i: number): number[] {
  const x = i % s.w, y = Math.floor(i / s.w), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.w && ny < s.h) out.push(ny * s.w + nx);
  }
  return out;
}

function placeMines(s: MinesState, safe: number): MineCell[] {
  const excluded = new Set([safe, ...minesNeighbors(s, safe)]);
  const candidates: number[] = [];
  for (let i = 0; i < s.w * s.h; i++) if (!excluded.has(i)) candidates.push(i);
  const rng = mulberry32(s.seed);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  const mineSet = new Set(candidates.slice(0, s.mines));
  return s.cells.map((c, i) => ({
    ...c, mine: mineSet.has(i),
    adjacent: minesNeighbors(s, i).filter((n) => mineSet.has(n)).length,
  }));
}

/** Reveal a cell; zero cells flood-fill. Revealing a mine loses; revealing every safe cell wins. */
export function minesReveal(s: MinesState, i: number): MinesState {
  if (s.status === 'won' || s.status === 'lost' || i < 0 || i >= s.cells.length) return s;
  let cells = s.placed ? s.cells.map((c) => ({ ...c })) : placeMines(s, i);
  const start = cells[i]!;
  if (start.revealed || start.flagged) return s;
  if (start.mine) {
    cells = cells.map((c) => (c.mine ? { ...c, revealed: true } : c));
    return { ...s, cells, placed: true, status: 'lost', exploded: i };
  }
  let revealedCount = s.revealedCount;
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    const c = cells[j]!;
    if (c.revealed || c.flagged || c.mine) continue;
    c.revealed = true;
    revealedCount++;
    if (c.adjacent === 0) for (const n of minesNeighbors(s, j)) if (!cells[n]!.revealed) stack.push(n);
  }
  const won = revealedCount === s.w * s.h - s.mines;
  if (won) cells = cells.map((c) => (c.mine ? { ...c, flagged: true } : c));
  return { ...s, cells, placed: true, revealedCount, status: won ? 'won' : 'playing', flags: won ? s.mines : s.flags };
}

export function minesToggleFlag(s: MinesState, i: number): MinesState {
  if (s.status === 'won' || s.status === 'lost') return s;
  const c = s.cells[i];
  if (!c || c.revealed) return s;
  const cells = s.cells.map((x, j) => (j === i ? { ...x, flagged: !x.flagged } : x));
  return { ...s, cells, flags: s.flags + (c.flagged ? -1 : 1) };
}

/** "Chord": on a revealed number whose flag count matches, reveal all unflagged neighbours. */
export function minesChord(s: MinesState, i: number): MinesState {
  const c = s.cells[i];
  if (!c || !c.revealed || c.adjacent === 0) return s;
  const ns = minesNeighbors(s, i);
  if (ns.filter((n) => s.cells[n]!.flagged).length !== c.adjacent) return s;
  let out = s;
  for (const n of ns) if (!out.cells[n]!.flagged && !out.cells[n]!.revealed) out = minesReveal(out, n);
  return out;
}
