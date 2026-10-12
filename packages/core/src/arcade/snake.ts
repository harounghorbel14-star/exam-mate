import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export type Dir = 'up' | 'down' | 'left' | 'right';
export interface Pt { x: number; y: number }
export interface SnakeState { w: number; h: number; snake: Pt[]; dir: Dir; queued: Dir[]; food: Pt | null; score: number; alive: boolean; won: boolean; seed: number; eaten: number; wrap: boolean }

const DELTA: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Milliseconds per step for each difficulty (the UI drives step()). */
export const SNAKE_SPEED: Record<ArcadeDifficulty, number> = { easy: 180, medium: 120, hard: 80 };

function placeFood(s: Pick<SnakeState, 'w' | 'h' | 'snake' | 'seed' | 'eaten'>): Pt | null {
  const occupied = new Set(s.snake.map((p) => p.y * s.w + p.x));
  const free: number[] = [];
  for (let i = 0; i < s.w * s.h; i++) if (!occupied.has(i)) free.push(i);
  if (!free.length) return null;
  const idx = free[Math.floor(mulberry32(s.seed + s.eaten * 7919)() * free.length)]!;
  return { x: idx % s.w, y: Math.floor(idx / s.w) };
}

export function snakeNew(seed: number, w = 16, h = 16, wrap = false): SnakeState {
  const cy = Math.floor(h / 2);
  const snake = [{ x: 4, y: cy }, { x: 3, y: cy }, { x: 2, y: cy }];
  const base = { w, h, snake, seed, eaten: 0 };
  return { ...base, dir: 'right', queued: [], food: placeFood(base), score: 0, alive: true, won: false, wrap };
}

/** Queue a turn (max 2 buffered); reversing into yourself is ignored. */
export function snakeTurn(s: SnakeState, d: Dir): SnakeState {
  const last = s.queued[s.queued.length - 1] ?? s.dir;
  if (d === last || d === OPPOSITE[last] || s.queued.length >= 2) return s;
  return { ...s, queued: [...s.queued, d] };
}

export function snakeStep(s: SnakeState): SnakeState {
  if (!s.alive || s.won) return s;
  const [next, ...rest] = s.queued;
  const dir = next ?? s.dir;
  const head = s.snake[0]!;
  let nh = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  if (s.wrap) nh = { x: (nh.x + s.w) % s.w, y: (nh.y + s.h) % s.h };
  const eating = !!s.food && nh.x === s.food.x && nh.y === s.food.y;
  const body = eating ? s.snake : s.snake.slice(0, -1); // tail moves away unless growing
  const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= s.w || nh.y >= s.h;
  const hitSelf = body.some((p) => p.x === nh.x && p.y === nh.y);
  if (hitWall || hitSelf) return { ...s, dir, queued: rest, alive: false };
  const snake = [nh, ...body];
  const eaten = s.eaten + (eating ? 1 : 0);
  const food = eating ? placeFood({ ...s, snake, eaten }) : s.food;
  return { ...s, snake, dir, queued: rest, eaten, food, score: s.score + (eating ? 10 : 0), won: eating && food === null };
}
