/**
 * Server-authoritative multiplayer game rules. Pure functions over JSON state so the server can
 * persist rooms and resume after a restart. Clients only ever receive `mpView()` output.
 * Randomness comes from a seed the server draws from a CSPRNG; timing comes from the server clock.
 */
import { mulberry32, shuffle } from '../exam/grading.js';
import { GENERAL_QUIZ, type McqItem } from '../content/banks.js';
import type { LocalizedText } from '../i18n/index.js';
import { tttNew, tttPlay, type TTTState } from '../arcade/tictactoe.js';
import { c4New, c4Drop, type C4State } from '../arcade/connect4.js';
import { checkersNew, checkersApply, checkersLegalMoves, type CheckersState, type CheckersMove } from '../arcade/checkers.js';
import { rpsNew, rpsPlayRound, RPS_CHOICES, type RPSChoice, type RPSMatch } from '../arcade/rps.js';
import { mmNew, mmFlip, type MMState } from '../arcade/memoryMatch.js';

export const MP_GAMES = {
  'tic-tac-toe': { min: 2, max: 2, emoji: '⭕', party: false },
  'connect-four': { min: 2, max: 2, emoji: '🔴', party: false },
  checkers: { min: 2, max: 2, emoji: '🏁', party: false },
  'rock-paper-scissors': { min: 2, max: 2, emoji: '✊', party: false },
  'memory-challenge': { min: 2, max: 4, emoji: '🃏', party: true },
  'reaction-race': { min: 2, max: 4, emoji: '⚡', party: true },
  trivia: { min: 2, max: 4, emoji: '❓', party: true },
} as const;
export type MpGameId = keyof typeof MP_GAMES;
export const MP_GAME_IDS = Object.keys(MP_GAMES) as MpGameId[];
export const isMpGameId = (x: unknown): x is MpGameId => typeof x === 'string' && x in MP_GAMES;

export interface MpTimings { turnMs: number; rpsRoundMs: number; triviaQuestionMs: number; revealMs: number; reactionMinMs: number; reactionMaxMs: number; reactionWindowMs: number }
export const DEFAULT_MP_TIMINGS: MpTimings = { turnMs: 30_000, rpsRoundMs: 20_000, triviaQuestionMs: 15_000, revealMs: 3_000, reactionMinMs: 1_500, reactionMaxMs: 4_000, reactionWindowMs: 3_000 };

export const TRIVIA_QUESTIONS = 7;
export const REACTION_ROUNDS = 5;

interface Base { seats: number; seed: number; deadline: number | null; over: boolean; winners: number[] | null; scores: number[]; forfeit: number | null }
export type MpState =
  | (Base & { game: 'tic-tac-toe'; s: TTTState })
  | (Base & { game: 'connect-four'; s: C4State })
  | (Base & { game: 'checkers'; s: CheckersState })
  | (Base & { game: 'rock-paper-scissors'; s: RPSMatch; pending: Array<RPSChoice | null>; idleRounds: number })
  | (Base & { game: 'memory-challenge'; s: MMState; closeAt: number | null })
  | (Base & { game: 'reaction-race'; round: number; phase: 'wait' | 'go' | 'result'; goAt: number; out: boolean[]; roundWinner: number | null; times: Array<number | null> })
  | (Base & { game: 'trivia'; order: number[]; q: number; phase: 'question' | 'reveal'; startedAt: number; answers: Array<{ choice: number; ms: number } | null> });

export type MpMove =
  | { cell: number } | { col: number } | { from: number; path: number[] } | { choice: string | number } | { card: number } | { tap: true };

export class MpError extends Error {
  constructor(public code: 'not_your_turn' | 'illegal_move' | 'stale' | 'game_over' | 'bad_move', message?: string) { super(message ?? code); }
}

function base(seats: number, seed: number): Base {
  return { seats, seed, deadline: null, over: false, winners: null, scores: Array(seats).fill(0), forfeit: null };
}

const reactionDelay = (seed: number, round: number, t: MpTimings) => Math.round(t.reactionMinMs + mulberry32(seed + round * 7907)() * (t.reactionMaxMs - t.reactionMinMs));

export function mpInit(game: MpGameId, seats: number, seed: number, now: number, t: MpTimings = DEFAULT_MP_TIMINGS): MpState {
  const spec = MP_GAMES[game];
  if (seats < spec.min || seats > spec.max) throw new MpError('bad_move', `This game needs ${spec.min}–${spec.max} players`);
  const b = base(seats, seed);
  switch (game) {
    case 'tic-tac-toe': return { ...b, game, s: tttNew('X'), deadline: now + t.turnMs };
    case 'connect-four': return { ...b, game, s: c4New(1), deadline: now + t.turnMs };
    case 'checkers': return { ...b, game, s: checkersNew(), deadline: now + t.turnMs };
    case 'rock-paper-scissors': return { ...b, game, s: rpsNew(5), pending: [null, null], idleRounds: 0, deadline: now + t.rpsRoundMs };
    case 'memory-challenge': return { ...b, game, s: mmNew('4x4', seed, seats), closeAt: null, deadline: now + t.turnMs };
    case 'reaction-race': return { ...b, game, round: 0, phase: 'wait', goAt: now + reactionDelay(seed, 0, t), out: Array(seats).fill(false), roundWinner: null, times: Array(seats).fill(null), deadline: now + reactionDelay(seed, 0, t) };
    case 'trivia': {
      const order = shuffle(GENERAL_QUIZ.map((_, i) => i), mulberry32(seed)).slice(0, TRIVIA_QUESTIONS);
      return { ...b, game, order, q: 0, phase: 'question', startedAt: now, answers: Array(seats).fill(null), deadline: now + t.triviaQuestionMs };
    }
  }
}

/** Whose turn it is (seat), or null for simultaneous games. */
export function mpTurn(st: MpState): number | null {
  if (st.over) return null;
  switch (st.game) {
    case 'tic-tac-toe': return st.s.turn === 'X' ? 0 : 1;
    case 'connect-four': return st.s.turn - 1;
    case 'checkers': return st.s.turn - 1;
    case 'memory-challenge': return st.s.turn;
    default: return null;
  }
}

/** Monotonic step the client must echo with a move, so stale or replayed moves are rejected. */
export function mpStep(st: MpState): number {
  switch (st.game) {
    case 'tic-tac-toe': return st.s.moves;
    case 'connect-four': return st.s.moves;
    case 'checkers': return st.s.moves;
    case 'rock-paper-scissors': return st.s.rounds.length;
    case 'memory-challenge': return st.s.moves * 2 + st.s.open.length;
    case 'reaction-race': return st.round;
    case 'trivia': return st.q;
  }
}

function finishByScores(st: MpState): MpState {
  const top = Math.max(...st.scores);
  return { ...st, over: true, deadline: null, winners: st.scores.map((v, i) => (v === top ? i : -1)).filter((i) => i >= 0) };
}

/** Applies a player's move. Throws MpError for anything illegal; never trusts client-side scores. */
export function mpApply(st: MpState, seat: number, move: MpMove, step: number, now: number, t: MpTimings = DEFAULT_MP_TIMINGS): MpState {
  if (st.over) throw new MpError('game_over');
  if (seat < 0 || seat >= st.seats) throw new MpError('bad_move');
  if (step !== mpStep(st)) throw new MpError('stale', 'This move refers to an old game state');
  const turn = mpTurn(st);
  if (turn !== null && turn !== seat) throw new MpError('not_your_turn');
  const m = move as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : NaN);
  try {
    switch (st.game) {
      case 'tic-tac-toe': {
        const s = tttPlay(st.s, int(m.cell));
        const over = s.result !== null;
        return { ...st, s, deadline: over ? null : now + t.turnMs, over, winners: over ? (s.result === 'draw' ? [] : [s.result === 'X' ? 0 : 1]) : null };
      }
      case 'connect-four': {
        const s = c4Drop(st.s, int(m.col));
        const over = s.result !== null;
        return { ...st, s, deadline: over ? null : now + t.turnMs, over, winners: over ? (s.result === 'draw' ? [] : [s.result === 1 ? 0 : 1]) : null };
      }
      case 'checkers': {
        if (!Array.isArray(m.path) || m.path.length < 1 || m.path.length > 12) throw new MpError('bad_move');
        const s = checkersApply(st.s, { from: int(m.from), path: (m.path as unknown[]).map(int), captures: [] } as CheckersMove);
        const over = s.winner !== null;
        return { ...st, s, deadline: over ? null : now + t.turnMs, over, winners: over ? (s.winner === 'draw' ? [] : [(s.winner as number) - 1]) : null };
      }
      case 'rock-paper-scissors': {
        const choice = m.choice as RPSChoice;
        if (!RPS_CHOICES.includes(choice)) throw new MpError('bad_move');
        if (st.pending[seat]) throw new MpError('illegal_move', 'Already chosen this round');
        const pending = st.pending.map((p, i) => (i === seat ? choice : p));
        if (pending.every(Boolean)) return resolveRps({ ...st, pending }, now, t);
        return { ...st, pending };
      }
      case 'memory-challenge': {
        let s = st.s;
        if (st.closeAt !== null) s = { ...s, open: [] };
        const r = mmFlip(s, int(m.card), now);
        if (r.state === s) throw new MpError('illegal_move');
        const scores = r.state.scores;
        const next = { ...st, s: r.state, scores, closeAt: r.match === false ? now + 1200 : null, deadline: now + t.turnMs };
        return r.state.finishedAt !== null ? finishByScores(next) : next;
      }
      case 'reaction-race': {
        if (m.tap !== true) throw new MpError('bad_move');
        if (st.phase === 'result' || st.out[seat]) throw new MpError('illegal_move');
        if (st.phase === 'wait' || now < st.goAt) {
          // False start: penalty and out for this round.
          return { ...st, out: st.out.map((o, i) => (i === seat ? true : o)), scores: st.scores.map((v, i) => (i === seat ? v - 1 : v)) };
        }
        const ms = now - st.goAt;
        return { ...st, phase: 'result', roundWinner: seat, times: st.times.map((x, i) => (i === seat ? ms : x)), scores: st.scores.map((v, i) => (i === seat ? v + 1 : v)), deadline: now + t.revealMs };
      }
      case 'trivia': {
        if (st.phase !== 'question') throw new MpError('illegal_move');
        if (st.answers[seat]) throw new MpError('illegal_move', 'Already answered');
        const choice = int(m.choice);
        const item = GENERAL_QUIZ[st.order[st.q]!]!;
        if (!(choice >= 0 && choice < item.choices.length)) throw new MpError('bad_move');
        const answers = st.answers.map((a, i) => (i === seat ? { choice, ms: now - st.startedAt } : a));
        const next = { ...st, answers };
        return answers.every(Boolean) ? revealTrivia(next, now, t) : next;
      }
    }
  } catch (e) {
    if (e instanceof MpError) throw e;
    throw new MpError('illegal_move', (e as Error).message);
  }
}

function resolveRps(st: Extract<MpState, { game: 'rock-paper-scissors' }>, now: number, t: MpTimings): MpState {
  const [a, b] = st.pending as [RPSChoice | null, RPSChoice | null];
  let s: RPSMatch;
  if (a && b) s = rpsPlayRound(st.s, a, b);
  else if (a || b) {
    // A missing choice loses the round.
    const w: 1 | 2 = a ? 1 : 2;
    const score: [number, number] = [st.s.score[0] + (w === 1 ? 1 : 0), st.s.score[1] + (w === 2 ? 1 : 0)];
    const need = Math.ceil(st.s.bestOf / 2);
    s = { ...st.s, rounds: [...st.s.rounds, { p1: a ?? 'rock', p2: b ?? 'rock', winner: w }], score, winner: score[0] >= need ? 1 : score[1] >= need ? 2 : null };
  } else s = { ...st.s, rounds: [...st.s.rounds, { p1: 'rock', p2: 'rock', winner: 0 }] };
  const idleRounds = a || b ? 0 : st.idleRounds + 1;
  const scores = [s.score[0], s.score[1]];
  if (s.winner) return { ...st, s, pending: [null, null], scores, idleRounds, over: true, deadline: null, winners: [s.winner - 1] };
  if (idleRounds >= 3) return { ...st, s, pending: [null, null], scores, idleRounds, over: true, deadline: null, winners: [] };
  return { ...st, s, pending: [null, null], scores, idleRounds, deadline: now + t.rpsRoundMs };
}

function revealTrivia(st: Extract<MpState, { game: 'trivia' }>, now: number, t: MpTimings): MpState {
  const item = GENERAL_QUIZ[st.order[st.q]!]!;
  const scores = st.scores.map((v, i) => {
    const a = st.answers[i];
    if (!a || a.choice !== item.answer) return v;
    return v + 100 + Math.round(50 * Math.max(0, 1 - a.ms / t.triviaQuestionMs));
  });
  return { ...st, scores, phase: 'reveal', deadline: now + t.revealMs };
}

/** Next instant the server must call mpTick (timeouts, phase changes), or null. */
export function mpWakeAt(st: MpState): number | null {
  if (st.over) return null;
  if (st.game === 'memory-challenge' && st.closeAt !== null) return Math.min(st.closeAt, st.deadline ?? Infinity);
  return st.deadline;
}

/** Advances time-driven state: turn timeouts, RPS round timers, reaction phases, trivia questions. */
export function mpTick(st: MpState, now: number, t: MpTimings = DEFAULT_MP_TIMINGS): MpState {
  if (st.over) return st;
  if (st.game === 'memory-challenge' && st.closeAt !== null && now >= st.closeAt) st = { ...st, s: { ...st.s, open: [] }, closeAt: null };
  if (st.deadline === null || now < st.deadline) return st;
  switch (st.game) {
    case 'tic-tac-toe': case 'connect-four': case 'checkers': {
      // Running out of time forfeits the game.
      const loser = mpTurn(st)!;
      return { ...st, over: true, deadline: null, winners: [1 - loser], forfeit: loser };
    }
    case 'memory-challenge': {
      // Timeout passes the turn.
      const s = { ...st.s, open: [], turn: (st.s.turn + 1) % st.seats };
      return { ...st, s, closeAt: null, deadline: now + t.turnMs };
    }
    case 'rock-paper-scissors': return resolveRps(st, now, t);
    case 'reaction-race': {
      if (st.phase === 'wait') return { ...st, phase: 'go', deadline: st.goAt + t.reactionWindowMs };
      if (st.phase === 'go') return { ...st, phase: 'result', roundWinner: null, deadline: now + t.revealMs };
      const round = st.round + 1;
      if (round >= REACTION_ROUNDS) return finishByScores(st);
      const goAt = now + reactionDelay(st.seed, round, t);
      return { ...st, round, phase: 'wait', goAt, out: Array(st.seats).fill(false), roundWinner: null, times: Array(st.seats).fill(null), deadline: goAt };
    }
    case 'trivia': {
      if (st.phase === 'question') return revealTrivia(st, now, t);
      const q = st.q + 1;
      if (q >= st.order.length) return finishByScores(st);
      return { ...st, q, phase: 'question', startedAt: now, answers: Array(st.seats).fill(null), deadline: now + t.triviaQuestionMs };
    }
  }
}

/** Ends the game because a player left for good: the remaining players win (party games end on scores). */
export function mpForfeit(st: MpState, seat: number): MpState {
  if (st.over) return st;
  if (st.seats === 2) return { ...st, over: true, deadline: null, winners: [1 - seat], forfeit: seat };
  return { ...finishByScores({ ...st, scores: st.scores.map((v, i) => (i === seat ? -Infinity : v)) }), scores: st.scores, forfeit: seat };
}

export interface MpTriviaQuestion { q: LocalizedText; choices: LocalizedText[]; answer?: number }

/** What a given seat may see. Hidden information (opponent RPS choices, face-down cards, trivia answers, reaction go time) is removed. */
export function mpView(st: MpState, seat: number | null) {
  const common = { game: st.game, seats: st.seats, deadline: st.deadline, over: st.over, winners: st.winners, scores: st.scores, forfeit: st.forfeit, turn: mpTurn(st), step: mpStep(st) };
  switch (st.game) {
    case 'tic-tac-toe': return { ...common, board: st.s.board, line: st.s.line };
    case 'connect-four': return { ...common, board: st.s.board, line: st.s.line, lastMove: st.s.lastMove };
    case 'checkers': return { ...common, board: st.s.board, last: st.s.last, legal: st.over ? [] : checkersLegalMoves(st.s).map((m) => ({ from: m.from, path: m.path })) };
    case 'rock-paper-scissors': return {
      ...common, rounds: st.s.rounds, bestOf: st.s.bestOf,
      chosen: st.pending.map((p) => p !== null),
      myChoice: seat !== null ? st.pending[seat] ?? null : null,
    };
    case 'memory-challenge': return {
      ...common, cols: 4,
      cards: st.s.cards.map((c) => ({ id: c.id, matched: c.matched, symbol: c.matched || st.s.open.includes(c.id) ? c.symbol : null })),
      moves: st.s.moves,
    };
    case 'reaction-race': return { ...common, round: st.round, rounds: REACTION_ROUNDS, phase: st.phase, out: st.out, roundWinner: st.roundWinner, times: st.times };
    case 'trivia': {
      const item: McqItem = GENERAL_QUIZ[st.order[st.q]!]!;
      return {
        ...common, q: st.q, total: st.order.length, phase: st.phase,
        question: { q: item.q, choices: item.choices, ...(st.phase === 'reveal' || st.over ? { answer: item.answer } : {}) } as MpTriviaQuestion,
        answered: st.answers.map(Boolean),
        myAnswer: seat !== null ? st.answers[seat]?.choice ?? null : null,
        reveal: st.phase === 'reveal' || st.over ? st.answers.map((a) => (a ? a.choice : null)) : null,
      };
    }
  }
}
export type MpView = ReturnType<typeof mpView>;

/** Shifts every absolute timestamp in a game state, used to pause games across a server restart. */
export function mpShiftTime(st: MpState, delta: number): MpState {
  if (!delta) return st;
  const out = { ...st, deadline: st.deadline === null ? null : st.deadline + delta } as MpState;
  if (out.game === 'memory-challenge' && out.closeAt !== null) out.closeAt += delta;
  if (out.game === 'reaction-race') out.goAt += delta;
  if (out.game === 'trivia') out.startedAt += delta;
  return out;
}
