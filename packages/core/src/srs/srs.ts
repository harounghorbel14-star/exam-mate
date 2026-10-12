/**
 * Spaced repetition based on the SM-2 algorithm with four answer buttons.
 * All times are epoch milliseconds so the logic is deterministic and testable.
 */
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

export interface CardSchedule {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: number;
  lastReviewedAt: number | null;
}

export const DAY_MS = 86_400_000;
export const MIN_EASE = 1.3;

export function newSchedule(now: number): CardSchedule {
  return { ease: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, dueAt: now, lastReviewedAt: null };
}

const QUALITY: Record<ReviewRating, number> = { again: 1, hard: 3, good: 4, easy: 5 };

export function review(s: CardSchedule, rating: ReviewRating, now: number): CardSchedule {
  const q = QUALITY[rating];
  let { ease, intervalDays, repetitions, lapses } = s;
  if (q < 3) {
    repetitions = 0;
    lapses += 1;
    intervalDays = 0; // re-show in the same session (10 minutes)
    ease = Math.max(MIN_EASE, ease - 0.2);
    return { ease, intervalDays, repetitions, lapses, dueAt: now + 10 * 60_000, lastReviewedAt: now };
  }
  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  repetitions += 1;
  if (repetitions === 1) intervalDays = rating === 'easy' ? 4 : 1;
  else if (repetitions === 2) intervalDays = rating === 'hard' ? 3 : 6;
  else intervalDays = Math.round(intervalDays * (rating === 'hard' ? 1.2 : ease) * (rating === 'easy' ? 1.3 : 1));
  intervalDays = Math.min(intervalDays, 365);
  return { ease, intervalDays, repetitions, lapses, dueAt: now + intervalDays * DAY_MS, lastReviewedAt: now };
}

export function isDue(s: CardSchedule, now: number): boolean {
  return s.dueAt <= now;
}

/** Cards answered "again" at least `threshold` times are considered forgotten / leeches. */
export function isLeech(s: CardSchedule, threshold = 4): boolean {
  return s.lapses >= threshold;
}

/** Build today's session: due cards first (most overdue first), then up to `newLimit` new cards. */
export function buildSession<T extends { schedule: CardSchedule | null }>(cards: T[], now: number, newLimit = 10, maxTotal = 50): T[] {
  const due = cards.filter((c) => c.schedule && isDue(c.schedule, now)).sort((a, b) => a.schedule!.dueAt - b.schedule!.dueAt);
  const fresh = cards.filter((c) => !c.schedule).slice(0, newLimit);
  return [...due, ...fresh].slice(0, maxTotal);
}
