import { mulberry32, shuffle, normalizeText } from '../exam/grading.js';
import type { Locale } from '../i18n/index.js';
import type { GameProgressRecord } from '../sync/merge.js';
import type { GameDefinition, GameQuestion } from './types.js';

export interface AnswerRecord { questionId: string; response: string | number; correct: boolean; timeMs: number; points: number }

export interface QuizState {
  gameId: string;
  level: number;
  seed: number;
  locale: Locale;
  questions: GameQuestion[];
  index: number;
  score: number;
  streak: number;
  bestStreak: number;
  livesLeft: number | null;
  startedAt: number;
  questionStartedAt: number;
  /** Absolute deadline (ms) for sprint games. */
  deadline: number | null;
  answers: AnswerRecord[];
  finished: boolean;
  /** Optional opponent for Quiz Battle. */
  opponent?: { name: string; score: number; accuracy: number };
}

export function levelMultiplier(level: number) {
  return 1 + (level - 1) * 0.25;
}

export function startQuiz(def: GameDefinition, opts: { level: number; seed: number; locale: Locale; now: number; deck?: Array<{ front: string; back: string }>; dateKey?: string }): QuizState {
  const level = Math.max(1, Math.min(def.maxLevel, Math.floor(opts.level)));
  const rng = mulberry32(opts.seed);
  const questions = def.generate({ level, rng, locale: opts.locale, deck: opts.deck, dateKey: opts.dateKey });
  if (questions.length === 0) throw new Error('No questions available for this game');
  return {
    gameId: def.id, level, seed: opts.seed, locale: opts.locale, questions, index: 0, score: 0, streak: 0, bestStreak: 0,
    livesLeft: def.lives, startedAt: opts.now, questionStartedAt: opts.now,
    deadline: def.timing === 'sprint' ? opts.now + def.timeLimitSec * 1000 : null,
    answers: [], finished: false,
    ...(def.id === 'quiz-battle' ? { opponent: { name: 'Robo', score: 0, accuracy: Math.min(0.9, 0.45 + level * 0.08) } } : {}),
  };
}

export function isCorrect(q: GameQuestion, response: string | number): boolean {
  if (q.kind === 'choice' || q.kind === 'truefalse') return Number(response) === q.answer;
  if (typeof q.answer === 'number') {
    const v = Number(String(response).trim().replace(',', '.').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    if (!Number.isFinite(v) || String(response).trim() === '') return false;
    const tol = (q.tolerance ?? 0) * Math.abs(q.answer);
    return Math.abs(v - q.answer) <= Math.max(tol, 1e-9);
  }
  const given = normalizeText(String(response));
  return [q.answer, ...(q.accept ?? [])].some((a) => normalizeText(String(a)) === given);
}

/** Points: base by level + speed bonus (within the time window) + streak bonus. */
export function scoreAnswer(def: GameDefinition, level: number, correct: boolean, timeMs: number, streak: number): number {
  if (!correct) return 0;
  const base = Math.round(100 * levelMultiplier(level));
  const window = def.timing === 'sprint' ? 5000 : def.timeLimitSec * 1000;
  const speed = Math.max(0, 1 - timeMs / window);
  const speedBonus = Math.round(50 * speed);
  const streakBonus = Math.min(50, 10 * Math.max(0, streak - 1));
  return base + speedBonus + streakBonus;
}

export function answerQuiz(def: GameDefinition, state: QuizState, response: string | number, now: number): { state: QuizState; correct: boolean; points: number; expected: GameQuestion } {
  if (state.finished) throw new Error('The game is already finished');
  const q = state.questions[state.index]!;
  if (state.deadline !== null && now > state.deadline) {
    return { state: { ...state, finished: true }, correct: false, points: 0, expected: q };
  }
  const correct = isCorrect(q, response);
  const timeMs = Math.max(0, now - state.questionStartedAt);
  const streak = correct ? state.streak + 1 : 0;
  const points = scoreAnswer(def, state.level, correct, timeMs, streak);
  const livesLeft = state.livesLeft === null ? null : correct ? state.livesLeft : state.livesLeft - 1;
  const index = state.index + 1;
  let opponent = state.opponent;
  if (opponent) {
    // Deterministic opponent: pseudo-random from seed + question index.
    const r = mulberry32(state.seed * 31 + state.index)();
    opponent = { ...opponent, score: opponent.score + (r < opponent.accuracy ? Math.round(100 * levelMultiplier(state.level) + 25) : 0) };
  }
  const finished = index >= state.questions.length || livesLeft === 0;
  return {
    correct, points, expected: q,
    state: {
      ...state, index, score: state.score + points, streak, bestStreak: Math.max(state.bestStreak, streak), livesLeft,
      questionStartedAt: now, answers: [...state.answers, { questionId: q.id, response, correct, timeMs, points }], finished, opponent,
    },
  };
}

/** Advance time; sprint games end when the deadline passes. */
export function tickQuiz(state: QuizState, now: number): QuizState {
  if (!state.finished && state.deadline !== null && now >= state.deadline) return { ...state, finished: true };
  return state;
}

export function remainingMs(state: QuizState, now: number): number | null {
  return state.deadline === null ? null : Math.max(0, state.deadline - now);
}

export interface GameResult {
  gameId: string;
  level: number;
  score: number;
  correct: number;
  answered: number;
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
  passed: boolean;
  bestStreak: number;
  avgTimeMs: number;
  won?: boolean;
}

export function starsFor(accuracy: number, answered: number, minAnswered: number): 0 | 1 | 2 | 3 {
  if (answered < minAnswered) return accuracy >= 0.9 && answered > 0 ? 1 : 0;
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  if (accuracy >= 0.5) return 1;
  return 0;
}

export function quizResult(def: GameDefinition, s: QuizState): GameResult {
  const answered = s.answers.length;
  const correct = s.answers.filter((a) => a.correct).length;
  const accuracy = answered ? correct / answered : 0;
  // Sprint games need a minimum number of answers to earn full stars.
  const minAnswered = def.timing === 'sprint' ? Math.min(10, s.questions.length) : s.questions.length;
  const stars = starsFor(accuracy, answered, minAnswered);
  const won = s.opponent ? s.score > s.opponent.score : undefined;
  return {
    gameId: s.gameId, level: s.level, score: s.score, correct, answered, accuracy, stars,
    passed: stars >= 2 && (won ?? true), bestStreak: s.bestStreak,
    avgTimeMs: answered ? Math.round(s.answers.reduce((t, a) => t + a.timeMs, 0) / answered) : 0,
    ...(won !== undefined ? { won } : {}),
  };
}

// ---------------- Memory (pairs) engine ----------------

export interface MemoryCard { id: number; pairId: number; text: string; matched: boolean }
export interface MemoryState {
  gameId: string;
  level: number;
  cards: MemoryCard[];
  /** Indices of currently face-up, unmatched cards (0–2). */
  open: number[];
  moves: number;
  matchedPairs: number;
  startedAt: number;
  finishedAt: number | null;
  score: number;
}

export function startMemory(gameId: string, level: number, pairs: Array<[string, string]>, seed: number, now: number): MemoryState {
  if (pairs.length < 2) throw new Error('At least two pairs are needed');
  const cards = pairs.flatMap(([a, b], pairId) => [{ pairId, text: a }, { pairId, text: b }]);
  const shuffled = shuffle(cards, mulberry32(seed)).map((c, id) => ({ ...c, id, matched: false }));
  return { gameId, level, cards: shuffled, open: [], moves: 0, matchedPairs: 0, startedAt: now, finishedAt: null, score: 0 };
}

/**
 * Flip a card. When two unmatched cards are open, the next flip first closes them.
 * Returns `match` when the flip completed a pair.
 */
export function flipCard(s: MemoryState, cardId: number, now: number): { state: MemoryState; match: boolean | null } {
  if (s.finishedAt !== null) return { state: s, match: null };
  const card = s.cards[cardId];
  if (!card || card.matched || s.open.includes(cardId)) return { state: s, match: null };
  let open = s.open.length >= 2 ? [] : [...s.open];
  open.push(cardId);
  if (open.length < 2) return { state: { ...s, open }, match: null };
  const [a, b] = open as [number, number];
  const moves = s.moves + 1;
  const match = s.cards[a]!.pairId === s.cards[b]!.pairId;
  let cards = s.cards;
  let matchedPairs = s.matchedPairs;
  if (match) {
    cards = s.cards.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c));
    matchedPairs++;
    open = [];
  }
  const total = s.cards.length / 2;
  const finished = matchedPairs === total;
  const score = finished ? memoryScore(total, moves, now - s.startedAt, s.level) : s.score;
  return { state: { ...s, cards, open, moves, matchedPairs, finishedAt: finished ? now : null, score }, match };
}

export function memoryScore(pairs: number, moves: number, elapsedMs: number, level: number): number {
  const extraMoves = Math.max(0, moves - pairs);
  const timeBonus = Math.max(0, 300 - Math.floor(elapsedMs / 1000) * 2);
  return Math.max(0, Math.round((pairs * 100 - extraMoves * 15 + timeBonus) * levelMultiplier(level)));
}

export function memoryResult(s: MemoryState): GameResult {
  const pairs = s.cards.length / 2;
  const efficiency = s.moves ? pairs / s.moves : 0;
  const stars: 0 | 1 | 2 | 3 = s.finishedAt === null ? 0 : efficiency >= 0.75 ? 3 : efficiency >= 0.5 ? 2 : 1;
  return {
    gameId: s.gameId, level: s.level, score: s.score, correct: s.matchedPairs, answered: s.moves, accuracy: efficiency,
    stars, passed: stars >= 2, bestStreak: 0, avgTimeMs: s.moves ? Math.round(((s.finishedAt ?? s.startedAt) - s.startedAt) / s.moves) : 0,
  };
}

// ---------------- Progression ----------------

export function emptyProgress(gameId: string, now: number): GameProgressRecord {
  return { id: gameId, gameId, highScore: 0, bestLevel: 0, unlockedLevel: 1, stars: {}, counters: {}, updatedAt: now, version: 0 };
}

/** Apply a finished game to stored progress: high score, stars per level, unlock next level on pass. */
export function applyResult(progress: GameProgressRecord | undefined, r: GameResult, maxLevel: number, deviceId: string, now: number): { progress: GameProgressRecord; newlyUnlocked: number | null; newHighScore: boolean } {
  const p = progress ?? emptyProgress(r.gameId, now);
  const key = String(r.level);
  const stars = { ...p.stars, [key]: Math.max(p.stars[key] ?? 0, r.stars) };
  const unlock = r.passed && r.level >= p.unlockedLevel && r.level < maxLevel ? r.level + 1 : null;
  const c = p.counters[deviceId] ?? { plays: 0, correct: 0, answered: 0 };
  const next: GameProgressRecord = {
    ...p,
    highScore: Math.max(p.highScore, r.score),
    bestLevel: r.passed ? Math.max(p.bestLevel, r.level) : p.bestLevel,
    unlockedLevel: unlock ? Math.max(p.unlockedLevel, unlock) : p.unlockedLevel,
    stars,
    counters: { ...p.counters, [deviceId]: { plays: c.plays + 1, correct: c.correct + r.correct, answered: c.answered + r.answered } },
    updatedAt: now,
    version: p.version + 1,
  };
  return { progress: next, newlyUnlocked: unlock && unlock > p.unlockedLevel ? unlock : null, newHighScore: r.score > p.highScore };
}

// ---------------- Local persistence ----------------

/** Minimal async key-value interface implemented by localStorage/IndexedDB (web) and AsyncStorage (mobile). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) { this.data.set(k, v); }
  async removeItem(k: string) { this.data.delete(k); }
}

const PROGRESS_KEY = 'exammate.games.progress.v1';
const DIRTY_KEY = 'exammate.games.dirty.v1';

/** Stores game progress locally and tracks which records still need to be synced. */
export class GameProgressRepository {
  constructor(private store: KeyValueStore) {}

  async all(): Promise<Record<string, GameProgressRecord>> {
    try {
      const raw = await this.store.getItem(PROGRESS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, GameProgressRecord>) : {};
    } catch {
      return {};
    }
  }

  async get(gameId: string): Promise<GameProgressRecord | undefined> {
    return (await this.all())[gameId];
  }

  async save(p: GameProgressRecord, markDirty = true): Promise<void> {
    const all = await this.all();
    all[p.gameId] = p;
    await this.store.setItem(PROGRESS_KEY, JSON.stringify(all));
    if (markDirty) {
      const dirty = new Set(await this.dirty());
      dirty.add(p.gameId);
      await this.store.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
    }
  }

  async dirty(): Promise<string[]> {
    try { return JSON.parse((await this.store.getItem(DIRTY_KEY)) ?? '[]') as string[]; } catch { return []; }
  }

  async clearDirty(ids: string[]): Promise<void> {
    const left = (await this.dirty()).filter((id) => !ids.includes(id));
    await this.store.setItem(DIRTY_KEY, JSON.stringify(left));
  }
}
