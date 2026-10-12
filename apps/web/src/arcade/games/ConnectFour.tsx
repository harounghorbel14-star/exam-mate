import { useEffect, useState } from 'react';
import { c4New, c4Drop, c4AiMove, c4LegalCols, C4_COLS, type C4State } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useKeys } from '../shared';

export default function ConnectFour({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<C4State>(() => c4New(1));
  const [col, setCol] = useState(3);
  const vsAi = mode === 'ai';
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));

  const drop = (c: number) => {
    if (paused || s.result || (vsAi && s.turn === 2) || !c4LegalCols(s).includes(c)) { sfx.play('error'); return; }
    setS(c4Drop(s, c)); sfx.play('move'); sfx.buzz(15);
  };

  useEffect(() => {
    if (!vsAi || s.turn !== 2 || s.result || paused) return;
    const id = setTimeout(() => { setS((cur) => (cur.result || cur.turn !== 2 ? cur : c4Drop(cur, c4AiMove(cur, difficulty, seed + cur.moves)))); sfx.play('hit'); }, 300);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed, sfx]);

  useEffect(() => {
    if (!s.result) return;
    if (s.result === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.result === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.result) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result]);

  useKeys((e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setCol((c) => Math.max(0, c - 1)); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setCol((c) => Math.min(C4_COLS - 1, c + 1)); }
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); drop(col); }
    else if (/^[1-7]$/.test(e.key)) drop(Number(e.key) - 1);
  }, !paused);

  const win = new Set(s.line?.map(([r, c]) => `${r},${c}`));
  return (
    <div className="stack center">
      <p className="arcade-status" role="status">{s.result ? '' : vsAi && s.turn === 2 ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}
        <span className={`c4-disc mini p${s.turn}`} aria-hidden /></p>
      <div className="c4-board ltr" role="grid" aria-label="Connect Four">
        {Array.from({ length: C4_COLS }, (_, c) => (
          <button key={c} className={`c4-col${col === c ? ' cursor' : ''}`} aria-label={t('arcade.column', { n: c + 1 })} onClick={() => { setCol(c); drop(c); }} disabled={!!s.result}>
            {s.board.map((row, r) => (
              <span key={r} className={`c4-slot${win.has(`${r},${c}`) ? ' win' : ''}`}>
                {row[c] ? <span className={`c4-disc p${row[c]}${s.lastMove?.[0] === r && s.lastMove?.[1] === c ? ' drop' : ''}`} /> : null}
              </span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
}
