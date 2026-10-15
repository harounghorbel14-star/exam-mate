import { pool } from '../db/pool.js';

export type AuditEvent =
  | 'auth.register' | 'auth.login' | 'auth.login_failed' | 'auth.logout' | 'auth.password_reset_requested' | 'auth.password_reset'
  | 'auth.login_mfa_challenge' | 'auth.login_mfa_failed' | 'auth.mfa_enabled' | 'auth.mfa_disabled' | 'auth.mfa_recovery_regenerated'
  | 'auth.email_verified' | 'account.deleted' | 'account.exported' | 'billing.checkout_started' | 'billing.upgraded' | 'billing.canceled'
  | 'document.uploaded' | 'document.deleted' | 'memory.cleared' | 'model.activated' | 'model.rollback' | 'security.upload_rejected';

export async function audit(event: AuditEvent, userId: string | null, meta: { ip?: string; userAgent?: string; details?: Record<string, unknown> } = {}): Promise<void> {
  await pool.query('INSERT INTO audit_log (user_id, event, ip, user_agent, details) VALUES ($1, $2, $3, $4, $5)', [userId, event, meta.ip ?? null, meta.userAgent?.slice(0, 300) ?? null, meta.details ?? {}]);
}
