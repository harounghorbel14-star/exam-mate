import { useEffect, useState } from 'react';
import { tttNew, tttPlay, tttAiMove, type TTTState } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useKeys } from '../shared';

export default function TicTacToe({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<TTTState>(() => tttNew('X'));
  const [cursor, setCursor] = useState(4);
  const vsAi = mode === 'ai';
  const name = (p: 'X' | 'O') => (vsAi ? (p === 'X' ? t('arcade.you') : t('arcade.computer')) : `${t('arcade.player', { n: p === 'X' ? 1 : 2 })} (${p})`);

  const play = (i: number) => {
    if (paused || s.result || s.board[i] || (vsAi && s.turn === 'O')) return;
    setS(tttPlay(s, i)); sfx.play('move'); sfx.buzz(15);
  };

  useEffect(() => {
    if (!vsAi || s.turn !== 'O' || s.result || paused) return;
    const id = setTimeout(() => { setS((cur) => (cur.result || cur.turn !== 'O' ? cur : tttPlay(cur, tttAiMove(cur, difficulty, seed + cur.moves)))); sfx.play('hit'); }, 350);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed, sfx]);

  useEffect(() => {
    if (!s.result) return;
    if (s.result === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.result === 'X' ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.result) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result]);

  useKeys((e) => {
    const m: Record<string, number> = { ArrowUp: -3, ArrowDown: 3, ArrowLeft: -1, ArrowRight: 1 };
    if (m[e.key] !== undefined) { e.preventDefault(); setCursor((c) => Math.min(8, Math.max(0, c + m[e.key]!))); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(cursor); }
    else if (/^[1-9]$/.test(e.key)) play(Number(e.key) - 1);
  }, !paused);

  return (
    <div className="stack center">
      <p className="arcade-status" role="status">{s.result ? '' : vsAi && s.turn === 'O' ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}</p>
      <div className="ttt-board ltr" role="grid" aria-label="Tic-Tac-Toe">
        {s.board.map((c, i) => (
          <button key={i} role="gridcell" className={`ttt-cell${s.line?.includes(i) ? ' win' : ''}${cursor === i ? ' cursor' : ''} ${c ?? ''}`}
            aria-label={`${t('arcade.cell', { r: Math.floor(i / 3) + 1, c: (i % 3) + 1 })}${c ? `: ${c}` : ''}`}
            onClick={() => { setCursor(i); play(i); }} disabled={!!c || !!s.result}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
