import { useEffect, useRef, useState } from 'react';
import { reactionNew, reactionArm, reactionGo, reactionTap, reactionSummary, type ReactionState } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useKeys } from '../shared';

export default function ReactionTest({ seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<ReactionState>(() => reactionNew(5, seed));
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const done = useRef(false);
  const ref = useRef(s);
  ref.current = s;

  // Pausing during the wait cancels the round (it would otherwise skew timing).
  useEffect(() => { if (paused && s.phase === 'waiting') { clearTimeout(timer.current); setS({ ...s, phase: 'idle' }); } }, [paused, s]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const tap = (at: number) => {
    if (paused) return;
    const cur = ref.current;
    if (cur.phase === 'idle' || cur.phase === 'result' || cur.phase === 'false-start') {
      const { state, delay } = reactionArm(cur, at);
      setS(state);
      timer.current = setTimeout(() => { setS((x) => reactionGo(x, performance.now())); sfx.play('tick'); }, delay);
    } else if (cur.phase === 'waiting' || cur.phase === 'go') {
      clearTimeout(timer.current);
      const next = reactionTap(cur, at);
      sfx.play(next.phase === 'false-start' ? 'error' : 'hit');
      if (next.phase === 'false-start') sfx.buzz(80);
      setS(next);
    }
  };
  useEffect(() => {
    if (s.phase !== 'done' || done.current) return;
    done.current = true;
    sfx.play('win');
    onFinish({ outcome: 'done', timeMs: reactionSummary(s).average ?? undefined, message: t('arcade.reaction.average', { ms: reactionSummary(s).average ?? 0 }) });
  }, [s, sfx, onFinish, t]);
  useKeys((e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); tap(performance.now()); } }, !paused);

  const label = s.phase === 'waiting' ? t('arcade.reaction.wait') : s.phase === 'go' ? t('arcade.reaction.go') : s.phase === 'false-start' ? t('arcade.reaction.early')
    : s.phase === 'result' ? t('arcade.reaction.result', { ms: s.last ?? 0 }) : t('arcade.reaction.start');
  const sum = reactionSummary(s);
  return (
    <div className="stack center">
      <div className="row center faint">
        <span>{t('arcade.reaction.round', { n: Math.min(s.results.length + 1, s.rounds), total: s.rounds })}</span>
        {sum.average !== null && <span>{t('arcade.reaction.average', { ms: sum.average })}</span>}
        <span>{t('arcade.falseStarts', { n: s.falseStarts })}</span>
      </div>
      {/* pointerdown (not click) gives the most accurate timestamp on touch screens */}
      <button className={`reaction-pad ${s.phase}`} onPointerDown={(e) => { e.preventDefault(); tap(e.timeStamp || performance.now()); }} aria-live="assertive">
        {label}
      </button>
      {s.results.length > 0 && <p className="faint ltr">{s.results.map((r) => `${r} ms`).join(' · ')}</p>}
    </div>
  );
}
