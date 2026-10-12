import { Router } from 'express';
import { pool } from '../../db/pool.js';
import { getModel } from '../../agent/models/manager.js';
import { detectHardware } from '../../agent/models/hardware.js';
import { traceMetrics } from '../../agent/observability/traces.js';
import { runEvaluation, regressions, type EvalReport } from '../../agent/evaluation/runner.js';
import { activeClassifier, listClassifierVersions, retrainClassifier, rollbackClassifier } from '../../agent/training/classifierRegistry.js';
import { TOOLS } from '../../agent/tools/registry.js';
import { audit } from '../../services/audit.js';
import { asyncHandler, clientMeta, requireAdmin, requireAuth } from '../middleware.js';

export const agentRouter = Router();

/** Public capability report so clients can label features honestly. */
agentRouter.get('/status', asyncHandler(async (_req, res) => {
  const model = await getModel().status();
  const clf = await activeClassifier();
  res.json({
    externalAiApis: false,
    deterministicTools: Object.values(TOOLS).map((t) => ({ name: t.name, description: t.description })),
    localModel: model,
    classifier: { version: clf.version, datasetVersion: clf.datasetVersion },
    capabilities: {
      equationsAndCalculus: true, unitsAndPhysicsFormulas: true, chemistryBalancing: true, ocr: true, documentQa: 'extractive retrieval with page citations',
      openEndedQuestions: model.available ? 'local model (unverified)' : 'unavailable without a local model',
      translation: model.available ? 'local model' : 'unavailable without a local model',
    },
  });
}));

agentRouter.get('/hardware', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ hardware: await detectHardware() });
}));

agentRouter.get('/metrics', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await traceMetrics(24));
}));

agentRouter.post('/eval', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const report = runEvaluation({ systemVersion: process.env.GIT_SHA ?? 'server', classifier: await activeClassifier() });
  const prev = await pool.query("SELECT results FROM eval_runs WHERE suite = 'agent' ORDER BY created_at DESC LIMIT 1");
  const regs = regressions(report, (prev.rows[0]?.results as EvalReport | undefined) ?? null);
  await pool.query('INSERT INTO eval_runs (suite, dataset_version, system_version, metrics, results) VALUES ($1, $2, $3, $4, $5)', ['agent', report.datasetVersion, report.systemVersion, { suites: report.suites, classifier: report.classifier }, report]);
  res.json({ report, regressions: regs });
}));

agentRouter.get('/eval/history', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const { rows } = await pool.query("SELECT id, dataset_version, system_version, metrics, created_at FROM eval_runs WHERE suite = 'agent' ORDER BY created_at DESC LIMIT 50");
  res.json({ runs: rows });
}));

agentRouter.get('/classifier', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ versions: await listClassifierVersions() });
}));

agentRouter.post('/classifier/train', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const outcome = await retrainClassifier();
  if (outcome.status === 'active') await audit('model.activated', req.user!.id, { ...clientMeta(req), details: { version: outcome.version } });
  res.json({ ...outcome, candidate: { accuracy: outcome.candidate.accuracy, n: outcome.candidate.n }, baseline: { accuracy: outcome.baseline.accuracy, n: outcome.baseline.n } });
}));

agentRouter.post('/classifier/rollback', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const r = await rollbackClassifier();
  await audit('model.rollback', req.user!.id, { ...clientMeta(req), details: r });
  res.json(r);
}));
