import { useEffect, useMemo, useRef, useState } from 'react';
import { sudokuNew, sudokuEnter, sudokuHint, sudokuToggleNote, type SudokuState } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { arcadeRepo, formatMs, useInterval, useKeys, useStopwatch } from '../shared';

export default function Sudoku({ difficulty, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<SudokuState | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [notes, setNotes] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);
  const [, force] = useState(0);
  const elapsed = useStopwatch(!paused && s?.status === 'playing');
  const done = useRef(false);
  useInterval(() => force((n) => n + 1), s?.status === 'playing' && !paused ? 1000 : null);

  useEffect(() => {
    void arcadeRepo.loadGame<SudokuState>('sudoku').then((saved) => {
      setS(saved && saved.status === 'playing' && saved.difficulty === difficulty && Array.isArray(saved.values) ? saved : sudokuNew(difficulty, seed));
    });
  }, [difficulty, seed]);
  useEffect(() => { if (s?.status === 'playing') void arcadeRepo.saveGame('sudoku', s); }, [s]);
  useEffect(() => {
    if (!s || s.status === 'playing' || done.current) return;
    done.current = true;
    void arcadeRepo.clearGame('sudoku');
    sfx.play(s.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', timeMs: Math.round(elapsed()) });
  }, [s, sfx, onFinish, elapsed]);

  const enter = (v: number) => {
    if (!s || sel === null || paused) return;
    if (notes && v > 0) { setS(sudokuToggleNote(s, sel, v)); return; }
    const r = sudokuEnter(s, sel, v);
    if (r.correct === false) { sfx.play('error'); sfx.buzz(60); setFlash(sel); setTimeout(() => setFlash(null), 500); }
    else if (r.correct) sfx.play('move');
    setS(r.state);
  };
  const hint = () => { if (!s || paused) return; const r = sudokuHint(s, sel ?? undefined); if (r.cell !== null) { setSel(r.cell); sfx.play('score'); } setS(r.state); };

  useKeys((e) => {
    if (/^[0-9]$/.test(e.key)) { enter(Number(e.key)); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { enter(0); return; }
    if (e.key === 'n' || e.key === 'N') { setNotes((n) => !n); return; }
    if (e.key === 'h' || e.key === 'H') { hint(); return; }
    const m: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (m[e.key] !== undefined) { e.preventDefault(); setSel((c) => Math.min(80, Math.max(0, (c ?? 40) + m[e.key]!))); }
  }, !paused);

  const counts = useMemo(() => { const c = Array(10).fill(0); s?.values.forEach((v) => c[v]++); return c; }, [s]);
  if (!s) return null;
  const selVal = sel !== null ? s.values[sel] : 0;
  return (
    <div className="stack center">
      <div className="row center">
        <span className={`badge${s.mistakes ? ' warning' : ''}`}>{t('arcade.mistakes', { n: s.mistakes, max: s.maxMistakes })}</span>
        <span className="badge timer">⏱ {formatMs(elapsed())}</span>
      </div>
      <div className="sudoku-board ltr" role="grid" aria-label="Sudoku">
        {s.values.map((v, i) => {
          const r = Math.floor(i / 9), c = i % 9;
          const related = sel !== null && (Math.floor(sel / 9) === r || sel % 9 === c || (Math.floor(Math.floor(sel / 9) / 3) === Math.floor(r / 3) && Math.floor((sel % 9) / 3) === Math.floor(c / 3)));
          return (
            <button key={i} role="gridcell" className={`sd-cell${s.puzzle[i] ? ' given' : ''}${sel === i ? ' sel' : related ? ' rel' : ''}${v && v === selVal ? ' same' : ''}${flash === i ? ' bad' : ''}${c % 3 === 2 && c < 8 ? ' br' : ''}${r % 3 === 2 && r < 8 ? ' bb' : ''}`}
              onClick={() => setSel(i)} aria-label={`${t('arcade.cell', { r: r + 1, c: c + 1 })}${v ? `: ${v}` : ''}`} aria-selected={sel === i}>
              {v ? v : s.notes[i]!.length ? <span className="sd-notes">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <i key={n}>{s.notes[i]!.includes(n) ? n : ''}</i>)}</span> : ''}
            </button>
          );
        })}
      </div>
      <div className="sd-pad ltr">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} className="btn" onClick={() => enter(n)} disabled={counts[n] >= 9}>{n}</button>)}
      </div>
      <div className="row center">
        <button className={`btn sm${notes ? ' primary' : ''}`} aria-pressed={notes} onClick={() => setNotes((x) => !x)}>✎ {t('arcade.notes')}</button>
        <button className="btn sm" onClick={() => enter(0)}>⌫ {t('arcade.erase')}</button>
        <button className="btn sm" onClick={hint}>💡 {t('arcade.hint')} ({s.hintsUsed})</button>
      </div>
    </div>
  );
}
