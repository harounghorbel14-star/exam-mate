import { useEffect, useRef, useState } from 'react';
import { snakeNew, snakeStep, snakeTurn, SNAKE_SPEED, type SnakeState, type Dir } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { DPad, KEY_DIR, swipeHandlers, useInterval, useKeys } from '../shared';

const CELL = 22;

export default function Snake({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<SnakeState>(() => snakeNew(seed, 16, 16));
  const canvas = useRef<HTMLCanvasElement>(null);
  const finished = useRef(false);
  const turn = (d: Dir) => setS((cur) => snakeTurn(cur, d));

  useInterval(() => setS((cur) => {
    const next = snakeStep(cur);
    if (next.score > cur.score) { sfx.play('score'); sfx.buzz(20); }
    return next;
  }), paused || !s.alive || s.won ? null : SNAKE_SPEED[difficulty]);

  useEffect(() => { onScore?.(s.score); }, [s.score, onScore]);
  useEffect(() => {
    if ((s.alive && !s.won) || finished.current) return;
    finished.current = true;
    sfx.play(s.won ? 'win' : 'lose'); sfx.buzz([60, 40, 60]);
    onFinish({ outcome: s.won ? 'win' : 'done', score: s.score });
  }, [s.alive, s.won, s.score, sfx, onFinish]);

  useKeys((e) => { const d = KEY_DIR[e.key]; if (d) { e.preventDefault(); turn(d); } }, !paused);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(canvas.current!);
    ctx.fillStyle = css.getPropertyValue('--arcade-field') || '#0f172a';
    ctx.fillRect(0, 0, s.w * CELL, s.h * CELL);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < s.h; y++) for (let x = (y % 2); x < s.w; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    if (s.food) { ctx.font = `${CELL - 4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🍎', s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2 + 1); }
    s.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#86efac' : `hsl(${142 - Math.min(i, 30)}, 70%, ${50 - Math.min(i, 20) * 0.6}%)`;
      ctx.beginPath(); ctx.roundRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2, 6); ctx.fill();
    });
  }, [s]);

  return (
    <div className="stack center">
      <canvas ref={canvas} width={16 * CELL} height={16 * CELL} className="arcade-canvas" role="img" aria-label={`Snake — ${t('arcade.score')} ${s.score}`}
        {...swipeHandlers(turn)} style={{ touchAction: 'none' }} />
      <DPad onDir={turn} t={t} />
    </div>
  );
}
