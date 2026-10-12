import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { pongNew, pongStep, pongAiTarget, pongAiSpeed, PONG_W, PONG_H, PADDLE_H, PADDLE_W, BALL_R, type PongState } from '@exammate/core';
import { a, boardWidth, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

export default function Pong({ difficulty, mode, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const [s, setS] = useState<PongState>(() => pongNew(seed, 7));
  const ref = useRef(s);
  const touch = useRef<{ left?: number; right?: number }>({});
  const done = useRef(false);
  const W = boardWidth(), scale = W / PONG_W, H = PONG_H * scale;

  // Drag anywhere on your half (left half = player 1; vs AI the whole field controls you).
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => { const { locationX: x, locationY: y } = e.nativeEvent; if (vsAi || x < W / 2) touch.current.left = y / scale; else touch.current.right = y / scale; },
    onPanResponderMove: (e) => { const { locationX: x, locationY: y } = e.nativeEvent; if (vsAi || x < W / 2) touch.current.left = y / scale; else touch.current.right = y / scale; },
    onPanResponderRelease: () => { touch.current = {}; },
  }), [vsAi, W, scale]);

  useEffect(() => {
    if (paused) return;
    let raf = 0, last = Date.now();
    const loop = () => {
      const now = Date.now(), dt = (now - last) / 1000; last = now;
      const cur = ref.current;
      if (!cur.winner) {
        const next = pongStep(cur, dt, { left: 0, right: 0, leftTarget: touch.current.left, rightTarget: vsAi ? pongAiTarget(cur, 2, difficulty) : touch.current.right }, [70, vsAi ? pongAiSpeed(difficulty) : 70]);
        if (Math.sign(next.ball.vx) !== Math.sign(cur.ball.vx) && next.serves === cur.serves) sfx.play('hit');
        if (next.serves !== cur.serves) { sfx.play('score'); sfx.buzz(30); onScore?.(next.score[0]); }
        ref.current = next; setS(next);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, vsAi, difficulty, sfx, onScore]);

  useEffect(() => {
    if (!s.winner || done.current) return;
    done.current = true;
    const outcome = vsAi ? (s.winner === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, score: s.score[0], message: vsAi ? undefined : t('arcade.playerWins', { name: t('arcade.player', { n: s.winner }) }) });
  }, [s.winner, s.score, vsAi, sfx, onFinish, t]);

  return (
    <View style={a.center}>
      <View style={[a.ltr, { flexDirection: 'row', justifyContent: 'space-between', width: W }]}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{vsAi ? t('arcade.you') : t('arcade.player', { n: 1 })} {s.score[0]}</Text>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>{s.score[1]} {vsAi ? t('arcade.computer') : t('arcade.player', { n: 2 })}</Text>
      </View>
      <View {...pan.panHandlers} accessible accessibilityRole="image" accessibilityLabel={`Pong ${s.score[0]}–${s.score[1]}`} style={[a.ltr, { width: W, height: H, backgroundColor: '#060b18', borderRadius: 12, overflow: 'hidden' }]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: W / 2 - 1, top: 0, bottom: 0, width: 2, backgroundColor: '#ffffff22' }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: (3 - PADDLE_W / 2) * scale, top: (s.paddles[0] - PADDLE_H / 2) * scale, width: PADDLE_W * scale, height: PADDLE_H * scale, backgroundColor: '#a5b4fc', borderRadius: 3 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: (PONG_W - 3 - PADDLE_W / 2) * scale, top: (s.paddles[1] - PADDLE_H / 2) * scale, width: PADDLE_W * scale, height: PADDLE_H * scale, backgroundColor: '#f9a8d4', borderRadius: 3 }} />
        <View pointerEvents="none" style={{ position: 'absolute', left: (s.ball.x - BALL_R * 1.2) * scale, top: (s.ball.y - BALL_R * 1.2) * scale, width: BALL_R * 2.4 * scale, height: BALL_R * 2.4 * scale, borderRadius: 99, backgroundColor: '#fef08a' }} />
      </View>
    </View>
  );
}
