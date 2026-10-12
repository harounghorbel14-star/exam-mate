import { describe, expect, it } from 'vitest';
import { mpInit, mpApply, mpTick, mpView, mpStep, mpTurn, mpForfeit, mpWakeAt, MpError, DEFAULT_MP_TIMINGS as T, REACTION_ROUNDS, TRIVIA_QUESTIONS, type MpState } from './games.js';
import { parseClientMessage, isRoomCode, normalizeRoomCode, avatarFor } from './protocol.js';
import { GENERAL_QUIZ } from '../content/banks.js';

const code = (f: () => unknown) => { try { f(); return null; } catch (e) { return (e as MpError).code; } };

describe('multiplayer rules: turn games', () => {
  it('tic-tac-toe enforces turns and steps and declares the winner', () => {
    let s = mpInit('tic-tac-toe', 2, 1, 0);
    expect(code(() => mpApply(s, 1, { cell: 0 }, 0, 1))).toBe('not_your_turn');
    s = mpApply(s, 0, { cell: 0 }, 0, 1);
    expect(code(() => mpApply(s, 1, { cell: 1 }, 0, 2))).toBe('stale'); // replay of an old step
    expect(code(() => mpApply(s, 1, { cell: 0 }, 1, 2))).toBe('illegal_move'); // occupied
    for (const [seat, cell] of [[1, 3], [0, 1], [1, 4], [0, 2]] as const) s = mpApply(s, seat, { cell }, mpStep(s), 3);
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([0]);
    expect(code(() => mpApply(s, 1, { cell: 8 }, mpStep(s), 4))).toBe('game_over');
  });
  it('turn timeout forfeits, and a departed player forfeits', () => {
    const s = mpInit('connect-four', 2, 1, 0);
    expect(mpWakeAt(s)).toBe(T.turnMs);
    expect(mpTick(s, T.turnMs - 1)).toBe(s);
    const out = mpTick(s, T.turnMs);
    expect(out.over).toBe(true);
    expect(out.winners).toEqual([1]);
    expect(out.forfeit).toBe(0);
    expect(mpForfeit(mpInit('checkers', 2, 1, 0), 1).winners).toEqual([0]);
  });
  it('checkers validates moves server-side and exposes legal moves', () => {
    let s = mpInit('checkers', 2, 1, 0);
    const v = mpView(s, 0) as { legal: Array<{ from: number; path: number[] }> };
    expect(v.legal).toHaveLength(7);
    expect(code(() => mpApply(s, 0, { from: 40, path: [24] }, 0, 1))).toBe('illegal_move');
    s = mpApply(s, 0, v.legal[0]!, 0, 1);
    expect(mpTurn(s)).toBe(1);
  });
  it('rejects bad seats and wrong player counts', () => {
    expect(code(() => mpInit('tic-tac-toe', 3, 1, 0))).toBe('bad_move');
    expect(code(() => mpInit('trivia', 1, 1, 0))).toBe('bad_move');
    expect(code(() => mpApply(mpInit('tic-tac-toe', 2, 1, 0), 5, { cell: 0 }, 0, 1))).toBe('bad_move');
  });
});

describe('multiplayer rules: simultaneous and party games', () => {
  it('rock paper scissors hides the opponent choice until both chose; missing choice loses the round', () => {
    let s = mpInit('rock-paper-scissors', 2, 1, 0);
    s = mpApply(s, 0, { choice: 'rock' }, 0, 1);
    const v1 = mpView(s, 1) as { chosen: boolean[]; myChoice: string | null };
    expect(v1.chosen).toEqual([true, false]);
    expect(v1.myChoice).toBeNull();
    expect(JSON.stringify(mpView(s, 1))).not.toContain('"rock"');
    expect(code(() => mpApply(s, 0, { choice: 'paper' }, 0, 2))).toBe('illegal_move'); // no changing
    s = mpApply(s, 1, { choice: 'scissors' }, 0, 2);
    expect(s.scores).toEqual([1, 0]);
    expect(code(() => mpApply(s, 1, { choice: 'rock' }, 0, 3))).toBe('stale');
    s = mpApply(s, 1, { choice: 'rock' }, 1, 3);
    s = mpTick(s, 3 + T.rpsRoundMs);
    expect(s.scores).toEqual([1, 1]);
  });
  it('memory challenge hides face-down cards and passes turns on a miss', () => {
    let s = mpInit('memory-challenge', 3, 7, 0) as Extract<MpState, { game: 'memory-challenge' }>;
    const v = mpView(s, 0) as { cards: Array<{ symbol: string | null }> };
    expect(v.cards.every((c) => c.symbol === null)).toBe(true);
    const sym = s.s.cards.map((c) => c.symbol);
    const a = 0, miss = sym.findIndex((x) => x !== sym[0]);
    s = mpApply(s, 0, { card: a }, 0, 1) as typeof s;
    expect((mpView(s, 2) as { cards: Array<{ symbol: string | null }> }).cards[a]!.symbol).toBe(sym[0]);
    s = mpApply(s, 0, { card: miss }, 1, 2) as typeof s;
    expect(mpTurn(s)).toBe(1);
    s = mpTick(s, 2000) as typeof s;
    expect(s.s.open).toEqual([]);
    expect(code(() => mpApply(s, 0, { card: 3 }, mpStep(s), 2100))).toBe('not_your_turn');
  });
  it('reaction race: server-timed go, false starts penalised, first valid tap wins the round', () => {
    let s = mpInit('reaction-race', 3, 5, 0) as Extract<MpState, { game: 'reaction-race' }>;
    expect(JSON.stringify(mpView(s, 0))).not.toContain('goAt');
    s = mpApply(s, 2, { tap: true }, 0, 100) as typeof s; // early
    expect(s.scores[2]).toBe(-1);
    expect(code(() => mpApply(s, 2, { tap: true }, 0, 101))).toBe('illegal_move');
    s = mpTick(s, s.goAt) as typeof s;
    expect(s.phase).toBe('go');
    s = mpApply(s, 1, { tap: true }, 0, s.goAt + 250) as typeof s;
    expect(s.roundWinner).toBe(1);
    expect(s.times[1]).toBe(250);
    expect(code(() => mpApply(s, 0, { tap: true }, 0, s.goAt + 260))).toBe('illegal_move');
    let now = s.goAt + 260;
    for (let i = 0; i < REACTION_ROUNDS * 3 && !s.over; i++) { now = mpWakeAt(s)!; s = mpTick(s, now) as typeof s; }
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([1]);
  });
  it('trivia: answers stay hidden until reveal, scoring is server-side with a speed bonus', () => {
    let s = mpInit('trivia', 2, 9, 0) as Extract<MpState, { game: 'trivia' }>;
    const item = GENERAL_QUIZ[s.order[0]!]!;
    expect((mpView(s, 0) as { question: { answer?: number } }).question.answer).toBeUndefined();
    s = mpApply(s, 0, { choice: item.answer }, 0, 1000) as typeof s;
    expect((mpView(s, 1) as { answered: boolean[]; reveal: unknown }).reveal).toBeNull();
    s = mpApply(s, 1, { choice: (item.answer + 1) % item.choices.length }, 0, 2000) as typeof s;
    expect(s.phase).toBe('reveal');
    expect(s.scores[0]).toBe(100 + Math.round(50 * (1 - 1000 / T.triviaQuestionMs)));
    expect(s.scores[1]).toBe(0);
    expect((mpView(s, 1) as { question: { answer?: number } }).question.answer).toBe(item.answer);
    let now = 2000;
    for (let i = 0; i < TRIVIA_QUESTIONS * 2 + 2 && !s.over; i++) { now = mpWakeAt(s)!; s = mpTick(s, now) as typeof s; }
    expect(s.over).toBe(true);
    expect(s.winners).toEqual([0]);
  });
});

describe('protocol validation', () => {
  it('accepts well-formed messages and rejects malformed or oversized input', () => {
    expect(parseClientMessage('{"type":"join","id":"a1","code":"abc-234"}')).toEqual({ type: 'join', id: 'a1', code: 'ABC234' });
    expect(parseClientMessage('{"type":"move","id":"a","step":0,"move":{"cell":4}}')).toBeTruthy();
    expect(parseClientMessage('{"type":"move","id":"a","step":0,"move":{"cell":4,"score":999}}')).toBeNull();
    expect(parseClientMessage('{"type":"move","id":"a","step":0,"move":{"from":40,"path":[33,26]}}')).toBeTruthy();
    expect(parseClientMessage('{"type":"move","id":"a","step":"0","move":{"cell":4}}')).toBeNull();
    expect(parseClientMessage('{"type":"create","id":"a","game":"poker","maxPlayers":2}')).toBeNull();
    expect(parseClientMessage('{"type":"join","id":"a b","code":"ABC234"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage('x'.repeat(5000))).toBeNull();
    expect(parseClientMessage('[1,2]')).toBeNull();
  });
  it('room codes and avatars', () => {
    expect(isRoomCode('ABC234')).toBe(true);
    expect(isRoomCode('ABC10O')).toBe(false); // ambiguous characters are excluded
    expect(normalizeRoomCode(' abc 234 ')).toBe('ABC234');
    expect(avatarFor('u1')).toBe(avatarFor('u1'));
  });
});

describe('restart support', () => {
  it('shifts all timers so downtime does not count against players', async () => {
    const { mpShiftTime } = await import('./games.js');
    const s = mpInit('reaction-race', 2, 1, 0) as Extract<MpState, { game: 'reaction-race' }>;
    const shifted = mpShiftTime(s, 10_000) as typeof s;
    expect(shifted.deadline).toBe(s.deadline! + 10_000);
    expect(shifted.goAt).toBe(s.goAt + 10_000);
  });
});
