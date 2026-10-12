import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tttNew, tttPlay, tttAiMove, type TTTState } from '@exammate/core';
import { a, boardWidth, Status, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

export default function TicTacToe({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<TTTState>(() => tttNew('X'));
  const vsAi = mode === 'ai';
  const name = (p: 'X' | 'O') => (vsAi ? (p === 'X' ? t('arcade.you') : t('arcade.computer')) : `${t('arcade.player', { n: p === 'X' ? 1 : 2 })} (${p})`);
  const play = (i: number) => {
    if (paused || s.result || s.board[i] || (vsAi && s.turn === 'O')) return;
    setS(tttPlay(s, i)); sfx.play('move'); sfx.buzz(10);
  };
  useEffect(() => {
    if (!vsAi || s.turn !== 'O' || s.result || paused) return;
    const id = setTimeout(() => { setS((c) => (c.result || c.turn !== 'O' ? c : tttPlay(c, tttAiMove(c, difficulty, seed + c.moves)))); sfx.play('hit'); }, 350);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed, sfx]);
  useEffect(() => {
    if (!s.result) return;
    if (s.result === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.result === 'X' ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.result) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result]);
  const size = Math.min(boardWidth(), 330) / 3 - 8;
  return (
    <View style={a.center}>
      <Status>{s.result ? '' : vsAi && s.turn === 'O' ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}</Status>
      <View style={[a.row, a.ltr, { width: (size + 8) * 3 }]}>
        {s.board.map((c, i) => (
          <Pressable key={i} onPress={() => play(i)} accessibilityRole="button" accessibilityLabel={`${t('arcade.cell', { r: Math.floor(i / 3) + 1, c: (i % 3) + 1 })}${c ? `: ${c}` : ''}`}
            style={{ width: size, height: size, borderRadius: 16, borderWidth: 2, borderColor: s.line?.includes(i) ? '#facc15' : colors.border, backgroundColor: s.line?.includes(i) ? '#3f3a1a' : colors.elev, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: size * 0.5, fontWeight: '800', color: c === 'X' ? '#f472b6' : '#22d3ee' }}>{c ?? ''}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
