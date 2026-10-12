import { solveLocally, detectQuestionType, normalizeMathInput, type Locale, type SolveMode, type SolveResponse, type SubjectLabel } from '@exammate/core';
import { config } from '../../config.js';
import { pool } from '../../db/pool.js';
import { Budget, BudgetExceededError, withinBudget } from '../security/limits.js';
import { detectInjection, fenceUntrusted } from '../security/untrusted.js';
import { planSolve, type StepId } from '../planner/planner.js';
import { callTool, type Permission, type ToolContext } from '../tools/registry.js';
import { getModel } from '../models/manager.js';
import { ModelUnavailableError, type LocalModel } from '../models/types.js';
import { answerFromDocuments, type DocAnswer } from '../knowledge/docQa.js';
import { enrichSimpleExplanation } from '../reasoning/explain.js';
import { OpenAnswerSchema, parseModelJson, type OpenAnswer } from '../reasoning/validate.js';
import { recordTrace, type TraceStep } from '../observability/traces.js';
import { noteConcept } from '../memory/memoryService.js';

export interface SolveTask {
  question: string;
  mode: SolveMode;
  locale: Locale;
  studentAnswer?: string;
  targetLocale?: Locale;
  documentIds?: string[];
}

export type Engine = 'deterministic' | 'retrieval' | 'local-llm' | 'none';

export interface AgentResult extends SolveResponse {
  engine: Engine;
  plan: StepId[];
  rationale: string;
  documentAnswer?: DocAnswer;
  llmAnswer?: OpenAnswer;
  translation?: string;
  enrichedExplanation?: string;
  warnings: string[];
  traceId?: string;
  latencyMs: number;
  stepsUsed: number;
}

const MAX_TOOL_RETRIES = 1;

/** Alternative normalisations tried when a tool fails to parse the input (bounded retries). */
function retryVariants(q: string): string[] {
  const n = normalizeMathInput(q);
  return [
    n.replace(/^[^0-9a-zA-Z(√-]*?(?=[0-9a-zA-Z(√-])/, '').replace(/[.?؟!]+$/, ''),
    n.replace(/\b(please|svp|s'il te plaît|من فضلك)\b/gi, '').trim(),
  ].filter((v, i, a) => v && v !== q && a.indexOf(v) === i);
}

/**
 * The ExamMate agent loop: classify → plan → execute permitted tools → inspect → verify →
 * explain, with hard limits on steps, time and retries. It never fabricates an answer: when no
 * tool, document or local model can answer, it says so.
 */
export async function runSolveAgent(task: SolveTask, ctx: { userId: string | null; signal?: AbortSignal; model?: LocalModel; timeoutMs?: number; maxSteps?: number }): Promise<AgentResult> {
  const started = Date.now();
  const budget = new Budget(ctx.maxSteps ?? config.AGENT_MAX_STEPS, ctx.timeoutMs ?? config.AGENT_TIMEOUT_MS, ctx.signal);
  const trace: TraceStep[] = [];
  const warnings: string[] = [];
  const permissions = new Set<Permission>(['compute', 'classify', ...(ctx.userId ? (['user-docs'] as Permission[]) : [])]);
  const toolCtx: ToolContext = { userId: ctx.userId, permissions, signal: budget.signal };
  const model = ctx.model ?? getModel();
  const timed = async <T>(step: string, tool: string | undefined, fn: () => Promise<T>): Promise<T> => {
    budget.step(step);
    const t0 = Date.now();
    try {
      const v = await withinBudget(budget, fn(), step);
      trace.push({ step, tool, ok: true, ms: Date.now() - t0 });
      return v;
    } catch (e) {
      trace.push({ step, tool, ok: false, ms: Date.now() - t0, note: (e as Error).message.slice(0, 120) });
      throw e;
    }
  };

  if (detectInjection(task.question).length) warnings.push('The question contains instruction-like text; it was treated as data only.');

  // 1. Classify (cheap, always local).
  const classified = await timed('classify', 'classify.subject', () => callTool('classify.subject', { text: task.question }, toolCtx));
  const questionType = detectQuestionType(task.question);

  // 2. Determine resources and plan.
  let route = await callTool('math.solve', { question: task.question }, toolCtx).then((r) => r !== null).catch(() => true);
  const modelStatus = await model.status();
  let userHasDocuments = false;
  if (ctx.userId) {
    const { rows } = await pool.query("SELECT EXISTS (SELECT 1 FROM documents WHERE user_id = $1 AND status = 'ready') AS has", [ctx.userId]);
    userHasDocuments = rows[0].has;
  }
  if (!route) {
    for (const v of retryVariants(task.question)) {
      if (await callTool('math.solve', { question: v }, toolCtx).then((r) => r !== null).catch(() => false)) { route = true; task = { ...task, question: v }; break; }
    }
  }
  const plan = planSolve({ mode: task.mode, hasDeterministicRoute: route, userHasDocuments, modelAvailable: modelStatus.available });

  let response: SolveResponse = { status: 'unsupported', subject: classified.subject as SubjectLabel, questionType, tool: null, mode: task.mode, confidence: 'unsupported' };
  let engine: Engine = 'none';
  let documentAnswer: DocAnswer | undefined;
  let llmAnswer: OpenAnswer | undefined;
  let translation: string | undefined;
  let enrichedExplanation: string | undefined;

  try {
    for (const step of plan.steps.slice(1)) {
      if (step === 'compute') {
        let attempt = 0;
        let q = task.question;
        // 3. Execute the deterministic tool, retrying once with a normalised variant on error.
        for (;;) {
          response = await timed('compute', 'math.solve', async () => solveLocally(q, { mode: task.mode, locale: task.locale, studentAnswer: task.studentAnswer }));
          if (response.status !== 'error' || attempt >= MAX_TOOL_RETRIES) break;
          const variant = retryVariants(q)[0];
          if (!variant) break;
          q = variant;
          attempt++;
        }
        if (response.status === 'solved') engine = 'deterministic';
        if (response.status === 'error') warnings.push(`The solver could not process this input: ${response.error}`);
        if (response.subject === 'general' && classified.subject !== 'general') response.subject = classified.subject as SubjectLabel;
      } else if (step === 'verify') {
        // 4. Inspect verification results; never present an unverified answer as certain.
        await timed('verify', undefined, async () => {
          const checks = response.result?.verification ?? [];
          if (response.status === 'solved' && checks.length === 0) warnings.push('No independent verification was available for this result.');
          if (checks.some((c) => !c.passed)) {
            response.confidence = 'unverified';
            warnings.push('An independent check did not pass. Treat this answer with caution.');
          }
        });
      } else if (step === 'explain') {
        if (task.mode === 'simple' && modelStatus.available && response.status === 'solved') {
          enrichedExplanation = (await timed('explain', 'local-llm', () => enrichSimpleExplanation(model, response, task.locale, budget.signal)).catch(() => null)) ?? undefined;
        }
      } else if (step === 'retrieve') {
        documentAnswer = await timed('retrieve', 'docs.search', () => answerFromDocuments(ctx.userId!, task.question, { documentIds: task.documentIds, model: modelStatus.available ? model : undefined, signal: budget.signal }));
        if (documentAnswer.injectionWarnings.length) warnings.push('Some retrieved document text looked like instructions; it was treated as data only.');
        if (documentAnswer.found) {
          engine = documentAnswer.engine === 'local-llm' ? 'local-llm' : 'retrieval';
          response = { ...response, status: 'solved', confidence: 'unverified' };
          break; // grounded answer found; skip ungrounded generation
        }
      } else if (step === 'llm-answer') {
        llmAnswer = await timed('llm-answer', 'local-llm', () => openAnswer(model, task, budget.signal));
        if (llmAnswer) {
          engine = 'local-llm';
          response = { ...response, status: 'solved', confidence: 'unverified' };
          warnings.push('Generated by the on-device language model and not independently verified. Check it against your course material.');
        }
      } else if (step === 'translate') {
        translation = await timed('translate', 'local-llm', () => translateText(model, task.question, task.targetLocale ?? 'en', budget.signal)) ?? undefined;
        if (translation) { engine = 'local-llm'; response = { ...response, status: 'solved', confidence: 'unverified' }; }
      }
    }
  } catch (e) {
    if (e instanceof BudgetExceededError) {
      warnings.push(`Stopped early: ${e.message}`);
      if (response.status !== 'solved') response = { ...response, status: 'error', error: e.message };
    } else if (e instanceof ModelUnavailableError) {
      warnings.push('The local language model is unavailable.');
    } else {
      throw e;
    }
  }

  if (response.status === 'unsupported' && !modelStatus.available) {
    warnings.push(task.mode === 'translate'
      ? 'Translation of free text needs an on-device language model, which is not installed on this server.'
      : 'This question needs knowledge rather than calculation. Upload your course notes (My Documents) or install a local model to answer it.');
  }

  const latencyMs = Date.now() - started;
  const outcome = response.status === 'solved' ? `solved:${engine}` : response.status;
  const traceId = await recordTrace({ userId: ctx.userId, taskKind: `solve:${task.mode}`, input: task.question, plan: plan.steps, steps: trace, outcome, latencyMs }).catch(() => undefined);
  if (ctx.userId && response.status === 'solved' && response.tool) {
    await noteConcept(ctx.userId, response.subject, response.tool).catch(() => undefined);
  }
  return {
    ...response, engine, plan: plan.steps, rationale: plan.rationale, documentAnswer, llmAnswer, translation, enrichedExplanation,
    warnings: [...(response.result?.warnings ?? []), ...warnings], traceId, latencyMs, stepsUsed: budget.used,
  };
}

async function openAnswer(model: LocalModel, task: SolveTask, signal: AbortSignal): Promise<OpenAnswer | undefined> {
  const lang = { en: 'English', fr: 'French', ar: 'Arabic' }[task.locale];
  const prompt = `You are ExamMate, a careful study tutor. Answer in ${lang}. If you are not sure, say so and set uncertainty to "high". Reply with JSON only: {"answer": string, "steps": string[], "uncertainty": "low"|"medium"|"high", "assumptions": string[]}.\n${fenceUntrusted('STUDENT QUESTION', task.question)}\nJSON:`;
  // Retry once if the output does not validate against the schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await model.generate(prompt, { maxTokens: 400, temperature: attempt === 0 ? 0.2 : 0.0, signal });
    const parsed = parseModelJson(out.text, OpenAnswerSchema);
    if (parsed) return parsed;
  }
  return undefined;
}

async function translateText(model: LocalModel, text: string, target: Locale, signal: AbortSignal): Promise<string | null> {
  const lang = { en: 'English', fr: 'French', ar: 'Arabic' }[target];
  const out = await model.generate(`Translate the following text into ${lang}. Keep mathematical notation unchanged. Output only the translation.\n${fenceUntrusted('TEXT', text)}\nTranslation:`, { maxTokens: 400, temperature: 0.1, signal });
  const t = out.text.trim();
  return t.length ? t : null;
}
