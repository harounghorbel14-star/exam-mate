import { TRAIN, EVAL, DATASET_VERSION, SUBJECT_LABELS, type SubjectLabel } from './dataset.js';
import { trainNaiveBayes, predict, evaluate, type NBModel } from './naiveBayes.js';

export * from './naiveBayes.js';
export { TRAIN, EVAL, DATASET_VERSION, SUBJECT_LABELS, type SubjectLabel };

let builtin: NBModel | null = null;

/** The baseline subject model, trained deterministically from the bundled dataset (works offline). */
export function builtinSubjectModel(): NBModel {
  builtin ??= trainNaiveBayes(TRAIN, { version: 'builtin-1', datasetVersion: DATASET_VERSION, labels: SUBJECT_LABELS });
  return builtin;
}

export function classifySubject(text: string, model: NBModel = builtinSubjectModel()): { subject: SubjectLabel; scores: Array<{ label: string; score: number }> } {
  const p = predict(model, text);
  return { subject: p.label as SubjectLabel, scores: p.scores };
}

export function evaluateBuiltin() {
  return evaluate(builtinSubjectModel(), EVAL);
}
