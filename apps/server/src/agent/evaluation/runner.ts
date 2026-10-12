import { performance } from 'node:perf_hooks';
import { solveLocally, evaluate, EVAL, builtinSubjectModel, type NBModel } from '@exammate/core';
import { chunkPages } from '../../services/extraction.js';
import { extractiveAnswer } from '../../services/studyTools.js';
import { queryTerms } from '../../services/retrieval.js';
import { SOLVE_CASES, CHECK_CASES, GROUNDING_CASES, EVAL_DATASET_VERSION } from './datasets/solver.js';

export interface CaseResult { id: string; suite: string; passed: boolean; status: string; latencyMs: number; detail: string }
export interface SuiteMetrics { suite: string; n: number; accuracy: number; failureRate: number; unsupportedRate: number; p50Ms: number; p95Ms: number; totalComputeMs: number }
export interface EvalReport { datasetVersion: string; systemVersion: string; suites: SuiteMetrics[]; cases: CaseResult[]; classifier: { accuracy: number; n: number; modelVersion: string } }

function pct(xs: number[], p: number) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]! * 100) / 100;
}

function numbersMatch(actual: number[] | undefined, expected: number[], tol = 1e-6): boolean {
  if (!actual || actual.length < expected.length) return false;
  return expected.every((e) => actual.some((a) => Math.abs(a - e) <= tol * Math.max(1, Math.abs(e))));
}

/** In-memory lexical retrieval mirroring the server's re-ranking, so grounding can be benchmarked without a database. */
function retrieveInMemory(pages: string[], question: string) {
  const chunks = chunkPages(pages.map((text, i) => ({ page: i + 1, text })));
  const terms = queryTerms(question);
  return chunks
    .map((c) => ({ ...c, score: terms.filter((t) => c.content.toLowerCase().includes(t)).length / Math.max(1, terms.length) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export function runEvaluation(opts: { systemVersion?: string; classifier?: NBModel } = {}): EvalReport {
  const cases: CaseResult[] = [];
  for (const c of SOLVE_CASES) {
    const t0 = performance.now();
    const r = solveLocally(c.question, { mode: 'steps' });
    const ms = performance.now() - t0;
    let passed = false;
    if (r.status === 'solved' && r.result) {
      if (c.expectNumbers) passed = numbersMatch(r.result.numeric, c.expectNumbers, c.tolerance ?? 1e-6);
      if (c.expectText) passed = r.result.answer.includes(c.expectText);
    }
    cases.push({ id: c.id, suite: c.suite, passed, status: r.status, latencyMs: ms, detail: r.result?.answer ?? r.error ?? r.status });
  }
  for (const c of CHECK_CASES) {
    const t0 = performance.now();
    const r = solveLocally(c.question, { mode: 'check', studentAnswer: c.studentAnswer });
    const ms = performance.now() - t0;
    cases.push({ id: c.id, suite: 'verification', passed: r.check?.correct === c.expectCorrect, status: r.status, latencyMs: ms, detail: r.check?.detail ?? r.status });
  }
  for (const c of GROUNDING_CASES) {
    const t0 = performance.now();
    const chunks = retrieveInMemory(c.pages, c.question);
    const ans = extractiveAnswer(c.question, chunks);
    const ms = performance.now() - t0;
    let passed = ans.found === c.expectFound;
    if (passed && c.expectFound) {
      passed = (!c.mustContain || ans.answer.includes(c.mustContain)) && (!c.expectPage || ans.citations.some((x) => x.page === c.expectPage));
    }
    cases.push({ id: c.id, suite: 'grounding', passed, status: ans.found ? 'found' : 'not_found', latencyMs: ms, detail: ans.answer.slice(0, 120) || '(no answer)' });
  }
  const suites = [...new Set(cases.map((c) => c.suite))].map((suite) => {
    const cs = cases.filter((c) => c.suite === suite);
    const lat = cs.map((c) => c.latencyMs);
    return {
      suite, n: cs.length,
      accuracy: cs.filter((c) => c.passed).length / cs.length,
      failureRate: cs.filter((c) => c.status === 'error').length / cs.length,
      unsupportedRate: cs.filter((c) => c.status === 'unsupported').length / cs.length,
      p50Ms: pct(lat, 0.5), p95Ms: pct(lat, 0.95), totalComputeMs: Math.round(lat.reduce((s, x) => s + x, 0)),
    };
  });
  const clf = evaluate(opts.classifier ?? builtinSubjectModel(), EVAL);
  return { datasetVersion: EVAL_DATASET_VERSION, systemVersion: opts.systemVersion ?? 'dev', suites, cases, classifier: { accuracy: clf.accuracy, n: clf.n, modelVersion: clf.modelVersion } };
}

/** Compare with a previous report and list suites whose accuracy dropped. */
export function regressions(current: EvalReport, previous: EvalReport | null, tolerance = 0): string[] {
  if (!previous) return [];
  const out: string[] = [];
  for (const s of current.suites) {
    const p = previous.suites.find((x) => x.suite === s.suite);
    if (p && s.accuracy + tolerance < p.accuracy) out.push(`${s.suite}: ${(p.accuracy * 100).toFixed(1)}% → ${(s.accuracy * 100).toFixed(1)}%`);
  }
  if (current.classifier.accuracy + tolerance < previous.classifier.accuracy) out.push(`classifier: ${previous.classifier.accuracy} → ${current.classifier.accuracy}`);
  return out;
}
