export interface SectionPlan { name: string; questions: number; pointsEach: number; difficulty: 1 | 2 | 3 }
export interface AllocationRow { name: string; minutes: number; perQuestionSec: number; order: number; reason: string }

/**
 * Allocate exam time proportionally to points, weighted by difficulty, keeping a review buffer.
 * Easy, high-value sections are scheduled first.
 */
export function allocateTime(totalMinutes: number, sections: SectionPlan[], reviewFraction = 0.1): { rows: AllocationRow[]; reviewMinutes: number } {
  const review = Math.round(totalMinutes * reviewFraction);
  const available = totalMinutes - review;
  const weight = (s: SectionPlan) => s.questions * s.pointsEach * (0.8 + 0.2 * s.difficulty);
  const total = sections.reduce((t, s) => t + weight(s), 0) || 1;
  const order = [...sections].sort((a, b) => (b.pointsEach / b.difficulty) - (a.pointsEach / a.difficulty));
  const rows = sections.map((s) => {
    const minutes = Math.round((available * weight(s)) / total * 10) / 10;
    return {
      name: s.name, minutes, perQuestionSec: Math.round((minutes * 60) / Math.max(1, s.questions)), order: order.indexOf(s) + 1,
      reason: s.difficulty === 1 ? 'secure easy points first' : s.difficulty === 3 ? 'hard: attempt after banking easier marks' : 'medium difficulty',
    };
  });
  return { rows, reviewMinutes: review };
}

/** Expected score from guessing after eliminating k of n options (with optional negative marking). */
export function guessExpectedValue(options: number, eliminated: number, pointsCorrect = 1, penaltyWrong = 0): number {
  const left = Math.max(1, options - eliminated);
  return pointsCorrect / left - penaltyWrong * (left - 1) / left;
}

export interface Tip { id: string; area: 'time' | 'mcq' | 'patterns' | 'checking' | 'partial-credit' | 'analysis' }

export const STRATEGY_TIPS: Tip[] = [
  { id: 'scan-first', area: 'time' }, { id: 'two-pass', area: 'time' }, { id: 'skip-stuck', area: 'time' },
  { id: 'eliminate-extremes', area: 'mcq' }, { id: 'units-check', area: 'mcq' }, { id: 'plug-in', area: 'mcq' },
  { id: 'quadratic-forms', area: 'patterns' }, { id: 'special-triangles', area: 'patterns' }, { id: 'conservation', area: 'patterns' },
  { id: 'estimate', area: 'checking' }, { id: 'substitute-back', area: 'checking' }, { id: 'dimension', area: 'checking' },
  { id: 'show-method', area: 'partial-credit' }, { id: 'state-formula', area: 'partial-credit' }, { id: 'carry-forward', area: 'partial-credit' },
  { id: 'error-log', area: 'analysis' }, { id: 'time-audit', area: 'analysis' },
];
