import { config } from './config.js';
import { createApp } from './http/app.js';
import { migrate } from './db/migrate.js';
import { seedQuestionBank, seedContentPacks } from './services/seed.js';
import { startWorker } from './services/jobs.js';
import { pruneTraces } from './agent/observability/traces.js';
import { shutdownOcr } from './services/ocr.js';
import { pool } from './db/pool.js';
import { log } from './logger.js';
import { RoomManager } from './multiplayer/rooms.js';
import { attachMultiplayer } from './multiplayer/ws.js';
import { DEFAULT_MP_TIMINGS } from '@exammate/core';

async function main() {
  await migrate(undefined, (m) => log('info', m));
  const seeded = await seedQuestionBank();
  await seedContentPacks();
  if (seeded) log('info', 'seeded question bank', { questions: seeded });
  const stopWorker = config.RUN_WORKER_INLINE ? startWorker() : () => undefined;
  const pruneTimer = setInterval(() => { void pruneTraces().catch(() => undefined); }, 6 * 3600_000);
  const rooms = config.MP_ENABLED ? new RoomManager({
    timings: { ...DEFAULT_MP_TIMINGS, turnMs: config.MP_TURN_SECONDS * 1000 },
    graceMs: config.MP_RECONNECT_GRACE_SECONDS * 1000,
    idleMs: config.MP_ROOM_IDLE_MINUTES * 60_000,
  }) : null;
  if (rooms) {
    const restored = await rooms.restore();
    if (restored) log('info', 'restored multiplayer rooms', { rooms: restored });
    rooms.startSweeper();
  }
  const server = createApp({ rooms: rooms ?? undefined }).listen(config.PORT, () => log('info', 'ExamMate API listening', { port: config.PORT, llmMode: config.LLM_MODE, multiplayer: !!rooms }));
  const mp = rooms ? attachMultiplayer(server, rooms, { origins: config.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) }) : null;
  const shutdown = async () => {
    log('info', 'shutting down');
    clearInterval(pruneTimer);
    stopWorker();
    mp?.close();
    await rooms?.shutdown();
    server.close();
    await shutdownOcr();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => { log('error', 'startup failed', { message: (e as Error).message }); process.exit(1); });
