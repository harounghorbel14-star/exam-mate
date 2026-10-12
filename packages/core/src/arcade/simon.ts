import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export interface SimonState {
  pads: number;
  sequence: number[];
  inputIndex: number;
  round: number;
  status: 'showing' | 'input' | 'over';
  seed: number;
  difficulty: ArcadeDifficulty;
  /** Strict mode: one mistake ends the game; otherwise one retry per game. */
  retriesLeft: number;
}

const PADS: Record<ArcadeDifficulty, number> = { easy: 4, medium: 4, hard: 6 };

export function simonNew(difficulty: ArcadeDifficulty, seed: number): SimonState {
  return { pads: PADS[difficulty], sequence: [Math.floor(mulberry32(seed)() * PADS[difficulty])], inputIndex: 0, round: 1, status: 'showing', seed, difficulty, retriesLeft: difficulty === 'easy' ? 1 : 0 };
}

/** Flash duration grows shorter every round (playback speeds up). */
export function simonFlashMs(s: SimonState): number {
  const base = s.difficulty === 'hard' ? 420 : s.difficulty === 'medium' ? 520 : 620;
  return Math.max(180, Math.round(base * Math.pow(0.95, s.round - 1)));
}

export function simonShown(s: SimonState): SimonState {
  return s.status === 'showing' ? { ...s, status: 'input', inputIndex: 0 } : s;
}

export function simonPress(s: SimonState, pad: number): { state: SimonState; result: 'ok' | 'round' | 'retry' | 'over' | null } {
  if (s.status !== 'input' || pad < 0 || pad >= s.pads) return { state: s, result: null };
  if (s.sequence[s.inputIndex] !== pad) {
    if (s.retriesLeft > 0) return { state: { ...s, retriesLeft: s.retriesLeft - 1, status: 'showing', inputIndex: 0 }, result: 'retry' };
    return { state: { ...s, status: 'over' }, result: 'over' };
  }
  if (s.inputIndex + 1 < s.sequence.length) return { state: { ...s, inputIndex: s.inputIndex + 1 }, result: 'ok' };
  const next = Math.floor(mulberry32(s.seed + s.sequence.length * 7349)() * s.pads);
  return { state: { ...s, sequence: [...s.sequence, next], round: s.round + 1, inputIndex: 0, status: 'showing' }, result: 'round' };
}

/** Score = completed rounds. */
export function simonScore(s: SimonState): number { return s.round - 1; }
