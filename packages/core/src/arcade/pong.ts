import { mulberry32 } from '../exam/grading.js';
import type { ArcadeDifficulty } from './tictactoe.js';

/** Pong on a 100×60 field; positions are centres. step() is pure and frame-rate independent. */
export const PONG_W = 100;
export const PONG_H = 60;
export const PADDLE_H = 12;
export const PADDLE_W = 2;
export const BALL_R = 1;
const PADDLE_X = [3, PONG_W - 3] as const;
const PADDLE_SPEED = 70; // units per second for humans
const AI_SPEED: Record<ArcadeDifficulty, number> = { easy: 32, medium: 48, hard: 66 };
const AI_ERROR: Record<ArcadeDifficulty, number> = { easy: 7, medium: 3.5, hard: 1.2 };

export interface PongState { ball: { x: number; y: number; vx: number; vy: number }; paddles: [number, number]; score: [number, number]; target: number; winner: 1 | 2 | null; serves: number; seed: number; aiAim: number }

export interface PongInput { left: -1 | 0 | 1 | number; right: -1 | 0 | 1 | number; leftTarget?: number; rightTarget?: number }

function serve(s: Omit<PongState, 'ball'>, towards: 1 | 2): PongState['ball'] {
  const rng = mulberry32(s.seed + s.serves * 977);
  const angle = (rng() - 0.5) * (Math.PI / 3);
  const speed = 45;
  const dir = towards === 2 ? 1 : -1;
  return { x: PONG_W / 2, y: PONG_H / 2, vx: Math.cos(angle) * speed * dir, vy: Math.sin(angle) * speed };
}

export function pongNew(seed: number, target = 7): PongState {
  const base = { paddles: [PONG_H / 2, PONG_H / 2] as [number, number], score: [0, 0] as [number, number], target, winner: null, serves: 0, seed, aiAim: 0 };
  return { ...base, ball: serve(base, 2) };
}

const clampPaddle = (y: number) => Math.min(PONG_H - PADDLE_H / 2, Math.max(PADDLE_H / 2, y));

function movePaddle(y: number, input: number, target: number | undefined, dt: number, speed: number): number {
  if (target !== undefined) {
    const d = target - y;
    return clampPaddle(y + Math.sign(d) * Math.min(Math.abs(d), speed * dt));
  }
  return clampPaddle(y + Math.max(-1, Math.min(1, input)) * speed * dt);
}

/** AI target: track the ball when it approaches, with a per-rally aiming error; drift to centre otherwise. */
export function pongAiTarget(s: PongState, side: 1 | 2, difficulty: ArcadeDifficulty): number {
  const approaching = side === 2 ? s.ball.vx > 0 : s.ball.vx < 0;
  if (!approaching) return PONG_H / 2;
  return s.ball.y + s.aiAim * AI_ERROR[difficulty];
}

export function pongAiSpeed(d: ArcadeDifficulty) { return AI_SPEED[d]; }

export function pongStep(s: PongState, dt: number, input: PongInput, speeds: [number, number] = [PADDLE_SPEED, PADDLE_SPEED]): PongState {
  if (s.winner) return s;
  dt = Math.min(dt, 0.05); // avoid tunnelling after a stall
  const paddles: [number, number] = [
    movePaddle(s.paddles[0], input.left, input.leftTarget, dt, speeds[0]),
    movePaddle(s.paddles[1], input.right, input.rightTarget, dt, speeds[1]),
  ];
  let { x, y, vx, vy } = s.ball;
  x += vx * dt; y += vy * dt;
  if (y < BALL_R) { y = BALL_R; vy = Math.abs(vy); }
  if (y > PONG_H - BALL_R) { y = PONG_H - BALL_R; vy = -Math.abs(vy); }
  let aiAim = s.aiAim;
  for (const side of [0, 1] as const) {
    const px = PADDLE_X[side];
    const movingTowards = side === 0 ? vx < 0 : vx > 0;
    const edge = side === 0 ? px + PADDLE_W / 2 + BALL_R : px - PADDLE_W / 2 - BALL_R;
    const crossed = side === 0 ? x <= edge : x >= edge;
    if (movingTowards && crossed && Math.abs(y - paddles[side]) <= PADDLE_H / 2 + BALL_R) {
      const offset = (y - paddles[side]) / (PADDLE_H / 2); // -1..1
      const speed = Math.min(110, Math.hypot(vx, vy) * 1.05);
      const angle = offset * (Math.PI / 3);
      vx = Math.cos(angle) * speed * (side === 0 ? 1 : -1);
      vy = Math.sin(angle) * speed;
      x = edge;
      aiAim = mulberry32(s.seed + s.serves * 31 + Math.round(Math.abs(y) * 1000))() * 2 - 1;
    }
  }
  let score = s.score, serves = s.serves, ball = { x, y, vx, vy };
  if (x < -BALL_R || x > PONG_W + BALL_R) {
    const scorer: 1 | 2 = x < 0 ? 2 : 1;
    score = scorer === 1 ? [s.score[0] + 1, s.score[1]] : [s.score[0], s.score[1] + 1];
    serves = s.serves + 1;
    ball = serve({ ...s, serves }, scorer === 1 ? 2 : 1);
  }
  const winner = score[0] >= s.target ? 1 : score[1] >= s.target ? 2 : null;
  return { ...s, ball, paddles, score, serves, winner, aiAim };
}
