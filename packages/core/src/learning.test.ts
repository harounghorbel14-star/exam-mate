import { describe, it, expect } from 'vitest';
import { newSchedule, review, buildSession, isLeech, DAY_MS } from './srs/srs.js';
import { gradeAnswer, summarizeAttempt, buildExam, type ExamQuestion } from './exam/grading.js';
import { analyzeWeaknesses, buildStudyPlan, type PracticeRecord } from './analytics/weakness.js';
import { mergeCollections, mergeGameProgress, progressTotals, type GameProgressRecord } from './sync/merge.js';

describe('spaced repetition', () => {
  it('grows intervals on success and resets on failure', () => {
    let s = newSchedule(0);
    s = review(s, 'good', 0); expect(s.intervalDays).toBe(1);
    s = review(s, 'good', DAY_MS); expect(s.intervalDays).toBe(6);
    s = review(s, 'good', 7 * DAY_MS); expect(s.intervalDays).toBe(15);
    s = review(s, 'again', 22 * DAY_MS);
    expect(s.repetitions).toBe(0); expect(s.lapses).toBe(1); expect(s.ease).toBeLessThan(2.5);
    expect(s.dueAt).toBe(22 * DAY_MS + 600_000);
  });
  it('never drops ease below the minimum and detects leeches', () => {
    let s = newSchedule(0);
    for (let i = 0; i < 10; i++) s = review(s, 'again', i);
    expect(s.ease).toBe(1.3);
    expect(isLeech(s)).toBe(true);
  });
  it('builds sessions with due cards first', () => {
    const cards = [{ id: 'new', schedule: null }, { id: 'due', schedule: { ...newSchedule(0), dueAt: 5 } }, { id: 'later', schedule: { ...newSchedule(0), dueAt: 1e12 } }];
    expect(buildSession(cards, 10).map((c) => c.id)).toEqual(['due', 'new']);
  });
});

const bank: ExamQuestion[] = [
  { id: 'q1', type: 'mcq', prompt: '2+2', subject: 'math', topic: 'arith', difficulty: 1, points: 1, choices: ['3', '4', '5'], answer: 1 },
  { id: 'q2', type: 'numeric', prompt: 'pi', subject: 'math', topic: 'geom', difficulty: 2, points: 2, answer: 3.14159, tolerance: 0.01 },
  { id: 'q3', type: 'written', prompt: 'Explain photosynthesis', subject: 'bio', topic: 'plants', difficulty: 2, points: 5, rubric: [{ id: 'light', description: 'mentions light', points: 2, keywords: ['light', 'sun'] }] },
  { id: 'q4', type: 'multi', prompt: 'primes', subject: 'math', topic: 'arith', difficulty: 1, points: 2, choices: ['2', '3', '4'], answer: [0, 1] },
  { id: 'q5', type: 'short', prompt: 'capital of France', subject: 'geo', topic: 'capitals', difficulty: 1, points: 1, answer: ['Paris'] },
];

describe('grading', () => {
  it('grades each type', () => {
    expect(gradeAnswer(bank[0]!, 1).status).toBe('correct');
    expect(gradeAnswer(bank[1]!, '3,14').status).toBe('correct');
    const w = gradeAnswer(bank[2]!, 'Plants use sunlight');
    expect(w.status).toBe('needs_review'); expect(w.pointsAwarded).toBe(0); expect(w.matchedCriteria).toEqual(['light']);
    expect(gradeAnswer(bank[3]!, [0]).status).toBe('partial');
    expect(gradeAnswer(bank[3]!, [0, 1, 2]).pointsAwarded).toBe(1);
    expect(gradeAnswer(bank[4]!, ' paris ').status).toBe('correct');
    expect(gradeAnswer(bank[4]!, 'Lyon').status).toBe('needs_review');
    expect(gradeAnswer(bank[0]!, undefined).status).toBe('unanswered');
  });
  it('summarizes attempts', () => {
    const grades = bank.map((q) => gradeAnswer(q, q.id === 'q1' ? 1 : q.id === 'q3' ? 'x' : undefined));
    const s = summarizeAttempt(bank, grades);
    expect(s.score).toBe(1); expect(s.maxScore).toBe(11); expect(s.pendingReview).toBe(1);
  });
  it('builds reproducible exams with correct shuffled answers', () => {
    const a = buildExam(bank, { count: 3, durationMinutes: 10, seed: 42 });
    const b = buildExam(bank, { count: 3, durationMinutes: 10, seed: 42 });
    expect(a).toEqual(b);
    const mcq = a.find((q) => q.id === 'q1');
    if (mcq) expect(mcq.choices![mcq.answer as number]).toBe('4');
  });
});

describe('weakness detector', () => {
  const recs: PracticeRecord[] = [];
  for (let i = 0; i < 8; i++) recs.push({ subject: 'math', topic: 'fractions', correct: i % 4 === 0, timeSpent: 90, expectedTime: 45, mistakeTag: i % 4 ? 'common denominator' : undefined, at: i });
  for (let i = 0; i < 8; i++) recs.push({ subject: 'math', topic: 'algebra', correct: i !== 3, timeSpent: 40, expectedTime: 45, at: i });
  it('ranks weak topics with reasons', () => {
    const r = analyzeWeaknesses(recs);
    expect(r.topics[0]!.topic).toBe('fractions');
    expect(r.topics[0]!.reasons.join(' ')).toMatch(/accuracy/);
    expect(r.repeatedMistakes[0]).toEqual({ tag: 'common denominator', count: 6 });
    expect(r.timeManagement.slowTopics).toEqual(['fractions']);
  });
  it('builds a plan honouring overrides', () => {
    const r = analyzeWeaknesses(recs);
    const plan = buildStudyPlan(r, { days: 3, minutesPerDay: 60 });
    expect(plan.filter((t) => t.day === 1).reduce((s, t) => s + t.minutes, 0)).toBeLessThanOrEqual(60);
    expect(plan.every((t) => t.reason.length > 0)).toBe(true);
    expect(buildStudyPlan(r, { days: 2, minutesPerDay: 60, exclude: ['fractions'] }).some((t) => t.topic === 'fractions')).toBe(false);
  });
});

describe('sync', () => {
  it('merges collections with last-write-wins', () => {
    const local = [{ id: 'a', version: 2, updatedAt: 5, v: 'L' }, { id: 'b', version: 1, updatedAt: 1, v: 'L' }];
    const remote = [{ id: 'a', version: 1, updatedAt: 9, v: 'R' }, { id: 'c', version: 1, updatedAt: 1, v: 'R' }];
    const { merged, conflicts } = mergeCollections(local, remote);
    expect(merged.map((m) => m.id + m.v)).toEqual(['aL', 'bL', 'cR']);
    expect(conflicts).toEqual([{ id: 'a', kept: 'local' }]);
  });
  it('never loses game progress across devices', () => {
    const base = { id: 'p', gameId: 'math-rush', updatedAt: 1, version: 1 };
    const phone: GameProgressRecord = { ...base, highScore: 500, bestLevel: 3, unlockedLevel: 4, stars: { '1': 3, '2': 1 }, counters: { phone: { plays: 5, correct: 40, answered: 50 } } };
    const web: GameProgressRecord = { ...base, highScore: 700, bestLevel: 2, unlockedLevel: 3, stars: { '2': 2 }, counters: { web: { plays: 2, correct: 10, answered: 20 } } };
    const m = mergeGameProgress(phone, web);
    expect(m.highScore).toBe(700); expect(m.unlockedLevel).toBe(4); expect(m.stars).toEqual({ '1': 3, '2': 2 });
    expect(progressTotals(m)).toEqual({ plays: 7, correct: 50, answered: 70 });
    expect(mergeGameProgress(m, phone).highScore).toBe(700);
  });
});
