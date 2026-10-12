import type { Locale, SolveResponse } from '@exammate/core';
import type { LocalModel } from '../models/types.js';
import { preservesNumbers } from './validate.js';

const LANG_NAME: Record<Locale, string> = { en: 'English', fr: 'French', ar: 'Arabic' };

/**
 * Optionally ask the local model to rephrase a verified solution for a beginner. The verified
 * answer stays authoritative: the rephrasing is discarded if it drops or changes any number.
 */
export async function enrichSimpleExplanation(model: LocalModel, response: SolveResponse, locale: Locale, signal: AbortSignal): Promise<string | null> {
  if (!response.result) return null;
  const steps = response.result.steps.map((s, i) => `${i + 1}. ${s.description}${s.latex ? ` (${s.latex})` : ''}`).join('\n');
  const prompt = `Rewrite this verified solution for a beginner student in ${LANG_NAME[locale]}. Keep every number exactly. Do not add new calculations.\nFinal answer: ${response.result.answer}\nSteps:\n${steps}\nBeginner explanation:`;
  try {
    const out = await model.generate(prompt, { maxTokens: 300, temperature: 0.3, signal });
    const text = out.text.trim();
    return text && preservesNumbers(response.result.answer, text) ? text : null;
  } catch {
    return null;
  }
}
