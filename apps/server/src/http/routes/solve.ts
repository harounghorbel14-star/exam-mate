import { Router } from 'express';
import multer from 'multer';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { z } from 'zod';
import { splitQuestions, detectLanguage, SUBJECT_LABELS } from '@exammate/core';
import { pool } from '../../db/pool.js';
import { config } from '../../config.js';
import { runSolveAgent } from '../../agent/core/runner.js';
import { consumeQuota, recordComputeMs } from '../../services/plans.js';
import { recognize, type OcrLang } from '../../services/ocr.js';
import { detectImageType } from '../../services/fileValidation.js';
import { audit } from '../../services/audit.js';
import { asyncHandler, body, clientMeta, query, requireAuth } from '../middleware.js';
import { HttpError, badRequest, notFound } from '../errors.js';

export const solveRouter = Router();
solveRouter.use(['/solve', '/questions', '/solutions', '/scan'], requireAuth);

const solveLimiter = rateLimit({ windowMs: 60_000, limit: config.NODE_ENV === 'test' ? 1000 : 30, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? '0.0.0.0'), message: { error: { code: 'rate_limited', message: 'Too many requests' } } });

async function assertNotInAssessment(userId: string) {
  const { rows } = await pool.query('SELECT assessment_mode FROM preferences WHERE user_id = $1', [userId]);
  if (rows[0]?.assessment_mode) {
    throw new HttpError(423, 'assessment_mode', 'Restricted assessment mode is on: solvers are disabled. Turn it off in Settings after your assessment.');
  }
}

const SolveInput = z.object({
  question: z.string().trim().min(1).max(4000),
  mode: z.enum(['short', 'steps', 'simple', 'hint', 'check', 'similar', 'translate']).default('steps'),
  locale: z.enum(['en', 'fr', 'ar']).default('en'),
  studentAnswer: z.string().max(500).optional(),
  targetLocale: z.enum(['en', 'fr', 'ar']).optional(),
  documentIds: z.array(z.string().uuid()).max(20).optional(),
  source: z.enum(['typed', 'scan', 'voice', 'document']).default('typed'),
  save: z.boolean().default(false),
});

solveRouter.post('/solve', solveLimiter, asyncHandler(async (req, res) => {
  const input = body(SolveInput, req);
  const userId = req.user!.id;
  await assertNotInAssessment(userId);
  const usage = await consumeQuota(userId, 'ai');
  // Cancel the agent run if the client disconnects.
  const controller = new AbortController();
  req.on('close', () => { if (!res.writableEnded) controller.abort('client disconnected'); });
  const result = await runSolveAgent(input, { userId, signal: controller.signal });
  await recordComputeMs(userId, 'ai', result.latencyMs);
  const { rows: q } = await pool.query(
    'INSERT INTO questions (user_id, text, subject, question_type, language, source, saved) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [userId, input.question, result.subject, result.questionType, detectLanguage(input.question), input.source, input.save],
  );
  const { rows: s } = await pool.query(
    `INSERT INTO solutions (question_id, user_id, mode, engine, tool, status, answer, confidence, payload, verification, latency_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [q[0].id, userId, input.mode, result.engine, result.tool, result.status, result.result?.answer ?? result.documentAnswer?.answer ?? result.llmAnswer?.answer ?? result.translation ?? null,
      result.confidence, JSON.stringify(result), JSON.stringify(result.result?.verification ?? []), result.latencyMs],
  );
  res.json({ questionId: q[0].id, solutionId: s[0].id, usage, ...result });
}));

solveRouter.get('/questions', asyncHandler(async (req, res) => {
  const p = query(z.object({ saved: z.enum(['true', 'false']).optional(), bookmarked: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(100).default(20), before: z.string().datetime().optional(), q: z.string().max(100).optional() }), req);
  const { rows } = await pool.query(
    `SELECT q.id, q.text, q.subject, q.question_type, q.source, q.saved, q.bookmarked, q.tags, q.created_at,
            (SELECT json_build_object('id', s.id, 'answer', s.answer, 'confidence', s.confidence, 'engine', s.engine, 'mode', s.mode) FROM solutions s WHERE s.question_id = q.id ORDER BY s.created_at DESC LIMIT 1) AS latest_solution
     FROM questions q WHERE q.user_id = $1 AND ($2::boolean IS NULL OR q.saved = $2) AND ($3::boolean IS NULL OR q.bookmarked = $3)
       AND ($4::timestamptz IS NULL OR q.created_at < $4) AND ($5::text IS NULL OR q.text ILIKE '%' || $5 || '%')
     ORDER BY q.created_at DESC LIMIT $6`,
    [req.user!.id, p.saved === undefined ? null : p.saved === 'true', p.bookmarked === undefined ? null : p.bookmarked === 'true', p.before ?? null, p.q ?? null, p.limit + 1],
  );
  const hasMore = rows.length > p.limit;
  const items = rows.slice(0, p.limit);
  res.json({ items, nextCursor: hasMore ? items[items.length - 1]!.created_at : null });
}));

solveRouter.get('/questions/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { rows } = await pool.query('SELECT * FROM questions WHERE id = $1 AND user_id = $2', [id, req.user!.id]);
  if (!rows[0]) throw notFound();
  const sols = await pool.query('SELECT id, mode, engine, tool, status, answer, confidence, payload, created_at FROM solutions WHERE question_id = $1 AND user_id = $2 ORDER BY created_at DESC', [id, req.user!.id]);
  res.json({ question: rows[0], solutions: sols.rows });
}));

solveRouter.patch('/questions/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const p = body(z.object({ saved: z.boolean().optional(), bookmarked: z.boolean().optional(), tags: z.array(z.string().trim().min(1).max(30)).max(10).optional() }), req);
  const { rowCount } = await pool.query('UPDATE questions SET saved = COALESCE($3, saved), bookmarked = COALESCE($4, bookmarked), tags = COALESCE($5, tags) WHERE id = $1 AND user_id = $2', [id, req.user!.id, p.saved ?? null, p.bookmarked ?? null, p.tags ?? null]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

solveRouter.delete('/questions/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM questions WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

solveRouter.post('/solutions/:id/feedback', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const f = body(z.object({ helpful: z.boolean().optional(), correctedSubject: z.enum(SUBJECT_LABELS as [string, ...string[]]).optional(), allowTraining: z.boolean().default(false), comment: z.string().max(1000).optional() }), req);
  const { rows } = await pool.query('SELECT s.id, q.text FROM solutions s JOIN questions q ON q.id = s.question_id WHERE s.id = $1 AND s.user_id = $2', [id, req.user!.id]);
  if (!rows[0]) throw notFound();
  // The question text is copied only when the user explicitly allows it to be used for training.
  await pool.query('INSERT INTO feedback (user_id, solution_id, helpful, corrected_subject, allow_training, question_text, comment) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [req.user!.id, id, f.helpful ?? null, f.correctedSubject ?? null, f.allowTraining, f.allowTraining ? rows[0].text : null, f.comment ?? null]);
  res.status(201).json({ ok: true });
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

solveRouter.post('/scan', solveLimiter, upload.single('image'), asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  await assertNotInAssessment(userId);
  if (!req.file) throw badRequest('Attach an image in the "image" field');
  const type = detectImageType(req.file.buffer);
  if (!type) {
    await audit('security.upload_rejected', userId, { ...clientMeta(req), details: { reason: 'not an allowed image' } });
    throw badRequest('Only PNG, JPEG or WebP images are accepted');
  }
  const langs = z.array(z.enum(['eng', 'fra', 'ara'])).min(1).max(3).catch(['eng', 'fra']).parse(String(req.body?.langs ?? 'eng,fra').split(',')) as OcrLang[];
  await consumeQuota(userId, 'ocr');
  let ocr;
  try {
    ocr = await recognize(req.file.buffer, langs);
  } catch (e) {
    // Graceful fallback: the client can let the user type the question instead.
    return res.status(503).json({ error: { code: 'ocr_unavailable', message: `Text recognition failed: ${(e as Error).message}. You can type the question instead.` } });
  }
  const questions = splitQuestions(ocr.text);
  res.json({ text: ocr.text, confidence: ocr.confidence, lang: ocr.lang, durationMs: ocr.durationMs, questions, notes: ['Diagrams and handwriting are not interpreted reliably; review the extracted text before solving.'] });
}));
