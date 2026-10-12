import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

export type RPSChoice = 'rock' | 'paper' | 'scissors';
export const RPS_CHOICES: RPSChoice[] = ['rock', 'paper', 'scissors'];
const BEATS: Record<RPSChoice, RPSChoice> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
const COUNTER: Record<RPSChoice, RPSChoice> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

export function rpsOutcome(a: RPSChoice, b: RPSChoice): 1 | 2 | 0 {
  if (a === b) return 0;
  return BEATS[a] === b ? 1 : 2;
}

export interface RPSMatch { bestOf: number; rounds: Array<{ p1: RPSChoice; p2: RPSChoice; winner: 0 | 1 | 2 }>; score: [number, number]; winner: 1 | 2 | null }

export function rpsNew(bestOf = 5): RPSMatch {
  if (bestOf < 1 || bestOf % 2 === 0) throw new Error('bestOf must be odd');
  return { bestOf, rounds: [], score: [0, 0], winner: null };
}

export function rpsPlayRound(m: RPSMatch, p1: RPSChoice, p2: RPSChoice): RPSMatch {
  if (m.winner) throw new Error('Match over');
  const w = rpsOutcome(p1, p2);
  const score: [number, number] = [m.score[0] + (w === 1 ? 1 : 0), m.score[1] + (w === 2 ? 1 : 0)];
  const need = Math.ceil(m.bestOf / 2);
  return { ...m, rounds: [...m.rounds, { p1, p2, winner: w }], score, winner: score[0] >= need ? 1 : score[1] >= need ? 2 : null };
}

/**
 * Computer choice. easy: uniform random. medium/hard: predicts the human's next move from a
 * frequency (medium) or first-order transition (hard) model of their history, then counters it.
 */
export function rpsAiChoice(history: RPSChoice[], difficulty: ArcadeDifficulty, seed: number): RPSChoice {
  const rng = mulberry32(seed);
  const random = () => RPS_CHOICES[Math.floor(rng() * 3)]!;
  if (difficulty === 'easy' || history.length < 3 || rng() < 0.15) return random();
  const counts: Record<RPSChoice, number> = { rock: 0, paper: 0, scissors: 0 };
  if (difficulty === 'medium') for (const h of history) counts[h]++;
  else {
    const last = history[history.length - 1]!;
    for (let i = 1; i < history.length; i++) if (history[i - 1] === last) counts[history[i]!]++;
    if (counts.rock + counts.paper + counts.scissors === 0) for (const h of history) counts[h]++;
  }
  const predicted = RPS_CHOICES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  return COUNTER[predicted];
}
