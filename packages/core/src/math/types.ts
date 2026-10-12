export interface SolutionStep {
  /** Short description of what is done in this step. */
  description: string;
  /** Optional LaTeX for the result of the step. */
  latex?: string;
}

export interface Verification {
  method: string;
  passed: boolean;
  detail: string;
}

export interface MathResult {
  kind: 'evaluate' | 'equation' | 'system' | 'derivative' | 'integral' | 'statistics' | 'simplify' | 'units' | 'formula';
  input: string;
  answer: string;
  answerLatex?: string;
  numeric?: number[];
  steps: SolutionStep[];
  verification: Verification[];
  assumptions: string[];
  warnings: string[];
}
