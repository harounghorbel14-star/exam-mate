import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { minesNew, minesReveal, minesToggleFlag, minesChord, type MinesState } from '@exammate/core';
import { a, boardWidth, formatMs, Key, useInterval, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

const NUM = ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#e5e7eb'];

export default function Minesweeper({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<MinesState>(() => minesNew(difficulty, seed));
  const [flagMode, setFlagMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  useInterval(() => setElapsed((e) => e + 250), s.status === 'playing' && !paused ? 250 : null);
  const reveal = (i: number) => {
    if (paused) return;
    const n = s.cells[i]!.revealed ? minesChord(s, i) : minesReveal(s, i);
    if (n !== s) { sfx.play(n.status === 'lost' ? 'lose' : 'move'); if (n.status === 'lost') sfx.buzz([0, 100, 50, 100]); }
    setS(n);
  };
  const flag = (i: number) => { if (paused) return; const n = minesToggleFlag(s, i); if (n !== s) { sfx.play('tick'); sfx.buzz(15); } setS(n); };
  useEffect(() => {
    if ((s.status !== 'won' && s.status !== 'lost') || done.current) return;
    done.current = true; if (s.status === 'won') sfx.play('win');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', timeMs: elapsed });
  }, [s.status, sfx, onFinish, elapsed]);
  const cell = boardWidth() / s.w;
  return (
    <View style={a.center}>
      <View style={a.row}>
        <Text style={a.faint}>💣 {s.mines - s.flags}   ⏱ {formatMs(elapsed)}</Text>
        <Key label={`🚩 ${t('arcade.flagMode')}`} onPress={() => setFlagMode((f) => !f)} active={flagMode} />
      </View>
      <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', width: cell * s.w }]}>
        {s.cells.map((c, i) => {
          const label = c.revealed ? (c.mine ? '💣' : c.adjacent ? String(c.adjacent) : '') : c.flagged ? '🚩' : '';
          return (
            <Pressable key={i} onPress={() => (flagMode ? flag(i) : reveal(i))} onLongPress={() => flag(i)} delayLongPress={350} accessibilityRole="button"
              accessibilityLabel={`${t('arcade.cell', { r: Math.floor(i / s.w) + 1, c: (i % s.w) + 1 })}${label ? `: ${label}` : ''}`}
              style={{ width: cell, height: cell, padding: 1 }}>
              <View style={{ flex: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: s.exploded === i ? '#dc2626' : c.revealed ? colors.elev : '#475569' }}>
                <Text style={{ fontWeight: '800', fontSize: cell * 0.5, color: c.revealed && !c.mine ? NUM[c.adjacent] : '#fff' }}>{label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
