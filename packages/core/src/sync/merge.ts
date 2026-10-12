/**
 * Offline-first synchronisation helpers. Records carry `updatedAt` (client clock, ms) and a
 * monotonically increasing `version`. Merges are deterministic so client and server agree.
 */
export interface Versioned { id: string; updatedAt: number; version: number; deleted?: boolean }

export type ConflictStrategy = 'last-write-wins' | 'max-progress';

/** Last-write-wins with version, then updatedAt, then id as tie-breakers. */
export function pickWinner<T extends Versioned>(a: T, b: T): T {
  if (a.version !== b.version) return a.version > b.version ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export function mergeCollections<T extends Versioned>(local: T[], remote: T[]): { merged: T[]; conflicts: Array<{ id: string; kept: 'local' | 'remote' }> } {
  const map = new Map<string, T>();
  const conflicts: Array<{ id: string; kept: 'local' | 'remote' }> = [];
  for (const r of remote) map.set(r.id, r);
  for (const l of local) {
    const r = map.get(l.id);
    if (!r) { map.set(l.id, l); continue; }
    if (JSON.stringify(r) === JSON.stringify(l)) continue;
    const w = pickWinner(l, r);
    conflicts.push({ id: l.id, kept: w === l ? 'local' : 'remote' });
    map.set(l.id, w);
  }
  return { merged: [...map.values()].sort((a, b) => a.id.localeCompare(b.id)), conflicts };
}

export interface GameProgressRecord extends Versioned {
  gameId: string;
  highScore: number;
  bestLevel: number;
  unlockedLevel: number;
  stars: Record<string, number>;
  /** Per-device grow-only counters (G-Counter CRDT): totals are the sum over devices. */
  counters: Record<string, { plays: number; correct: number; answered: number }>;
}

export function progressTotals(p: Pick<GameProgressRecord, 'counters'>) {
  return Object.values(p.counters).reduce((t, c) => ({ plays: t.plays + c.plays, correct: t.correct + c.correct, answered: t.answered + c.answered }), { plays: 0, correct: 0, answered: 0 });
}

/**
 * Game progress must never regress because of a sync: take the maximum of monotonic fields
 * and the union of stars, and merge per-device counters by max so offline plays on two
 * devices add up instead of overwriting each other.
 */
export function mergeGameProgress(a: GameProgressRecord, b: GameProgressRecord): GameProgressRecord {
  if (a.gameId !== b.gameId) throw new Error('Cannot merge progress of different games');
  const stars: Record<string, number> = { ...a.stars };
  for (const [lvl, s] of Object.entries(b.stars)) stars[lvl] = Math.max(stars[lvl] ?? 0, s);
  const counters: GameProgressRecord['counters'] = { ...a.counters };
  for (const [dev, c] of Object.entries(b.counters)) {
    const x = counters[dev];
    counters[dev] = x ? { plays: Math.max(x.plays, c.plays), correct: Math.max(x.correct, c.correct), answered: Math.max(x.answered, c.answered) } : c;
  }
  return {
    id: a.id,
    gameId: a.gameId,
    highScore: Math.max(a.highScore, b.highScore),
    bestLevel: Math.max(a.bestLevel, b.bestLevel),
    unlockedLevel: Math.max(a.unlockedLevel, b.unlockedLevel),
    stars,
    counters,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    version: Math.max(a.version, b.version) + 1,
  };
}
