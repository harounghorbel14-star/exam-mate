import { describe, expect, it } from 'vitest';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { PgRateLimitStore } from '../http/rateLimitStore.js';
import { request } from './helpers.js';

/** Two separate Express apps stand in for two API instances behind a load balancer. */
function instance(prefix: string, limit: number, windowMs: number) {
  const a = express();
  a.use(rateLimit({ windowMs, limit, store: new PgRateLimitStore(prefix), keyGenerator: () => 'client-1', standardHeaders: 'draft-7', legacyHeaders: false }));
  a.get('/', (_req, res) => { res.json({ ok: true }); });
  return a;
}

describe('shared PostgreSQL rate-limit store', () => {
  it('enforces one limit across instances', async () => {
    const prefix = `t-${randomUUID()}`;
    const [a, b] = [instance(prefix, 3, 60_000), instance(prefix, 3, 60_000)];
    const codes = [];
    for (const app of [a, b, a, b, a]) codes.push((await request(app).get('/')).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
  });

  it('counts concurrent hits exactly and opens a new window after it expires', async () => {
    const store = new PgRateLimitStore(`t-${randomUUID()}`);
    store.init({ windowMs: 400 } as never);
    const results = await Promise.all(Array.from({ length: 20 }, () => store.increment('k')));
    expect(results.map((r) => r.totalHits).sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect((await store.get('k'))?.totalHits).toBe(20);
    await store.decrement('k');
    expect((await store.get('k'))?.totalHits).toBe(19);
    await new Promise((r) => setTimeout(r, 450));
    expect((await store.increment('k')).totalHits).toBe(1);
    await store.resetKey('k');
    expect(await store.get('k')).toBeUndefined();
  });
});
