import { config } from './config.js';
import { createApp } from './http/app.js';
import { migrate } from './db/migrate.js';
import { seedQuestionBank, seedContentPacks } from './services/seed.js';
import { startWorker } from './services/jobs.js';
import { pruneTraces } from './agent/observability/traces.js';
import { shutdownOcr } from './services/ocr.js';
import { pool } from './db/pool.js';
import { log } from './logger.js';

async function main() {
  await migrate(undefined, (m) => log('info', m));
  const seeded = await seedQuestionBank();
  await seedContentPacks();
  if (seeded) log('info', 'seeded question bank', { questions: seeded });
  const stopWorker = config.RUN_WORKER_INLINE ? startWorker() : () => undefined;
  const pruneTimer = setInterval(() => { void pruneTraces().catch(() => undefined); }, 6 * 3600_000);
  const server = createApp().listen(config.PORT, () => log('info', 'ExamMate API listening', { port: config.PORT, llmMode: config.LLM_MODE }));
  const shutdown = async () => {
    log('info', 'shutting down');
    clearInterval(pruneTimer);
    stopWorker();
    server.close();
    await shutdownOcr();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { log('error', 'startup failed', { message: (e as Error).message }); process.exit(1); });
