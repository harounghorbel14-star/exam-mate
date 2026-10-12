import { useEffect, useState } from 'react';
import type { MessageKey, MultiplayerClient, RoomSnapshot, MpTriviaQuestion, Locale } from '@exammate/core';

type T = (k: MessageKey, p?: Record<string, string | number>) => string;
interface Props { room: RoomSnapshot; client: MultiplayerClient; t: T; locale: Locale; onError(e: unknown): void }

/** Countdown from a server deadline, corrected for clock skew using the snapshot's serverTime. */
function useCountdown(deadline: number | null, serverTime: number) {
  const [skew] = useState(() => serverTime - Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i); }, []);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - (now + skew)) / 1000));
}

const RPS_ICON: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

export function GameView({ room, client, t, locale, onError }: Props) {
  const v = room.view! as Record<string, unknown> & { game: string; turn: number | null; scores: number[]; over: boolean; deadline: number | null; step: number };
  const me = room.mySeat;
  const nameOf = (seat: number) => room.players.find((p) => p.seat === seat)?.name ?? '?';
  const left = useCountdown(v.deadline, room.serverTime);
  const myTurn = v.turn !== null && v.turn === me;
  const move = (m: Parameters<MultiplayerClient['move']>[0]) => client.move(m).catch(onError);

  const turnLine = v.over ? null : v.turn !== null
    ? <p className="arcade-status" role="status">{myTurn ? t('mp.yourTurn') : t('mp.theirTurn', { name: nameOf(v.turn) })}{left !== null && <span className={`badge timer${left <= 5 ? ' danger' : ''}`}>⏱ {t('mp.timeLeft', { s: left })}</span>}</p>
    : left !== null ? <p className="arcade-status"><span className={`badge timer${left <= 5 ? ' danger' : ''}`}>⏱ {t('mp.timeLeft', { s: left })}</span></p> : null;

  switch (v.game) {
    case 'tic-tac-toe': {
      const board = v.board as Array<string | null>, line = (v.line as number[] | null) ?? [];
      return (<div className="stack center">{turnLine}
        <div className="ttt-board ltr" role="grid" aria-label="Tic-Tac-Toe">
          {board.map((c, i) => <button key={i} role="gridcell" className={`ttt-cell ${c ?? ''}${line.includes(i) ? ' win' : ''}`} disabled={!myTurn || !!c} onClick={() => move({ cell: i })} aria-label={`${t('arcade.cell', { r: Math.floor(i / 3) + 1, c: (i % 3) + 1 })}${c ? `: ${c}` : ''}`}>{c}</button>)}
        </div></div>);
    }
    case 'connect-four': {
      const board = v.board as number[][];
      const win = new Set(((v.line as Array<[number, number]> | null) ?? []).map(([r, c]) => `${r},${c}`));
      return (<div className="stack center">{turnLine}
        <div className="c4-board ltr" role="grid" aria-label="Connect Four">
          {board[0]!.map((_, c) => <button key={c} className="c4-col" disabled={!myTurn} onClick={() => move({ col: c })} aria-label={t('arcade.column', { n: c + 1 })}>
            {board.map((row, r) => <span key={r} className={`c4-slot${win.has(`${r},${c}`) ? ' win' : ''}`}>{row[c] ? <span className={`c4-disc p${row[c]}`} /> : null}</span>)}
          </button>)}
        </div></div>);
    }
    case 'checkers': return <CheckersView v={v} me={me} myTurn={myTurn} t={t} move={move} turnLine={turnLine} nameOf={nameOf} />;
    case 'rock-paper-scissors': {
      const rounds = v.rounds as Array<{ p1: string; p2: string; winner: number }>;
      const chosen = v.chosen as boolean[], mine = v.myChoice as string | null, last = rounds[rounds.length - 1];
      return (<div className="stack center">{turnLine}
        <div className="row center">{[0, 1].map((s) => <span key={s} className="badge">{nameOf(s)}: {chosen[s] ? `✓ ${t('mp.chosen')}` : t('mp.waitingChoice')}</span>)}</div>
        {last && <p className="rps-reveal" role="status"><span className="rps-hand">{RPS_ICON[last.p1]}</span> vs <span className="rps-hand flip">{RPS_ICON[last.p2]}</span>
          <span style={{ flexBasis: '100%', textAlign: 'center' }}>{last.winner === 0 ? t('arcade.rps.tie') : t('arcade.rps.roundWin', { name: nameOf(last.winner - 1) })}</span></p>}
        {!v.over && <div className="row center">{(['rock', 'paper', 'scissors'] as const).map((c) => (
          <button key={c} className={`btn rps-btn${mine === c ? ' primary' : ''}`} disabled={!!mine || me === null} onClick={() => move({ choice: c })}><span aria-hidden style={{ fontSize: '2.2rem' }}>{RPS_ICON[c]}</span>{t(`arcade.rps.${c}`)}</button>
        ))}</div>}
      </div>);
    }
    case 'memory-challenge': {
      const cards = v.cards as Array<{ id: number; symbol: string | null; matched: boolean }>;
      return (<div className="stack center">{turnLine}
        <div className="mm-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', maxWidth: 420 }}>
          {cards.map((c, i) => <button key={c.id} className={`mm-card${c.symbol ? ' up' : ''}${c.matched ? ' matched' : ''}`} disabled={!myTurn || c.matched || !!c.symbol} onClick={() => move({ card: c.id })}
            aria-label={c.symbol ? t('arcade.cardFaceUp', { n: i + 1, symbol: c.symbol }) : t('arcade.card', { n: i + 1 })}><span aria-hidden>{c.symbol ?? '?'}</span></button>)}
        </div></div>);
    }
    case 'reaction-race': {
      const phase = v.phase as string, out = v.out as boolean[], winner = v.roundWinner as number | null, times = v.times as Array<number | null>;
      const amOut = me !== null && out[me];
      const label = phase === 'wait' ? (amOut ? t('mp.reaction.out') : t('mp.reaction.wait')) : phase === 'go' ? (amOut ? t('mp.reaction.out') : t('mp.reaction.go'))
        : winner !== null ? t('mp.reaction.roundWinner', { name: nameOf(winner), ms: times[winner] ?? 0 }) : t('mp.reaction.noWinner');
      return (<div className="stack center">
        <p className="faint">{t('arcade.reaction.round', { n: (v.round as number) + 1, total: v.rounds as number })} · {t('mp.latencyNote')}</p>
        <button className={`reaction-pad ${phase === 'wait' ? 'waiting' : phase === 'go' ? 'go' : 'result'}`} disabled={phase === 'result' || amOut || me === null}
          onPointerDown={(e) => { e.preventDefault(); void move({ tap: true }); }} aria-live="assertive">{label}</button>
      </div>);
    }
    case 'trivia': {
      const q = v.question as MpTriviaQuestion, phase = v.phase as string, myAnswer = v.myAnswer as number | null, answered = v.answered as boolean[];
      const reveal = v.reveal as Array<number | null> | null;
      return (<div className="stack center">
        <p className="faint">{t('mp.question', { n: (v.q as number) + 1, total: v.total as number })}{left !== null && <> · ⏱ {t('mp.timeLeft', { s: left })}</>}</p>
        <h2 style={{ textAlign: 'center', margin: 0 }}>{q.q[locale]}</h2>
        <div className="choice-grid" style={{ width: '100%', maxWidth: 640 }}>
          {q.choices.map((c, i) => {
            const cls = q.answer !== undefined ? (i === q.answer ? ' correct' : myAnswer === i ? ' wrong' : '') : myAnswer === i ? ' selected' : '';
            return <button key={i} className={`choice${cls}`} disabled={phase !== 'question' || myAnswer !== null || me === null} onClick={() => move({ choice: i })} aria-pressed={myAnswer === i}>{c[locale]}</button>;
          })}
        </div>
        <div className="row center">{room.players.map((p) => <span key={p.userId} className="badge">{p.avatar} {p.name}{reveal ? (reveal[p.seat] === q.answer ? ' ✓' : ' ✗') : answered[p.seat] ? ` · ${t('mp.answered')}` : ''}</span>)}</div>
      </div>);
    }
    default: return null;
  }
}

function CheckersView({ v, me, myTurn, t, move, turnLine, nameOf }: { v: Record<string, unknown>; me: number | null; myTurn: boolean; t: T; move(m: { from: number; path: number[] }): void; turnLine: React.ReactNode; nameOf(s: number): string }) {
  const [sel, setSel] = useState<number | null>(null);
  const board = v.board as number[], legal = v.legal as Array<{ from: number; path: number[] }>;
  const movable = new Set(myTurn ? legal.map((m) => m.from) : []);
  const targets = sel !== null ? legal.filter((m) => m.from === sel) : [];
  // Seat 1 sees the board from their side.
  const flip = me === 1;
  const order = Array.from({ length: 64 }, (_, i) => (flip ? 63 - i : i));
  return (<div className="stack center">{turnLine}
    <div className="ck-board ltr" role="grid" aria-label="Checkers">
      {order.map((i) => {
        const p = board[i]!, dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
        const target = targets.find((m) => m.path[m.path.length - 1] === i);
        const owner = p === 0 ? 0 : p === 1 || p === 3 ? 1 : 2;
        return <button key={i} role="gridcell" disabled={!dark} className={`ck-sq${dark ? ' dark' : ''}${sel === i ? ' sel' : ''}${target ? ' target' : ''}${movable.has(i) ? ' can' : ''}`}
          onClick={() => { if (target) { move({ from: target.from, path: target.path }); setSel(null); } else if (movable.has(i)) setSel(i); }}
          aria-label={`${t('arcade.cell', { r: Math.floor(i / 8) + 1, c: (i % 8) + 1 })}${p ? `: ${nameOf(owner - 1)}${p > 2 ? ` ${t('arcade.king')}` : ''}` : ''}`}>
          {p ? <span className={`ck-piece p${owner}`}>{p > 2 ? '♛' : ''}</span> : null}
        </button>;
      })}
    </div></div>);
}
