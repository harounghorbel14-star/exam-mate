import { hostname } from 'node:os';
import { pool } from '../db/pool.js';
import { log } from '../logger.js';

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const handlers = new Map<string, JobHandler>();
const WORKER_ID = `${hostname()}:${process.pid}`;

export function registerJob(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

export async function enqueue(kind: string, payload: Record<string, unknown>, opts: { maxAttempts?: number } = {}): Promise<string> {
  const { rows } = await pool.query('INSERT INTO jobs (kind, payload, max_attempts) VALUES ($1, $2, $3) RETURNING id', [kind, payload, opts.maxAttempts ?? 3]);
  wake?.();
  return rows[0].id as string;
}

/** Claim one ready job with SKIP LOCKED so several workers can run safely. Stale locks (>10 min) are reclaimed. */
export async function runOnce(): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE jobs SET status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1
     WHERE id = (
       SELECT id FROM jobs
       WHERE (status = 'queued' AND run_at <= now()) OR (status = 'running' AND locked_at < now() - interval '10 minutes')
       ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id, kind, payload, attempts, max_attempts`,
    [WORKER_ID],
  );
  const job = rows[0];
  if (!job) return false;
  const handler = handlers.get(job.kind);
  try {
    if (!handler) throw new Error(`No handler for job kind ${job.kind}`);
    await handler(job.payload);
    await pool.query("UPDATE jobs SET status = 'done', finished_at = now(), last_error = NULL WHERE id = $1", [job.id]);
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    const final = job.attempts >= job.max_attempts;
    // Exponential backoff: 5s, 20s, 80s…
    await pool.query(
      `UPDATE jobs SET status = $2, last_error = $3, run_at = now() + ($4 || ' seconds')::interval, finished_at = CASE WHEN $2 = 'failed' THEN now() END WHERE id = $1`,
      [job.id, final ? 'failed' : 'queued', message, String(5 * 4 ** (job.attempts - 1))],
    );
    log('warn', 'job failed', { kind: job.kind, attempts: job.attempts, final, message });
    if (final) await failureHooks.get(job.kind)?.(job.payload, message);
  }
  return true;
}

const failureHooks = new Map<string, (payload: Record<string, unknown>, error: string) => Promise<void>>();
export function onJobFailed(kind: string, hook: (payload: Record<string, unknown>, error: string) => Promise<void>) {
  failureHooks.set(kind, hook);
}

let wake: (() => void) | null = null;
let stopped = false;

export function startWorker(pollMs = 1000): () => void {
  stopped = false;
  const loop = async () => {
    while (!stopped) {
      let worked = false;
      try { worked = await runOnce(); } catch (e) { log('error', 'worker loop error', { message: (e as Error).message }); }
      if (!worked) await new Promise<void>((resolve) => { const t = setTimeout(resolve, pollMs); wake = () => { clearTimeout(t); resolve(); }; });
    }
  };
  void loop();
  return () => { stopped = true; wake?.(); };
}

/** Process all currently ready jobs (used by tests and CLI). */
export async function drain(max = 100): Promise<number> {
  let n = 0;
  while (n < max && (await runOnce())) n++;
  return n;
}
