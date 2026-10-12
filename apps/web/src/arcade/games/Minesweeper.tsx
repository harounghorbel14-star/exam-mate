import { useEffect, useRef, useState } from 'react';
import { minesNew, minesReveal, minesToggleFlag, minesChord, type MinesState } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { formatMs, useInterval, useKeys, useStopwatch } from '../shared';

const NUM_COLORS = ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#e5e7eb'];

export default function Minesweeper({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<MinesState>(() => minesNew(difficulty, seed));
  const [flagMode, setFlagMode] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [, force] = useState(0);
  const elapsed = useStopwatch(!paused && s.status === 'playing');
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean } | null>(null);
  const done = useRef(false);
  useInterval(() => force((n) => n + 1), s.status === 'playing' && !paused ? 500 : null);

  const reveal = (i: number) => {
    if (paused) return;
    const c = s.cells[i]!;
    const next = c.revealed ? minesChord(s, i) : minesReveal(s, i);
    if (next !== s) { sfx.play(next.status === 'lost' ? 'lose' : 'move'); if (next.status === 'lost') sfx.buzz([100, 50, 100]); }
    setS(next);
  };
  const flag = (i: number) => {
    if (paused) return;
    const next = minesToggleFlag(s, i);
    if (next !== s) { sfx.play('tick'); sfx.buzz(20); }
    setS(next);
  };
  useEffect(() => {
    if ((s.status !== 'won' && s.status !== 'lost') || done.current) return;
    done.current = true;
    if (s.status === 'won') sfx.play('win');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', timeMs: Math.round(elapsed()) });
  }, [s.status, sfx, onFinish, elapsed]);

  useKeys((e) => {
    const moves: Record<string, number> = { ArrowUp: -s.w, ArrowDown: s.w, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[e.key] !== undefined) { e.preventDefault(); setCursor((c) => Math.min(s.cells.length - 1, Math.max(0, c + moves[e.key]!))); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(cursor); }
    else if (e.key === 'f' || e.key === 'F') flag(cursor);
  }, !paused);

  return (
    <div className="stack center">
      <div className="row center">
        <span className="badge">💣 {s.mines - s.flags}</span>
        <span className="badge timer">⏱ {formatMs(elapsed())}</span>
        <button className={`btn sm${flagMode ? ' primary' : ''}`} aria-pressed={flagMode} onClick={() => setFlagMode((f) => !f)}>🚩 {t('arcade.flagMode')}</button>
      </div>
      <div className="mines-board ltr" role="grid" aria-label="Minesweeper" style={{ gridTemplateColumns: `repeat(${s.w}, minmax(0, 1fr))` }} onContextMenu={(e) => e.preventDefault()}>
        {s.cells.map((c, i) => {
          const label = c.revealed ? (c.mine ? '💣' : c.adjacent ? String(c.adjacent) : '') : c.flagged ? '🚩' : '';
          return (
            <button key={i} role="gridcell" className={`mine-cell${c.revealed ? ' open' : ''}${s.exploded === i ? ' boom' : ''}${cursor === i ? ' cursor' : ''}`}
              style={c.revealed && c.adjacent && !c.mine ? { color: NUM_COLORS[c.adjacent] } : undefined}
              aria-label={`${t('arcade.cell', { r: Math.floor(i / s.w) + 1, c: (i % s.w) + 1 })}${label ? `: ${label}` : ''}`}
              onClick={() => { if (longPress.current?.fired) { longPress.current = null; return; } setCursor(i); if (flagMode) flag(i); else reveal(i); }}
              onContextMenu={(e) => { e.preventDefault(); flag(i); }}
              onPointerDown={(e) => { if (e.pointerType !== 'mouse') { const lp = { fired: false, timer: setTimeout(() => { lp.fired = true; flag(i); }, 450) }; longPress.current = lp; } }}
              onPointerUp={() => { if (longPress.current && !longPress.current.fired) { clearTimeout(longPress.current.timer); longPress.current = null; } }}
              onPointerLeave={() => { if (longPress.current && !longPress.current.fired) { clearTimeout(longPress.current.timer); longPress.current = null; } }}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
