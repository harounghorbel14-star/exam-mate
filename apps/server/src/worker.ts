import { startWorker } from './services/jobs.js';
import './services/documentJobs.js';
import { log } from './logger.js';

/** Standalone background worker (set RUN_WORKER_INLINE=false on API nodes when running this). */
const stop = startWorker();
log('info', 'worker started');
process.on('SIGTERM', () => { stop(); process.exit(0); });
