import { builtinSubjectModel, evaluate, trainNaiveBayes, TRAIN, EVAL, DATASET_VERSION, SUBJECT_LABELS, type NBModel, type EvalReport } from '@exammate/core';
import { pool } from '../../db/pool.js';

const KIND = 'subject-classifier';
let cache: { model: NBModel; loadedAt: number } | null = null;

/** The active classifier from the registry, falling back to the bundled baseline. Cached for 60 s. */
export async function activeClassifier(): Promise<NBModel> {
  if (cache && Date.now() - cache.loadedAt < 60_000) return cache.model;
  const { rows } = await pool.query("SELECT artifact FROM model_registry WHERE kind = $1 AND status = 'active'", [KIND]);
  const model = (rows[0]?.artifact as NBModel | undefined) ?? builtinSubjectModel();
  cache = { model, loadedAt: Date.now() };
  return model;
}

export function invalidateClassifierCache() { cache = null; }

export interface TrainingOutcome { version: string; status: 'active' | 'rejected'; candidate: EvalReport; baseline: EvalReport; addedExamples: number; reason: string }

/**
 * Real weight training: re-fit the Naive Bayes classifier on the bundled dataset plus user
 * corrections from people who explicitly allowed their feedback to be used for training.
 * The candidate is evaluated on the held-out set and only promoted if it does not regress.
 */
export async function retrainClassifier(opts: { minImprovement?: number } = {}): Promise<TrainingOutcome> {
  const { rows } = await pool.query(
    `SELECT corrected_subject, question_text FROM feedback
     WHERE allow_training AND corrected_subject = ANY($1) AND question_text IS NOT NULL AND length(question_text) BETWEEN 5 AND 500`,
    [SUBJECT_LABELS],
  );
  const extra: Array<[string, string]> = rows.map((r) => [r.corrected_subject, r.question_text]);
  // Never train on held-out evaluation texts (prevents leakage).
  const evalTexts = new Set(EVAL.map(([, t]) => t.trim().toLowerCase()));
  const clean = extra.filter(([, t]) => !evalTexts.has(t.trim().toLowerCase()));
  const version = `nb-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
  const candidateModel = trainNaiveBayes([...TRAIN, ...clean], { version, datasetVersion: `${DATASET_VERSION}+feedback${clean.length}`, labels: SUBJECT_LABELS });
  candidateModel.trainedAt = new Date().toISOString();
  const active = await activeClassifier();
  const baseline = evaluate(active, EVAL);
  const candidate = evaluate(candidateModel, EVAL);
  const ok = candidate.accuracy >= baseline.accuracy + (opts.minImprovement ?? 0);
  const status = ok ? 'active' : 'rejected';
  const reason = ok ? `held-out accuracy ${(candidate.accuracy * 100).toFixed(1)}% ≥ active ${(baseline.accuracy * 100).toFixed(1)}%` : `regression: ${(candidate.accuracy * 100).toFixed(1)}% < ${(baseline.accuracy * 100).toFixed(1)}%`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (ok) await client.query("UPDATE model_registry SET status = 'retired' WHERE kind = $1 AND status = 'active'", [KIND]);
    await client.query(
      'INSERT INTO model_registry (kind, version, artifact, metrics, status, notes, activated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [KIND, version, candidateModel, { accuracy: candidate.accuracy, baseline: baseline.accuracy, n: candidate.n, addedExamples: clean.length }, status, reason, ok ? new Date() : null],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  invalidateClassifierCache();
  return { version, status, candidate, baseline, addedExamples: clean.length, reason };
}

/** Roll back to the previous retired version (or to the bundled baseline if none). */
export async function rollbackClassifier(): Promise<{ active: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query("UPDATE model_registry SET status = 'rejected', notes = coalesce(notes, '') || ' [rolled back]' WHERE kind = $1 AND status = 'active' RETURNING created_at", [KIND]);
    const prev = await client.query(
      "SELECT id, version FROM model_registry WHERE kind = $1 AND status = 'retired' AND ($2::timestamptz IS NULL OR created_at < $2) ORDER BY created_at DESC LIMIT 1",
      [KIND, cur.rows[0]?.created_at ?? null],
    );
    let active = 'builtin-1';
    if (prev.rows[0]) {
      await client.query("UPDATE model_registry SET status = 'active', activated_at = now() WHERE id = $1", [prev.rows[0].id]);
      active = prev.rows[0].version;
    }
    await client.query('COMMIT');
    invalidateClassifierCache();
    return { active };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listClassifierVersions() {
  const { rows } = await pool.query('SELECT version, status, metrics, notes, created_at, activated_at FROM model_registry WHERE kind = $1 ORDER BY created_at DESC LIMIT 50', [KIND]);
  return rows;
}
