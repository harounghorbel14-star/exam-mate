import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { mmNew, mmFlip, mmScore, MEMORY_GRIDS, type MMState, type MemoryGrid } from '@exammate/core';
import { a, boardWidth, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

const GRID_BY_DIFF = { easy: '3x4', medium: '4x4', hard: '6x6' } as const;

export default function MemoryMatch({ difficulty, mode, seed, paused, option, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const grid = (option && option in MEMORY_GRIDS ? option : GRID_BY_DIFF[difficulty]) as MemoryGrid;
  const players = mode === 'local' ? 2 : 1;
  const [s, setS] = useState<MMState>(() => mmNew(grid, seed, players));
  const closer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = useRef(false);
  const flip = (id: number) => {
    if (paused) return;
    clearTimeout(closer.current);
    const r = mmFlip(s, id, Date.now());
    if (r.state === s) return;
    sfx.play(r.match === true ? 'score' : r.match === false ? 'error' : 'move');
    if (r.match) sfx.buzz(20);
    setS(r.state);
    if (r.match === false) closer.current = setTimeout(() => setS((c) => (c.open.length === 2 ? { ...c, open: [] } : c)), 900);
  };
  useEffect(() => () => clearTimeout(closer.current), []);
  useEffect(() => { onScore?.(s.moves); }, [s.moves, onScore]);
  useEffect(() => {
    if (s.finishedAt === null || done.current) return;
    done.current = true; sfx.play('win');
    if (players === 1) onFinish({ outcome: 'win', score: mmScore(s), timeMs: s.finishedAt - (s.startedAt ?? s.finishedAt) });
    else { const [x, y] = s.scores as [number, number]; onFinish(x === y ? { outcome: 'draw', message: t('arcade.draw') } : { outcome: 'win', message: t('arcade.playerWins', { name: t('arcade.player', { n: x > y ? 1 : 2 }) }) }); }
  }, [s, players, sfx, onFinish, t]);
  const { cols } = MEMORY_GRIDS[grid];
  const size = (boardWidth() - (cols - 1) * 6) / cols;
  return (
    <View style={a.center}>
      <Text style={a.faint}>{t('arcade.moves')}: {s.moves}{players === 2 ? `  ·  ${s.scores.map((v, i) => `${s.turn === i ? '▶ ' : ''}${t('arcade.player', { n: i + 1 })}: ${v}`).join('  ')}` : ''}</Text>
      <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: boardWidth() }]}>
        {s.cards.map((c, i) => {
          const up = c.matched || s.open.includes(c.id);
          return (
            <Pressable key={c.id} onPress={() => flip(c.id)} disabled={c.matched} accessibilityRole="button" accessibilityLabel={up ? t('arcade.cardFaceUp', { n: i + 1, symbol: c.symbol }) : t('arcade.card', { n: i + 1 })}
              style={{ width: size, height: size, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: up ? colors.elev : '#7c3aed', borderWidth: 2, borderColor: c.matched ? colors.success : '#a78bfa', opacity: c.matched ? 0.6 : 1 }}>
              <Text style={{ fontSize: size * 0.45, color: '#fff' }}>{up ? c.symbol : '?'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
