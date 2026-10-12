import type { KeyValueStore } from '../games/engine.js';
import { ARCADE_BY_ID, isArcadeId, type ArcadeId } from './catalog.js';

export type ArcadeOutcome = 'win' | 'loss' | 'draw' | 'done';
export interface ArcadeResult {
  gameId: ArcadeId;
  outcome: ArcadeOutcome;
  /** Points for 'high' games (and optional for others). */
  score?: number;
  /** Completion time (or average reaction) for 'time' games — only recorded on a win/done. */
  timeMs?: number;
  playMs: number;
  difficulty?: string;
  mode?: string;
}

export interface ArcadeCounters { plays: number; wins: number; losses: number; draws: number; playMs: number }
export interface ArcadeStatsRecord {
  gameId: ArcadeId;
  bestScore: number;
  /** 0 = no time recorded yet. */
  bestTimeMs: number;
  bestStreak: number;
  /** Current win streak on this device (local, last-writer-wins). */
  streak: number;
  lastPlayedAt: number;
  /** Per-device grow-only counters so offline plays on several devices add up after a sync. */
  counters: Record<string, ArcadeCounters>;
  updatedAt: number;
}

export function emptyArcadeStats(gameId: ArcadeId): ArcadeStatsRecord {
  return { gameId, bestScore: 0, bestTimeMs: 0, bestStreak: 0, streak: 0, lastPlayedAt: 0, counters: {}, updatedAt: 0 };
}

export function arcadeTotals(r: Pick<ArcadeStatsRecord, 'counters'>): ArcadeCounters {
  return Object.values(r.counters).reduce((t, c) => ({ plays: t.plays + c.plays, wins: t.wins + c.wins, losses: t.losses + c.losses, draws: t.draws + c.draws, playMs: t.playMs + c.playMs }), { plays: 0, wins: 0, losses: 0, draws: 0, playMs: 0 });
}

/** Applies a finished game. Scores/times are validated (finite, non-negative, bounded) so a bad caller can't corrupt records. */
export function applyArcadeResult(prev: ArcadeStatsRecord | undefined, r: ArcadeResult, deviceId: string, now: number): { stats: ArcadeStatsRecord; newBestScore: boolean; newBestTime: boolean } {
  const s = prev ? { ...prev, counters: { ...prev.counters } } : emptyArcadeStats(r.gameId);
  const c = { ...(s.counters[deviceId] ?? { plays: 0, wins: 0, losses: 0, draws: 0, playMs: 0 }) };
  c.plays++;
  if (r.outcome === 'win') c.wins++;
  else if (r.outcome === 'loss') c.losses++;
  else if (r.outcome === 'draw') c.draws++;
  c.playMs += clamp(r.playMs, 0, 6 * 3600_000);
  s.counters[deviceId] = c;
  const score = r.score !== undefined ? clamp(r.score, 0, 1e9) : undefined;
  const newBestScore = score !== undefined && score > s.bestScore;
  if (newBestScore) s.bestScore = score!;
  const successful = r.outcome === 'win' || r.outcome === 'done';
  const time = r.timeMs !== undefined && successful && ARCADE_BY_ID[r.gameId].scoreKind === 'time' ? clamp(r.timeMs, 1, 24 * 3600_000) : undefined;
  const newBestTime = time !== undefined && (s.bestTimeMs === 0 || time < s.bestTimeMs);
  if (newBestTime) s.bestTimeMs = time!;
  if (r.outcome === 'win') s.streak++;
  else if (r.outcome === 'loss') s.streak = 0;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.lastPlayedAt = now;
  s.updatedAt = now;
  return { stats: s, newBestScore, newBestTime };
}

function clamp(v: number, lo: number, hi: number) {
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo;
}

/** Merge two copies of the same record (e.g. local + server): never regresses bests; counters merge per device by max. */
export function mergeArcadeStats(a: ArcadeStatsRecord, b: ArcadeStatsRecord): ArcadeStatsRecord {
  if (a.gameId !== b.gameId) throw new Error('Cannot merge stats of different games');
  const counters: Record<string, ArcadeCounters> = { ...a.counters };
  for (const [dev, c] of Object.entries(b.counters)) {
    const x = counters[dev];
    counters[dev] = x ? { plays: Math.max(x.plays, c.plays), wins: Math.max(x.wins, c.wins), losses: Math.max(x.losses, c.losses), draws: Math.max(x.draws, c.draws), playMs: Math.max(x.playMs, c.playMs) } : c;
  }
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const times = [a.bestTimeMs, b.bestTimeMs].filter((t) => t > 0);
  return {
    gameId: a.gameId,
    bestScore: Math.max(a.bestScore, b.bestScore),
    bestTimeMs: times.length ? Math.min(...times) : 0,
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    streak: newer.streak,
    lastPlayedAt: Math.max(a.lastPlayedAt, b.lastPlayedAt),
    counters,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

/** Structural validation for records arriving from storage or the network. */
export function isArcadeStatsRecord(x: unknown): x is ArcadeStatsRecord {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  if (!isArcadeId(r.gameId) || !['bestScore', 'bestTimeMs', 'bestStreak', 'streak', 'lastPlayedAt', 'updatedAt'].every((k) => num(r[k]))) return false;
  if (!r.counters || typeof r.counters !== 'object') return false;
  return Object.values(r.counters as Record<string, unknown>).every((c) => !!c && typeof c === 'object' && ['plays', 'wins', 'losses', 'draws', 'playMs'].every((k) => num((c as Record<string, unknown>)[k])));
}

export interface ArcadeSettings { sound: boolean; haptics: boolean; volume: number; reducedMotion: boolean; seenOnboarding: boolean }
export const DEFAULT_ARCADE_SETTINGS: ArcadeSettings = { sound: true, haptics: true, volume: 0.6, reducedMotion: false, seenOnboarding: false };

const STATS_KEY = 'exammate.arcade.stats.v1';
const DIRTY_KEY = 'exammate.arcade.dirty.v1';
const META_KEY = 'exammate.arcade.meta.v1';
const SAVE_PREFIX = 'exammate.arcade.save.v1.';

interface ArcadeMeta { favorites: ArcadeId[]; recent: ArcadeId[]; settings: ArcadeSettings; seenRules: ArcadeId[] }

/** Local-first arcade persistence. Works with localStorage (web) or AsyncStorage (mobile) through KeyValueStore. */
export class ArcadeRepository {
  constructor(private store: KeyValueStore, private deviceId: string) {}

  private async read<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await this.store.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
  }

  async allStats(): Promise<Partial<Record<ArcadeId, ArcadeStatsRecord>>> {
    const raw = await this.read<Record<string, unknown>>(STATS_KEY, {});
    const out: Partial<Record<ArcadeId, ArcadeStatsRecord>> = {};
    for (const [k, v] of Object.entries(raw)) if (isArcadeId(k) && isArcadeStatsRecord(v)) out[k] = v;
    return out;
  }

  async stats(id: ArcadeId): Promise<ArcadeStatsRecord | undefined> { return (await this.allStats())[id]; }

  async record(result: ArcadeResult, now = Date.now()) {
    const all = await this.allStats();
    const out = applyArcadeResult(all[result.gameId], result, this.deviceId, now);
    all[result.gameId] = out.stats;
    await this.store.setItem(STATS_KEY, JSON.stringify(all));
    const dirty = new Set(await this.dirty()); dirty.add(result.gameId);
    await this.store.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
    await this.touchRecent(result.gameId);
    return out;
  }

  /** Merges records from the server (or another device) without losing local progress. */
  async mergeRemote(records: unknown[]): Promise<number> {
    const all = await this.allStats();
    let n = 0;
    for (const r of records) {
      if (!isArcadeStatsRecord(r)) continue;
      const local = all[r.gameId];
      all[r.gameId] = local ? mergeArcadeStats(local, r) : r;
      n++;
    }
    await this.store.setItem(STATS_KEY, JSON.stringify(all));
    return n;
  }

  async dirty(): Promise<ArcadeId[]> { return (await this.read<string[]>(DIRTY_KEY, [])).filter(isArcadeId); }
  async clearDirty(ids: ArcadeId[]) {
    await this.store.setItem(DIRTY_KEY, JSON.stringify((await this.dirty()).filter((d) => !ids.includes(d))));
  }

  async meta(): Promise<ArcadeMeta> {
    const m = await this.read<Partial<ArcadeMeta>>(META_KEY, {});
    return {
      favorites: (m.favorites ?? []).filter(isArcadeId),
      recent: (m.recent ?? []).filter(isArcadeId),
      seenRules: (m.seenRules ?? []).filter(isArcadeId),
      settings: { ...DEFAULT_ARCADE_SETTINGS, ...(m.settings ?? {}) },
    };
  }
  private async writeMeta(patch: Partial<ArcadeMeta>) { await this.store.setItem(META_KEY, JSON.stringify({ ...(await this.meta()), ...patch })); }

  async toggleFavorite(id: ArcadeId): Promise<ArcadeId[]> {
    const { favorites } = await this.meta();
    const next = favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
    await this.writeMeta({ favorites: next });
    return next;
  }
  async touchRecent(id: ArcadeId) {
    const { recent } = await this.meta();
    await this.writeMeta({ recent: [id, ...recent.filter((r) => r !== id)].slice(0, 6) });
  }
  async markRulesSeen(id: ArcadeId) {
    const { seenRules } = await this.meta();
    if (!seenRules.includes(id)) await this.writeMeta({ seenRules: [...seenRules, id] });
  }
  async updateSettings(patch: Partial<ArcadeSettings>): Promise<ArcadeSettings> {
    const settings = { ...(await this.meta()).settings, ...patch };
    settings.volume = Math.min(1, Math.max(0, Number(settings.volume) || 0));
    await this.writeMeta({ settings });
    return settings;
  }

  /** Optional saved game (e.g. 2048 or Sudoku in progress) so a game survives an app restart. */
  async saveGame(id: ArcadeId, state: unknown) { await this.store.setItem(SAVE_PREFIX + id, JSON.stringify(state)); }
  async loadGame<T>(id: ArcadeId): Promise<T | null> { return this.read<T | null>(SAVE_PREFIX + id, null); }
  async clearGame(id: ArcadeId) {
    if (this.store.removeItem) await this.store.removeItem(SAVE_PREFIX + id);
    else await this.store.setItem(SAVE_PREFIX + id, 'null');
  }
}

/** Overall arcade summary for the hub. */
export function arcadeSummary(all: Partial<Record<ArcadeId, ArcadeStatsRecord>>) {
  const recs = Object.values(all) as ArcadeStatsRecord[];
  const totals = recs.map(arcadeTotals).reduce((t, c) => ({ plays: t.plays + c.plays, wins: t.wins + c.wins, playMs: t.playMs + c.playMs }), { plays: 0, wins: 0, playMs: 0 });
  return { gamesPlayed: recs.filter((r) => arcadeTotals(r).plays > 0).length, ...totals, bestStreak: Math.max(0, ...recs.map((r) => r.bestStreak)) };
}
