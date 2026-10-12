import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';
import type { Dir, Pt } from './snake.js';

/** Wall bitmask per cell. */
export const WALL = { up: 1, right: 2, down: 4, left: 8 } as const;
const DELTA: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPP: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const MAZE_SIZES: Record<ArcadeDifficulty, { w: number; h: number; timeLimitSec: number }> = {
  easy: { w: 8, h: 8, timeLimitSec: 90 },
  medium: { w: 12, h: 12, timeLimitSec: 120 },
  hard: { w: 18, h: 18, timeLimitSec: 150 },
};

export interface MazeState {
  w: number; h: number; walls: number[]; player: Pt; exit: Pt; moves: number;
  status: 'playing' | 'won' | 'lost'; startedAt: number | null; finishedAt: number | null; timeLimitSec: number;
}

/** Perfect maze via iterative recursive-backtracker: every cell reachable, exactly one path between any two cells. */
export function mazeGenerate(w: number, h: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const walls = Array(w * h).fill(15);
  const seen = new Uint8Array(w * h);
  const stack = [0];
  seen[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const x = cur % w, y = Math.floor(cur / w);
    const options = (Object.keys(DELTA) as Dir[]).filter((d) => {
      const nx = x + DELTA[d].x, ny = y + DELTA[d].y;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
    });
    if (!options.length) { stack.pop(); continue; }
    const d = options[Math.floor(rng() * options.length)]!;
    const next = (y + DELTA[d].y) * w + x + DELTA[d].x;
    walls[cur] &= ~WALL[d];
    walls[next] &= ~WALL[OPP[d]];
    seen[next] = 1;
    stack.push(next);
  }
  return walls;
}

export function mazeCanMove(m: Pick<MazeState, 'w' | 'h' | 'walls'>, p: Pt, d: Dir): boolean {
  if (m.walls[p.y * m.w + p.x]! & WALL[d]) return false;
  const nx = p.x + DELTA[d].x, ny = p.y + DELTA[d].y;
  return nx >= 0 && ny >= 0 && nx < m.w && ny < m.h;
}

/** Shortest path (BFS) from `from` to `to`, inclusive; null if unreachable. */
export function mazeShortestPath(m: Pick<MazeState, 'w' | 'h' | 'walls'>, from: Pt, to: Pt): Pt[] | null {
  const prev = new Int32Array(m.w * m.h).fill(-2);
  const start = from.y * m.w + from.x, goal = to.y * m.w + to.x;
  prev[start] = -1;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi]!;
    if (cur === goal) break;
    const p = { x: cur % m.w, y: Math.floor(cur / m.w) };
    for (const d of Object.keys(DELTA) as Dir[]) {
      if (!mazeCanMove(m, p, d)) continue;
      const n = (p.y + DELTA[d].y) * m.w + p.x + DELTA[d].x;
      if (prev[n] === -2) { prev[n] = cur; q.push(n); }
    }
  }
  if (prev[goal] === -2) return null;
  const path: Pt[] = [];
  for (let c = goal; c !== -1; c = prev[c]!) path.unshift({ x: c % m.w, y: Math.floor(c / m.w) });
  return path;
}

export function mazeNew(difficulty: ArcadeDifficulty, seed: number): MazeState {
  const { w, h, timeLimitSec } = MAZE_SIZES[difficulty];
  return { w, h, walls: mazeGenerate(w, h, seed), player: { x: 0, y: 0 }, exit: { x: w - 1, y: h - 1 }, moves: 0, status: 'playing', startedAt: null, finishedAt: null, timeLimitSec };
}

/** Moves one cell (timer starts on the first move). Blocked moves are ignored. */
export function mazeMove(m: MazeState, d: Dir, now: number): MazeState {
  if (m.status !== 'playing' || !mazeCanMove(m, m.player, d)) return m;
  if (m.startedAt !== null && now - m.startedAt > m.timeLimitSec * 1000) return { ...m, status: 'lost', finishedAt: now };
  const player = { x: m.player.x + DELTA[d].x, y: m.player.y + DELTA[d].y };
  const won = player.x === m.exit.x && player.y === m.exit.y;
  return { ...m, player, moves: m.moves + 1, startedAt: m.startedAt ?? now, status: won ? 'won' : 'playing', finishedAt: won ? now : null };
}

/** Called by the UI clock; flips to lost when the time limit passes. */
export function mazeTick(m: MazeState, now: number): MazeState {
  if (m.status !== 'playing' || m.startedAt === null) return m;
  return now - m.startedAt > m.timeLimitSec * 1000 ? { ...m, status: 'lost', finishedAt: now } : m;
}
