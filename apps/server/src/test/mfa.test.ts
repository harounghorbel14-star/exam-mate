import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, decryptSecret, encryptSecret, hotp, otpauthUri, timeStep, verifyTotp } from '../auth/totp.js';
import { pool } from '../db/pool.js';
import { app, auth, makeUser, request } from './helpers.js';
import { MFA_MAX_ATTEMPTS } from '../http/routes/auth.js';

const codeFor = (secret: string, ms = Date.now()) => hotp(base32Decode(secret), timeStep(ms));

describe('TOTP primitives', () => {
  it('matches the RFC 6238 SHA-1 test vectors (8 digits) and RFC 4226 HOTP values', () => {
    const key = Buffer.from('12345678901234567890');
    // RFC 6238 Appendix B (SHA-1): time → 8-digit TOTP
    const vectors: Array<[number, string]> = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
    for (const [t, expected] of vectors) expect(hotp(key, Math.floor(t / 30), 8)).toBe(expected);
    // RFC 4226 Appendix D: first HOTP values
    expect([0, 1, 2, 3].map((c) => hotp(key, c))).toEqual(['755224', '287082', '359152', '969429']);
  });
  it('base32 round-trips, verifies with ±1 step drift and rejects replays', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    const now = 1_700_000_000_000;
    const step = timeStep(now);
    expect(verifyTotp(secret, codeFor(secret, now), now, null)).toBe(step);
    expect(verifyTotp(secret, codeFor(secret, now - 30_000), now, null)).toBe(step - 1);
    expect(verifyTotp(secret, codeFor(secret, now - 90_000), now, null)).toBeNull();
    expect(verifyTotp(secret, codeFor(secret, now), now, step)).toBeNull(); // already used
    expect(verifyTotp(secret, 'abcdef', now, null)).toBeNull();
    expect(otpauthUri(secret, 'a@b.c')).toMatch(/^otpauth:\/\/totp\/ExamMate%20AI%3Aa%40b\.c\?secret=GEZ/);
  });
  it('encrypts secrets at rest with authenticated encryption', () => {
    const blob = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(blob)).toBe('JBSWY3DPEHPK3PXP');
    const parts = blob.split(':');
    parts[3] = Buffer.from('tampered!!').toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });
});

async function enroll(u: Awaited<ReturnType<typeof makeUser>>) {
  const setup = await request(app).post('/api/auth/mfa/setup').set(auth(u)).send({ password: u.password }).expect(200);
  const secret = setup.body.secret as string;
  const en = await request(app).post('/api/auth/mfa/enable').set(auth(u)).send({ code: codeFor(secret) }).expect(200);
  return { secret, recoveryCodes: en.body.recoveryCodes as string[] };
}

/** Moves the stored "last used step" back so a test can use the current code again for a fresh login. */
const allowReuse = (id: string) => pool.query('UPDATE users SET mfa_last_step = mfa_last_step - 3 WHERE id = $1', [id]);

describe('two-factor sign-in', () => {
  it('setup needs the password and is not active until confirmed; secrets are stored encrypted', async () => {
    const u = await makeUser();
    expect((await request(app).post('/api/auth/mfa/setup').set(auth(u)).send({ password: 'wrong password!!' })).status).toBe(401);
    const setup = await request(app).post('/api/auth/mfa/setup').set(auth(u)).send({ password: u.password }).expect(200);
    expect(setup.body.otpauthUri).toContain(setup.body.secret);
    expect((await request(app).get('/api/auth/mfa').set(auth(u))).body.enabled).toBe(false);
    // Not yet confirmed: login still works with the password alone.
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: u.password })).body.token).toBeTruthy();
    expect((await request(app).post('/api/auth/mfa/enable').set(auth(u)).send({ code: '000000' })).status).toBe(400);
    await request(app).post('/api/auth/mfa/enable').set(auth(u)).send({ code: codeFor(setup.body.secret) }).expect(200);
    const { rows } = await pool.query('SELECT mfa_secret_enc FROM users WHERE id = $1', [u.id]);
    expect(rows[0].mfa_secret_enc).not.toContain(setup.body.secret);
    const status = await request(app).get('/api/auth/mfa').set(auth(u));
    expect(status.body).toMatchObject({ enabled: true, recoveryCodesRemaining: 10 });
    expect((await request(app).get('/api/account/export').set(auth(u))).text).not.toContain(setup.body.secret);
  });

  it('password alone no longer signs in; a valid code does, and the same code cannot be replayed', async () => {
    const u = await makeUser();
    const { secret } = await enroll(u);
    await allowReuse(u.id);
    const first = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password }).expect(200);
    expect(first.body).toEqual({ mfaRequired: true, challenge: expect.any(String) });
    expect(first.headers['set-cookie']).toBeUndefined();
    expect(first.body.token).toBeUndefined();
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: first.body.challenge, code: '123456' })).status).toBe(401);
    const code = codeFor(secret);
    const ok = await request(app).post('/api/auth/login/mfa').send({ challenge: first.body.challenge, code }).expect(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.headers['set-cookie']?.[0]).toMatch(/em_session=/);
    // challenge is single use
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: first.body.challenge, code })).status).toBe(401);
    // replaying the same code on a new challenge fails
    const again = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: again.body.challenge, code })).status).toBe(401);
  });

  it('a challenge dies after too many wrong codes', async () => {
    const u = await makeUser();
    const { secret } = await enroll(u);
    await allowReuse(u.id);
    const { body: c } = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    for (let i = 0; i < MFA_MAX_ATTEMPTS; i++) await request(app).post('/api/auth/login/mfa').send({ challenge: c.challenge, code: '000000' }).expect(401);
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: c.challenge, code: codeFor(secret) })).status).toBe(401);
    // still possible with a fresh challenge
    const { body: c2 } = await request(app).post('/api/auth/login').send({ email: u.email, password: u.password });
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: c2.challenge, code: codeFor(secret) })).status).toBe(200);
  });

  it('recovery codes work once each; regenerating replaces them; disabling needs password and a code', async () => {
    const u = await makeUser();
    const { secret, recoveryCodes } = await enroll(u);
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    const login = async () => (await request(app).post('/api/auth/login').send({ email: u.email, password: u.password })).body.challenge as string;
    const rc = recoveryCodes[0]!.toUpperCase().replace(/-/g, ' ');
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: await login(), recoveryCode: rc })).status).toBe(200);
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: await login(), recoveryCode: recoveryCodes[0] })).status).toBe(401);
    expect((await request(app).get('/api/auth/mfa').set(auth(u))).body.recoveryCodesRemaining).toBe(9);
    await allowReuse(u.id);
    const regen = await request(app).post('/api/auth/mfa/recovery-codes').set(auth(u)).send({ code: codeFor(secret) }).expect(200);
    expect((await request(app).post('/api/auth/login/mfa').send({ challenge: await login(), recoveryCode: recoveryCodes[1] })).status).toBe(401);
    await allowReuse(u.id);
    expect((await request(app).post('/api/auth/mfa/disable').set(auth(u)).send({ password: 'wrong password!!', code: codeFor(secret) })).status).toBe(401);
    expect((await request(app).post('/api/auth/mfa/disable').set(auth(u)).send({ password: u.password, code: '000000' })).status).toBe(401);
    await request(app).post('/api/auth/mfa/disable').set(auth(u)).send({ password: u.password, recoveryCode: regen.body.recoveryCodes[0] }).expect(200);
    expect((await request(app).post('/api/auth/login').send({ email: u.email, password: u.password })).body.token).toBeTruthy();
    const events = (await pool.query('SELECT event FROM audit_log WHERE user_id = $1 ORDER BY id', [u.id])).rows.map((r) => r.event);
    expect(events).toEqual(expect.arrayContaining(['auth.mfa_enabled', 'auth.login_mfa_challenge', 'auth.mfa_recovery_regenerated', 'auth.mfa_disabled']));
  });

  it('other users cannot touch your second factor; anonymous calls are rejected', async () => {
    expect((await request(app).get('/api/auth/mfa')).status).toBe(401);
    expect((await request(app).post('/api/auth/mfa/setup').send({ password: 'x' })).status).toBe(401);
    const a = await makeUser(), b = await makeUser();
    await enroll(a);
    expect((await request(app).get('/api/auth/mfa').set(auth(b))).body.enabled).toBe(false);
    // b's login is unaffected by a's 2FA
    expect((await request(app).post('/api/auth/login').send({ email: b.email, password: b.password })).body.token).toBeTruthy();
  });
});
