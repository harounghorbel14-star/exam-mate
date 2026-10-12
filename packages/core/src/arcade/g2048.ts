import { mulberry32 } from '../exam/grading.js';
import type { Dir } from './snake.js';

export interface G2048State { grid: number[][]; score: number; won: boolean; over: boolean; seed: number; spawns: number; moves: number }

function empties(grid: number[][]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (!v) out.push([r, c]); }));
  return out;
}

function spawnTile(s: G2048State): G2048State {
  const free = empties(s.grid);
  if (!free.length) return s;
  const rng = mulberry32(s.seed + s.spawns * 31337);
  const [r, c] = free[Math.floor(rng() * free.length)]!;
  const grid = s.grid.map((row) => [...row]);
  grid[r]![c] = rng() < 0.9 ? 2 : 4;
  return { ...s, grid, spawns: s.spawns + 1 };
}

export function g2048New(seed: number, size = 4): G2048State {
  let s: G2048State = { grid: Array.from({ length: size }, () => Array(size).fill(0)), score: 0, won: false, over: false, seed, spawns: 0, moves: 0 };
  s = spawnTile(spawnTile(s));
  return s;
}

/** Slide one row to the left, merging each pair once. */
export function slideRow(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter(Boolean);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) { out.push(tiles[i]! * 2); gained += tiles[i]! * 2; i++; }
    else out.push(tiles[i]!);
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

function transpose(g: number[][]): number[][] { return g[0]!.map((_, c) => g.map((r) => r[c]!)); }

export function g2048CanMove(grid: number[][]): boolean {
  if (empties(grid).length) return true;
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid.length; c++) {
    if (grid[r]![c] === grid[r]![c + 1] || grid[r]![c] === grid[r + 1]?.[c]) return true;
  }
  return false;
}

export function g2048Move(s: G2048State, dir: Dir): { state: G2048State; moved: boolean } {
  if (s.over) return { state: s, moved: false };
  let g = s.grid.map((r) => [...r]);
  const vertical = dir === 'up' || dir === 'down';
  const reverse = dir === 'right' || dir === 'down';
  if (vertical) g = transpose(g);
  let gained = 0;
  g = g.map((row) => {
    const src = reverse ? [...row].reverse() : row;
    const res = slideRow(src);
    gained += res.gained;
    return reverse ? res.row.reverse() : res.row;
  });
  if (vertical) g = transpose(g);
  const moved = JSON.stringify(g) !== JSON.stringify(s.grid);
  if (!moved) return { state: s, moved: false };
  let next: G2048State = { ...s, grid: g, score: s.score + gained, moves: s.moves + 1, won: s.won || g.some((r) => r.some((v) => v >= 2048)) };
  next = spawnTile(next);
  return { state: { ...next, over: !g2048CanMove(next.grid) }, moved: true };
}

export function g2048MaxTile(s: G2048State): number {
  return Math.max(...s.grid.flat());
}
