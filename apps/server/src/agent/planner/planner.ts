import type { SolveMode } from '@exammate/core';

export type StepId = 'classify' | 'compute' | 'verify' | 'explain' | 'retrieve' | 'llm-answer' | 'translate';

export interface PlanInput {
  mode: SolveMode;
  hasDeterministicRoute: boolean;
  userHasDocuments: boolean;
  modelAvailable: boolean;
}

export interface Plan { steps: StepId[]; rationale: string }

/**
 * Decide how to handle a question. Deterministic tools are always preferred for anything they
 * can compute; documents are consulted for knowledge questions; the local model is a last
 * resort and its answers are always marked unverified.
 */
export function planSolve(p: PlanInput): Plan {
  if (p.mode === 'translate') {
    return p.modelAvailable ? { steps: ['classify', 'translate'], rationale: 'translation needs the local language model' } : { steps: ['classify'], rationale: 'translation requested but no local model is installed' };
  }
  if (p.hasDeterministicRoute) {
    return { steps: ['classify', 'compute', 'verify', 'explain'], rationale: 'a deterministic tool can compute and verify this answer' };
  }
  const steps: StepId[] = ['classify'];
  if (p.userHasDocuments) steps.push('retrieve');
  if (p.modelAvailable) steps.push('llm-answer');
  return { steps, rationale: p.modelAvailable || p.userHasDocuments ? 'knowledge question: consult your documents, then the local model' : 'no deterministic tool, documents or local model can answer this' };
}
