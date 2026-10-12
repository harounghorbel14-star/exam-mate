import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { pool, withTransaction } from '../../db/pool.js';
import { config } from '../../config.js';
import { limitsFor, planOf } from '../../services/plans.js';
import { audit } from '../../services/audit.js';
import { asyncHandler, body, clientMeta, requireAuth } from '../middleware.js';
import { HttpError, badRequest } from '../errors.js';

/**
 * Billing layer. No live payment provider is configured in this build, so only TEST MODE is
 * available: nothing is ever charged, every response says so, and upgrading requires an
 * explicit confirmation step with the checkout session id. A real provider (e.g. Stripe
 * Checkout + signed webhooks) must be added server-side before charging anyone.
 */
export const billingRouter = Router();
billingRouter.use(requireAuth);

const pending = new Map<string, { userId: string; plan: 'premium'; expires: number }>();

billingRouter.get('/plans', asyncHandler(async (_req, res) => {
  res.json({
    testMode: config.BILLING_PROVIDER === 'test', provider: config.BILLING_PROVIDER,
    plans: [
      { id: 'free', price: null, limits: limitsFor('free') },
      { id: 'premium', price: config.PREMIUM_PRICE_LABEL, limits: limitsFor('premium') },
    ],
  });
}));

billingRouter.get('/subscription', asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT plan, status, provider, current_period_end FROM subscriptions WHERE user_id = $1', [req.user!.id]);
  res.json({ subscription: rows[0] ?? { plan: 'free', status: 'active', provider: 'none' }, effectivePlan: await planOf(req.user!.id), testMode: config.BILLING_PROVIDER === 'test' });
}));

billingRouter.post('/checkout', asyncHandler(async (req, res) => {
  const { plan } = body(z.object({ plan: z.literal('premium') }), req);
  if (config.BILLING_PROVIDER !== 'test') throw new HttpError(501, 'billing_unavailable', 'No payment provider is configured');
  const sessionId = `test_cs_${randomUUID()}`;
  pending.set(sessionId, { userId: req.user!.id, plan, expires: Date.now() + 15 * 60_000 });
  await pool.query('INSERT INTO billing_events (user_id, kind, provider, test_mode, payload) VALUES ($1, $2, $3, true, $4)', [req.user!.id, 'checkout.created', 'test', { sessionId, plan }]);
  await audit('billing.checkout_started', req.user!.id, { ...clientMeta(req), details: { testMode: true } });
  res.json({ testMode: true, sessionId, amountCharged: 0, message: 'TEST MODE: no payment will be taken. Confirm explicitly to activate Premium for 30 days.' });
}));

billingRouter.post('/test/confirm', asyncHandler(async (req, res) => {
  const p = body(z.object({ sessionId: z.string().startsWith('test_cs_'), acknowledgeTestMode: z.literal(true) }), req);
  const s = pending.get(p.sessionId);
  if (!s || s.userId !== req.user!.id || s.expires < Date.now()) throw badRequest('Unknown or expired checkout session');
  pending.delete(p.sessionId);
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO subscriptions (user_id, plan, status, provider, provider_ref, current_period_end) VALUES ($1, 'premium', 'active', 'test', $2, now() + interval '30 days')
       ON CONFLICT (user_id) DO UPDATE SET plan = 'premium', status = 'active', provider = 'test', provider_ref = $2, current_period_end = now() + interval '30 days', updated_at = now()`,
      [req.user!.id, p.sessionId],
    );
    await c.query('INSERT INTO billing_events (user_id, kind, provider, test_mode, payload) VALUES ($1, $2, $3, true, $4)', [req.user!.id, 'subscription.activated', 'test', { sessionId: p.sessionId, amountCharged: 0 }]);
  });
  await audit('billing.upgraded', req.user!.id, { ...clientMeta(req), details: { testMode: true } });
  res.json({ ok: true, plan: 'premium', testMode: true, amountCharged: 0 });
}));

billingRouter.post('/cancel', asyncHandler(async (req, res) => {
  await pool.query("UPDATE subscriptions SET plan = 'free', status = 'active', provider = 'none', current_period_end = NULL, updated_at = now() WHERE user_id = $1", [req.user!.id]);
  await pool.query('INSERT INTO billing_events (user_id, kind, provider, test_mode) VALUES ($1, $2, $3, $4)', [req.user!.id, 'subscription.canceled', config.BILLING_PROVIDER, config.BILLING_PROVIDER === 'test']);
  await audit('billing.canceled', req.user!.id, clientMeta(req));
  res.json({ ok: true, plan: 'free' });
}));
