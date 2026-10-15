import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { limiterStore } from '../rateLimitStore.js';
import { pool, withTransaction } from '../../db/pool.js';
import { config } from '../../config.js';
import { hashPassword, verifyPassword, passwordProblems, DUMMY_HASH } from '../../auth/passwords.js';
import { createSession, revokeSession, revokeAllSessions } from '../../auth/sessions.js';
import { hashToken, newToken } from '../../auth/tokens.js';
import { consumeSecondFactor } from './mfa.js';
import { sendMail } from '../../auth/mailer.js';
import { audit } from '../../services/audit.js';
import { asyncHandler, body, clientMeta, requireAuth, SESSION_COOKIE } from '../middleware.js';
import { HttpError, badRequest, conflict, unauthorized } from '../errors.js';

export const authRouter = Router();

const strict = rateLimit({ windowMs: 15 * 60_000, limit: config.NODE_ENV === 'test' ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false, store: limiterStore('auth'), message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } } });

const Email = z.string().trim().toLowerCase().email().max(254);
const Locale = z.enum(['en', 'fr', 'ar']).default('en');

function setSessionCookie(res: import('express').Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: config.COOKIE_SECURE, sameSite: 'lax', expires: expiresAt, path: '/' });
}

async function issueEmailToken(userId: string, purpose: 'verify' | 'reset', ttlMinutes: number): Promise<string> {
  const token = newToken();
  await pool.query('INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, now() + ($4 || \' minutes\')::interval)', [userId, purpose, hashToken(token), String(ttlMinutes)]);
  return token;
}

authRouter.post('/register', strict, asyncHandler(async (req, res) => {
  const input = body(z.object({ email: Email, password: z.string(), displayName: z.string().trim().min(1).max(60), locale: Locale }), req);
  const problems = passwordProblems(input.password);
  if (problems.length) throw badRequest(problems[0]!, problems);
  const hash = await hashPassword(input.password);
  const user = await withTransaction(async (c) => {
    const exists = await c.query('SELECT 1 FROM users WHERE lower(email) = $1', [input.email]);
    if (exists.rowCount) throw conflict('An account with this email already exists');
    const { rows } = await c.query('INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id', [input.email, hash, input.displayName]);
    const id = rows[0].id as string;
    await c.query('INSERT INTO profiles (user_id, locale) VALUES ($1, $2)', [id, input.locale]);
    await c.query('INSERT INTO preferences (user_id) VALUES ($1)', [id]);
    await c.query("INSERT INTO subscriptions (user_id, plan, provider) VALUES ($1, 'free', 'none')", [id]);
    return { id };
  });
  const verifyToken = await issueEmailToken(user.id, 'verify', 60 * 24);
  await sendMail(input.email, 'Verify your ExamMate email', `Open ${config.PUBLIC_APP_URL}/verify-email?token=${verifyToken} to verify your email address.`);
  const session = await createSession(user.id, clientMeta(req));
  setSessionCookie(res, session.token, session.expiresAt);
  await audit('auth.register', user.id, clientMeta(req));
  res.status(201).json({ user: { id: user.id, email: input.email, displayName: input.displayName, emailVerified: false }, token: session.token, expiresAt: session.expiresAt });
}));

export const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_BASE_MINUTES = 15;

authRouter.post('/login', strict, asyncHandler(async (req, res) => {
  const input = body(z.object({ email: Email, password: z.string().max(200) }), req);
  const emailHash = hashToken(`login:${input.email}`);
  const lock = await pool.query('SELECT locked_until FROM login_attempts WHERE email_hash = $1 AND locked_until > now()', [emailHash]);
  if (lock.rows[0]) {
    const retryAfter = Math.ceil((new Date(lock.rows[0].locked_until).getTime() - Date.now()) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    throw new HttpError(429, 'account_locked', 'Too many failed attempts for this account. Try again later or reset your password.', { retryAfterSeconds: retryAfter });
  }
  const { rows } = await pool.query('SELECT id, email, password_hash, display_name, email_verified_at, mfa_enabled_at FROM users WHERE lower(email) = $1', [input.email]);
  const u = rows[0];
  // Always run the KDF so response time does not reveal whether the email exists.
  const ok = await verifyPassword(input.password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok) {
    // Lock after LOCKOUT_THRESHOLD consecutive failures; the lock doubles on each further failure (max 24 h).
    await pool.query(
      `INSERT INTO login_attempts (email_hash, failures) VALUES ($1, 1)
       ON CONFLICT (email_hash) DO UPDATE SET failures = login_attempts.failures + 1, updated_at = now(),
         locked_until = CASE WHEN login_attempts.failures + 1 >= $2
           THEN now() + LEAST(1440, $3 * power(2, login_attempts.failures + 1 - $2)) * interval '1 minute' ELSE login_attempts.locked_until END`,
      [emailHash, LOCKOUT_THRESHOLD, LOCKOUT_BASE_MINUTES],
    );
    await audit('auth.login_failed', u?.id ?? null, { ...clientMeta(req), details: { emailHash: hashToken(input.email).slice(0, 12) } });
    throw unauthorized('Invalid email or password');
  }
  await pool.query('DELETE FROM login_attempts WHERE email_hash = $1', [emailHash]);
  if (u.mfa_enabled_at) {
    // Password was right; a second factor is still needed before any session exists.
    const challenge = newToken();
    await pool.query("INSERT INTO mfa_challenges (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '5 minutes')", [hashToken(challenge), u.id]);
    await pool.query('DELETE FROM mfa_challenges WHERE expires_at < now()');
    await audit('auth.login_mfa_challenge', u.id, clientMeta(req));
    res.json({ mfaRequired: true, challenge });
    return;
  }
  const session = await createSession(u.id, clientMeta(req));
  setSessionCookie(res, session.token, session.expiresAt);
  await audit('auth.login', u.id, clientMeta(req));
  res.json({ user: { id: u.id, email: u.email, displayName: u.display_name, emailVerified: !!u.email_verified_at }, token: session.token, expiresAt: session.expiresAt });
}));

export const MFA_MAX_ATTEMPTS = 5;

/** Second login step: exchange the challenge plus a TOTP or recovery code for a session. */
authRouter.post('/login/mfa', strict, asyncHandler(async (req, res) => {
  const input = body(z.object({ challenge: z.string().min(10).max(200), code: z.string().trim().max(32).optional(), recoveryCode: z.string().trim().max(32).optional() }), req);
  // Each attempt is counted atomically; a challenge dies after MFA_MAX_ATTEMPTS wrong codes or 5 minutes.
  const { rows } = await pool.query(
    'UPDATE mfa_challenges SET attempts = attempts + 1 WHERE token_hash = $1 AND expires_at > now() AND attempts < $2 RETURNING user_id',
    [hashToken(input.challenge), MFA_MAX_ATTEMPTS],
  );
  if (!rows[0]) throw unauthorized('This sign-in attempt expired. Enter your password again.');
  const userId = rows[0].user_id as string;
  const used = await consumeSecondFactor(userId, input);
  if (!used) {
    await audit('auth.login_mfa_failed', userId, clientMeta(req));
    throw unauthorized('Invalid code');
  }
  await pool.query('DELETE FROM mfa_challenges WHERE token_hash = $1', [hashToken(input.challenge)]);
  const { rows: ur } = await pool.query('SELECT id, email, display_name, email_verified_at FROM users WHERE id = $1', [userId]);
  const u = ur[0];
  const session = await createSession(u.id, clientMeta(req));
  setSessionCookie(res, session.token, session.expiresAt);
  await audit('auth.login', u.id, { ...clientMeta(req), details: { secondFactor: used } });
  res.json({ user: { id: u.id, email: u.email, displayName: u.display_name, emailVerified: !!u.email_verified_at }, token: session.token, expiresAt: session.expiresAt });
}));

authRouter.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await revokeSession(req.user!.sessionId, req.user!.id);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  await audit('auth.logout', req.user!.id, clientMeta(req));
  res.json({ ok: true });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: { id: req.user!.id, email: req.user!.email, displayName: req.user!.displayName, emailVerified: req.user!.emailVerified, role: req.user!.role } });
}));

authRouter.post('/verify-email', strict, asyncHandler(async (req, res) => {
  const { token } = body(z.object({ token: z.string().min(10).max(200) }), req);
  const { rows } = await pool.query(
    "UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = 'verify' AND used_at IS NULL AND expires_at > now() RETURNING user_id",
    [hashToken(token)],
  );
  if (!rows[0]) throw badRequest('Invalid or expired verification link');
  await pool.query('UPDATE users SET email_verified_at = now() WHERE id = $1', [rows[0].user_id]);
  await audit('auth.email_verified', rows[0].user_id, clientMeta(req));
  res.json({ ok: true });
}));

authRouter.post('/request-password-reset', strict, asyncHandler(async (req, res) => {
  const { email } = body(z.object({ email: Email }), req);
  const { rows } = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
  if (rows[0]) {
    const token = await issueEmailToken(rows[0].id, 'reset', 30);
    await sendMail(email, 'Reset your ExamMate password', `Open ${config.PUBLIC_APP_URL}/reset-password?token=${token} within 30 minutes to choose a new password. If you did not ask for this, ignore this email.`);
    await audit('auth.password_reset_requested', rows[0].id, clientMeta(req));
  }
  // Same response either way: no account enumeration.
  res.json({ ok: true });
}));

authRouter.post('/reset-password', strict, asyncHandler(async (req, res) => {
  const { token, password } = body(z.object({ token: z.string().min(10).max(200), password: z.string() }), req);
  const problems = passwordProblems(password);
  if (problems.length) throw badRequest(problems[0]!, problems);
  const hash = await hashPassword(password);
  const userId = await withTransaction(async (c) => {
    const { rows } = await c.query("UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = 'reset' AND used_at IS NULL AND expires_at > now() RETURNING user_id", [hashToken(token)]);
    if (!rows[0]) throw badRequest('Invalid or expired reset link');
    await c.query('UPDATE users SET password_hash = $2 WHERE id = $1', [rows[0].user_id, hash]);
    return rows[0].user_id as string;
  });
  await revokeAllSessions(userId);
  const { rows: em } = await pool.query('SELECT lower(email) AS email FROM users WHERE id = $1', [userId]);
  if (em[0]) await pool.query('DELETE FROM login_attempts WHERE email_hash = $1', [hashToken(`login:${em[0].email}`)]);
  await audit('auth.password_reset', userId, clientMeta(req));
  res.json({ ok: true });
}));

authRouter.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query('SELECT id, user_agent, ip, created_at, last_used_at, expires_at FROM sessions WHERE user_id = $1 ORDER BY last_used_at DESC', [req.user!.id]);
  res.json({ sessions: rows.map((r) => ({ ...r, current: r.id === req.user!.sessionId })) });
}));

authRouter.delete('/sessions/:id', requireAuth, asyncHandler(async (req, res) => {
  await revokeSession(z.string().uuid().parse(req.params.id), req.user!.id);
  res.json({ ok: true });
}));
