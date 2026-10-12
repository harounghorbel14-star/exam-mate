import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { mazeNew, mazeMove, mazeTick, WALL, type MazeState, type Dir } from '@exammate/core';
import { a, boardWidth, DPad, useInterval, useSwipe, type ArcadeGameProps } from '../shared';

export default function MazeEscape({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [m, setM] = useState<MazeState>(() => mazeNew(difficulty, seed));
  const pausedTotal = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(false);
  useEffect(() => {
    if (paused) pausedAt.current = Date.now();
    else if (pausedAt.current !== null) { pausedTotal.current += Date.now() - pausedAt.current; pausedAt.current = null; }
  }, [paused]);
  const clock = () => Date.now() - pausedTotal.current;
  useInterval(() => { setNow(clock()); setM((c) => mazeTick(c, clock())); }, paused || m.status !== 'playing' ? null : 250);
  const move = (d: Dir) => { if (paused) return; setM((c) => { const n = mazeMove(c, d, clock()); if (n !== c) sfx.play('tick'); else sfx.buzz(8); return n; }); };
  const swipe = useSwipe(move);
  useEffect(() => {
    if (m.status === 'playing' || done.current) return;
    done.current = true; sfx.play(m.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: m.status === 'won' ? 'win' : 'loss', timeMs: m.finishedAt! - (m.startedAt ?? m.finishedAt!), score: m.moves, message: m.status === 'won' ? t('arcade.escaped') : t('arcade.timeUp') });
  }, [m, sfx, onFinish, t]);
  const left = m.startedAt === null ? m.timeLimitSec : Math.max(0, Math.ceil(m.timeLimitSec - (now - m.startedAt) / 1000));
  const cell = Math.floor(boardWidth() / m.w);
  const wall = '#14b8a6';
  return (
    <View style={a.center}>
      <Text style={a.faint}>⏱ {t('arcade.timeLeft', { s: left })}  ·  {t('arcade.moves')}: {m.moves}</Text>
      <View {...swipe} accessible accessibilityRole="image" accessibilityLabel={`Maze ${m.player.x + 1},${m.player.y + 1}`} style={[a.ltr, { width: cell * m.w, height: cell * m.h, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#111a2e' }]}>
        {m.walls.map((w, i) => (
          <View key={i} pointerEvents="none" style={{ width: cell, height: cell, borderColor: wall, borderTopWidth: w & WALL.up ? 2 : 0, borderLeftWidth: w & WALL.left ? 2 : 0, borderRightWidth: w & WALL.right ? 2 : 0, borderBottomWidth: w & WALL.down ? 2 : 0, alignItems: 'center', justifyContent: 'center' }}>
            {i === m.player.y * m.w + m.player.x ? <View style={{ width: cell * 0.55, height: cell * 0.55, borderRadius: cell, backgroundColor: '#facc15' }} />
              : i === m.exit.y * m.w + m.exit.x ? <Text style={{ fontSize: cell * 0.6 }}>🏁</Text> : null}
          </View>
        ))}
      </View>
      <DPad onDir={move} t={t} />
    </View>
  );
}
