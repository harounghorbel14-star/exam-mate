import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { config } from '../config.js';
import { pool } from '../db/pool.js';
import { loadUser, csrfGuard, errorHandler, CSRF_HEADER } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { accountRouter } from './routes/account.js';
import { solveRouter } from './routes/solve.js';
import { documentsRouter } from './routes/documents.js';
import { flashcardsRouter } from './routes/flashcards.js';
import { examsRouter } from './routes/exams.js';
import { progressRouter } from './routes/progress.js';
import { billingRouter } from './routes/billing.js';
import { agentRouter } from './routes/agent.js';
import '../services/documentJobs.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], frameAncestors: ["'none'"], workerSrc: ["'self'", 'blob:'], mediaSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  const origins = config.APP_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  app.use('/api', cors({ origin: (o, cb) => cb(null, !o || origins.includes(o)), credentials: true, allowedHeaders: ['content-type', 'authorization', CSRF_HEADER] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', rateLimit({ windowMs: 60_000, limit: config.NODE_ENV === 'test' ? 10_000 : 300, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api', loadUser, csrfGuard);
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.get('/api/health', async (_req, res) => {
    const db = await pool.query('SELECT 1').then(() => 'ok').catch(() => 'down');
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, time: new Date().toISOString() });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api', solveRouter);
  app.use('/api/documents', documentsRouter);
  app.use('/api/flashcards', flashcardsRouter);
  app.use('/api/exams', examsRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Unknown endpoint' } }));

  // Optionally serve the built web app (single-origin deployment).
  const webDist = process.env.WEB_DIST ?? path.resolve(process.cwd(), '../web/dist');
  if (existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist, { index: false, maxAge: '1h', setHeaders: (res, p) => { if (p.endsWith('sw.js') || p.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache'); } }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
