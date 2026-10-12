import { describe, it, expect } from 'vitest';
import { app, makeUser, auth, request } from './helpers.js';
import { pool } from '../db/pool.js';
import { drain } from '../services/jobs.js';

describe('billing (test mode only)', () => {
  it('never upgrades without explicit confirmation and never charges', async () => {
    const u = await makeUser();
    const plans = await request(app).get('/api/billing/plans').set(auth(u));
    expect(plans.body.testMode).toBe(true);
    const checkout = await request(app).post('/api/billing/checkout').set(auth(u)).send({ plan: 'premium' });
    expect(checkout.body.amountCharged).toBe(0);
    expect((await request(app).get('/api/billing/subscription').set(auth(u))).body.effectivePlan).toBe('free');
    expect((await request(app).post('/api/billing/test/confirm').set(auth(u)).send({ sessionId: checkout.body.sessionId })).status).toBe(400);
    const other = await makeUser();
    expect((await request(app).post('/api/billing/test/confirm').set(auth(other)).send({ sessionId: checkout.body.sessionId, acknowledgeTestMode: true })).status).toBe(400);
    const ok = await request(app).post('/api/billing/test/confirm').set(auth(u)).send({ sessionId: checkout.body.sessionId, acknowledgeTestMode: true });
    expect(ok.body).toMatchObject({ plan: 'premium', testMode: true, amountCharged: 0 });
    expect((await request(app).post('/api/billing/test/confirm').set(auth(u)).send({ sessionId: checkout.body.sessionId, acknowledgeTestMode: true })).status).toBe(400);
    const usage = await request(app).get('/api/account/usage').set(auth(u));
    expect(usage.body.plan).toBe('premium');
    expect(usage.body.limits.dailyAiRequests).toBe(500);
    await request(app).post('/api/billing/cancel').set(auth(u)).expect(200);
    expect((await request(app).get('/api/account/usage').set(auth(u))).body.plan).toBe('free');
    const events = await pool.query('SELECT kind, test_mode FROM billing_events WHERE user_id = $1 ORDER BY created_at', [u.id]);
    expect(events.rows.every((e) => e.test_mode)).toBe(true);
  });

  it('unlocks premium document features after an upgrade', async () => {
    const u = await makeUser();
    const doc = await request(app).post('/api/documents').set(auth(u)).attach('file', Buffer.from('# Cells\nThe cell is the basic unit of life.\nF = m * a'), 'c.md');
    await drain();
    expect((await request(app).post(`/api/documents/${doc.body.document.id}/revision-sheet`).set(auth(u)).send({})).status).toBe(402);
    const c = await request(app).post('/api/billing/checkout').set(auth(u)).send({ plan: 'premium' });
    await request(app).post('/api/billing/test/confirm').set(auth(u)).send({ sessionId: c.body.sessionId, acknowledgeTestMode: true }).expect(200);
    const sheet = await request(app).post(`/api/documents/${doc.body.document.id}/revision-sheet`).set(auth(u)).send({});
    expect(sheet.status).toBe(200);
    expect(sheet.body.sheet.formulas[0].item).toBe('F = m * a');
  });
});

describe('profile, preferences and personal AI memory', () => {
  it('stores onboarding choices as user memory and lets the user edit and delete memory', async () => {
    const u = await makeUser();
    await request(app).put('/api/account/profile').set(auth(u)).send({ academicLevel: 'high', subjects: ['math', 'physics'], goals: ['exam'], locale: 'fr', onboarded: true }).expect(200);
    const prof = await request(app).get('/api/account/profile').set(auth(u));
    expect(prof.body.profile).toMatchObject({ academicLevel: 'high', locale: 'fr', onboarded: true });
    let mem = (await request(app).get('/api/account/memory').set(auth(u))).body.items;
    expect(mem.map((m: { key: string }) => m.key).sort()).toEqual(['academic_level', 'exam', 'math', 'physics']);
    expect(mem.every((m: { source: string }) => m.source === 'user')).toBe(true);
    await request(app).put('/api/account/memory').set(auth(u)).send({ kind: 'preference', key: 'units', value: 'SI' }).expect(200);
    const target = (await request(app).get('/api/account/memory').set(auth(u))).body.items.find((m: { key: string }) => m.key === 'units');
    await request(app).delete(`/api/account/memory/${target.id}`).set(auth(u)).expect(200);
    // Solving records inferred concepts, unless memory is disabled.
    await request(app).post('/api/solve').set(auth(u)).send({ question: '2x = 6' });
    mem = (await request(app).get('/api/account/memory').set(auth(u))).body.items;
    expect(mem.some((m: { kind: string; source: string }) => m.kind === 'concept' && m.source === 'inferred')).toBe(true);
    await request(app).put('/api/account/preferences').set(auth(u)).send({ memoryEnabled: false }).expect(200);
    mem = (await request(app).get('/api/account/memory').set(auth(u))).body.items;
    expect(mem.some((m: { source: string }) => m.source === 'inferred')).toBe(false);
    await request(app).post('/api/solve').set(auth(u)).send({ question: '3x = 6' });
    expect((await request(app).get('/api/account/memory').set(auth(u))).body.items.some((m: { source: string }) => m.source === 'inferred')).toBe(false);
    const cleared = await request(app).delete('/api/account/memory').set(auth(u));
    expect(cleared.body.deleted).toBeGreaterThan(0);
  });

  it('never stores sensitive-looking inferred memory', async () => {
    const { remember } = await import('../agent/memory/memoryService.js');
    const u = await makeUser();
    expect(await remember(u.id, { kind: 'note', key: 'contact', value: 'me@example.com', source: 'inferred' })).toBe(false);
    expect(await remember(u.id, { kind: 'note', key: 'phone', value: '+216 22 333 444', source: 'inferred' })).toBe(false);
    expect(await remember(u.id, { kind: 'concept', key: 'math:equation', value: '1', source: 'inferred' })).toBe(true);
  });

  it('handles note version conflicts', async () => {
    const u = await makeUser();
    const n = (await request(app).post('/api/account/notes').set(auth(u)).send({ title: 'T', body: 'v1' })).body.note;
    await request(app).put(`/api/account/notes/${n.id}`).set(auth(u)).send({ title: 'T', body: 'v2', version: 1 }).expect(200);
    const stale = await request(app).put(`/api/account/notes/${n.id}`).set(auth(u)).send({ title: 'T', body: 'stale', version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentVersion).toBe(2);
  });
});

describe('data export and account deletion', () => {
  it('exports all personal data and deletes everything on request', async () => {
    const u = await makeUser();
    await request(app).post('/api/solve').set(auth(u)).send({ question: '2x = 4', save: true });
    const doc = await request(app).post('/api/documents').set(auth(u)).attach('file', Buffer.from('Cells are small.'), 'a.txt');
    await drain();
    await request(app).post('/api/account/notes').set(auth(u)).send({ title: 'n', body: 'b' });
    const exp = await request(app).get('/api/account/export').set(auth(u));
    expect(exp.status).toBe(200);
    expect(exp.body.format).toBe('exammate-export-v1');
    expect(exp.body.questions).toHaveLength(1);
    expect(exp.body.documents[0].id).toBe(doc.body.document.id);
    expect(exp.body.user[0].email).toBe(u.email);
    expect(JSON.stringify(exp.body)).not.toContain('password_hash');
    expect((await request(app).delete('/api/account').set(auth(u)).send({ password: 'wrong password' })).status).toBe(401);
    await request(app).delete('/api/account').set(auth(u)).send({ password: u.password }).expect(200);
    for (const t of ['questions', 'documents', 'document_chunks', 'notes', 'sessions', 'learning_memory', 'ai_usage']) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = $1`, [u.id]);
      expect(rows[0].n, t).toBe(0);
    }
    expect((await request(app).get('/api/auth/me').set(auth(u))).status).toBe(401);
    const audit = await pool.query("SELECT user_id FROM audit_log WHERE event = 'account.deleted' ORDER BY created_at DESC LIMIT 1");
    expect(audit.rows[0].user_id).toBeNull(); // audit row kept, link to the person removed
  });
});
