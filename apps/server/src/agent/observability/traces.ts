import { pool } from '../../db/pool.js';
import { sha256 } from '../../auth/tokens.js';
import { config } from '../../config.js';

export interface TraceStep { step: string; tool?: string; ok: boolean; ms: number; note?: string }

/** Persist a privacy-respecting trace: only a hash of the input, never the raw question. */
export async function recordTrace(t: { userId: string | null; taskKind: string; input: string; plan: string[]; steps: TraceStep[]; outcome: string; latencyMs: number }): Promise<string> {
  const { rows } = await pool.query(
    'INSERT INTO agent_traces (user_id, task_kind, input_hash, plan, steps, outcome, latency_ms) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [t.userId, t.taskKind, sha256(t.input).slice(0, 16), JSON.stringify(t.plan), JSON.stringify(t.steps), t.outcome, Math.round(t.latencyMs)],
  );
  return rows[0].id;
}

export async function pruneTraces(): Promise<number> {
  const r = await pool.query(`DELETE FROM agent_traces WHERE created_at < now() - ($1 || ' days')::interval`, [String(config.TRACE_RETENTION_DAYS)]);
  return r.rowCount ?? 0;
}

export async function traceMetrics(sinceHours = 24) {
  const { rows } = await pool.query(
    `SELECT task_kind, outcome, count(*)::int AS n,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95
     FROM agent_traces WHERE created_at > now() - ($1 || ' hours')::interval
     GROUP BY task_kind, outcome ORDER BY task_kind, outcome`,
    [String(sinceHours)],
  );
  const tools = await pool.query(
    `SELECT s->>'tool' AS tool, count(*)::int AS n, avg((s->>'ms')::numeric)::int AS avg_ms, sum(CASE WHEN (s->>'ok')::boolean THEN 0 ELSE 1 END)::int AS failures
     FROM agent_traces, jsonb_array_elements(steps) s
     WHERE created_at > now() - ($1 || ' hours')::interval AND s ? 'tool'
     GROUP BY 1 ORDER BY 2 DESC`,
    [String(sinceHours)],
  );
  return { outcomes: rows.map((r) => ({ ...r, p50: Number(r.p50), p95: Number(r.p95) })), tools: tools.rows };
}
