import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { simonNew, simonShown, simonPress, simonFlashMs, simonScore, type SimonState } from '@exammate/core';
import { a, boardWidth, Status, type ArcadeGameProps, type SfxName } from '../shared';

const COLORS = ['#22c55e', '#ef4444', '#eab308', '#3b82f6', '#a855f7', '#f97316'];
const DIM = ['#14532d', '#7f1d1d', '#713f12', '#1e3a8a', '#581c87', '#7c2d12'];

export default function SimonSays({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<SimonState>(() => simonNew(difficulty, seed));
  const [lit, setLit] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (s.status !== 'showing' || paused) return;
    const flash = simonFlashMs(s);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    s.sequence.forEach((pad, i) => {
      timers.push(setTimeout(() => { setLit(pad); sfx.play(`pad${pad}` as SfxName); }, 600 + i * (flash + 160)));
      timers.push(setTimeout(() => setLit(null), 600 + i * (flash + 160) + flash));
    });
    timers.push(setTimeout(() => { setS((c) => simonShown(c)); setMsg(null); }, 600 + s.sequence.length * (flash + 160)));
    return () => { timers.forEach(clearTimeout); setLit(null); };
  }, [s, paused, sfx]);
  useEffect(() => { onScore?.(simonScore(s)); }, [s, onScore]);
  useEffect(() => {
    if (s.status !== 'over' || done.current) return;
    done.current = true; sfx.play('lose'); sfx.buzz([0, 80, 40, 80]);
    onFinish({ outcome: 'done', score: simonScore(s) });
  }, [s, sfx, onFinish]);
  const press = (pad: number) => {
    if (paused || s.status !== 'input') return;
    setLit(pad); setTimeout(() => setLit((l) => (l === pad ? null : l)), 180);
    const r = simonPress(s, pad);
    if (r.result === null) return;
    sfx.play(r.result === 'over' || r.result === 'retry' ? 'error' : (`pad${pad}` as SfxName)); sfx.buzz(12);
    if (r.result === 'retry') setMsg(t('arcade.simon.retry'));
    setS(r.state);
  };
  const cols = s.pads === 6 ? 3 : 2;
  const size = Math.min(boardWidth(), 360) / cols - 12;
  return (
    <View style={a.center}>
      <Status>{msg ?? (s.status === 'showing' ? t('arcade.simon.watch') : s.status === 'input' ? t('arcade.simon.yourTurn') : '')} · {t('arcade.round', { n: s.round })}</Status>
      <View style={[a.row, { width: (size + 12) * cols }]}>
        {Array.from({ length: s.pads }, (_, i) => (
          <Pressable key={i} onPressIn={() => press(i)} disabled={s.status !== 'input'} accessibilityRole="button" accessibilityLabel={t('arcade.pad', { n: i + 1 })}
            style={{ width: size, height: size, borderRadius: 26, backgroundColor: lit === i ? COLORS[i] : DIM[i], transform: [{ scale: lit === i ? 1.04 : 1 }] }} />
        ))}
      </View>
    </View>
  );
}
