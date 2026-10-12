import { pool } from '../db/pool.js';
import { hashToken, newToken } from '../auth/tokens.js';

const TICKET_TTL_MS = 60_000;

/**
 * WebSocket tickets: browsers cannot attach an Authorization header to a WebSocket, and putting a
 * long-lived session token in a URL would leak it into logs. Instead an authenticated REST call
 * issues a random single-use ticket (stored hashed) that expires after 60 seconds.
 */
export async function issueTicket(userId: string): Promise<{ ticket: string; expiresAt: Date }> {
  const ticket = newToken(32);
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);
  await pool.query('DELETE FROM mp_tickets WHERE expires_at < now()');
  await pool.query('INSERT INTO mp_tickets (ticket_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(ticket), userId, expiresAt]);
  return { ticket, expiresAt };
}

/** Atomically consumes a ticket; replaying it (or an expired one) yields null. */
export async function consumeTicket(ticket: string): Promise<{ id: string; displayName: string } | null> {
  const { rows } = await pool.query(
    `WITH t AS (DELETE FROM mp_tickets WHERE ticket_hash = $1 RETURNING user_id, expires_at)
     SELECT u.id, u.display_name FROM t JOIN users u ON u.id = t.user_id WHERE t.expires_at > now()`,
    [hashToken(ticket)],
  );
  return rows[0] ? { id: rows[0].id, displayName: rows[0].display_name } : null;
}
