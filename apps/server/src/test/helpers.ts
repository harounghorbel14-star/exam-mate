import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../http/app.js';
import { pool } from '../db/pool.js';

export const app = createApp();

export interface TestUser { id: string; email: string; token: string; password: string }

export async function makeUser(opts: { admin?: boolean; locale?: 'en' | 'fr' | 'ar' } = {}): Promise<TestUser> {
  const email = `u${randomUUID().slice(0, 8)}@example.test`;
  const password = 'correct horse battery';
  const res = await request(app).post('/api/auth/register').send({ email, password, displayName: 'Test', locale: opts.locale ?? 'en' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  if (opts.admin) await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [res.body.user.id]);
  return { id: res.body.user.id, email, token: res.body.token, password };
}

export const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
export { request };
