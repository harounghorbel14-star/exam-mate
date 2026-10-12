import { Router } from 'express';
import { z } from 'zod';
import { buildExam, gradeAnswer, summarizeAttempt, allocateTime, pick, type ExamQuestion, type GradeResult, type Locale } from '@exammate/core';
import { pool, withTransaction } from '../../db/pool.js';
import { consumeQuota } from '../../services/plans.js';
import type { BankPayload } from '../../services/seed.js';
import { asyncHandler, body, requireAuth } from '../middleware.js';
import { HttpError, badRequest, notFound } from '../errors.js';

export const examsRouter = Router();
examsRouter.use(requireAuth);

const GRACE_MS = 60_000;

interface StoredQuestion extends ExamQuestion { expectedSeconds: number }

function materialize(id: string, subject: string, topic: string, difficulty: 1 | 2 | 3, p: BankPayload, locale: Locale): StoredQuestion {
  const base = { id, subject, topic, difficulty, points: p.points, prompt: pick(p.prompt, locale), expectedSeconds: p.expectedSeconds, ...(p.explanation ? { explanation: pick(p.explanation, locale) } : {}) };
  switch (p.type) {
    case 'mcq': case 'truefalse': return { ...base, type: p.type, choices: p.choices!.map((c) => pick(c, locale)), answer: p.answer as number };
    case 'numeric': return { ...base, type: 'numeric', answer: Number((p.answer as string[])[0]), ...(p.tolerance !== undefined ? { tolerance: p.tolerance } : {}) };
    case 'short': return { ...base, type: 'short', answer: p.answer as string[] };
    case 'written': return { ...base, type: 'written', rubric: (p.rubric ?? []).map((r) => ({ id: r.id, description: pick(r.description, locale), points: r.points, keywords: r.keywords })) };
  }
}

/** Strip answers, rubrics and explanations before sending questions to the client during an attempt. */
function publicQuestion(q: StoredQuestion) {
  return { id: q.id, type: q.type, prompt: q.prompt, subject: q.subject, topic: q.topic, difficulty: q.difficulty, points: q.points, choices: q.choices, expectedSeconds: q.expectedSeconds };
}

examsRouter.get('/topics', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT subject, topic, count(*)::int AS n FROM question_bank WHERE owner_id IS NULL OR owner_id = $1 GROUP BY subject, topic ORDER BY subject, topic', [req.user!.id]);
  res.json({ topics: rows });
}));

const BankQuestionInput = z.object({
  subject: z.string().trim().min(1).max(40), topic: z.string().trim().min(1).max(60), difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(['mcq', 'truefalse', 'numeric', 'short', 'written']), prompt: z.string().trim().min(3).max(2000),
  choices: z.array(z.string().trim().min(1).max(300)).min(2).max(6).optional(), answer: z.union([z.number(), z.array(z.string().max(200)).min(1)]).optional(),
  tolerance: z.number().min(0).optional(), points: z.number().min(0.5).max(20).default(1), expectedSeconds: z.number().int().min(10).max(1800).default(60),
  rubric: z.array(z.object({ id: z.string().max(30), description: z.string().max(300), points: z.number().min(0).max(20), keywords: z.array(z.string().max(60)).max(20).default([]) })).max(10).optional(),
});

examsRouter.post('/bank', asyncHandler(async (req, res) => {
  const q = body(BankQuestionInput, req);
  if ((q.type === 'mcq' || q.type === 'truefalse') && (!q.choices || typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length)) throw badRequest('Choice questions need choices and a valid answer index');
  if (q.type === 'numeric' && typeof q.answer !== 'number') throw badRequest('Numeric questions need a numeric answer');
  if (q.type === 'short' && !Array.isArray(q.answer)) throw badRequest('Short-answer questions need accepted answers');
  const same = (s: string) => ({ en: s, fr: s, ar: s });
  const payload: BankPayload = {
    type: q.type, prompt: same(q.prompt), points: q.points, expectedSeconds: q.expectedSeconds,
    ...(q.choices ? { choices: q.choices.map(same) } : {}),
    ...(q.type === 'numeric' ? { answer: [String(q.answer)] } : q.answer !== undefined ? { answer: q.answer as number | string[] } : {}),
    ...(q.tolerance !== undefined ? { tolerance: q.tolerance } : {}),
    ...(q.rubric ? { rubric: q.rubric.map((r) => ({ ...r, description: same(r.description) })) } : {}),
  };
  const { rows } = await pool.query("INSERT INTO question_bank (owner_id, subject, topic, difficulty, payload, source) VALUES ($1, $2, $3, $4, $5, 'user') RETURNING id", [req.user!.id, q.subject, q.topic, q.difficulty, payload]);
  res.status(201).json({ id: rows[0].id });
}));

examsRouter.get('/bank/mine', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, subject, topic, difficulty, payload, created_at FROM question_bank WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 500', [req.user!.id]);
  res.json({ questions: rows });
}));

examsRouter.delete('/bank/:id', asyncHandler(async (req, res) => {
  const r = await pool.query('DELETE FROM question_bank WHERE id = $1 AND owner_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
}));

const ExamConfig = z.object({
  title: z.string().trim().max(120).optional(),
  subjects: z.array(z.string().max(40)).max(10).optional(),
  topics: z.array(z.string().max(60)).max(30).optional(),
  difficulty: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).max(3).optional(),
  count: z.number().int().min(1).max(60).default(10),
  durationMinutes: z.number().int().min(1).max(300).default(20),
  seed: z.number().int().optional(),
  strategyMode: z.boolean().default(false),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
});

examsRouter.get('/templates', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, title, config, created_at FROM exam_templates WHERE user_id = $1 ORDER BY created_at DESC', [req.user!.id]);
  res.json({ templates: rows });
}));
examsRouter.post('/templates', asyncHandler(async (req, res) => {
  const t = body(z.object({ title: z.string().trim().min(1).max(120), config: ExamConfig }), req);
  const { rows } = await pool.query('INSERT INTO exam_templates (user_id, title, config) VALUES ($1, $2, $3) RETURNING id', [req.user!.id, t.title, t.config]);
  res.status(201).json({ id: rows[0].id });
}));
examsRouter.delete('/templates/:id', asyncHandler(async (req, res) => {
  const r = await pool.query('DELETE FROM exam_templates WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
}));

examsRouter.post('/attempts', asyncHandler(async (req, res) => {
  const input = body(ExamConfig.extend({ templateId: z.string().uuid().optional() }), req);
  let cfg = input;
  if (input.templateId) {
    const { rows } = await pool.query('SELECT config FROM exam_templates WHERE id = $1 AND user_id = $2', [input.templateId, req.user!.id]);
    if (!rows[0]) throw notFound('Template not found');
    cfg = { ...ExamConfig.parse(rows[0].config), locale: input.locale, templateId: input.templateId };
  }
  await consumeQuota(req.user!.id, 'exam');
  const { rows: bank } = await pool.query('SELECT id, subject, topic, difficulty, payload FROM question_bank WHERE owner_id IS NULL OR owner_id = $1', [req.user!.id]);
  const all = bank.map((b) => materialize(b.id, b.subject, b.topic, b.difficulty, b.payload, cfg.locale));
  const seed = cfg.seed ?? Math.floor(Math.random() * 2 ** 31);
  const questions = buildExam(all, { subjects: cfg.subjects, topics: cfg.topics, difficulty: cfg.difficulty, count: cfg.count, durationMinutes: cfg.durationMinutes, seed }) as StoredQuestion[];
  if (questions.length === 0) throw badRequest('No questions match these settings');
  const deadline = new Date(Date.now() + cfg.durationMinutes * 60_000);
  const { rows } = await pool.query(
    'INSERT INTO exam_attempts (user_id, template_id, config, questions, strategy_mode, deadline_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, started_at, deadline_at',
    [req.user!.id, input.templateId ?? null, { ...cfg, seed }, JSON.stringify(questions), cfg.strategyMode, deadline],
  );
  const strategy = cfg.strategyMode ? allocateTime(cfg.durationMinutes, [1, 2, 3].map((d) => {
    const qs = questions.filter((q) => q.difficulty === d);
    return { name: `difficulty-${d}`, questions: qs.length, pointsEach: qs.length ? qs.reduce((s, q) => s + q.points, 0) / qs.length : 0, difficulty: d as 1 | 2 | 3 };
  }).filter((s) => s.questions > 0)) : null;
  res.status(201).json({ attempt: { ...rows[0], status: 'in_progress', questions: questions.map(publicQuestion), strategy } });
}));

examsRouter.get('/attempts', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, config, status, summary, strategy_mode, started_at, deadline_at, submitted_at FROM exam_attempts WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50', [req.user!.id]);
  res.json({ attempts: rows });
}));

async function ownedAttempt(userId: string, id: string) {
  const { rows } = await pool.query('SELECT * FROM exam_attempts WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(id), userId]);
  if (!rows[0]) throw notFound('Attempt not found');
  return rows[0];
}

examsRouter.get('/attempts/:id', asyncHandler(async (req, res) => {
  const a = await ownedAttempt(req.user!.id, req.params.id!);
  const questions = a.questions as StoredQuestion[];
  if (a.status === 'in_progress') return res.json({ attempt: { ...a, questions: questions.map(publicQuestion), grades: null } });
  res.json({ attempt: a });
}));

examsRouter.put('/attempts/:id/responses', asyncHandler(async (req, res) => {
  const a = await ownedAttempt(req.user!.id, req.params.id!);
  if (a.status !== 'in_progress') throw new HttpError(409, 'already_submitted', 'This attempt was already submitted');
  if (Date.now() > new Date(a.deadline_at).getTime() + GRACE_MS) throw new HttpError(409, 'time_up', 'Time is up; submit the attempt');
  const p = body(z.object({ responses: z.record(z.string(), z.unknown()), timings: z.record(z.string(), z.number().min(0).max(36_000)).default({}) }), req);
  const ids = new Set((a.questions as StoredQuestion[]).map((q) => q.id));
  if (Object.keys(p.responses).some((k) => !ids.has(k))) throw badRequest('Unknown question id');
  await pool.query("UPDATE exam_attempts SET responses = responses || $3, timings = timings || $4 WHERE id = $1 AND user_id = $2 AND status = 'in_progress'", [a.id, req.user!.id, p.responses, p.timings]);
  res.json({ ok: true });
}));

function analysis(questions: StoredQuestion[], grades: GradeResult[], timings: Record<string, number>) {
  return questions.map((q) => {
    const g = grades.find((x) => x.questionId === q.id)!;
    const t = timings[q.id] ?? 0;
    return { questionId: q.id, topic: q.topic, status: g.status, timeSpent: t, expected: q.expectedSeconds, overTime: t > q.expectedSeconds * 1.5 };
  });
}

examsRouter.post('/attempts/:id/submit', asyncHandler(async (req, res) => {
  const a = await ownedAttempt(req.user!.id, req.params.id!);
  if (a.status !== 'in_progress') throw new HttpError(409, 'already_submitted', 'This attempt was already submitted');
  const p = body(z.object({ responses: z.record(z.string(), z.unknown()).default({}), timings: z.record(z.string(), z.number().min(0).max(36_000)).default({}) }), req);
  const late = Date.now() > new Date(a.deadline_at).getTime() + GRACE_MS;
  // After the deadline, only responses saved before it count.
  const responses = late ? a.responses : { ...a.responses, ...p.responses };
  const timings = { ...a.timings, ...p.timings };
  const questions = a.questions as StoredQuestion[];
  const grades = questions.map((q) => gradeAnswer(q, responses[q.id]));
  const summary = { ...summarizeAttempt(questions, grades), late, analysis: analysis(questions, grades, timings) };
  await withTransaction(async (c) => {
    await c.query("UPDATE exam_attempts SET responses = $3, timings = $4, grades = $5, summary = $6, status = CASE WHEN $7 THEN 'submitted' ELSE 'reviewed' END, submitted_at = now() WHERE id = $1 AND user_id = $2",
      [a.id, req.user!.id, responses, timings, JSON.stringify(grades), summary, summary.pendingReview > 0]);
    for (const q of questions) {
      const g = grades.find((x) => x.questionId === q.id)!;
      if (g.status === 'needs_review') continue;
      await c.query('INSERT INTO practice_records (user_id, subject, topic, correct, time_spent, expected_time, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [req.user!.id, q.subject, q.topic, g.status === 'correct', timings[q.id] ?? 0, q.expectedSeconds, 'exam']);
    }
  });
  res.json({ grades, summary, questions });
}));

examsRouter.post('/attempts/:id/review', asyncHandler(async (req, res) => {
  const a = await ownedAttempt(req.user!.id, req.params.id!);
  if (a.status === 'in_progress') throw new HttpError(409, 'not_submitted', 'Submit the attempt first');
  const p = body(z.object({ questionId: z.string(), pointsAwarded: z.number().min(0), feedback: z.string().max(1000).optional() }), req);
  const questions = a.questions as StoredQuestion[];
  const q = questions.find((x) => x.id === p.questionId);
  if (!q) throw notFound('Question not found');
  if (p.pointsAwarded > q.points) throw badRequest(`At most ${q.points} points`);
  const grades = (a.grades as GradeResult[]).map((g) => g.questionId === q.id ? { ...g, pointsAwarded: p.pointsAwarded, status: (p.pointsAwarded === q.points ? 'correct' : p.pointsAwarded > 0 ? 'partial' : 'incorrect') as GradeResult['status'], feedback: p.feedback ?? 'Manually reviewed.' } : g);
  const summary = { ...a.summary, ...summarizeAttempt(questions, grades) };
  await withTransaction(async (c) => {
    await c.query("UPDATE exam_attempts SET grades = $3, summary = $4, status = CASE WHEN $5 THEN 'submitted' ELSE 'reviewed' END WHERE id = $1 AND user_id = $2", [a.id, req.user!.id, JSON.stringify(grades), summary, summary.pendingReview > 0]);
    await c.query('INSERT INTO practice_records (user_id, subject, topic, correct, time_spent, expected_time, source) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user!.id, q.subject, q.topic, p.pointsAwarded >= q.points / 2, (a.timings as Record<string, number>)[q.id] ?? 0, q.expectedSeconds, 'exam-review']);
  });
  res.json({ grades, summary });
}));
