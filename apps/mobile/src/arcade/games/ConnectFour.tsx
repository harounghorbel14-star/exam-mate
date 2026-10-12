import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { c4New, c4Drop, c4AiMove, c4LegalCols, C4_COLS, type C4State } from '@exammate/core';
import { a, boardWidth, Status, type ArcadeGameProps } from '../shared';

export default function ConnectFour({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<C4State>(() => c4New(1));
  const vsAi = mode === 'ai';
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));
  const drop = (c: number) => {
    if (paused || s.result || (vsAi && s.turn === 2) || !c4LegalCols(s).includes(c)) { sfx.play('error'); return; }
    setS(c4Drop(s, c)); sfx.play('move'); sfx.buzz(10);
  };
  useEffect(() => {
    if (!vsAi || s.turn !== 2 || s.result || paused) return;
    const id = setTimeout(() => { setS((c) => (c.result || c.turn !== 2 ? c : c4Drop(c, c4AiMove(c, difficulty, seed + c.moves)))); sfx.play('hit'); }, 300);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed, sfx]);
  useEffect(() => {
    if (!s.result) return;
    if (s.result === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.result === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.result) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.result]);
  const cell = (boardWidth() - 20) / C4_COLS;
  const win = new Set(s.line?.map(([r, c]) => `${r},${c}`));
  return (
    <View style={a.center}>
      <Status>{s.result ? '' : vsAi && s.turn === 2 ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}</Status>
      <View style={[a.ltr, { flexDirection: 'row', backgroundColor: '#1d4ed8', padding: 6, borderRadius: 16 }]}>
        {Array.from({ length: C4_COLS }, (_, c) => (
          <Pressable key={c} onPress={() => drop(c)} accessibilityRole="button" accessibilityLabel={t('arcade.column', { n: c + 1 })} style={{ gap: 3, padding: 1.5 }}>
            {s.board.map((row, r) => (
              <View key={r} style={{ width: cell - 3, height: cell - 3, borderRadius: cell, backgroundColor: row[c] === 1 ? '#e11d48' : row[c] === 2 ? '#eab308' : '#0b1220', borderWidth: win.has(`${r},${c}`) ? 3 : 0, borderColor: '#fff' }} />
            ))}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
