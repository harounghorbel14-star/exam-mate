import { SUBJECT_LABELS, type SubjectLabel } from './dataset.js';

/** Serializable multinomial Naive Bayes model. */
export interface NBModel {
  version: string;
  datasetVersion: string;
  labels: string[];
  vocabSize: number;
  classDocCounts: Record<string, number>;
  classTokenTotals: Record<string, number>;
  tokenCounts: Record<string, Record<string, number>>;
  alpha: number;
  trainedAt: string;
}

const ARABIC_DIACRITICS = /[ً-ْـ]/g;

function stem(word: string): string {
  if (/[؀-ۿ]/.test(word)) {
    let w = word.replace(/^(وال|بال|كال|فال|لل|ال)/, '');
    if (w.length > 4) w = w.replace(/(ات|ون|ين|ها|ية|ة)$/, '');
    return w;
  }
  if (word.length > 5) return word.replace(/(ations?|ements?|ement|ing|tion|ions|ies|es|s|ed|er|ly)$/, '');
  return word;
}

/** Word + character n-gram + structural features. Deterministic and language-agnostic. */
export function featurize(text: string): string[] {
  const feats: string[] = [];
  if (/(?<![<>!=])=(?!=)/.test(text)) feats.push('__eq__');
  if (/\d\s*(m\/s|km|kg|N|J|W|Hz|V|A|Ω|ohm|m|s)\b/.test(text)) feats.push('__unit__');
  if (/(->|→)/.test(text)) feats.push('__arrow__');
  if (/\b(?:[A-Z][a-z]?\d*){2,}\b/.test(text) && /\d/.test(text)) feats.push('__chemformula__');
  if (/\b(def|print|return|function|for|while|class|SELECT|int|var|let)\b/.test(text) && /[(){};:]/.test(text) || /\b(python|javascript|java|sql|c\+\+)\b/i.test(text)) feats.push('__code__');
  if (/\b1[0-9]{3}\b|\b20[0-9]{2}\b/.test(text)) feats.push('__year__');
  if (/[\^²³√]|\b(sin|cos|tan|log|ln)\b|\d\s*[a-z]\b/.test(text)) feats.push('__math__');
  const norm = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(ARABIC_DIACRITICS, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  const words = norm.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  for (const w of words) {
    const s = stem(w);
    feats.push(`w:${s}`);
    const padded = `_${s}_`;
    if (padded.length >= 5) for (let i = 0; i + 4 <= padded.length; i++) feats.push(`c:${padded.slice(i, i + 4)}`);
  }
  return feats;
}

export function trainNaiveBayes(examples: Array<[string, string]>, opts: { version: string; datasetVersion: string; alpha?: number; labels?: string[] }): NBModel {
  const labels = opts.labels ?? [...new Set(examples.map(([l]) => l))];
  const classDocCounts: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  const classTokenTotals: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  const tokenCounts: Record<string, Record<string, number>> = {};
  for (const [label, text] of examples) {
    classDocCounts[label] = (classDocCounts[label] ?? 0) + 1;
    for (const f of featurize(text)) {
      const row = (tokenCounts[f] ??= {});
      row[label] = (row[label] ?? 0) + 1;
      classTokenTotals[label] = (classTokenTotals[label] ?? 0) + 1;
    }
  }
  return {
    version: opts.version, datasetVersion: opts.datasetVersion, labels, vocabSize: Object.keys(tokenCounts).length,
    classDocCounts, classTokenTotals, tokenCounts, alpha: opts.alpha ?? 0.5, trainedAt: new Date(0).toISOString(),
  };
}

export interface Prediction { label: string; scores: Array<{ label: string; score: number }> }

/**
 * Predict the label. `score` values are normalised posteriors from Naive Bayes; they rank
 * labels but are NOT calibrated probabilities and must not be shown as accuracy.
 */
export function predict(model: NBModel, text: string): Prediction {
  const feats = featurize(text).filter((f) => model.tokenCounts[f]);
  const totalDocs = Object.values(model.classDocCounts).reduce((s, x) => s + x, 0);
  const logps = model.labels.map((label) => {
    let lp = Math.log((model.classDocCounts[label]! + 1) / (totalDocs + model.labels.length));
    const denom = model.classTokenTotals[label]! + model.alpha * model.vocabSize;
    for (const f of feats) lp += Math.log(((model.tokenCounts[f]![label] ?? 0) + model.alpha) / denom);
    return lp;
  });
  const max = Math.max(...logps);
  const exps = logps.map((l) => Math.exp(l - max));
  const z = exps.reduce((s, x) => s + x, 0);
  const scores = model.labels.map((label, i) => ({ label, score: exps[i]! / z })).sort((a, b) => b.score - a.score);
  return { label: feats.length ? scores[0]!.label : 'general', scores };
}

export interface EvalReport {
  modelVersion: string;
  datasetVersion: string;
  n: number;
  accuracy: number;
  perClass: Record<string, { precision: number; recall: number; support: number }>;
  confusion: Record<string, Record<string, number>>;
  errors: Array<{ text: string; expected: string; predicted: string }>;
}

export function evaluate(model: NBModel, examples: Array<[string, string]>): EvalReport {
  const confusion: Record<string, Record<string, number>> = {};
  const errors: EvalReport['errors'] = [];
  let correct = 0;
  for (const [expected, text] of examples) {
    const predicted = predict(model, text).label;
    (confusion[expected] ??= {})[predicted] = ((confusion[expected] ??= {})[predicted] ?? 0) + 1;
    if (predicted === expected) correct++;
    else errors.push({ text, expected, predicted });
  }
  const perClass: EvalReport['perClass'] = {};
  for (const label of model.labels) {
    const tp = confusion[label]?.[label] ?? 0;
    const support = Object.values(confusion[label] ?? {}).reduce((s, x) => s + x, 0);
    const predictedCount = Object.values(confusion).reduce((s, row) => s + (row[label] ?? 0), 0);
    perClass[label] = { precision: predictedCount ? tp / predictedCount : 0, recall: support ? tp / support : 0, support };
  }
  return { modelVersion: model.version, datasetVersion: model.datasetVersion, n: examples.length, accuracy: examples.length ? correct / examples.length : 0, perClass, confusion, errors };
}

export type { SubjectLabel };
export { SUBJECT_LABELS };
