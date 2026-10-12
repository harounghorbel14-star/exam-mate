import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { reactionNew, reactionArm, reactionGo, reactionTap, reactionSummary, type ReactionState } from '@exammate/core';
import { a, type ArcadeGameProps } from '../shared';

const BG = { idle: '#334155', waiting: '#b91c1c', go: '#15803d', 'false-start': '#a16207', result: '#1d4ed8', done: '#1d4ed8' } as const;

export default function ReactionTest({ seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<ReactionState>(() => reactionNew(5, seed));
  const ref = useRef(s);
  ref.current = s;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = useRef(false);
  useEffect(() => { if (paused && s.phase === 'waiting') { clearTimeout(timer.current); setS({ ...s, phase: 'idle' }); } }, [paused, s]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const tap = (at: number) => {
    if (paused) return;
    const cur = ref.current;
    if (cur.phase === 'idle' || cur.phase === 'result' || cur.phase === 'false-start') {
      const { state, delay } = reactionArm(cur, at);
      setS(state);
      timer.current = setTimeout(() => { setS((x) => reactionGo(x, performance.now())); }, delay);
    } else if (cur.phase === 'waiting' || cur.phase === 'go') {
      clearTimeout(timer.current);
      const n = reactionTap(cur, at);
      sfx.play(n.phase === 'false-start' ? 'error' : 'hit'); if (n.phase === 'false-start') sfx.buzz(60);
      setS(n);
    }
  };
  useEffect(() => {
    if (s.phase !== 'done' || done.current) return;
    done.current = true; sfx.play('win');
    const avg = reactionSummary(s).average ?? 0;
    onFinish({ outcome: 'done', timeMs: avg, message: t('arcade.reaction.average', { ms: avg }) });
  }, [s, sfx, onFinish, t]);
  const label = s.phase === 'waiting' ? t('arcade.reaction.wait') : s.phase === 'go' ? t('arcade.reaction.go') : s.phase === 'false-start' ? t('arcade.reaction.early')
    : s.phase === 'result' ? t('arcade.reaction.result', { ms: s.last ?? 0 }) : t('arcade.reaction.start');
  const sum = reactionSummary(s);
  return (
    <View style={a.center}>
      <Text style={a.faint}>{t('arcade.reaction.round', { n: Math.min(s.results.length + 1, s.rounds), total: s.rounds })}  ·  {t('arcade.falseStarts', { n: s.falseStarts })}{sum.average !== null ? `  ·  ${t('arcade.reaction.average', { ms: sum.average })}` : ''}</Text>
      {/* onPressIn fires on touch-down: the most accurate moment to timestamp */}
      <Pressable onPressIn={() => tap(performance.now())} accessibilityRole="button" accessibilityLabel={label} accessibilityLiveRegion="assertive"
        style={{ width: '100%', minHeight: 280, borderRadius: 24, backgroundColor: BG[s.phase], alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
      </Pressable>
    </View>
  );
}
