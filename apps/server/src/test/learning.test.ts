import { describe, it, expect } from 'vitest';
import { app, makeUser, auth, request } from './helpers.js';
import { pool } from '../db/pool.js';

describe('exam simulator', () => {
  it('runs a timed exam: hides answers, autosaves, grades, flags written answers for review', async () => {
    const u = await makeUser({ locale: 'fr' });
    const topics = await request(app).get('/api/exams/topics').set(auth(u));
    expect(topics.body.topics.length).toBeGreaterThan(5);
    const created = await request(app).post('/api/exams/attempts').set(auth(u)).send({ subjects: ['math', 'biology'], count: 8, durationMinutes: 15, seed: 42, locale: 'fr', strategyMode: true });
    expect(created.status).toBe(201);
    const a = created.body.attempt;
    expect(a.questions.length).toBe(8);
    expect(a.strategy.rows.length).toBeGreaterThan(0);
    for (const q of a.questions) { expect(q.answer).toBeUndefined(); expect(q.rubric).toBeUndefined(); }
    // Same seed → same exam.
    const again = await request(app).post('/api/exams/attempts').set(auth(u)).send({ subjects: ['math', 'biology'], count: 8, durationMinutes: 15, seed: 42, locale: 'fr' });
    expect(again.body.attempt.questions.map((q: { id: string }) => q.id)).toEqual(a.questions.map((q: { id: string }) => q.id));

    const { rows } = await pool.query('SELECT questions FROM exam_attempts WHERE id = $1', [a.id]);
    const stored = rows[0].questions as Array<{ id: string; type: string; answer: unknown; choices?: string[] }>;
    // Answer the first half correctly and the rest wrongly.
    const responses: Record<string, unknown> = {};
    stored.forEach((q, i) => {
      const right = i < 4;
      if (q.type === 'mcq' || q.type === 'truefalse') responses[q.id] = right ? q.answer : ((q.answer as number) + 1) % q.choices!.length;
      else if (q.type === 'numeric') responses[q.id] = right ? q.answer : -999;
      else if (q.type === 'short') responses[q.id] = right ? (q.answer as string[])[0] : 'zzz';
      else responses[q.id] = 'Les plantes utilisent la lumière du soleil';
    });
    const ids = Object.keys(responses);
    await request(app).put(`/api/exams/attempts/${a.id}/responses`).set(auth(u)).send({ responses: { [ids[0]!]: responses[ids[0]!] }, timings: { [ids[0]!]: 30 } }).expect(200);
    expect((await request(app).put(`/api/exams/attempts/${a.id}/responses`).set(auth(u)).send({ responses: { bogus: 1 } })).status).toBe(400);
    const sub = await request(app).post(`/api/exams/attempts/${a.id}/submit`).set(auth(u)).send({ responses, timings: Object.fromEntries(ids.map((id) => [id, 40])) });
    expect(sub.status).toBe(200);
    const correct = sub.body.grades.filter((g: { status: string }) => g.status === 'correct').length;
    const written = stored.filter((q) => q.type === 'written').length;
    expect(correct).toBe(stored.slice(0, 4).filter((q) => q.type !== 'written').length);
    expect(sub.body.summary.pendingReview).toBe(written);
    expect(sub.body.summary.analysis).toHaveLength(8);
    expect((await request(app).post(`/api/exams/attempts/${a.id}/submit`).set(auth(u)).send({})).status).toBe(409);
    // Practice records feed the weakness detector.
    const recs = await pool.query('SELECT count(*)::int AS n FROM practice_records WHERE user_id = $1 AND source = $2', [u.id, 'exam']);
    expect(recs.rows[0].n).toBe(8 - written);
  });

  it('supports manual review of written answers', async () => {
    const u = await makeUser();
    const created = await request(app).post('/api/exams/attempts').set(auth(u)).send({ subjects: ['history'], topics: ['ww1'], count: 1, durationMinutes: 5 });
    const a = created.body.attempt;
    expect(a.questions[0].type).toBe('written');
    const sub = await request(app).post(`/api/exams/attempts/${a.id}/submit`).set(auth(u)).send({ responses: { [a.questions[0].id]: 'The alliance system and nationalism; the trigger was Sarajevo.' } });
    expect(sub.body.grades[0].status).toBe('needs_review');
    expect(sub.body.grades[0].matchedCriteria).toEqual(['alliances', 'nationalism', 'trigger']);
    expect((await request(app).post(`/api/exams/attempts/${a.id}/review`).set(auth(u)).send({ questionId: a.questions[0].id, pointsAwarded: 99 })).status).toBe(400);
    const rev = await request(app).post(`/api/exams/attempts/${a.id}/review`).set(auth(u)).send({ questionId: a.questions[0].id, pointsAwarded: 4 });
    expect(rev.body.summary.percent).toBe(100);
    expect(rev.body.summary.pendingReview).toBe(0);
    const got = await request(app).get(`/api/exams/attempts/${a.id}`).set(auth(u));
    expect(got.body.attempt.status).toBe('reviewed');
  });

  it('ignores responses sent after the deadline', async () => {
    const u = await makeUser();
    const a = (await request(app).post('/api/exams/attempts').set(auth(u)).send({ subjects: ['math'], topics: ['percentages'], count: 1, durationMinutes: 1 })).body.attempt;
    await pool.query("UPDATE exam_attempts SET deadline_at = now() - interval '5 minutes' WHERE id = $1", [a.id]);
    expect((await request(app).put(`/api/exams/attempts/${a.id}/responses`).set(auth(u)).send({ responses: {} })).status).toBe(409);
    const { rows } = await pool.query('SELECT questions FROM exam_attempts WHERE id = $1', [a.id]);
    const sub = await request(app).post(`/api/exams/attempts/${a.id}/submit`).set(auth(u)).send({ responses: { [a.questions[0].id]: rows[0].questions[0].answer } });
    expect(sub.body.summary.late).toBe(true);
    expect(sub.body.grades[0].status).toBe('unanswered');
  });

  it('enforces the daily exam quota and supports templates and custom questions', async () => {
    const u = await makeUser();
    const custom = await request(app).post('/api/exams/bank').set(auth(u)).send({ subject: 'math', topic: 'my-topic', difficulty: 1, type: 'mcq', prompt: 'Pick two', choices: ['1', '2'], answer: 1 });
    expect(custom.status).toBe(201);
    expect((await request(app).post('/api/exams/bank').set(auth(u)).send({ subject: 'math', topic: 't', difficulty: 1, type: 'mcq', prompt: 'bad', choices: ['1', '2'], answer: 5 })).status).toBe(400);
    const tpl = await request(app).post('/api/exams/templates').set(auth(u)).send({ title: 'Mine', config: { topics: ['my-topic'], count: 1, durationMinutes: 2 } });
    const fromTpl = await request(app).post('/api/exams/attempts').set(auth(u)).send({ templateId: tpl.body.id });
    expect(fromTpl.body.attempt.questions[0].prompt).toBe('Pick two');
    await request(app).post('/api/exams/attempts').set(auth(u)).send({ count: 1 }).expect(201);
    await request(app).post('/api/exams/attempts').set(auth(u)).send({ count: 1 }).expect(201);
    expect((await request(app).post('/api/exams/attempts').set(auth(u)).send({ count: 1 })).status).toBe(429);
  });
});

describe('flashcards & memory mode', () => {
  it('schedules reviews with SM-2, tracks leeches and replays offline reviews', async () => {
    const u = await makeUser();
    const deck = (await request(app).post('/api/flashcards/decks').set(auth(u)).send({ title: 'Vocab', subject: 'languages', cards: [{ front: 'chat', back: 'cat' }, { front: 'chien', back: 'dog' }] })).body.deck;
    const due = await request(app).get('/api/flashcards/due').set(auth(u));
    expect(due.body.cards).toHaveLength(2);
    const card = due.body.cards[0];
    const r1 = await request(app).post(`/api/flashcards/cards/${card.id}/review`).set(auth(u)).send({ rating: 'good', elapsedMs: 2000 });
    expect(r1.body.schedule.intervalDays).toBe(1);
    expect((await request(app).get('/api/flashcards/due').set(auth(u))).body.cards).toHaveLength(1);
    const other = due.body.cards[1];
    const now = Date.now();
    const sync = await request(app).post('/api/flashcards/sync').set(auth(u)).send({ reviews: [
      { cardId: other.id, rating: 'again', at: now - 3000 }, { cardId: other.id, rating: 'again', at: now - 2000 },
      { cardId: other.id, rating: 'again', at: now - 1000 }, { cardId: other.id, rating: 'again', at: now - 500 },
      { cardId: '00000000-0000-0000-0000-000000000000', rating: 'good', at: now }, { cardId: other.id, rating: 'good', at: now + 3_600_000 },
    ] });
    expect(sync.body.applied).toBe(4);
    expect(sync.body.skipped).toHaveLength(2);
    const cards = await request(app).get(`/api/flashcards/decks/${deck.id}/cards`).set(auth(u));
    expect(cards.body.cards.find((c: { id: string }) => c.id === other.id).leech).toBe(true);
    const bundle = await request(app).get('/api/flashcards/offline-bundle').set(auth(u));
    expect(bundle.body.cards).toHaveLength(2);
    const logs = await pool.query('SELECT count(*)::int AS n FROM review_logs WHERE user_id = $1', [u.id]);
    expect(logs.rows[0].n).toBe(5);
  });
});

describe('weakness detector & study plan', () => {
  it('finds weak topics, explains why, and honours overrides', async () => {
    const u = await makeUser();
    const records = [
      ...Array.from({ length: 8 }, (_, i) => ({ subject: 'math', topic: 'fractions', correct: i % 4 === 0, timeSpent: 90, expectedTime: 40, mistakeTag: 'common denominator' })),
      ...Array.from({ length: 8 }, () => ({ subject: 'math', topic: 'algebra', correct: true, timeSpent: 30, expectedTime: 40 })),
      ...Array.from({ length: 6 }, (_, i) => ({ subject: 'chemistry', topic: 'balancing', correct: i < 2, timeSpent: 60, expectedTime: 60 })),
    ];
    await request(app).post('/api/progress/practice').set(auth(u)).send({ records }).expect(201);
    const w = await request(app).get('/api/progress/weaknesses').set(auth(u));
    expect(w.body.report.topics[0].topic).toBe('fractions');
    expect(w.body.report.topics[0].reasons.length).toBeGreaterThan(0);
    expect(w.body.report.repeatedMistakes[0].tag).toBe('common denominator');
    const plan = await request(app).get('/api/progress/plan?days=3').set(auth(u));
    expect(plan.body.plan.some((t: { topic: string }) => t.topic === 'fractions')).toBe(true);
    await request(app).put('/api/progress/plan/overrides').set(auth(u)).send({ exclude: ['fractions'], pin: ['algebra'], minutesPerDay: 30 }).expect(200);
    const plan2 = await request(app).get('/api/progress/plan?days=3').set(auth(u));
    expect(plan2.body.plan.some((t: { topic: string }) => t.topic === 'fractions')).toBe(false);
    expect(plan2.body.plan[0].topic).toBe('algebra');
    expect(plan2.body.plan[0].reason).toMatch(/pinned/);
    const summary = await request(app).get('/api/progress/summary').set(auth(u));
    expect(summary.body.today.answered).toBe(22);
    expect(summary.body.streakDays).toBe(1);
  });
});

describe('offline game progress sync', () => {
  it('merges progress from two devices without losing anything', async () => {
    const u = await makeUser();
    const phone = { id: 'math-rush', gameId: 'math-rush', highScore: 1200, bestLevel: 3, unlockedLevel: 4, stars: { '1': 3, '2': 2 }, counters: { phone: { plays: 5, correct: 50, answered: 60 } }, updatedAt: 1, version: 3 };
    const web = { id: 'math-rush', gameId: 'math-rush', highScore: 900, bestLevel: 4, unlockedLevel: 5, stars: { '2': 3 }, counters: { web: { plays: 2, correct: 15, answered: 20 } }, updatedAt: 2, version: 1 };
    await request(app).post('/api/progress/games/sync').set(auth(u)).send({ records: [phone] }).expect(200);
    const r = await request(app).post('/api/progress/games/sync').set(auth(u)).send({ records: [web] });
    const m = r.body.merged[0];
    expect(m.highScore).toBe(1200);
    expect(m.unlockedLevel).toBe(5);
    expect(m.stars).toEqual({ '1': 3, '2': 3 });
    expect(Object.keys(m.counters).sort()).toEqual(['phone', 'web']);
    // Replaying the same payload is idempotent for scores and counters.
    const again = await request(app).post('/api/progress/games/sync').set(auth(u)).send({ records: [web] });
    expect(again.body.merged[0].counters).toEqual(m.counters);
    expect((await request(app).post('/api/progress/games/sync').set(auth(u)).send({ records: [{ ...web, gameId: 'not-a-game' }] })).status).toBe(400);
  });

  it('serves downloadable question packs with an integrity hash', async () => {
    const u = await makeUser();
    const list = await request(app).get('/api/progress/packs').set(auth(u));
    const pack = await request(app).get(`/api/progress/packs/${list.body.packs[0].id}`).set(auth(u));
    const { createHash } = await import('node:crypto');
    const { canonicalJson } = await import('@exammate/core');
    expect(createHash('sha256').update(canonicalJson(pack.body.pack.payload)).digest('hex')).toBe(pack.body.pack.sha256);
  });
});
