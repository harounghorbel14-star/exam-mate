import { pool } from '../db/pool.js';
import { log } from '../logger.js';

/**
 * Mail delivery abstraction. No SMTP provider is configured in this build, so messages are
 * stored in the outbox table (visible to operators) instead of being sent. Plug a real
 * transport into `deliver` for production.
 */
export async function sendMail(to: string, subject: string, body: string): Promise<void> {
  await pool.query('INSERT INTO outbox_emails (to_email, subject, body) VALUES ($1, $2, $3)', [to, subject, body]);
  log('info', 'email queued in outbox', { subject });
}
