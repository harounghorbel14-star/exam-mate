import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export const C4_ROWS = 6;
export const C4_COLS = 7;
export type C4Player = 1 | 2;
export interface C4State { board: number[][]; turn: C4Player; result: C4Player | 'draw' | null; line: Array<[number, number]> | null; lastMove: [number, number] | null; moves: number }

export function c4New(first: C4Player = 1): C4State {
  return { board: Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(0)), turn: first, result: null, line: null, lastMove: null, moves: 0 };
}

export function c4LegalCols(s: Pick<C4State, 'board'>): number[] {
  return [...Array(C4_COLS).keys()].filter((c) => s.board[0]![c] === 0);
}

const DIRS: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function c4FindLine(board: number[][], r: number, c: number): Array<[number, number]> | null {
  const p = board[r]![c]!;
  if (!p) return null;
  for (const [dr, dc] of DIRS) {
    const cells: Array<[number, number]> = [[r, c]];
    for (const sign of [1, -1]) {
      let rr = r + dr * sign, cc = c + dc * sign;
      while (rr >= 0 && rr < C4_ROWS && cc >= 0 && cc < C4_COLS && board[rr]![cc] === p) { cells.push([rr, cc]); rr += dr * sign; cc += dc * sign; }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

export function c4Drop(s: C4State, col: number): C4State {
  if (s.result) throw new Error('Game over');
  if (!Number.isInteger(col) || col < 0 || col >= C4_COLS || s.board[0]![col] !== 0) throw new Error('Illegal move');
  const board = s.board.map((row) => [...row]);
  let r = C4_ROWS - 1;
  while (board[r]![col] !== 0) r--;
  board[r]![col] = s.turn;
  const line = c4FindLine(board, r, col);
  const full = board[0]!.every((x) => x !== 0);
  return { board, turn: s.turn === 1 ? 2 : 1, result: line ? s.turn : full ? 'draw' : null, line, lastMove: [r, col], moves: s.moves + 1 };
}

function scoreWindow(w: number[], me: number): number {
  const mine = w.filter((x) => x === me).length, theirs = w.filter((x) => x !== 0 && x !== me).length, empty = 4 - mine - theirs;
  if (mine === 4) return 1000;
  if (mine === 3 && empty === 1) return 5;
  if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -4;
  return 0;
}

function heuristic(board: number[][], me: number): number {
  let score = 0;
  for (let r = 0; r < C4_ROWS; r++) score += board[r]![3] === me ? 3 : 0;
  for (let r = 0; r < C4_ROWS; r++) for (let c = 0; c < C4_COLS; c++) for (const [dr, dc] of DIRS) {
    const w: number[] = [];
    for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS) break; w.push(board[rr]![cc]!); }
    if (w.length === 4) score += scoreWindow(w, me);
  }
  return score;
}

function negamax(s: C4State, depth: number, alpha: number, beta: number, me: C4Player): number {
  if (s.result === 'draw') return 0;
  if (s.result) return s.result === me ? 100000 + depth : -100000 - depth;
  if (depth === 0) return heuristic(s.board, me) - heuristic(s.board, me === 1 ? 2 : 1);
  const maximizing = s.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const c of [3, 2, 4, 1, 5, 0, 6].filter((x) => s.board[0]![x] === 0)) {
    const v = negamax(c4Drop(s, c), depth - 1, alpha, beta, me);
    if (maximizing) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}

/** Alpha-beta search; depth 1 / 4 / 6 by difficulty. Easy also plays randomly 40% of the time. */
export function c4AiMove(s: C4State, difficulty: ArcadeDifficulty, seed: number): number {
  const rng = mulberry32(seed);
  const legal = c4LegalCols(s);
  if (!legal.length) throw new Error('No moves');
  if (difficulty === 'easy' && rng() < 0.4) return legal[Math.floor(rng() * legal.length)]!;
  const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 4 : 6;
  let best = -Infinity, bestCols: number[] = [];
  for (const c of legal) {
    const v = negamax(c4Drop(s, c), depth - 1, -Infinity, Infinity, s.turn);
    if (v > best) { best = v; bestCols = [c]; } else if (v === best) bestCols.push(c);
  }
  return bestCols[Math.floor(rng() * bestCols.length)]!;
}
