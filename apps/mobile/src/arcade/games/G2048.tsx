import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { g2048New, g2048Move, g2048MaxTile, type G2048State, type Dir } from '@exammate/core';
import { a, boardWidth, Key, arcadeRepo, useSwipe, type ArcadeGameProps } from '../shared';

const BG: Record<number, string> = { 0: '#ffffff14', 2: '#fde7f3', 4: '#fbcfe8', 8: '#f9a8d4', 16: '#f472b6', 32: '#ec4899', 64: '#c026d3', 128: '#a855f7', 256: '#8b5cf6', 512: '#6366f1', 1024: '#3b82f6', 2048: '#f59e0b' };

export default function G2048({ seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<G2048State | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const done = useRef(false);
  useEffect(() => { void arcadeRepo().then((r) => r.loadGame<G2048State>('2048')).then((saved) => setS(saved && !saved.over && Array.isArray(saved.grid) ? saved : g2048New(seed))); }, [seed]);
  useEffect(() => { if (s && !s.over) void arcadeRepo().then((r) => r.saveGame('2048', s)); }, [s]);
  useEffect(() => { if (s) onScore?.(s.score); }, [s, onScore]);
  useEffect(() => {
    if (!s?.over || done.current) return;
    done.current = true; void arcadeRepo().then((r) => r.clearGame('2048'));
    sfx.play(s.won ? 'win' : 'lose');
    onFinish({ outcome: s.won ? 'win' : 'done', score: s.score });
  }, [s, sfx, onFinish]);
  const move = (d: Dir) => {
    if (!s || paused || celebrate) return;
    const r = g2048Move(s, d);
    if (!r.moved) return;
    sfx.play(r.state.score > s.score ? 'hit' : 'move');
    if (r.state.won && !s.won) { setCelebrate(true); sfx.play('win'); sfx.buzz(40); }
    setS(r.state);
  };
  const swipe = useSwipe(move);
  if (!s) return null;
  const cell = (boardWidth() - 50) / 4;
  return (
    <View style={a.center}>
      <Text style={a.faint}>▲ {g2048MaxTile(s)} · {t('arcade.moves')}: {s.moves}</Text>
      <View {...swipe} accessible accessibilityRole="image" accessibilityLabel="2048" style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', width: cell * 4 + 50, padding: 5, gap: 10, backgroundColor: '#3b3150', borderRadius: 16 }]}>
        {s.grid.flatMap((row, r) => row.map((v, c) => (
          <View key={`${r}-${c}`} accessibilityLabel={v ? String(v) : t('arcade.cell', { r: r + 1, c: c + 1 })} style={{ width: cell, height: cell, borderRadius: 10, backgroundColor: BG[Math.min(v, 2048)] ?? '#f59e0b', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '800', fontSize: v >= 1024 ? cell * 0.26 : cell * 0.36, color: v >= 16 ? '#fff' : '#1f1530' }}>{v || ''}</Text>
          </View>
        )))}
      </View>
      {celebrate && (
        <View style={a.center}>
          <Text style={a.status}>{t('arcade.reached2048')}</Text>
          <View style={a.row}><Key label={t('arcade.keepGoing')} onPress={() => setCelebrate(false)} active />
            <Key label={t('arcade.quit')} onPress={() => { done.current = true; void arcadeRepo().then((r) => r.clearGame('2048')); onFinish({ outcome: 'win', score: s.score }); }} /></View>
        </View>
      )}
    </View>
  );
}
