import type { Options, Store, IncrementResponse, ClientRateLimitInfo } from 'express-rate-limit';
import { config } from '../config.js';
import { pool } from '../db/pool.js';

/**
 * Fixed-window rate-limit counters in PostgreSQL, so every API instance enforces the same limit.
 * One atomic upsert per request: the window restarts when its reset time has passed.
 */
export class PgRateLimitStore implements Store {
  windowMs = 60_000;
  localKeys = false;
  constructor(public prefix: string) {}

  init(options: Options) { this.windowMs = options.windowMs; }

  private key(k: string) { return `${this.prefix}:${k}`; }

  async increment(k: string): Promise<IncrementResponse> {
    const { rows } = await pool.query(
      `INSERT INTO rate_limits (key, hits, reset_at) VALUES ($1, 1, now() + $2 * interval '1 millisecond')
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + $2 * interval '1 millisecond' ELSE rate_limits.reset_at END
       RETURNING hits, reset_at`,
      [this.key(k), this.windowMs],
    );
    // Occasionally clear expired windows so the table stays small.
    if (Math.random() < 0.01) void pool.query('DELETE FROM rate_limits WHERE reset_at < now()').catch(() => undefined);
    return { totalHits: rows[0].hits, resetTime: new Date(rows[0].reset_at) };
  }

  async get(k: string): Promise<ClientRateLimitInfo | undefined> {
    const { rows } = await pool.query('SELECT hits, reset_at FROM rate_limits WHERE key = $1 AND reset_at > now()', [this.key(k)]);
    return rows[0] ? { totalHits: rows[0].hits, resetTime: new Date(rows[0].reset_at) } : undefined;
  }

  async decrement(k: string) { await pool.query('UPDATE rate_limits SET hits = GREATEST(0, hits - 1) WHERE key = $1', [this.key(k)]); }
  async resetKey(k: string) { await pool.query('DELETE FROM rate_limits WHERE key = $1', [this.key(k)]); }
}

/** Store for a named limiter: shared PostgreSQL counters in production (or when configured), in-process memory otherwise. */
export function limiterStore(name: string): Store | undefined {
  const mode = config.RATE_LIMIT_STORE ?? (config.NODE_ENV === 'production' ? 'postgres' : 'memory');
  return mode === 'postgres' ? new PgRateLimitStore(name) : undefined;
}
