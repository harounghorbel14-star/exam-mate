import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { blocksNew, blocksTick, blocksMove, blocksRotate, blocksSoftDrop, blocksHardDrop, blocksHold, blocksGhostY, blocksInterval, pieceCells, BLOCKS_W, BLOCKS_H, type BlocksState, type PieceKind } from '@exammate/core';
import { a, Key, useInterval, type ArcadeGameProps } from '../shared';
import { Dimensions } from 'react-native';
import { colors } from '../../lib/theme';

const COLORS: Record<PieceKind, string> = { I: '#22d3ee', O: '#facc15', T: '#a78bfa', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c' };
const KINDS: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const START = { easy: 1, medium: 4, hard: 8 } as const;

export default function FallingBlocks({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<BlocksState>(() => blocksNew(seed, START[difficulty]));
  const done = useRef(false);
  const act = (f: (b: BlocksState) => BlocksState, sound?: 'move' | 'hit') => {
    if (paused) return;
    setS((c) => { const n = f(c); if (n.lines > c.lines) { sfx.play('score'); sfx.buzz(30); } else if (sound && n !== c) sfx.play(sound); return n; });
  };
  useInterval(() => act(blocksTick), paused || s.over ? null : blocksInterval(s.level));
  useEffect(() => { onScore?.(s.score); }, [s.score, onScore]);
  useEffect(() => {
    if (!s.over || done.current) return;
    done.current = true; sfx.play('lose'); sfx.buzz([0, 80, 40, 80]);
    onFinish({ outcome: 'done', score: s.score });
  }, [s.over, s.score, sfx, onFinish]);
  const cell = Math.floor(Math.min((Dimensions.get('window').height - 330) / BLOCKS_H, (Dimensions.get('window').width - 140) / BLOCKS_W, 26));
  const active = new Map<number, string>();
  if (!s.over) {
    for (const [r, c] of pieceCells({ ...s.piece, y: blocksGhostY(s) })) if (r >= 0) active.set(r * BLOCKS_W + c, COLORS[s.piece.kind] + '44');
    for (const [r, c] of pieceCells(s.piece)) if (r >= 0) active.set(r * BLOCKS_W + c, COLORS[s.piece.kind]);
  }
  return (
    <View style={[a.row, { alignItems: 'flex-start' }]}>
      <View accessibilityLabel={`${t('arcade.score')} ${s.score}, ${t('arcade.lines')} ${s.lines}`} style={[a.ltr, { width: cell * BLOCKS_W, height: cell * BLOCKS_H, backgroundColor: '#0b1020', borderRadius: 10, flexDirection: 'row', flexWrap: 'wrap' }]}>
        {s.board.flatMap((row, r) => row.map((v, c) => {
          const color = v ? COLORS[KINDS[v - 1]!] : active.get(r * BLOCKS_W + c);
          return <View key={r * BLOCKS_W + c} style={{ width: cell, height: cell, padding: 1 }}>{color ? <View style={{ flex: 1, borderRadius: 3, backgroundColor: color }} /> : null}</View>;
        }))}
      </View>
      <View style={{ gap: 6, width: 110 }}>
        <Text style={a.faint}>{t('arcade.next')}: {s.queue[0]}</Text>
        <Text style={a.faint}>{t('arcade.hold')}: {s.hold ?? '—'}</Text>
        <Text style={{ color: colors.text }}>{t('arcade.lines')}: {s.lines}</Text>
        <Text style={{ color: colors.text }}>{t('arcade.level')}: {s.level}</Text>
        <View style={[a.row, a.ltr, { justifyContent: 'flex-start' }]}>
          <Key label="◀" a11y={t('arcade.dirLeft')} onPress={() => act((b) => blocksMove(b, -1), 'move')} style={{ width: 50 }} />
          <Key label="▶" a11y={t('arcade.dirRight')} onPress={() => act((b) => blocksMove(b, 1), 'move')} style={{ width: 50 }} />
          <Key label="⟳" a11y={t('arcade.rotate')} onPress={() => act((b) => blocksRotate(b, 1), 'move')} style={{ width: 50 }} />
          <Key label="▼" a11y={t('arcade.softDrop')} onPress={() => act(blocksSoftDrop)} style={{ width: 50 }} />
          <Key label="⤓" a11y={t('arcade.drop')} onPress={() => act(blocksHardDrop, 'hit')} style={{ width: 50 }} />
          <Key label="⇄" a11y={t('arcade.hold')} onPress={() => act(blocksHold, 'move')} style={{ width: 50 }} />
        </View>
      </View>
    </View>
  );
}
