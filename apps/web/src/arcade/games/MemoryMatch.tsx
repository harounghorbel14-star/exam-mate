import { useEffect, useRef, useState } from 'react';
import { mmNew, mmFlip, mmScore, MEMORY_GRIDS, type MMState, type MemoryGrid } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';

const GRID_BY_DIFF = { easy: '3x4', medium: '4x4', hard: '6x6' } as const;

export default function MemoryMatch({ difficulty, mode, seed, paused, option, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const grid = (option && option in MEMORY_GRIDS ? option : GRID_BY_DIFF[difficulty]) as MemoryGrid;
  const players = mode === 'local' ? 2 : 1;
  const [s, setS] = useState<MMState>(() => mmNew(grid, seed, players));
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const done = useRef(false);

  const flip = (id: number) => {
    if (paused) return;
    clearTimeout(closeTimer.current);
    const r = mmFlip(s, id, Date.now());
    if (r.state === s) return;
    sfx.play(r.match === true ? 'score' : r.match === false ? 'error' : 'move');
    if (r.match) sfx.buzz(25);
    setS(r.state);
    // Auto-close a missed pair after a short look.
    if (r.match === false) closeTimer.current = setTimeout(() => setS((cur) => (cur.open.length === 2 ? { ...cur, open: [] } : cur)), 900);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => { onScore?.(s.moves); }, [s.moves, onScore]);
  useEffect(() => {
    if (s.finishedAt === null || done.current) return;
    done.current = true;
    sfx.play('win');
    if (players === 1) onFinish({ outcome: 'win', score: mmScore(s), timeMs: s.finishedAt - (s.startedAt ?? s.finishedAt) });
    else {
      const [a, b] = s.scores as [number, number];
      onFinish(a === b ? { outcome: 'draw', message: t('arcade.draw') } : { outcome: 'win', message: t('arcade.playerWins', { name: t('arcade.player', { n: a > b ? 1 : 2 }) }) });
    }
  }, [s, players, sfx, onFinish, t]);

  const { cols } = MEMORY_GRIDS[grid];
  return (
    <div className="stack center">
      <div className="row center faint" aria-live="polite">
        <span>{t('arcade.moves')}: {s.moves}</span>
        {players === 2 && s.scores.map((v, i) => <span key={i} className={`badge${s.turn === i ? ' info' : ''}`}>{t('arcade.player', { n: i + 1 })}: {v}</span>)}
      </div>
      <div className="mm-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {s.cards.map((c, i) => {
          const up = c.matched || s.open.includes(c.id);
          return (
            <button key={c.id} className={`mm-card${up ? ' up' : ''}${c.matched ? ' matched' : ''}`} onClick={() => flip(c.id)} disabled={c.matched}
              aria-label={up ? t('arcade.cardFaceUp', { n: i + 1, symbol: c.symbol }) : t('arcade.card', { n: i + 1 })} aria-pressed={up}>
              <span aria-hidden>{up ? c.symbol : '?'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
