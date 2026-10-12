import { Router } from 'express';
import { z } from 'zod';
import { analyzeWeaknesses, buildStudyPlan, mergeGameProgress, GAME_IDS, type GameProgressRecord, type PracticeRecord } from '@exammate/core';
import { pool } from '../../db/pool.js';
import { asyncHandler, body, query, requireAuth } from '../middleware.js';
import { notFound } from '../errors.js';

export const progressRouter = Router();
progressRouter.use(requireAuth);

async function records(userId: string, days: number): Promise<PracticeRecord[]> {
  const { rows } = await pool.query(
    `SELECT subject, topic, correct, time_spent, expected_time, mistake_tag, extract(epoch from at) * 1000 AS at
     FROM practice_records WHERE user_id = $1 AND at > now() - ($2 || ' days')::interval ORDER BY at`,
    [userId, String(days)],
  );
  return rows.map((r) => ({ subject: r.subject, topic: r.topic, correct: r.correct, timeSpent: r.time_spent, expectedTime: r.expected_time ?? undefined, mistakeTag: r.mistake_tag ?? undefined, at: Number(r.at) }));
}

progressRouter.post('/practice', asyncHandler(async (req, res) => {
  const p = body(z.object({ records: z.array(z.object({ subject: z.string().max(40), topic: z.string().max(60), correct: z.boolean(), timeSpent: z.number().min(0).max(36_000), expectedTime: z.number().min(0).max(36_000).optional(), mistakeTag: z.string().max(60).optional(), source: z.string().max(30).default('game'), at: z.number().int().optional() })).max(1000) }), req);
  for (const r of p.records) {
    await pool.query('INSERT INTO practice_records (user_id, subject, topic, correct, time_spent, expected_time, mistake_tag, source, at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE(to_timestamp($9 / 1000.0), now()))',
      [req.user!.id, r.subject, r.topic, r.correct, r.timeSpent, r.expectedTime ?? null, r.mistakeTag ?? null, r.source, r.at && r.at <= Date.now() + 300_000 ? r.at : null]);
  }
  res.status(201).json({ saved: p.records.length });
}));

progressRouter.get('/weaknesses', asyncHandler(async (req, res) => {
  const { days } = query(z.object({ days: z.coerce.number().int().min(1).max(365).default(60) }), req);
  const recs = await records(req.user!.id, days);
  res.json({ report: analyzeWeaknesses(recs), totalRecords: recs.length });
}));

progressRouter.get('/plan', asyncHandler(async (req, res) => {
  const p = query(z.object({ days: z.coerce.number().int().min(1).max(30).default(7) }), req);
  const { rows } = await pool.query('SELECT exclude, pin, minutes_per_day FROM study_plan_overrides WHERE user_id = $1', [req.user!.id]);
  const o = rows[0] ?? { exclude: [], pin: [], minutes_per_day: 45 };
  const report = analyzeWeaknesses(await records(req.user!.id, 60));
  res.json({ plan: buildStudyPlan(report, { days: p.days, minutesPerDay: o.minutes_per_day, exclude: o.exclude, pin: o.pin }), overrides: { exclude: o.exclude, pin: o.pin, minutesPerDay: o.minutes_per_day } });
}));

progressRouter.put('/plan/overrides', asyncHandler(async (req, res) => {
  const p = body(z.object({ exclude: z.array(z.string().max(60)).max(50).default([]), pin: z.array(z.string().max(60)).max(20).default([]), minutesPerDay: z.number().int().min(10).max(240).default(45) }), req);
  await pool.query(
    `INSERT INTO study_plan_overrides (user_id, exclude, pin, minutes_per_day) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET exclude = $2, pin = $3, minutes_per_day = $4, updated_at = now()`,
    [req.user!.id, p.exclude, p.pin, p.minutesPerDay],
  );
  res.json({ ok: true });
}));

progressRouter.get('/summary', asyncHandler(async (req, res) => {
  const uid = req.user!.id;
  const [streak, today, exams, due] = await Promise.all([
    pool.query(`WITH days AS (SELECT DISTINCT (at AT TIME ZONE 'UTC')::date AS d FROM practice_records WHERE user_id = $1)
                SELECT count(*)::int AS n FROM (SELECT d, d - (row_number() OVER (ORDER BY d DESC))::int AS grp FROM days) t
                WHERE grp = (SELECT d - 1 FROM (SELECT d, row_number() OVER (ORDER BY d DESC) rn FROM days) x WHERE rn = 1) AND (SELECT max(d) FROM days) >= current_date - 1`, [uid]),
    pool.query("SELECT count(*)::int AS answered, count(*) FILTER (WHERE correct)::int AS correct FROM practice_records WHERE user_id = $1 AND at::date = current_date", [uid]),
    pool.query("SELECT count(*)::int AS n, avg((summary->>'percent')::numeric)::numeric(5,1) AS avg FROM exam_attempts WHERE user_id = $1 AND status <> 'in_progress'", [uid]),
    pool.query("SELECT count(*)::int AS n FROM flashcards WHERE user_id = $1 AND NOT deleted AND (schedule IS NULL OR (schedule->>'dueAt')::bigint <= $2)", [uid, Date.now()]),
  ]);
  res.json({ streakDays: streak.rows[0]?.n ?? 0, today: today.rows[0], exams: { count: exams.rows[0].n, averagePercent: exams.rows[0].avg === null ? null : Number(exams.rows[0].avg) }, dueFlashcards: due.rows[0].n });
}));

// ---------------- Offline game progress sync ----------------
const ProgressRecord = z.object({
  id: z.string().max(40), gameId: z.enum(GAME_IDS), highScore: z.number().int().min(0).max(10_000_000), bestLevel: z.number().int().min(0).max(100),
  unlockedLevel: z.number().int().min(1).max(100), stars: z.record(z.string().max(4), z.number().int().min(0).max(3)),
  counters: z.record(z.string().max(64), z.object({ plays: z.number().int().min(0), correct: z.number().int().min(0), answered: z.number().int().min(0) })),
  updatedAt: z.number().int(), version: z.number().int().min(0),
});

progressRouter.get('/games', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT record FROM game_progress WHERE user_id = $1', [req.user!.id]);
  res.json({ progress: rows.map((r) => r.record) });
}));

/**
 * Merge client progress with the server copy using the conflict-free rules in core
 * (max for monotonic fields, union of stars, per-device counters). Returns the merged state.
 */
progressRouter.post('/games/sync', asyncHandler(async (req, res) => {
  const p = body(z.object({ records: z.array(ProgressRecord).max(GAME_IDS.length) }), req);
  const merged: GameProgressRecord[] = [];
  for (const incoming of p.records) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT record FROM game_progress WHERE user_id = $1 AND game_id = $2 FOR UPDATE', [req.user!.id, incoming.gameId]);
      const result = rows[0] ? mergeGameProgress(rows[0].record as GameProgressRecord, incoming) : { ...incoming, version: incoming.version + 1 };
      await client.query(
        `INSERT INTO game_progress (user_id, game_id, record, version) VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, game_id) DO UPDATE SET record = $3, version = $4, updated_at = now()`,
        [req.user!.id, incoming.gameId, result, result.version],
      );
      await client.query('COMMIT');
      merged.push(result);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  const all = await pool.query('SELECT record FROM game_progress WHERE user_id = $1', [req.user!.id]);
  res.json({ merged, progress: all.rows.map((r) => r.record) });
}));

progressRouter.get('/packs', asyncHandler(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, game_id, version, title, sha256, created_at FROM content_packs ORDER BY created_at');
  res.json({ packs: rows });
}));

progressRouter.get('/packs/:id', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, game_id, version, title, payload, sha256 FROM content_packs WHERE id = $1', [z.string().max(80).parse(req.params.id)]);
  if (!rows[0]) throw notFound();
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ pack: rows[0] });
}));
