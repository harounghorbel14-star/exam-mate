import { useEffect, useRef, useState } from 'react';
import { g2048New, g2048Move, g2048MaxTile, type G2048State, type Dir } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { arcadeRepo, KEY_DIR, swipeHandlers, useKeys } from '../shared';

export default function G2048({ seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<G2048State | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const done = useRef(false);

  // Resume a saved board (score persistence across restarts), otherwise start fresh.
  useEffect(() => {
    void arcadeRepo.loadGame<G2048State>('2048').then((saved) => setS(saved && !saved.over && Array.isArray(saved.grid) ? saved : g2048New(seed)));
  }, [seed]);
  useEffect(() => { if (s && !s.over) void arcadeRepo.saveGame('2048', s); }, [s]);
  useEffect(() => { if (s) onScore?.(s.score); }, [s, onScore]);
  useEffect(() => {
    if (!s?.over || done.current) return;
    done.current = true;
    void arcadeRepo.clearGame('2048');
    sfx.play(s.won ? 'win' : 'lose');
    onFinish({ outcome: s.won ? 'win' : 'done', score: s.score });
  }, [s, sfx, onFinish]);

  const move = (d: Dir) => {
    if (!s || paused || celebrate) return;
    const r = g2048Move(s, d);
    if (!r.moved) return;
    if (r.state.score > s.score) sfx.play('hit'); else sfx.play('move');
    if (r.state.won && !s.won) { setCelebrate(true); sfx.play('win'); sfx.buzz([40, 30, 40]); }
    setS(r.state);
  };
  useKeys((e) => { const d = KEY_DIR[e.key]; if (d) { e.preventDefault(); move(d); } }, !paused);
  if (!s) return null;
  return (
    <div className="stack center">
      <p className="faint">▲ {g2048MaxTile(s)} · {t('arcade.moves')}: {s.moves}</p>
      <div className="g2048-board ltr" role="grid" aria-label="2048" {...swipeHandlers(move)} style={{ touchAction: 'none' }}>
        {s.grid.flatMap((row, r) => row.map((v, c) => (
          <div key={`${r}-${c}`} role="gridcell" className={`g2048-tile v${Math.min(v, 4096)}`} aria-label={v ? String(v) : t('arcade.cell', { r: r + 1, c: c + 1 })}>{v || ''}</div>
        )))}
      </div>
      {celebrate && (
        <div className="alert success" role="status">{t('arcade.reached2048')}
          <button className="btn sm primary" onClick={() => setCelebrate(false)}>{t('arcade.keepGoing')}</button>
          <button className="btn sm" onClick={() => { void arcadeRepo.clearGame('2048'); done.current = true; onFinish({ outcome: 'win', score: s.score }); }}>{t('arcade.quit')}</button>
        </div>
      )}
    </div>
  );
}
