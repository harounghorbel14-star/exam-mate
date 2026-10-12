import { describe, it, expect } from 'vitest';
import { GAMES, GAME_BY_ID, dailySeed, todayKey } from './definitions.js';
import { GAME_IDS } from './types.js';
import { startQuiz, answerQuiz, quizResult, tickQuiz, startMemory, flipCard, memoryResult, applyResult, GameProgressRepository, MemoryStore, isCorrect, scoreAnswer } from './engine.js';
import { mulberry32 } from '../exam/grading.js';
import { solveEquation } from '../math/engine.js';
import type { Locale } from '../i18n/index.js';

const LOCALES: Locale[] = ['en', 'fr', 'ar'];

function correctResponse(q: { kind: string; answer: number | string }) {
  return q.answer;
}

describe('game catalogue', () => {
  it('has exactly 15 distinct games with trilingual metadata', () => {
    expect(GAMES).toHaveLength(15);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(15);
    expect(GAMES.map((g) => g.id).sort()).toEqual([...GAME_IDS].sort());
    for (const g of GAMES) for (const l of LOCALES) {
      expect(g.title[l]).toBeTruthy(); expect(g.description[l]).toBeTruthy(); expect(g.instructions[l]).toBeTruthy();
    }
  });
});

describe.each(GAMES.filter((g) => g.mode === 'quiz').map((g) => [g.id, g] as const))('%s', (_id, def) => {
  it('generates valid questions on every level, locale and many seeds', () => {
    for (let level = 1; level <= def.maxLevel; level++) for (const locale of LOCALES) for (let seed = 1; seed <= 15; seed++) {
      const s = startQuiz(def, { level, seed, locale, now: 0, dateKey: '2026-10-12' });
      expect(s.questions.length).toBeGreaterThan(0);
      for (const q of s.questions) {
        expect(q.prompt.length).toBeGreaterThan(0);
        if (q.kind === 'choice' || q.kind === 'truefalse') {
          expect(q.choices!.length).toBeGreaterThanOrEqual(2);
          expect(new Set(q.choices).size, `${def.id} duplicate choices ${JSON.stringify(q)}`).toBe(q.choices!.length);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.choices!.length);
        } else if (typeof q.answer === 'number') {
          expect(Number.isFinite(q.answer), `${def.id} ${JSON.stringify(q)}`).toBe(true);
        } else expect(String(q.answer).length).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = startQuiz(def, { level: 1, seed: 7, locale: 'en', now: 0 });
    const b = startQuiz(def, { level: 1, seed: 7, locale: 'en', now: 0 });
    expect(a.questions).toEqual(b.questions);
  });

  it('a perfect game passes and unlocks the next level', () => {
    let s = startQuiz(def, { level: 1, seed: 3, locale: 'en', now: 0 });
    let t = 0;
    const target = def.timing === 'sprint' ? 12 : s.questions.length;
    for (let i = 0; i < target && !s.finished; i++) {
      t += 1000;
      const r = answerQuiz(def, s, correctResponse(s.questions[s.index]!), t);
      expect(r.correct).toBe(true);
      expect(r.points).toBeGreaterThan(0);
      s = r.state;
    }
    if (def.timing === 'sprint') s = tickQuiz(s, s.deadline! + 1);
    expect(s.finished).toBe(true);
    const res = quizResult(def, s);
    expect(res.accuracy).toBe(1);
    expect(res.stars).toBe(3);
    if (def.id === 'quiz-battle') expect(res.won).toBe(res.score > s.opponent!.score);
    if (def.id !== 'quiz-battle') expect(res.passed).toBe(true);
    const { progress, newlyUnlocked } = applyResult(undefined, res, def.maxLevel, 'dev1', 1);
    expect(progress.highScore).toBe(res.score);
    if (def.maxLevel > 1 && res.passed) expect(newlyUnlocked).toBe(2);
  });

  it('wrong answers score zero and lives end the round', () => {
    let s = startQuiz(def, { level: 1, seed: 4, locale: 'fr', now: 0 });
    let n = 0;
    while (!s.finished && n < 200) {
      const q = s.questions[s.index]!;
      const wrong = q.kind === 'input' ? (typeof q.answer === 'number' ? q.answer + 1000 : `${q.answer}zz`) : ((q.answer as number) + 1) % q.choices!.length;
      const r = answerQuiz(def, s, wrong, ++n * 100);
      expect(r.correct).toBe(false);
      expect(r.points).toBe(0);
      s = r.state;
    }
    if (def.lives) expect(s.answers.length).toBe(def.lives);
    const res = quizResult(def, s);
    expect(res.stars).toBe(0);
    expect(res.passed).toBe(false);
    expect(() => answerQuiz(def, s, 0, n * 100 + 1)).toThrow();
  });
});

describe('specific game rules', () => {
  it('equation master answers are true solutions of the shown equation', () => {
    const def = GAME_BY_ID['equation-master'];
    for (let level = 1; level <= 6; level++) for (let seed = 1; seed <= 20; seed++) {
      const s = startQuiz(def, { level, seed, locale: 'en', now: 0 });
      for (const q of s.questions) {
        const sol = solveEquation(q.code!.replace(/−/g, '-'));
        expect(sol.numeric!.some((x) => Math.abs(x - (q.answer as number)) < 1e-9), `${q.code} → ${q.answer}`).toBe(true);
        if (level === 6) expect(q.answer as number).toBeCloseTo(Math.max(...sol.numeric!), 9);
      }
    }
  });
  it('sprint games end at the deadline and reject late answers', () => {
    const def = GAME_BY_ID['math-rush'];
    const s = startQuiz(def, { level: 1, seed: 1, locale: 'en', now: 0 });
    expect(s.deadline).toBe(60_000);
    const late = answerQuiz(def, s, s.questions[0]!.answer, 61_000);
    expect(late.state.finished).toBe(true);
    expect(late.points).toBe(0);
  });
  it('scoring rewards speed and streaks', () => {
    const def = GAME_BY_ID['quiz-battle'];
    expect(scoreAnswer(def, 1, true, 0, 1)).toBe(150);
    expect(scoreAnswer(def, 1, true, 20_000, 1)).toBe(100);
    expect(scoreAnswer(def, 1, true, 20_000, 4)).toBe(130);
    expect(scoreAnswer(def, 3, true, 20_000, 1)).toBe(150);
  });
  it('accepts tolerant numeric and accent-insensitive text answers', () => {
    expect(isCorrect({ id: 'a', prompt: '', kind: 'input', answer: 100, tolerance: 0.01 }, '100.9')).toBe(true);
    expect(isCorrect({ id: 'a', prompt: '', kind: 'input', answer: 100, tolerance: 0.01 }, '102')).toBe(false);
    expect(isCorrect({ id: 'a', prompt: '', kind: 'input', answer: 'planète' }, 'Planete')).toBe(true);
    expect(isCorrect({ id: 'a', prompt: '', kind: 'input', answer: 12 }, '١٢')).toBe(true);
  });
  it('daily challenge is the same for everyone on a date and differs across dates', () => {
    const def = GAME_BY_ID['daily-challenge'];
    const a = startQuiz(def, { level: 1, seed: dailySeed('2026-10-12'), locale: 'en', now: 0 });
    const b = startQuiz(def, { level: 1, seed: dailySeed('2026-10-12'), locale: 'en', now: 5 });
    const c = startQuiz(def, { level: 1, seed: dailySeed('2026-10-13'), locale: 'en', now: 0 });
    expect(a.questions).toEqual(b.questions);
    expect(a.questions).not.toEqual(c.questions);
    expect(a.questions).toHaveLength(10);
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('flashcard sprint uses a user deck when provided', () => {
    const deck = [{ front: 'chat', back: 'cat' }, { front: 'chien', back: 'dog' }, { front: 'oiseau', back: 'bird' }, { front: 'poisson', back: 'fish' }];
    const s = startQuiz(GAME_BY_ID['flashcard-sprint'], { level: 1, seed: 2, locale: 'en', now: 0, deck });
    expect(deck.map((d) => d.front)).toContain(s.questions[0]!.prompt);
  });
});

describe('memory cards', () => {
  const def = GAME_BY_ID['memory-cards'];
  it('produces pairs for every level and locale', () => {
    for (let level = 1; level <= def.maxLevel; level++) for (const locale of LOCALES) {
      const pairs = def.pairs!({ level, rng: mulberry32(level), locale });
      expect(pairs.length).toBeGreaterThanOrEqual(4);
      expect(new Set(pairs.flat()).size).toBe(pairs.length * 2);
    }
  });
  it('plays a full game: mismatches close, matches stay, finishes with a score', () => {
    const pairs = def.pairs!({ level: 1, rng: mulberry32(1), locale: 'en' });
    let s = startMemory('memory-cards', 1, pairs, 9, 0);
    // One deliberate mismatch first.
    const first = s.cards[0]!;
    const wrong = s.cards.find((c) => c.pairId !== first.pairId)!;
    s = flipCard(s, first.id, 1).state;
    const mm = flipCard(s, wrong.id, 2);
    expect(mm.match).toBe(false);
    s = mm.state;
    let t = 3;
    for (let p = 0; p < pairs.length; p++) {
      const [a, b] = s.cards.filter((c) => c.pairId === p);
      s = flipCard(s, a!.id, t++).state;
      const r = flipCard(s, b!.id, t++);
      expect(r.match).toBe(true);
      s = r.state;
    }
    expect(s.finishedAt).not.toBeNull();
    expect(s.moves).toBe(pairs.length + 1);
    const res = memoryResult(s);
    expect(res.stars).toBe(3);
    expect(res.score).toBeGreaterThan(0);
    // Flipping after finishing is a no-op.
    expect(flipCard(s, 0, t).match).toBeNull();
  });
});

describe('local persistence', () => {
  it('saves progress, tracks dirty records and survives corrupt storage', async () => {
    const store = new MemoryStore();
    const repo = new GameProgressRepository(store);
    const def = GAME_BY_ID['true-false'];
    const res = { gameId: def.id, level: 1, score: 900, correct: 10, answered: 10, accuracy: 1, stars: 3 as const, passed: true, bestStreak: 10, avgTimeMs: 900 };
    const { progress } = applyResult(await repo.get(def.id), res, def.maxLevel, 'web', 1);
    await repo.save(progress);
    expect((await repo.get(def.id))!.unlockedLevel).toBe(2);
    expect(await repo.dirty()).toEqual(['true-false']);
    await repo.clearDirty(['true-false']);
    expect(await repo.dirty()).toEqual([]);
    const second = applyResult(await repo.get(def.id), { ...res, score: 100, passed: false, stars: 0 }, def.maxLevel, 'web', 2);
    expect(second.progress.highScore).toBe(900);
    expect(second.newHighScore).toBe(false);
    await store.setItem('exammate.games.progress.v1', '{not json');
    expect(await repo.all()).toEqual({});
  });
});
