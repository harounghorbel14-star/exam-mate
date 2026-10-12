import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { checkersNew, checkersLegalMoves, checkersApply, checkersAiMove, checkersOwner, type CheckersState, type CheckersMove } from '@exammate/core';
import { a, boardWidth, Status, type ArcadeGameProps } from '../shared';

export default function Checkers({ difficulty, mode, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const vsAi = mode === 'ai';
  const [s, setS] = useState<CheckersState>(() => checkersNew());
  const [sel, setSel] = useState<number | null>(null);
  const legal = useMemo(() => checkersLegalMoves(s), [s]);
  const movable = new Set(legal.map((m) => m.from));
  const targets = sel !== null ? legal.filter((m) => m.from === sel) : [];
  const name = (p: 1 | 2) => (vsAi ? (p === 1 ? t('arcade.you') : t('arcade.computer')) : t('arcade.player', { n: p }));
  const myTurn = !vsAi || s.turn === 1;
  const apply = (m: CheckersMove) => { setS(checkersApply(s, m)); setSel(null); sfx.play(m.captures.length ? 'hit' : 'move'); sfx.buzz(m.captures.length ? 25 : 10); };
  const press = (i: number) => {
    if (paused || s.winner || !myTurn) return;
    const target = targets.find((m) => m.path[m.path.length - 1] === i);
    if (target) { apply(target); return; }
    if (movable.has(i)) setSel(i);
    else if (checkersOwner(s.board[i]!) === s.turn) { sfx.play('error'); setSel(null); }
  };
  useEffect(() => {
    if (!vsAi || s.turn !== 2 || s.winner || paused) return;
    const id = setTimeout(() => setS((c) => (c.turn !== 2 || c.winner ? c : checkersApply(c, checkersAiMove(c, difficulty, seed + c.moves)))), 450);
    return () => clearTimeout(id);
  }, [s, vsAi, paused, difficulty, seed]);
  useEffect(() => {
    if (!s.winner) return;
    if (s.winner === 'draw') { onFinish({ outcome: 'draw', message: t('arcade.draw') }); return; }
    const outcome = vsAi ? (s.winner === 1 ? 'win' : 'loss') : 'win';
    sfx.play(outcome === 'loss' ? 'lose' : 'win');
    onFinish({ outcome, message: vsAi ? undefined : t('arcade.playerWins', { name: name(s.winner) }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.winner]);
  const sq = boardWidth() / 8;
  return (
    <View style={a.center}>
      <Status>{s.winner ? '' : vsAi && s.turn === 2 ? t('arcade.thinking') : t('arcade.turn', { name: name(s.turn) })}</Status>
      <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', width: sq * 8, borderWidth: 3, borderColor: '#7c2d12' }]}>
        {s.board.map((p, i) => {
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
          const isTarget = targets.some((m) => m.path[m.path.length - 1] === i);
          const o = checkersOwner(p);
          return (
            <Pressable key={i} onPress={() => press(i)} disabled={!dark} accessibilityRole="button"
              accessibilityLabel={`${t('arcade.cell', { r: Math.floor(i / 8) + 1, c: (i % 8) + 1 })}${p ? `: ${name(o as 1 | 2)}${p > 2 ? ` ${t('arcade.king')}` : ''}` : ''}`}
              style={{ width: sq - (8 * 3 * 2) / 64, height: sq - (8 * 3 * 2) / 64, backgroundColor: dark ? (sel === i ? '#b45309' : '#9a3412') : '#fde7c7', alignItems: 'center', justifyContent: 'center',
                borderWidth: myTurn && movable.has(i) && !s.winner ? 2 : 0, borderColor: '#facc15' }}>
              {p ? <View style={{ width: sq * 0.72, height: sq * 0.72, borderRadius: sq, backgroundColor: o === 1 ? '#dc2626' : '#1f2937', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#facc15', fontSize: sq * 0.35 }}>{p > 2 ? '♛' : ''}</Text></View>
                : isTarget ? <View style={{ width: sq * 0.3, height: sq * 0.3, borderRadius: sq, backgroundColor: '#facc15' }} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
