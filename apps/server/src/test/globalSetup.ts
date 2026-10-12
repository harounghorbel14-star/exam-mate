import pg from 'pg';
import { rm } from 'node:fs/promises';

/** Reset the test database schema and storage before the suite runs. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://exammate:exammate_dev_password@localhost:5432/exammate_test';
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
  await rm('./.test-storage', { recursive: true, force: true });
  process.env.DATABASE_URL = url;
  const { migrate } = await import('../db/migrate.js');
  const { pool } = await import('../db/pool.js');
  await migrate(pool, () => undefined);
  const { seedQuestionBank, seedContentPacks } = await import('../services/seed.js');
  await seedQuestionBank();
  await seedContentPacks();
  await pool.end();
}
