import { describe, it, expect } from 'vitest';
import { app, makeUser, auth, request } from './helpers.js';
import { pool } from '../db/pool.js';

function tokenFromOutbox(body: string): string {
  return /token=([A-Za-z0-9_-]+)/.exec(body)![1]!;
}

describe('authentication', () => {
  it('registers, logs in, and returns the current user', async () => {
    const u = await makeUser();
    const me = await request(app).get('/api/auth/me').set(auth(u));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(u.email);
    const login = await request(app).post('/api/auth/login').send({ email: u.email.toUpperCase(), password: u.password });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie']?.[0]).toMatch(/em_session=.*HttpOnly/);
  });

  it('stores only a scrypt hash, never the password', async () => {
    const u = await makeUser();
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [u.id]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(rows[0].password_hash).not.toContain(u.password);
    const s = await pool.query('SELECT token_hash FROM sessions WHERE user_id = $1', [u.id]);
    expect(s.rows[0].token_hash).not.toBe(u.token);
  });

  it('rejects wrong passwords, weak passwords and duplicates', async () => {
    const u = await makeUser();
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'wrong password!!' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'nobody@example.test', password: 'whatever12345' })).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send({ email: 'x@example.test', password: 'short', displayName: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ email: u.email, password: 'another long password', displayName: 'x' })).status).toBe(409);
    const audit = await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE event = 'auth.login_failed'");
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(2);
  });

  it('verifies email and resets password through single-use tokens', async () => {
    const u = await makeUser();
    const verify = await pool.query("SELECT body FROM outbox_emails WHERE to_email = $1 AND subject LIKE 'Verify%'", [u.email]);
    const vtoken = tokenFromOutbox(verify.rows[0].body);
    expect((await request(app).post('/api/auth/verify-email').send({ token: vtoken })).status).toBe(200);
    expect((await request(app).post('/api/auth/verify-email').send({ token: vtoken })).status).toBe(400);
    expect((await request(app).get('/api/auth/me').set(auth(u))).body.user.emailVerified).toBe(true);

    expect((await request(app).post('/api/auth/request-password-reset').send({ email: u.email })).status).toBe(200);
    expect((await request(app).post('/api/auth/request-password-reset').send({ email: 'missing@example.test' })).status).toBe(200);
    const reset = await pool.query("SELECT body FROM outbox_emails WHERE to_email = $1 AND subject LIKE 'Reset%'", [u.email]);
    const rtoken = tokenFromOutbox(reset.rows[0].body);
    expect((await request(app).post('/api/auth/reset-password').send({ token: rtoken, password: 'a brand new password' })).status).toBe(200);
    // Old sessions are revoked after a reset.
    expect((await request(app).get('/api/auth/me').set(auth(u))).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'a brand new password' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: rtoken, password: 'yet another password' })).status).toBe(400);
  });

  it('requires the CSRF header for cookie-authenticated mutations', async () => {
    const u = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: u.email, password: u.password }).expect(200);
    expect((await agent.get('/api/account/profile')).status).toBe(200);
    expect((await agent.put('/api/account/preferences').send({ theme: 'dark' })).status).toBe(403);
    expect((await agent.put('/api/account/preferences').set('x-exammate-client', '1').send({ theme: 'dark' })).status).toBe(200);
    // Bearer clients (mobile) are not subject to CSRF.
    expect((await request(app).put('/api/account/preferences').set(auth(u)).send({ theme: 'light' })).status).toBe(200);
  });

  it('logs out and lists/revokes sessions', async () => {
    const u = await makeUser();
    const second = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    const sessions = await request(app).get('/api/auth/sessions').set(auth(u));
    expect(sessions.body.sessions).toHaveLength(2);
    const other = sessions.body.sessions.find((s: { current: boolean }) => !s.current);
    await request(app).delete(`/api/auth/sessions/${other.id}`).set(auth(u)).expect(200);
    expect((await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${second.body.token}` })).status).toBe(401);
    await request(app).post('/api/auth/logout').set(auth(u)).expect(200);
    expect((await request(app).get('/api/auth/me').set(auth(u))).status).toBe(401);
  });

  it('validates input and handles malformed JSON', async () => {
    expect((await request(app).post('/api/auth/login').set('content-type', 'application/json').send('{bad')).status).toBe(400);
    const r = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'x', displayName: '' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
  });
});

describe('account lockout', () => {
  it('locks an account after 5 failures, for real and unknown emails alike, and a reset unlocks it', async () => {
    const u = await makeUser();
    for (let i = 0; i < 5; i++) expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'wrong password!!' })).status).toBe(401);
    const locked = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('account_locked');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(800);
    // Unknown emails behave identically (no enumeration).
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ email: 'ghost@example.test', password: 'whatever12345' });
    expect((await request(app).post('/api/auth/login').send({ email: 'ghost@example.test', password: 'whatever12345' })).body.error.code).toBe('account_locked');
    // Other accounts are unaffected.
    const v = await makeUser();
    expect((await request(app).post('/api/auth/login').send({ email: v.email, password: v.password })).status).toBe(200);
    // Password reset clears the lock.
    await request(app).post('/api/auth/request-password-reset').send({ email: u.email });
    const reset = await pool.query("SELECT body FROM outbox_emails WHERE to_email = $1 AND subject LIKE 'Reset%' ORDER BY created_at DESC LIMIT 1", [u.email]);
    const token = /token=([A-Za-z0-9_-]+)/.exec(reset.rows[0].body)![1];
    await request(app).post('/api/auth/reset-password').send({ token, password: 'a fresh new password' }).expect(200);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: 'a fresh new password' })).status).toBe(200);
  });

  it('resets the failure counter after a successful login', async () => {
    const u = await makeUser();
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ email: u.email, password: 'wrong password!!' });
    await request(app).post('/api/auth/login').send({ email: u.email, password: u.password }).expect(200);
    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/login').send({ email: u.email, password: 'wrong password!!' });
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: u.password })).status).toBe(200);
  });
});
