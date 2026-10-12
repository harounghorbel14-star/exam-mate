import { useEffect, useRef, useState } from 'react';
import { pongNew, pongStep, pongAiTarget, pongAiSpeed, PONG_W, PONG_H, PADDLE_H, PADDLE_W, BALL_R, type PongState } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useFrame } from '../shared';

const SCALE = 6;

export default function Pong({ difficulty, mode, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const state = useRef<PongState>(pongNew(seed, 7));
  const keys = useRef(new Set<string>());
  const touch = useRef<{ left?: number; right?: number }>({});
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const done = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S', 'z', 'Z'].includes(e.key)) { e.preventDefault(); keys.current.add(e.key.toLowerCase()); } };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useFrame((dt) => {
    const s = state.current;
    if (s.winner) return;
    const k = keys.current;
    const axis = (upKey: boolean, downKey: boolean) => (upKey ? -1 : 0) + (downKey ? 1 : 0);
    const leftKeys = axis(k.has('w') || k.has('z'), k.has('s'));
    const arrows = axis(k.has('arrowup'), k.has('arrowdown'));
    const prev = s;
    const next = pongStep(s, dt, {
      left: vsAi ? leftKeys || arrows : leftKeys,
      right: vsAi ? 0 : arrows,
      leftTarget: touch.current.left,
      rightTarget: vsAi ? pongAiTarget(s, 2, difficulty) : touch.current.right,
    }, [70, vsAi ? pongAiSpeed(difficulty) : 70]);
    if (Math.sign(next.ball.vx) !== Math.sign(prev.ball.vx) && next.serves === prev.serves) { sfx.play('hit'); }
    if (next.serves !== prev.serves) { sfx.play('score'); sfx.buzz(40); setScore(next.score); onScore?.(next.score[0]); }
    state.current = next;
    draw(next);
    if (next.winner && !done.current) {
      done.current = true;
      const outcome = vsAi ? (next.winner === 1 ? 'win' : 'loss') : 'win';
      sfx.play(outcome === 'loss' ? 'lose' : 'win');
      onFinish({ outcome, score: next.score[0], message: vsAi ? undefined : t('arcade.playerWins', { name: t('arcade.player', { n: next.winner }) }) });
    }
  }, !paused);

  const draw = (s: PongState) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#060b18'; ctx.fillRect(0, 0, PONG_W * SCALE, PONG_H * SCALE);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo((PONG_W / 2) * SCALE, 0); ctx.lineTo((PONG_W / 2) * SCALE, PONG_H * SCALE); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#a5b4fc';
    ctx.fillRect((3 - PADDLE_W / 2) * SCALE, (s.paddles[0] - PADDLE_H / 2) * SCALE, PADDLE_W * SCALE, PADDLE_H * SCALE);
    ctx.fillStyle = '#f9a8d4';
    ctx.fillRect((PONG_W - 3 - PADDLE_W / 2) * SCALE, (s.paddles[1] - PADDLE_H / 2) * SCALE, PADDLE_W * SCALE, PADDLE_H * SCALE);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath(); ctx.arc(s.ball.x * SCALE, s.ball.y * SCALE, BALL_R * SCALE * 1.2, 0, Math.PI * 2); ctx.fill();
  };
  useEffect(() => { draw(state.current); });

  const onTouch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * PONG_H;
    const leftHalf = e.clientX - r.left < r.width / 2;
    if (leftHalf || vsAi) touch.current.left = y; else touch.current.right = y;
  };
  const release = () => { touch.current = {}; };
  return (
    <div className="stack center">
      <div className="pong-score ltr" aria-live="polite"><span>{vsAi ? t('arcade.you') : t('arcade.player', { n: 1 })} {score[0]}</span><span>{score[1]} {vsAi ? t('arcade.computer') : t('arcade.player', { n: 2 })}</span></div>
      <canvas ref={canvas} width={PONG_W * SCALE} height={PONG_H * SCALE} className="arcade-canvas ltr" role="img" aria-label={`Pong ${score[0]}–${score[1]}`}
        style={{ touchAction: 'none' }} onPointerDown={onTouch} onPointerMove={onTouch} onPointerUp={release} onPointerCancel={release} onPointerLeave={release} />
    </div>
  );
}
