import { useEffect, useRef, useState } from 'react';
import { simonNew, simonShown, simonPress, simonFlashMs, simonScore, type SimonState } from '@exammate/core';
import type { ArcadeGameProps, SfxName } from '../shared';
import { useKeys } from '../shared';

const COLORS = ['#22c55e', '#ef4444', '#eab308', '#3b82f6', '#a855f7', '#f97316'];

export default function SimonSays({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<SimonState>(() => simonNew(difficulty, seed));
  const [lit, setLit] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const done = useRef(false);

  // Play back the sequence whenever we enter the "showing" phase.
  useEffect(() => {
    if (s.status !== 'showing' || paused) return;
    const flash = simonFlashMs(s);
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    s.sequence.forEach((pad, i) => {
      timers.push(setTimeout(() => { setLit(pad); sfx.play(`pad${pad}` as SfxName); }, 600 + i * (flash + 160)));
      timers.push(setTimeout(() => setLit(null), 600 + i * (flash + 160) + flash));
    });
    timers.push(setTimeout(() => { setS((cur) => simonShown(cur)); setMsg(null); }, 600 + s.sequence.length * (flash + 160)));
    return () => { timers.forEach(clearTimeout); setLit(null); };
  }, [s.status, s.sequence, paused, sfx, s]);

  useEffect(() => { onScore?.(simonScore(s)); }, [s, onScore]);
  useEffect(() => {
    if (s.status !== 'over' || done.current) return;
    done.current = true;
    sfx.play('lose'); sfx.buzz([80, 40, 80]);
    onFinish({ outcome: 'done', score: simonScore(s) });
  }, [s, sfx, onFinish]);

  const press = (pad: number) => {
    if (paused || s.status !== 'input') return;
    setLit(pad); setTimeout(() => setLit((l) => (l === pad ? null : l)), 180);
    const r = simonPress(s, pad);
    if (r.result === null) return;
    sfx.play(r.result === 'over' || r.result === 'retry' ? 'error' : (`pad${pad}` as SfxName));
    sfx.buzz(15);
    if (r.result === 'retry') setMsg(t('arcade.simon.retry'));
    setS(r.state);
  };
  useKeys((e) => { const n = Number(e.key); if (n >= 1 && n <= s.pads) press(n - 1); }, !paused);

  return (
    <div className="stack center">
      <p className="arcade-status" role="status">{msg ?? (s.status === 'showing' ? t('arcade.simon.watch') : s.status === 'input' ? t('arcade.simon.yourTurn') : '')} · {t('arcade.round', { n: s.round })}</p>
      <div className={`simon-board pads-${s.pads}`}>
        {Array.from({ length: s.pads }, (_, i) => (
          <button key={i} className={`simon-pad${lit === i ? ' lit' : ''}`} style={{ ['--pad' as string]: COLORS[i] }} onPointerDown={() => press(i)}
            onKeyDown={(e) => { if (e.key === 'Enter') press(i); }} disabled={s.status !== 'input'} aria-label={t('arcade.pad', { n: i + 1 })} />
        ))}
      </div>
    </div>
  );
}
