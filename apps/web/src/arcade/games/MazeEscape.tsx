import { useEffect, useRef, useState } from 'react';
import { mazeNew, mazeMove, mazeTick, WALL, type MazeState, type Dir } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { DPad, KEY_DIR, swipeHandlers, useInterval, useKeys } from '../shared';

export default function MazeEscape({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [m, setM] = useState<MazeState>(() => mazeNew(difficulty, seed));
  // The engine works on timestamps; pauses shift the clock so paused time doesn't count.
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(false);
  useEffect(() => {
    if (paused) pausedAt.current = Date.now();
    else if (pausedAt.current !== null) { pausedTotal.current += Date.now() - pausedAt.current; pausedAt.current = null; }
  }, [paused]);
  const clock = () => Date.now() - pausedTotal.current;

  useInterval(() => { setNow(clock()); setM((cur) => mazeTick(cur, clock())); }, paused || m.status !== 'playing' ? null : 250);
  const move = (d: Dir) => {
    if (paused) return;
    setM((cur) => { const next = mazeMove(cur, d, clock()); if (next !== cur) sfx.play('tick'); else sfx.buzz(10); return next; });
  };
  useKeys((e) => { const d = KEY_DIR[e.key]; if (d) { e.preventDefault(); move(d); } }, !paused);
  useEffect(() => {
    if (m.status === 'playing' || done.current) return;
    done.current = true;
    sfx.play(m.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: m.status === 'won' ? 'win' : 'loss', timeMs: m.finishedAt! - (m.startedAt ?? m.finishedAt!), score: m.moves, message: m.status === 'won' ? t('arcade.escaped') : t('arcade.timeUp') });
  }, [m, sfx, onFinish, t]);

  const left = m.startedAt === null ? m.timeLimitSec : Math.max(0, Math.ceil(m.timeLimitSec - (now - m.startedAt) / 1000));
  const size = Math.min(440, typeof window !== 'undefined' ? window.innerWidth - 48 : 440);
  const cell = size / m.w;
  const lines: string[] = [];
  for (let i = 0; i < m.w * m.h; i++) {
    const x = (i % m.w) * cell, y = Math.floor(i / m.w) * cell, w = m.walls[i]!;
    if (w & WALL.up) lines.push(`M${x} ${y}h${cell}`);
    if (w & WALL.left) lines.push(`M${x} ${y}v${cell}`);
    if ((w & WALL.right) && i % m.w === m.w - 1) lines.push(`M${x + cell} ${y}v${cell}`);
    if ((w & WALL.down) && Math.floor(i / m.w) === m.h - 1) lines.push(`M${x} ${y + cell}h${cell}`);
    if ((w & WALL.right) && i % m.w !== m.w - 1) lines.push(`M${x + cell} ${y}v${cell}`);
    if ((w & WALL.down) && Math.floor(i / m.w) !== m.h - 1) lines.push(`M${x} ${y + cell}h${cell}`);
  }
  return (
    <div className="stack center">
      <div className="row center"><span className={`badge timer${left <= 10 ? ' danger' : ''}`}>⏱ {t('arcade.timeLeft', { s: left })}</span><span className="badge">{t('arcade.moves')}: {m.moves}</span></div>
      <svg width={size} height={size} viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="maze ltr" role="img" aria-label={`Maze ${m.player.x + 1},${m.player.y + 1}`} {...swipeHandlers(move)} style={{ touchAction: 'none' }}>
        <text x={(m.exit.x + 0.5) * cell} y={(m.exit.y + 0.5) * cell} fontSize={cell * 0.7} textAnchor="middle" dominantBaseline="central">🏁</text>
        <path d={lines.join('')} className="maze-walls" />
        <circle cx={(m.player.x + 0.5) * cell} cy={(m.player.y + 0.5) * cell} r={cell * 0.32} className="maze-player" />
      </svg>
      <DPad onDir={move} t={t} />
    </div>
  );
}
