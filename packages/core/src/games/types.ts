import type { Locale, LocalizedText } from '../i18n/index.js';

export const GAME_IDS = [
  'math-rush', 'equation-master', 'quiz-battle', 'memory-cards', 'word-master',
  'periodic-quest', 'physics-puzzle', 'chem-lab', 'biology-challenge', 'geo-explorer',
  'code-logic', 'pattern-detective', 'flashcard-sprint', 'true-false', 'daily-challenge',
] as const;

export type GameId = (typeof GAME_IDS)[number];

export interface GameQuestion {
  id: string;
  prompt: string;
  /** Optional monospace block (code, sequences, formulas) shown under the prompt, always LTR. */
  code?: string;
  kind: 'choice' | 'input' | 'truefalse';
  choices?: string[];
  /** Index for choice/truefalse (0 = true, 1 = false); number or string for input. */
  answer: number | string;
  /** Relative tolerance for numeric input (default exact). */
  tolerance?: number;
  /** Alternative accepted text answers for input questions. */
  accept?: string[];
  explanation?: string;
  topic?: string;
}

export interface GameContext {
  level: number;
  rng: () => number;
  locale: Locale;
  /** Optional user-provided deck for Flashcard Sprint / Memory Cards. */
  deck?: Array<{ front: string; back: string }>;
  /** Date key (YYYY-MM-DD) for the daily challenge. */
  dateKey?: string;
}

export interface GameDefinition {
  id: GameId;
  icon: string;
  subject: string;
  mode: 'quiz' | 'memory';
  /** 'sprint': answer as many as possible before a global timer. 'rounds': fixed question count. */
  timing: 'sprint' | 'rounds';
  /** Seconds: total for sprint games, per-question for round games (bonus window). */
  timeLimitSec: number;
  questionsPerRound: number;
  maxLevel: number;
  title: LocalizedText;
  description: LocalizedText;
  instructions: LocalizedText;
  /** Lives for round games (wrong answers allowed before game over); null = unlimited. */
  lives: number | null;
  generate(ctx: GameContext): GameQuestion[];
  /** Memory games produce pairs instead of questions. */
  pairs?(ctx: GameContext): Array<[string, string]>;
}
