import { mulberry32 } from '../exam/grading.js';

export type XO = 'X' | 'O';
export type TTTCell = XO | null;
export type ArcadeDifficulty = 'easy' | 'medium' | 'hard';

export interface TTTState { board: TTTCell[]; turn: XO; result: XO | 'draw' | null; line: number[] | null; moves: number }

export const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export function tttNew(first: XO = 'X'): TTTState {
  return { board: Array(9).fill(null), turn: first, result: null, line: null, moves: 0 };
}

export function tttWinner(b: TTTCell[]): { winner: XO | 'draw' | null; line: number[] | null } {
  for (const l of TTT_LINES) {
    const [a, c, d] = l as [number, number, number];
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a]!, line: l };
  }
  return { winner: b.every(Boolean) ? 'draw' : null, line: null };
}

export function tttPlay(s: TTTState, i: number): TTTState {
  if (s.result || i < 0 || i > 8 || s.board[i]) throw new Error('Illegal move');
  const board = [...s.board];
  board[i] = s.turn;
  const w = tttWinner(board);
  return { board, turn: s.turn === 'X' ? 'O' : 'X', result: w.winner, line: w.line, moves: s.moves + 1 };
}

function minimax(b: TTTCell[], me: XO, turn: XO, depth: number): number {
  const w = tttWinner(b).winner;
  if (w === me) return 10 - depth;
  if (w === 'draw') return 0;
  if (w) return depth - 10;
  const scores: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    scores.push(minimax(b, me, turn === 'X' ? 'O' : 'X', depth + 1));
    b[i] = null;
  }
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}

/** easy: random; medium: wins/blocks, otherwise random; hard: perfect minimax (never loses). */
export function tttAiMove(s: TTTState, difficulty: ArcadeDifficulty, seed: number): number {
  const rng = mulberry32(seed);
  const free = s.board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (free.length === 0) throw new Error('No moves');
  const me = s.turn, them: XO = me === 'X' ? 'O' : 'X';
  if (difficulty === 'easy') return free[Math.floor(rng() * free.length)]!;
  if (difficulty === 'medium') {
    for (const who of [me, them]) for (const i of free) {
      const b = [...s.board]; b[i] = who;
      if (tttWinner(b).winner === who) return i;
    }
    return free[Math.floor(rng() * free.length)]!;
  }
  let best = -Infinity, bestMoves: number[] = [];
  for (const i of free) {
    const b = [...s.board]; b[i] = me;
    const v = minimax(b, me, them, 1);
    if (v > best) { best = v; bestMoves = [i]; } else if (v === best) bestMoves.push(i);
  }
  return bestMoves[Math.floor(rng() * bestMoves.length)]!;
}
