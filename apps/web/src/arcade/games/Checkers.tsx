import { useEffect, useMemo, useState } from 'react';
import { checkersNew, checkersLegalMoves, checkersApply, checkersAiMove, checkersOwner, type CheckersState, type CheckersMove } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useKeys } from '../shared';

export default function Checkers({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const [s, setS] = useState<CheckersState>(() => checkersNew());
  const [sel, setSel] = useState<number | null>(null);
  const [cursor, setCursor] = useState(5 * 8 + 0);
  const legal = useMemo(() => checkersLegalMoves(s), [s]);
  const movable = new Set(legal.map((m) => m.from));
  const targets = sel !== null ? legal.filter((m) => m.from === sel) : [];
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));
  const myTurn = !vsAi || s.turn === 1;

  const apply = (m: CheckersMove) => { setS(checkersApply(s, m)); setSel(null); sfx.play(m.captures.length ? 'hit' : 'move'); sfx.buzz(m.captures.length ? 30 : 12); };
  const click = (i: number) => {
    if (paused || s.winner || !myTurn) return;
    const target = targets.find((m) => m.path[m.path.length - 1] === i);
    if (target) { apply(target); return; }
    if (movable.has(i)) setSel(i);
    else if (checkersOwner(s.board[i]!) === s.turn) { sfx.play('error'); setSel(null); } // a capture elsewhere is mandatory
  };

  useEffect(() => {
    if (!vsAi || s.turn !== 2 || s.winner || paused) return;
    const id = setTimeout(() => setS((cur) => (cur.turn !== 2 || cur.winner ? cur : checkersApply(cur, checkersAiMove(cur, difficulty, seed + cur.moves)))), 450);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed]);

  useEffect(() => {
    if (!s.winner) return;
    if (s.winner === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.winner === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.winner) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.winner]);

  useKeys((e) => {
    const m: Record<string, number> = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
    if (m[e.key] !== undefined) { e.preventDefault(); setCursor((c) => Math.min(63, Math.max(0, c + m[e.key]!))); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(cursor); }
    else if (e.key === 'Escape') setSel(null);
  }, !paused);

  const lastSquares = new Set(s.last ? [s.last.from, ...s.last.path] : []);
  return (
    <div className="stack center">
      <p className="arcade-status" role="status">{s.winner ? '' : vsAi && s.turn === 2 ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}</p>
      <div className="ck-board ltr" role="grid" aria-label="Checkers">
        {s.board.map((p, i) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const isTarget = targets.some((m) => m.path[m.path.length - 1] === i);
          const owner = checkersOwner(p);
          const pieceLabel = p ? `${name(owner as 1 | 2)}${p > 2 ? ` ${t('arcade.king')}` : ''}` : '';
          return (
            <button key={i} role="gridcell" className={`ck-sq${dark ? ' dark' : ''}${sel === i ? ' sel' : ''}${isTarget ? ' target' : ''}${cursor === i ? ' cursor' : ''}${lastSquares.has(i) ? ' last' : ''}${myTurn && movable.has(i) && !s.winner ? ' can' : ''}`}
              onClick={() => { setCursor(i); click(i); }} disabled={!dark} aria-label={`${t('arcade.cell', { r: Math.floor(i / 8) + 1, c: (i % 8) + 1 })}${pieceLabel ? `: ${pieceLabel}` : ''}`}>
              {p ? <span className={`ck-piece p${owner}`}>{p > 2 ? '♛' : ''}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
