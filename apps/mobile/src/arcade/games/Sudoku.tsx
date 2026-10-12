import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { sudokuNew, sudokuEnter, sudokuHint, sudokuToggleNote, type SudokuState } from '@exammate/core';
import { a, arcadeRepo, boardWidth, formatMs, Key, useInterval, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

export default function Sudoku({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<SudokuState | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [notes, setNotes] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(false);
  useInterval(() => setElapsed((e) => e + 1000), s?.status === 'playing' && !paused ? 1000 : null);
  useEffect(() => {
    void arcadeRepo().then((r) => r.loadGame<SudokuState>('sudoku')).then((saved) =>
      setS(saved && saved.status === 'playing' && saved.difficulty === difficulty && Array.isArray(saved.values) ? saved : sudokuNew(difficulty, seed)));
  }, [difficulty, seed]);
  useEffect(() => { if (s?.status === 'playing') void arcadeRepo().then((r) => r.saveGame('sudoku', s)); }, [s]);
  useEffect(() => {
    if (!s || s.status === 'playing' || done.current) return;
    done.current = true; void arcadeRepo().then((r) => r.clearGame('sudoku'));
    sfx.play(s.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', timeMs: elapsed });
  }, [s, sfx, onFinish, elapsed]);
  const enter = (v: number) => {
    if (!s || sel === null || paused) return;
    if (notes && v > 0) { setS(sudokuToggleNote(s, sel, v)); return; }
    const r = sudokuEnter(s, sel, v);
    if (r.correct === false) { sfx.play('error'); sfx.buzz(50); } else if (r.correct) sfx.play('move');
    setS(r.state);
  };
  if (!s) return null;
  const cell = Math.floor((boardWidth() - 6) / 9);
  return (
    <View style={a.center}>
      <Text style={a.faint}>{t('arcade.mistakes', { n: s.mistakes, max: s.maxMistakes })}   ⏱ {formatMs(elapsed)}</Text>
      <View style={[a.ltr, { flexDirection: 'row', flexWrap: 'wrap', width: cell * 9 + 6, borderWidth: 3, borderColor: colors.muted }]}>
        {s.values.map((v, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const same = sel !== null && v && v === s.values[sel];
          return (
            <Pressable key={i} onPress={() => setSel(i)} accessibilityRole="button" accessibilityLabel={`${t('arcade.cell', { r: r + 1, c: c + 1 })}${v ? `: ${v}` : ''}`} accessibilityState={{ selected: sel === i }}
              style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center', backgroundColor: sel === i ? '#1e3a8a' : same ? '#1e293b' : colors.elev,
                borderRightWidth: c % 3 === 2 && c < 8 ? 2 : 0.5, borderBottomWidth: r % 3 === 2 && r < 8 ? 2 : 0.5, borderColor: c % 3 === 2 || r % 3 === 2 ? colors.muted : colors.border }}>
              <Text style={{ fontSize: v ? cell * 0.55 : cell * 0.24, fontWeight: s.puzzle[i] ? '800' : '500', color: s.puzzle[i] ? colors.text : v ? colors.primary : colors.faint }}>
                {v || s.notes[i]!.join('')}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[a.row, a.ltr]}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <Key key={n} label={String(n)} onPress={() => enter(n)} style={{ width: cell * 0.95 }} />)}</View>
      <View style={a.row}>
        <Key label={`✎ ${t('arcade.notes')}`} onPress={() => setNotes((x) => !x)} active={notes} />
        <Key label={`⌫ ${t('arcade.erase')}`} onPress={() => enter(0)} />
        <Key label={`💡 ${t('arcade.hint')} (${s.hintsUsed})`} onPress={() => { const r = sudokuHint(s, sel ?? undefined); if (r.cell !== null) { setSel(r.cell); sfx.play('score'); } setS(r.state); }} />
      </View>
    </View>
  );
}
