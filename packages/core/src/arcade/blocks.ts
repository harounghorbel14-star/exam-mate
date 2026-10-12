import { mulberry32, shuffle } from '../exam/grading.js';

/** Falling-block puzzle (original implementation): 10×20 well, seven 4-cell pieces, 7-bag randomiser. */
export const BLOCKS_W = 10;
export const BLOCKS_H = 20;
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECE_KINDS: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const SHAPES: Record<PieceKind, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

export function rotateMatrix(m: number[][], times: number): number[][] {
  let r = m;
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) r = r[0]!.map((_, c) => r.map((row) => row[c]!).reverse());
  return r;
}

export interface Piece { kind: PieceKind; rot: number; x: number; y: number }
export interface BlocksState { board: number[][]; piece: Piece; queue: PieceKind[]; hold: PieceKind | null; canHold: boolean; score: number; lines: number; level: number; over: boolean; seed: number; bags: number }

export function pieceCells(p: Piece): Array<[number, number]> {
  const m = rotateMatrix(SHAPES[p.kind], p.rot);
  const out: Array<[number, number]> = [];
  m.forEach((row, r) => row.forEach((v, c) => { if (v) out.push([p.y + r, p.x + c]); }));
  return out;
}

function fits(board: number[][], p: Piece): boolean {
  return pieceCells(p).every(([r, c]) => c >= 0 && c < BLOCKS_W && r < BLOCKS_H && (r < 0 || board[r]![c] === 0));
}

function refill(s: Pick<BlocksState, 'queue' | 'seed' | 'bags'>): { queue: PieceKind[]; bags: number } {
  let { queue, bags } = s;
  while (queue.length < 7) { queue = [...queue, ...shuffle(PIECE_KINDS, mulberry32(s.seed + bags * 104729))]; bags++; }
  return { queue, bags };
}

function spawn(kind: PieceKind): Piece {
  return { kind, rot: 0, x: kind === 'O' ? 4 : 3, y: kind === 'I' ? -1 : 0 };
}

export function blocksNew(seed: number): BlocksState {
  const { queue, bags } = refill({ queue: [], seed, bags: 0 });
  const [first, ...rest] = queue;
  return { board: Array.from({ length: BLOCKS_H }, () => Array(BLOCKS_W).fill(0)), piece: spawn(first!), queue: rest, hold: null, canHold: true, score: 0, lines: 0, level: 1, over: false, seed, bags };
}

/** Gravity interval in ms for the current level. */
export function blocksInterval(level: number): number {
  return Math.max(70, Math.round(800 * Math.pow(0.85, level - 1)));
}

export function blocksMove(s: BlocksState, dx: number): BlocksState {
  if (s.over) return s;
  const p = { ...s.piece, x: s.piece.x + dx };
  return fits(s.board, p) ? { ...s, piece: p } : s;
}

/** Rotate with simple wall kicks (0, ±1, ±2 columns, then one row up). */
export function blocksRotate(s: BlocksState, dir: 1 | -1 = 1): BlocksState {
  if (s.over || s.piece.kind === 'O') return s;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]] as const) {
    const p = { ...s.piece, rot: s.piece.rot + dir, x: s.piece.x + dx, y: s.piece.y + dy };
    if (fits(s.board, p)) return { ...s, piece: p };
  }
  return s;
}

const LINE_POINTS = [0, 100, 300, 500, 800];

function lockPiece(s: BlocksState): BlocksState {
  const board = s.board.map((r) => [...r]);
  const color = PIECE_KINDS.indexOf(s.piece.kind) + 1;
  let toppedOut = false;
  for (const [r, c] of pieceCells(s.piece)) { if (r < 0) toppedOut = true; else board[r]![c] = color; }
  const kept = board.filter((row) => row.some((v) => v === 0));
  const cleared = BLOCKS_H - kept.length;
  const newBoard = [...Array.from({ length: cleared }, () => Array(BLOCKS_W).fill(0)), ...kept];
  const lines = s.lines + cleared;
  const score = s.score + LINE_POINTS[cleared]! * s.level;
  const level = 1 + Math.floor(lines / 10);
  const { queue, bags } = refill(s);
  const [next, ...rest] = queue;
  const piece = spawn(next!);
  const over = toppedOut || !fits(newBoard, piece);
  return { ...s, board: newBoard, piece, queue: rest, bags, lines, score, level, over, canHold: true };
}

/** One gravity step: move down, or lock the piece and spawn the next one. */
export function blocksTick(s: BlocksState): BlocksState {
  if (s.over) return s;
  const p = { ...s.piece, y: s.piece.y + 1 };
  return fits(s.board, p) ? { ...s, piece: p } : lockPiece(s);
}

export function blocksSoftDrop(s: BlocksState): BlocksState {
  if (s.over) return s;
  const p = { ...s.piece, y: s.piece.y + 1 };
  return fits(s.board, p) ? { ...s, piece: p, score: s.score + 1 } : lockPiece(s);
}

export function blocksGhostY(s: BlocksState): number {
  let y = s.piece.y;
  while (fits(s.board, { ...s.piece, y: y + 1 })) y++;
  return y;
}

export function blocksHardDrop(s: BlocksState): BlocksState {
  if (s.over) return s;
  const y = blocksGhostY(s);
  return lockPiece({ ...s, piece: { ...s.piece, y }, score: s.score + 2 * (y - s.piece.y) });
}

export function blocksHold(s: BlocksState): BlocksState {
  if (s.over || !s.canHold) return s;
  if (s.hold) return { ...s, hold: s.piece.kind, piece: spawn(s.hold), canHold: false };
  const { queue, bags } = refill(s);
  const [next, ...rest] = queue;
  return { ...s, hold: s.piece.kind, piece: spawn(next!), queue: rest, bags, canHold: false };
}
