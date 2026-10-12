import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { snakeNew, snakeStep, snakeTurn, SNAKE_SPEED, type SnakeState, type Dir } from '@exammate/core';
import { a, boardWidth, DPad, useInterval, useSwipe, type ArcadeGameProps } from '../shared';

const N = 16;

export default function Snake({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<SnakeState>(() => snakeNew(seed, N, N));
  const done = useRef(false);
  const turn = (d: Dir) => setS((c) => snakeTurn(c, d));
  const swipe = useSwipe(turn);
  useInterval(() => setS((c) => { const n = snakeStep(c); if (n.score > c.score) { sfx.play('score'); sfx.buzz(15); } return n; }), paused || !s.alive || s.won ? null : SNAKE_SPEED[difficulty]);
  useEffect(() => { onScore?.(s.score); }, [s.score, onScore]);
  useEffect(() => {
    if ((s.alive && !s.won) || done.current) return;
    done.current = true; sfx.play(s.won ? 'win' : 'lose'); sfx.buzz([0, 60, 40, 60]);
    onFinish({ outcome: s.won ? 'win' : 'done', score: s.score });
  }, [s.alive, s.won, s.score, sfx, onFinish]);
  const cell = Math.floor(boardWidth() / N);
  const body = new Map(s.snake.map((p, i) => [p.y * N + p.x, i]));
  return (
    <View style={a.center}>
      <View {...swipe} accessible accessibilityRole="image" accessibilityLabel={`Snake — ${t('arcade.score')} ${s.score}`} style={[a.ltr, { width: cell * N, height: cell * N, backgroundColor: '#0f172a', borderRadius: 12, overflow: 'hidden' }]}>
        {s.food && <Text style={{ position: 'absolute', left: s.food.x * cell, top: s.food.y * cell - 1, width: cell, fontSize: cell - 4, textAlign: 'center' }}>🍎</Text>}
        {[...body.entries()].map(([k, i]) => (
          <View key={k} style={{ position: 'absolute', left: (k % N) * cell + 1, top: Math.floor(k / N) * cell + 1, width: cell - 2, height: cell - 2, borderRadius: 5, backgroundColor: i === 0 ? '#86efac' : '#22c55e' }} />
        ))}
      </View>
      <DPad onDir={turn} t={t} />
    </View>
  );
}
