import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { quotaExceeded } from '../http/errors.js';

export type Plan = 'free' | 'premium';

export interface PlanLimits {
  dailyAiRequests: number;
  maxDocuments: number;
  maxUploadMb: number;
  dailyExams: number;
  features: { advancedDocumentAnalysis: boolean; advancedVerification: boolean; personalizedAnalytics: boolean; expandedTools: boolean };
}

export function limitsFor(plan: Plan): PlanLimits {
  return plan === 'premium'
    ? { dailyAiRequests: config.PREMIUM_DAILY_AI_REQUESTS, maxDocuments: config.PREMIUM_MAX_DOCUMENTS, maxUploadMb: config.PREMIUM_MAX_UPLOAD_MB, dailyExams: config.PREMIUM_DAILY_EXAMS, features: { advancedDocumentAnalysis: true, advancedVerification: true, personalizedAnalytics: true, expandedTools: true } }
    : { dailyAiRequests: config.FREE_DAILY_AI_REQUESTS, maxDocuments: config.FREE_MAX_DOCUMENTS, maxUploadMb: config.FREE_MAX_UPLOAD_MB, dailyExams: config.FREE_DAILY_EXAMS, features: { advancedDocumentAnalysis: false, advancedVerification: false, personalizedAnalytics: false, expandedTools: false } };
}

export async function planOf(userId: string): Promise<Plan> {
  const { rows } = await pool.query("SELECT plan FROM subscriptions WHERE user_id = $1 AND status = 'active' AND (current_period_end IS NULL OR current_period_end > now())", [userId]);
  return (rows[0]?.plan as Plan) ?? 'free';
}

export type UsageKind = 'ai' | 'exam' | 'ocr' | 'document';

export async function usageToday(userId: string, kind: UsageKind): Promise<number> {
  const { rows } = await pool.query('SELECT COALESCE(SUM(units), 0)::int AS n FROM ai_usage WHERE user_id = $1 AND day = current_date AND kind = $2', [userId, kind]);
  return rows[0].n as number;
}

/**
 * Atomically check the daily quota and record one unit. Uses an advisory transaction lock per
 * user+kind so concurrent requests cannot both pass the last remaining unit.
 */
export async function consumeQuota(userId: string, kind: UsageKind, computeMs = 0): Promise<{ used: number; limit: number }> {
  const plan = await planOf(userId);
  const lim = limitsFor(plan);
  const limit = kind === 'exam' ? lim.dailyExams : lim.dailyAiRequests;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${userId}:${kind}`]);
    const { rows } = await client.query('SELECT COALESCE(SUM(units), 0)::int AS n FROM ai_usage WHERE user_id = $1 AND day = current_date AND kind = $2', [userId, kind]);
    const used = rows[0].n as number;
    if (used >= limit) {
      await client.query('ROLLBACK');
      throw quotaExceeded('Daily limit reached for your plan', { kind, used, limit, plan });
    }
    await client.query('INSERT INTO ai_usage (user_id, kind, units, compute_ms) VALUES ($1, $2, 1, $3)', [userId, kind, computeMs]);
    await client.query('COMMIT');
    return { used: used + 1, limit };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function recordComputeMs(userId: string, kind: UsageKind, ms: number): Promise<void> {
  await pool.query('UPDATE ai_usage SET compute_ms = $3 WHERE id = (SELECT id FROM ai_usage WHERE user_id = $1 AND kind = $2 ORDER BY id DESC LIMIT 1)', [userId, kind, Math.round(ms)]);
}
