import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

/** 8×8 board; 0 empty, 1/2 men, 3/4 kings of player 1/2. Player 1 starts at the bottom and moves up. */
export type CheckersPiece = 0 | 1 | 2 | 3 | 4;
export interface CheckersMove { from: number; path: number[]; captures: number[] }
export interface CheckersState {
  board: CheckersPiece[];
  turn: 1 | 2;
  winner: 1 | 2 | 'draw' | null;
  /** Plies since the last capture or man move (draw at 80 = 40 moves each). */
  quietPlies: number;
  moves: number;
  last: CheckersMove | null;
}

export const checkersOwner = (p: CheckersPiece): 0 | 1 | 2 => (p === 0 ? 0 : p === 1 || p === 3 ? 1 : 2);
const isKing = (p: CheckersPiece) => p === 3 || p === 4;
const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const idx = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

export function checkersNew(): CheckersState {
  const board: CheckersPiece[] = Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const [r, c] = rc(i);
    if ((r + c) % 2 === 1) { if (r < 3) board[i] = 2; else if (r > 4) board[i] = 1; }
  }
  return { board, turn: 1, winner: null, quietPlies: 0, moves: 0, last: null };
}

function dirs(p: CheckersPiece): Array<[number, number]> {
  if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return checkersOwner(p) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

function jumpsFrom(board: CheckersPiece[], from: number, piece: CheckersPiece, captured: number[]): CheckersMove[] {
  const [r, c] = rc(from);
  const out: CheckersMove[] = [];
  for (const [dr, dc] of dirs(piece)) {
    const mid = idx(r + dr, c + dc), land = idx(r + 2 * dr, c + 2 * dc);
    if (mid < 0 || land < 0 || board[land] !== 0 || captured.includes(mid)) continue;
    const o = checkersOwner(board[mid]!);
    if (o === 0 || o === checkersOwner(piece)) continue;
    const [lr] = rc(land);
    const promotes = !isKing(piece) && ((checkersOwner(piece) === 1 && lr === 0) || (checkersOwner(piece) === 2 && lr === 7));
    // Promotion ends the turn (standard rule), otherwise continue jumping.
    const b2 = [...board]; b2[from] = 0; b2[land] = piece;
    const further = promotes ? [] : jumpsFrom(b2, land, piece, [...captured, mid]);
    if (further.length) for (const f of further) out.push({ from, path: [land, ...f.path], captures: [mid, ...f.captures] });
    else out.push({ from, path: [land], captures: [mid] });
  }
  return out;
}

/** All legal moves; captures are mandatory (any capture sequence may be chosen). */
export function checkersLegalMoves(s: CheckersState, onlyFrom?: number): CheckersMove[] {
  const jumps: CheckersMove[] = [], steps: CheckersMove[] = [];
  for (let i = 0; i < 64; i++) {
    const p = s.board[i]!;
    if (checkersOwner(p) !== s.turn) continue;
    jumps.push(...jumpsFrom(s.board, i, p, []));
    const [r, c] = rc(i);
    for (const [dr, dc] of dirs(p)) { const t = idx(r + dr, c + dc); if (t >= 0 && s.board[t] === 0) steps.push({ from: i, path: [t], captures: [] }); }
  }
  const all = jumps.length ? jumps : steps;
  return onlyFrom === undefined ? all : all.filter((m) => m.from === onlyFrom);
}

export function checkersApply(s: CheckersState, m: CheckersMove): CheckersState {
  if (s.winner) throw new Error('Game over');
  const legal = checkersLegalMoves(s).find((x) => x.from === m.from && x.path.length === m.path.length && x.path.every((p, i) => p === m.path[i]));
  if (!legal) throw new Error('Illegal move');
  const board = [...s.board];
  let piece = board[legal.from]!;
  board[legal.from] = 0;
  for (const cap of legal.captures) board[cap] = 0;
  const dest = legal.path[legal.path.length - 1]!;
  const [dr] = rc(dest);
  if (piece === 1 && dr === 0) piece = 3;
  if (piece === 2 && dr === 7) piece = 4;
  board[dest] = piece;
  const manMove = s.board[legal.from] === 1 || s.board[legal.from] === 2;
  const quietPlies = legal.captures.length || manMove ? 0 : s.quietPlies + 1;
  const next: CheckersState = { board, turn: s.turn === 1 ? 2 : 1, winner: null, quietPlies, moves: s.moves + 1, last: legal };
  if (checkersLegalMoves(next).length === 0) next.winner = s.turn; // opponent has no pieces or is blocked
  else if (quietPlies >= 80) next.winner = 'draw';
  return next;
}

function evaluate(board: CheckersPiece[], me: 1 | 2): number {
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i]!;
    if (!p) continue;
    const [r] = rc(i);
    const val = isKing(p) ? 3 : 1 + (checkersOwner(p) === 1 ? (7 - r) : r) * 0.05;
    v += checkersOwner(p) === me ? val : -val;
  }
  return v;
}

function search(s: CheckersState, depth: number, alpha: number, beta: number, me: 1 | 2): number {
  if (s.winner) return s.winner === 'draw' ? 0 : s.winner === me ? 1000 + depth : -1000 - depth;
  if (depth === 0) return evaluate(s.board, me);
  const moves = checkersLegalMoves(s);
  if (s.turn === me) {
    let best = -Infinity;
    for (const m of moves) { best = Math.max(best, search(checkersApply(s, m), depth - 1, alpha, beta, me)); alpha = Math.max(alpha, best); if (alpha >= beta) break; }
    return best;
  }
  let best = Infinity;
  for (const m of moves) { best = Math.min(best, search(checkersApply(s, m), depth - 1, alpha, beta, me)); beta = Math.min(beta, best); if (alpha >= beta) break; }
  return best;
}

/** easy: random legal; medium: depth-2 search; hard: depth-5 alpha-beta. */
export function checkersAiMove(s: CheckersState, difficulty: ArcadeDifficulty, seed: number): CheckersMove {
  const moves = checkersLegalMoves(s);
  if (!moves.length) throw new Error('No moves');
  const rng = mulberry32(seed);
  if (difficulty === 'easy') return moves[Math.floor(rng() * moves.length)]!;
  const depth = difficulty === 'medium' ? 2 : 5;
  let best = -Infinity, choices: CheckersMove[] = [];
  for (const m of moves) {
    const v = search(checkersApply(s, m), depth - 1, -Infinity, Infinity, s.turn);
    if (v > best + 1e-9) { best = v; choices = [m]; } else if (Math.abs(v - best) <= 1e-9) choices.push(m);
  }
  return choices[Math.floor(rng() * choices.length)]!;
}
