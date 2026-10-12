import { mulberry32 } from '../exam/grading.js';

/**
 * Reaction test state machine. Timing values are supplied by the caller (performance.now() on web,
 * or event timestamps) so the engine stays deterministic and testable.
 */
export type ReactionPhase = 'idle' | 'waiting' | 'go' | 'result' | 'false-start' | 'done';
export interface ReactionState {
  phase: ReactionPhase;
  rounds: number;
  results: number[];
  falseStarts: number;
  goAt: number | null;
  waitStartedAt: number | null;
  seed: number;
  last: number | null;
}

export const REACTION_MIN_DELAY = 1200;
export const REACTION_MAX_DELAY = 4000;
/** Below this, a response is physiologically implausible and treated as anticipation. */
export const REACTION_ANTICIPATION_MS = 100;

export function reactionNew(rounds = 5, seed = 1): ReactionState {
  return { phase: 'idle', rounds, results: [], falseStarts: 0, goAt: null, waitStartedAt: null, seed, last: null };
}

/** Starts a round: returns the state and the delay (ms) after which the UI must call reactionGo(). */
export function reactionArm(s: ReactionState, now: number): { state: ReactionState; delay: number } {
  const n = s.results.length + s.falseStarts;
  const delay = Math.round(REACTION_MIN_DELAY + mulberry32(s.seed + n * 104729)() * (REACTION_MAX_DELAY - REACTION_MIN_DELAY));
  return { state: { ...s, phase: 'waiting', waitStartedAt: now, goAt: null, last: null }, delay };
}

export function reactionGo(s: ReactionState, now: number): ReactionState {
  return s.phase === 'waiting' ? { ...s, phase: 'go', goAt: now } : s;
}

/** Player tap/press. While waiting → false start; on go → records reaction time. */
export function reactionTap(s: ReactionState, now: number): ReactionState {
  if (s.phase === 'waiting') return { ...s, phase: 'false-start', falseStarts: s.falseStarts + 1, goAt: null };
  if (s.phase !== 'go' || s.goAt === null) return s;
  const ms = Math.round(now - s.goAt);
  if (ms < REACTION_ANTICIPATION_MS) return { ...s, phase: 'false-start', falseStarts: s.falseStarts + 1, goAt: null };
  const results = [...s.results, ms];
  return { ...s, results, last: ms, goAt: null, phase: results.length >= s.rounds ? 'done' : 'result' };
}

export function reactionSummary(s: ReactionState): { average: number | null; best: number | null; worst: number | null } {
  if (!s.results.length) return { average: null, best: null, worst: null };
  return {
    average: Math.round(s.results.reduce((a, b) => a + b, 0) / s.results.length),
    best: Math.min(...s.results), worst: Math.max(...s.results),
  };
}
