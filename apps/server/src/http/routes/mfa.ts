import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../../db/pool.js';
import { verifyPassword } from '../../auth/passwords.js';
import { hashToken } from '../../auth/tokens.js';
import { decryptSecret, encryptSecret, newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUri, verifyTotp } from '../../auth/totp.js';
import { audit } from '../../services/audit.js';
import { asyncHandler, body, clientMeta, requireAuth } from '../middleware.js';
import { badRequest, conflict, unauthorized } from '../errors.js';

/** Two-factor management for the signed-in user. */
export const mfaRouter = Router();
mfaRouter.use(requireAuth);

const Code = z.string().trim().max(32);

async function checkPassword(userId: string, password: string) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) throw unauthorized('Password is incorrect');
}

/**
 * Verifies a TOTP code (or a recovery code) for a user and consumes it atomically:
 * the accepted time step is stored so the same code cannot be used twice, and recovery codes are single use.
 */
export async function consumeSecondFactor(userId: string, input: { code?: string; recoveryCode?: string }, now = Date.now()): Promise<'totp' | 'recovery' | null> {
  if (input.recoveryCode) {
    const { rows } = await pool.query(
      'UPDATE mfa_recovery_codes SET used_at = now() WHERE id = (SELECT id FROM mfa_recovery_codes WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL LIMIT 1) RETURNING id',
      [userId, hashToken(`recovery:${normalizeRecoveryCode(input.recoveryCode)}`)],
    );
    return rows[0] ? 'recovery' : null;
  }
  if (!input.code) return null;
  const { rows } = await pool.query('SELECT mfa_secret_enc, mfa_last_step FROM users WHERE id = $1 AND mfa_enabled_at IS NOT NULL', [userId]);
  if (!rows[0]?.mfa_secret_enc) return null;
  const step = verifyTotp(decryptSecret(rows[0].mfa_secret_enc), input.code, now, rows[0].mfa_last_step === null ? null : Number(rows[0].mfa_last_step));
  if (step === null) return null;
  const upd = await pool.query('UPDATE users SET mfa_last_step = $2 WHERE id = $1 AND (mfa_last_step IS NULL OR mfa_last_step < $2) RETURNING id', [userId, step]);
  return upd.rowCount ? 'totp' : null;
}

async function storeRecoveryCodes(c: { query: typeof pool.query }, userId: string): Promise<string[]> {
  const codes = newRecoveryCodes();
  await c.query('DELETE FROM mfa_recovery_codes WHERE user_id = $1', [userId]);
  for (const code of codes) await c.query('INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)', [userId, hashToken(`recovery:${normalizeRecoveryCode(code)}`)]);
  return codes;
}

mfaRouter.get('/', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.mfa_enabled_at, (SELECT count(*)::int FROM mfa_recovery_codes r WHERE r.user_id = u.id AND r.used_at IS NULL) AS remaining
     FROM users u WHERE u.id = $1`, [req.user!.id]);
  res.json({ enabled: !!rows[0]?.mfa_enabled_at, enabledAt: rows[0]?.mfa_enabled_at ?? null, recoveryCodesRemaining: rows[0]?.remaining ?? 0 });
}));

/** Step 1: re-enter the password, receive a new secret to add to an authenticator app. Nothing changes until it is confirmed. */
mfaRouter.post('/setup', asyncHandler(async (req, res) => {
  const { password } = body(z.object({ password: z.string().max(200) }), req);
  await checkPassword(req.user!.id, password);
  const { rows } = await pool.query('SELECT mfa_enabled_at FROM users WHERE id = $1', [req.user!.id]);
  if (rows[0]?.mfa_enabled_at) throw conflict('Two-factor authentication is already on');
  const secret = newTotpSecret();
  await pool.query('UPDATE users SET mfa_pending_enc = $2 WHERE id = $1', [req.user!.id, encryptSecret(secret)]);
  res.json({ secret, otpauthUri: otpauthUri(secret, req.user!.email) });
}));

/** Step 2: confirm with a code from the app. Returns the recovery codes once. */
mfaRouter.post('/enable', asyncHandler(async (req, res) => {
  const { code } = body(z.object({ code: Code }), req);
  const { rows } = await pool.query('SELECT mfa_pending_enc, mfa_enabled_at FROM users WHERE id = $1', [req.user!.id]);
  if (rows[0]?.mfa_enabled_at) throw conflict('Two-factor authentication is already on');
  if (!rows[0]?.mfa_pending_enc) throw badRequest('Start the setup first');
  const secret = decryptSecret(rows[0].mfa_pending_enc);
  const step = verifyTotp(secret, code, Date.now(), null);
  if (step === null) throw badRequest('That code is not valid. Check the time on your phone and try the newest code.');
  const codes = await withTransaction(async (c) => {
    await c.query('UPDATE users SET mfa_secret_enc = mfa_pending_enc, mfa_pending_enc = NULL, mfa_enabled_at = now(), mfa_last_step = $2 WHERE id = $1', [req.user!.id, step]);
    return storeRecoveryCodes(c, req.user!.id);
  });
  await audit('auth.mfa_enabled', req.user!.id, clientMeta(req));
  res.json({ enabled: true, recoveryCodes: codes });
}));

/** Turning it off needs the password and a current code (or a recovery code). */
mfaRouter.post('/disable', asyncHandler(async (req, res) => {
  const input = body(z.object({ password: z.string().max(200), code: Code.optional(), recoveryCode: Code.optional() }), req);
  await checkPassword(req.user!.id, input.password);
  if (!(await consumeSecondFactor(req.user!.id, input))) throw unauthorized('Invalid code');
  await withTransaction(async (c) => {
    await c.query('UPDATE users SET mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_enabled_at = NULL, mfa_last_step = NULL WHERE id = $1', [req.user!.id]);
    await c.query('DELETE FROM mfa_recovery_codes WHERE user_id = $1', [req.user!.id]);
  });
  await audit('auth.mfa_disabled', req.user!.id, clientMeta(req));
  res.json({ enabled: false });
}));

/** Replaces all recovery codes (the old ones stop working). */
mfaRouter.post('/recovery-codes', asyncHandler(async (req, res) => {
  const input = body(z.object({ code: Code }), req);
  if (!(await consumeSecondFactor(req.user!.id, { code: input.code }))) throw unauthorized('Invalid code');
  const codes = await withTransaction((c) => storeRecoveryCodes(c, req.user!.id));
  await audit('auth.mfa_recovery_regenerated', req.user!.id, clientMeta(req));
  res.json({ recoveryCodes: codes });
}));
