import { pool, type Queryable } from '../db/pool.js';
import { config } from '../config.js';
import { hashToken, newToken } from './tokens.js';

export interface SessionUser { id: string; email: string; displayName: string; role: 'user' | 'admin'; emailVerified: boolean; sessionId: string }

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }, db: Queryable = pool): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + config.SESSION_TTL_DAYS * 86_400_000);
  await db.query('INSERT INTO sessions (user_id, token_hash, ip, user_agent, expires_at) VALUES ($1, $2, $3, $4, $5)', [userId, hashToken(token), meta.ip ?? null, meta.userAgent?.slice(0, 300) ?? null, expiresAt]);
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<SessionUser | null> {
  const { rows } = await pool.query(
    `UPDATE sessions s SET last_used_at = now() FROM users u
     WHERE s.token_hash = $1 AND s.user_id = u.id AND s.expires_at > now()
     RETURNING s.id AS session_id, u.id, u.email, u.display_name, u.role, u.email_verified_at`,
    [hashToken(token)],
  );
  const r = rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, displayName: r.display_name, role: r.role, emailVerified: !!r.email_verified_at, sessionId: r.session_id };
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE user_id = $1 AND ($2::uuid IS NULL OR id <> $2)', [userId, exceptSessionId ?? null]);
}
