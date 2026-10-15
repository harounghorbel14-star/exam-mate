import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { verifyPassword } from '../../auth/passwords.js';
import { storage } from '../../services/storage.js';
import { audit } from '../../services/audit.js';
import { limitsFor, planOf, usageToday } from '../../services/plans.js';
import { forget, forgetAll, listMemory, remember } from '../../agent/memory/memoryService.js';
import { asyncHandler, body, clientMeta, requireAuth, SESSION_COOKIE } from '../middleware.js';
import { notFound, unauthorized } from '../errors.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'languages', 'cs', 'history', 'geography', 'general'] as const;

accountRouter.get('/profile', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT academic_level, subjects, goals, locale, onboarded FROM profiles WHERE user_id = $1', [req.user!.id]);
  const p = rows[0];
  res.json({ profile: { academicLevel: p?.academic_level ?? null, subjects: p?.subjects ?? [], goals: p?.goals ?? [], locale: p?.locale ?? 'en', onboarded: p?.onboarded ?? false } });
}));

accountRouter.put('/profile', asyncHandler(async (req, res) => {
  const p = body(z.object({
    academicLevel: z.enum(['middle', 'high', 'university', 'other']).nullable().optional(),
    subjects: z.array(z.enum(SUBJECTS)).max(9).optional(),
    goals: z.array(z.enum(['exam', 'grades', 'understand', 'habit'])).max(4).optional(),
    locale: z.enum(['en', 'fr', 'ar']).optional(),
    onboarded: z.boolean().optional(),
  }), req);
  await pool.query(
    `INSERT INTO profiles (user_id, academic_level, subjects, goals, locale, onboarded) VALUES ($1, $2, COALESCE($3::text[], '{}'), COALESCE($4::text[], '{}'), COALESCE($5, 'en'), COALESCE($6, false))
     ON CONFLICT (user_id) DO UPDATE SET academic_level = COALESCE($2, profiles.academic_level), subjects = COALESCE($3::text[], profiles.subjects),
       goals = COALESCE($4::text[], profiles.goals), locale = COALESCE($5, profiles.locale), onboarded = COALESCE($6, profiles.onboarded), updated_at = now()`,
    [req.user!.id, p.academicLevel ?? null, p.subjects ?? null, p.goals ?? null, p.locale ?? null, p.onboarded ?? null],
  );
  // Explicit profile choices are user-provided memory (not inferred).
  if (p.academicLevel) await remember(req.user!.id, { kind: 'level', key: 'academic_level', value: p.academicLevel, source: 'user' });
  for (const s of p.subjects ?? []) await remember(req.user!.id, { kind: 'subject', key: s, value: 'studying', source: 'user' });
  for (const g of p.goals ?? []) await remember(req.user!.id, { kind: 'goal', key: g, value: 'active', source: 'user' });
  res.json({ ok: true });
}));

accountRouter.get('/preferences', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT explanation_style, theme, speech_rate, voice, memory_enabled, assessment_mode FROM preferences WHERE user_id = $1', [req.user!.id]);
  const r = rows[0] ?? {};
  res.json({ preferences: { explanationStyle: r.explanation_style ?? 'steps', theme: r.theme ?? 'system', speechRate: r.speech_rate ?? 1, voice: r.voice ?? null, memoryEnabled: r.memory_enabled ?? true, assessmentMode: r.assessment_mode ?? false } });
}));

accountRouter.put('/preferences', asyncHandler(async (req, res) => {
  const p = body(z.object({
    explanationStyle: z.enum(['short', 'steps', 'simple', 'hint']).optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
    speechRate: z.number().min(0.5).max(2).optional(),
    voice: z.string().max(100).nullable().optional(),
    memoryEnabled: z.boolean().optional(),
    assessmentMode: z.boolean().optional(),
  }), req);
  await pool.query(
    `INSERT INTO preferences (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [req.user!.id]);
  await pool.query(
    `UPDATE preferences SET explanation_style = COALESCE($2, explanation_style), theme = COALESCE($3, theme), speech_rate = COALESCE($4, speech_rate),
       voice = CASE WHEN $5::boolean THEN $6 ELSE voice END, memory_enabled = COALESCE($7, memory_enabled), assessment_mode = COALESCE($8, assessment_mode), updated_at = now()
     WHERE user_id = $1`,
    [req.user!.id, p.explanationStyle ?? null, p.theme ?? null, p.speechRate ?? null, p.voice !== undefined, p.voice ?? null, p.memoryEnabled ?? null, p.assessmentMode ?? null],
  );
  if (p.memoryEnabled === false) await pool.query("DELETE FROM learning_memory WHERE user_id = $1 AND source = 'inferred'", [req.user!.id]);
  res.json({ ok: true });
}));

accountRouter.get('/usage', asyncHandler(async (req, res) => {
  const plan = await planOf(req.user!.id);
  const limits = limitsFor(plan);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM documents WHERE user_id = $1', [req.user!.id]);
  res.json({ plan, limits, usage: { aiRequests: await usageToday(req.user!.id, 'ai'), exams: await usageToday(req.user!.id, 'exam'), documents: rows[0].n } });
}));

// ---- Personal AI memory (user-controlled) ----
accountRouter.get('/memory', asyncHandler(async (req, res) => {
  res.json({ items: await listMemory(req.user!.id), retention: 'Inferred items expire after 180 days. Items you add yourself are kept until you delete them.' });
}));

accountRouter.put('/memory', asyncHandler(async (req, res) => {
  const item = body(z.object({ kind: z.enum(['preference', 'level', 'subject', 'goal', 'concept', 'note']), key: z.string().trim().min(1).max(120), value: z.string().trim().min(1).max(500) }), req);
  await remember(req.user!.id, { ...item, source: 'user' });
  res.json({ ok: true });
}));

accountRouter.delete('/memory/:id', asyncHandler(async (req, res) => {
  if (!(await forget(req.user!.id, z.string().uuid().parse(req.params.id)))) throw notFound();
  res.json({ ok: true });
}));

accountRouter.delete('/memory', asyncHandler(async (req, res) => {
  const n = await forgetAll(req.user!.id);
  await audit('memory.cleared', req.user!.id, clientMeta(req));
  res.json({ deleted: n });
}));

// ---- Study subjects ----
accountRouter.get('/subjects', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, color FROM study_subjects WHERE user_id = $1 ORDER BY name', [req.user!.id]);
  res.json({ subjects: rows });
}));
accountRouter.post('/subjects', asyncHandler(async (req, res) => {
  const s = body(z.object({ name: z.string().trim().min(1).max(60), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }), req);
  const { rows } = await pool.query('INSERT INTO study_subjects (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING id, name, color', [req.user!.id, s.name, s.color ?? null]);
  res.status(201).json({ subject: rows[0] });
}));
accountRouter.delete('/subjects/:id', asyncHandler(async (req, res) => {
  const r = await pool.query('DELETE FROM study_subjects WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
}));

// ---- Notes ----
accountRouter.get('/notes', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, title, body, version, updated_at FROM notes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200', [req.user!.id]);
  res.json({ notes: rows });
}));
accountRouter.post('/notes', asyncHandler(async (req, res) => {
  const n = body(z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(50_000).default('') }), req);
  const { rows } = await pool.query('INSERT INTO notes (user_id, title, body) VALUES ($1, $2, $3) RETURNING id, title, body, version, updated_at', [req.user!.id, n.title, n.body]);
  res.status(201).json({ note: rows[0] });
}));
accountRouter.put('/notes/:id', asyncHandler(async (req, res) => {
  const n = body(z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(50_000), version: z.number().int() }), req);
  const { rows } = await pool.query(
    'UPDATE notes SET title = $3, body = $4, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2 AND version = $5 RETURNING id, title, body, version, updated_at',
    [z.string().uuid().parse(req.params.id), req.user!.id, n.title, n.body, n.version],
  );
  if (!rows[0]) {
    const exists = await pool.query('SELECT version FROM notes WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    if (!exists.rowCount) throw notFound();
    return res.status(409).json({ error: { code: 'version_conflict', message: 'The note was changed elsewhere', details: { currentVersion: exists.rows[0].version } } });
  }
  res.json({ note: rows[0] });
}));
accountRouter.delete('/notes/:id', asyncHandler(async (req, res) => {
  const r = await pool.query('DELETE FROM notes WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!r.rowCount) throw notFound();
  res.json({ ok: true });
}));

// ---- Data export and account deletion ----
const EXPORT_QUERIES: Record<string, string> = {
  user: 'SELECT id, email, display_name, created_at, email_verified_at, mfa_enabled_at FROM users WHERE id = $1',
  profile: 'SELECT * FROM profiles WHERE user_id = $1',
  preferences: 'SELECT * FROM preferences WHERE user_id = $1',
  subjects: 'SELECT * FROM study_subjects WHERE user_id = $1',
  documents: 'SELECT id, title, filename, mime, size_bytes, status, page_count, course, exam, created_at FROM documents WHERE user_id = $1',
  questions: 'SELECT * FROM questions WHERE user_id = $1',
  solutions: 'SELECT id, question_id, mode, engine, tool, status, answer, confidence, verification, created_at FROM solutions WHERE user_id = $1',
  flashcardDecks: 'SELECT * FROM flashcard_decks WHERE user_id = $1',
  flashcards: 'SELECT * FROM flashcards WHERE user_id = $1',
  reviewLogs: 'SELECT * FROM review_logs WHERE user_id = $1',
  examAttempts: 'SELECT * FROM exam_attempts WHERE user_id = $1',
  practiceRecords: 'SELECT * FROM practice_records WHERE user_id = $1',
  gameProgress: 'SELECT * FROM game_progress WHERE user_id = $1',
  notes: 'SELECT * FROM notes WHERE user_id = $1',
  memory: 'SELECT * FROM learning_memory WHERE user_id = $1',
  subscription: 'SELECT plan, status, provider, current_period_end FROM subscriptions WHERE user_id = $1',
  usage: 'SELECT day, kind, units FROM ai_usage WHERE user_id = $1',
  feedback: 'SELECT * FROM feedback WHERE user_id = $1',
};

accountRouter.get('/export', asyncHandler(async (req, res) => {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), format: 'exammate-export-v1' };
  for (const [k, q] of Object.entries(EXPORT_QUERIES)) out[k] = (await pool.query(q, [req.user!.id])).rows;
  await audit('account.exported', req.user!.id, clientMeta(req));
  res.setHeader('Content-Disposition', 'attachment; filename="exammate-export.json"');
  res.json(out);
}));

accountRouter.delete('/', asyncHandler(async (req, res) => {
  const { password } = body(z.object({ password: z.string().max(200) }), req);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) throw unauthorized('Password is incorrect');
  await audit('account.deleted', req.user!.id, clientMeta(req));
  await pool.query('DELETE FROM users WHERE id = $1', [req.user!.id]); // cascades to all personal data
  await storage.deletePrefix(req.user!.id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}));
