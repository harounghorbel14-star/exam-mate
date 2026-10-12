import { pool } from '../../db/pool.js';
import { runEvaluation, regressions, type EvalReport } from './runner.js';
import { activeClassifier } from '../training/classifierRegistry.js';

/** `npm run eval` — runs all benchmark suites, stores the run, and fails on regressions. */
async function main() {
  const report = runEvaluation({ systemVersion: process.env.GIT_SHA ?? 'local', classifier: await activeClassifier() });
  const prev = await pool.query("SELECT results FROM eval_runs WHERE suite = 'agent' ORDER BY created_at DESC LIMIT 1");
  const regs = regressions(report, (prev.rows[0]?.results as EvalReport | undefined) ?? null);
  await pool.query('INSERT INTO eval_runs (suite, dataset_version, system_version, metrics, results) VALUES ($1, $2, $3, $4, $5)', ['agent', report.datasetVersion, report.systemVersion, { suites: report.suites, classifier: report.classifier }, report]);
  console.table(report.suites.map((s) => ({ suite: s.suite, n: s.n, accuracy: `${(s.accuracy * 100).toFixed(1)}%`, failures: `${(s.failureRate * 100).toFixed(1)}%`, unsupported: `${(s.unsupportedRate * 100).toFixed(1)}%`, p50ms: s.p50Ms, p95ms: s.p95Ms })));
  console.log(`classifier (${report.classifier.modelVersion}): ${(report.classifier.accuracy * 100).toFixed(1)}% on ${report.classifier.n} held-out examples`);
  const failed = report.cases.filter((c) => !c.passed);
  if (failed.length) console.log('failed cases:', failed.map((c) => `${c.id} → ${c.detail}`));
  if (regs.length) { console.error('REGRESSIONS:', regs); process.exitCode = 1; }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
