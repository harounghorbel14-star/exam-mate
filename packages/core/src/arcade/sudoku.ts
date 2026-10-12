import { mulberry32, shuffle } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

/** 81 cells, 0 = empty. */
export type SudokuGrid = number[];

export interface SudokuState {
  puzzle: SudokuGrid;
  solution: SudokuGrid;
  values: SudokuGrid;
  notes: number[][];
  mistakes: number;
  maxMistakes: number;
  hintsUsed: number;
  status: 'playing' | 'won' | 'lost';
  difficulty: ArcadeDifficulty;
}

const CLUES: Record<ArcadeDifficulty, number> = { easy: 40, medium: 32, hard: 26 };

export function sudokuCandidates(g: SudokuGrid, i: number): number[] {
  const r = Math.floor(i / 9), c = i % 9, used = new Set<number>();
  for (let k = 0; k < 9; k++) { used.add(g[r * 9 + k]!); used.add(g[k * 9 + c]!); }
  const br = r - (r % 3), bc = c - (c % 3);
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) used.add(g[(br + dr) * 9 + bc + dc]!);
  const out: number[] = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) out.push(v);
  return out;
}

/** True when no row, column or box contains a duplicate non-zero value. */
export function sudokuIsValid(g: SudokuGrid): boolean {
  if (g.length !== 81) return false;
  const units: number[][] = [];
  for (let k = 0; k < 9; k++) {
    units.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));
    units.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));
    const br = Math.floor(k / 3) * 3, bc = (k % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, j) => (br + Math.floor(j / 3)) * 9 + bc + (j % 3)));
  }
  return units.every((u) => {
    const vals = u.map((i) => g[i]!).filter((v) => v !== 0);
    return vals.every((v) => v >= 1 && v <= 9) && new Set(vals).size === vals.length;
  });
}

/** Counts solutions up to `limit` (backtracking with minimum-remaining-values). */
export function sudokuCountSolutions(g: SudokuGrid, limit = 2): number {
  const grid = [...g];
  let count = 0;
  const solve = (): boolean => {
    let best = -1, bestCands: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const c = sudokuCandidates(grid, i);
      if (c.length === 0) return false;
      if (best < 0 || c.length < bestCands.length) { best = i; bestCands = c; if (c.length === 1) break; }
    }
    if (best < 0) { count++; return count >= limit; }
    for (const v of bestCands) {
      grid[best] = v;
      if (solve()) return true;
    }
    grid[best] = 0;
    return false;
  };
  if (!sudokuIsValid(grid)) return 0;
  solve();
  return count;
}

export function sudokuSolve(g: SudokuGrid): SudokuGrid | null {
  const grid = [...g];
  const solve = (): boolean => {
    const i = grid.indexOf(0);
    if (i < 0) return true;
    for (const v of sudokuCandidates(grid, i)) { grid[i] = v; if (solve()) return true; }
    grid[i] = 0;
    return false;
  };
  return sudokuIsValid(grid) && solve() ? grid : null;
}

function fullGrid(rng: () => number): SudokuGrid {
  const grid: SudokuGrid = Array(81).fill(0);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    for (const v of shuffle(sudokuCandidates(grid, i), rng)) { grid[i] = v; if (fill(i + 1)) return true; }
    grid[i] = 0;
    return false;
  };
  fill(0);
  return grid;
}

/** Generates a puzzle with exactly one solution (verified by the solution counter after each removal). */
export function sudokuGenerate(difficulty: ArcadeDifficulty, seed: number): { puzzle: SudokuGrid; solution: SudokuGrid } {
  const rng = mulberry32(seed);
  const solution = fullGrid(rng);
  const puzzle = [...solution];
  let clues = 81;
  for (const i of shuffle(Array.from({ length: 81 }, (_, k) => k), rng)) {
    if (clues <= CLUES[difficulty]) break;
    const keep = puzzle[i]!;
    puzzle[i] = 0;
    if (sudokuCountSolutions(puzzle, 2) !== 1) puzzle[i] = keep;
    else clues--;
  }
  return { puzzle, solution };
}

export function sudokuNew(difficulty: ArcadeDifficulty, seed: number, maxMistakes = 3): SudokuState {
  const { puzzle, solution } = sudokuGenerate(difficulty, seed);
  return { puzzle, solution, values: [...puzzle], notes: Array.from({ length: 81 }, () => []), mistakes: 0, maxMistakes, hintsUsed: 0, status: 'playing', difficulty };
}

/** Enter a value (0 clears). Wrong values are rejected and count as a mistake. */
export function sudokuEnter(s: SudokuState, i: number, v: number): { state: SudokuState; correct: boolean | null } {
  if (s.status !== 'playing' || s.puzzle[i] || i < 0 || i > 80 || v < 0 || v > 9) return { state: s, correct: null };
  if (v === 0) { const values = [...s.values]; values[i] = 0; return { state: { ...s, values }, correct: null }; }
  if (s.solution[i] !== v) {
    const mistakes = s.mistakes + 1;
    return { state: { ...s, mistakes, status: mistakes >= s.maxMistakes ? 'lost' : 'playing' }, correct: false };
  }
  const values = [...s.values]; values[i] = v;
  const notes = s.notes.map((n, j) => (j === i ? [] : n));
  return { state: { ...s, values, notes, status: values.every((x, j) => x === s.solution[j]) ? 'won' : 'playing' }, correct: true };
}

export function sudokuToggleNote(s: SudokuState, i: number, v: number): SudokuState {
  if (s.status !== 'playing' || s.values[i] || v < 1 || v > 9) return s;
  const notes = s.notes.map((n, j) => (j === i ? (n.includes(v) ? n.filter((x) => x !== v) : [...n, v].sort()) : n));
  return { ...s, notes };
}

/** Fills one empty cell (the selected one when empty, otherwise the most constrained one). */
export function sudokuHint(s: SudokuState, preferred?: number): { state: SudokuState; cell: number | null } {
  if (s.status !== 'playing') return { state: s, cell: null };
  let cell = preferred !== undefined && s.values[preferred] === 0 ? preferred : -1;
  if (cell < 0) {
    let bestN = 10;
    for (let i = 0; i < 81; i++) if (!s.values[i]) { const n = sudokuCandidates(s.values, i).length; if (n < bestN) { bestN = n; cell = i; } }
  }
  if (cell < 0) return { state: s, cell: null };
  const r = sudokuEnter({ ...s, hintsUsed: s.hintsUsed + 1 }, cell, s.solution[cell]!);
  return { state: r.state, cell };
}

/** Indices whose current value conflicts with another value in its row, column or box. */
export function sudokuConflicts(g: SudokuGrid): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < 81; i++) {
    const v = g[i]!;
    if (!v) continue;
    const r = Math.floor(i / 9), c = i % 9;
    for (let j = 0; j < 81; j++) {
      if (j === i || g[j] !== v) continue;
      const rj = Math.floor(j / 9), cj = j % 9;
      if (rj === r || cj === c || (Math.floor(rj / 3) === Math.floor(r / 3) && Math.floor(cj / 3) === Math.floor(c / 3))) out.add(i);
    }
  }
  return out;
}
