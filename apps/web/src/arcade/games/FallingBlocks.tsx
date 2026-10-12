import { useEffect, useRef, useState } from 'react';
import { blocksNew, blocksTick, blocksMove, blocksRotate, blocksSoftDrop, blocksHardDrop, blocksHold, blocksGhostY, blocksInterval, pieceCells, BLOCKS_W, BLOCKS_H, type BlocksState, type PieceKind } from '@exammate/core';
import type { ArcadeGameProps } from '../shared';
import { useInterval, useKeys } from '../shared';

const CELL = 24;
const COLORS: Record<PieceKind, string> = { I: '#22d3ee', O: '#facc15', T: '#a78bfa', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c' };
const KIND_INDEX: PieceKind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const START_LEVEL = { easy: 1, medium: 4, hard: 8 } as const;

function Preview({ kind, label }: { kind: PieceKind | null | undefined; label: string }) {
  const cells = kind ? pieceCells({ kind, rot: 0, x: 0, y: 0 }) : [];
  return (
    <div className="blocks-preview" aria-label={`${label}: ${kind ?? '—'}`}>
      <span className="faint">{label}</span>
      <svg viewBox="0 0 4 4" width="56" height="56" aria-hidden>{cells.map(([r, c], i) => <rect key={i} x={c} y={r} width="0.92" height="0.92" rx="0.15" fill={COLORS[kind!]} />)}</svg>
    </div>
  );
}

export default function FallingBlocks({ difficulty, seed, paused, t, sfx, onFinish, onScore }: ArcadeGameProps) {
  const [s, setS] = useState<BlocksState>(() => blocksNew(seed, START_LEVEL[difficulty]));
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const act = (f: (b: BlocksState) => BlocksState, sound?: 'move' | 'hit') => {
    if (paused) return;
    setS((cur) => {
      const next = f(cur);
      if (next.lines > cur.lines) { sfx.play('score'); sfx.buzz(40); } else if (sound && next !== cur) sfx.play(sound);
      return next;
    });
  };
  const level = s.level;
  useInterval(() => act(blocksTick), paused || s.over ? null : blocksInterval(level));
  useEffect(() => { onScore?.(s.score); }, [s.score, onScore]);
  useEffect(() => {
    if (!s.over || done.current) return;
    done.current = true; sfx.play('lose'); sfx.buzz([80, 40, 80]);
    onFinish({ outcome: 'done', score: s.score });
  }, [s.over, s.score, sfx, onFinish]);

  useKeys((e) => {
    const map: Record<string, () => void> = {
      ArrowLeft: () => act((b) => blocksMove(b, -1), 'move'), ArrowRight: () => act((b) => blocksMove(b, 1), 'move'),
      ArrowDown: () => act(blocksSoftDrop), ArrowUp: () => act((b) => blocksRotate(b, 1), 'move'), x: () => act((b) => blocksRotate(b, 1), 'move'),
      z: () => act((b) => blocksRotate(b, -1), 'move'), ' ': () => act(blocksHardDrop, 'hit'), c: () => act(blocksHold, 'move'), C: () => act(blocksHold, 'move'),
    };
    const f = map[e.key];
    if (f) { e.preventDefault(); f(); }
  }, !paused);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0b1020'; ctx.fillRect(0, 0, BLOCKS_W * CELL, BLOCKS_H * CELL);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x <= BLOCKS_W; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, BLOCKS_H * CELL); ctx.stroke(); }
    const cell = (r: number, c: number, color: string, alpha = 1) => {
      if (r < 0) return;
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill(); ctx.globalAlpha = 1;
    };
    s.board.forEach((row, r) => row.forEach((v, c) => { if (v) cell(r, c, COLORS[KIND_INDEX[v - 1] ?? 'I']); }));
    if (!s.over) {
      const gy = blocksGhostY(s);
      for (const [r, c] of pieceCells({ ...s.piece, y: gy })) cell(r, c, COLORS[s.piece.kind], 0.22);
      for (const [r, c] of pieceCells(s.piece)) cell(r, c, COLORS[s.piece.kind]);
    }
  }, [s]);

  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  return (
    <div className="blocks-layout">
      <canvas ref={canvas} width={BLOCKS_W * CELL} height={BLOCKS_H * CELL} className="arcade-canvas" role="img" aria-label={`${t('arcade.score')} ${s.score}, ${t('arcade.lines')} ${s.lines}`} style={{ touchAction: 'none' }}
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY, moved: false }; }}
        onPointerMove={(e) => {
          const st = swipe.current; if (!st) return;
          const dx = e.clientX - st.x, dy = e.clientY - st.y;
          if (Math.abs(dx) > 24) { act((b) => blocksMove(b, dx > 0 ? 1 : -1), 'move'); st.x = e.clientX; st.moved = true; }
          if (dy > 70) { act(blocksHardDrop, 'hit'); swipe.current = null; }
        }}
        onPointerUp={() => { if (swipe.current && !swipe.current.moved) act((b) => blocksRotate(b, 1), 'move'); swipe.current = null; }} />
      <aside className="stack blocks-side">
        <Preview kind={s.queue[0]} label={t('arcade.next')} />
        <Preview kind={s.hold} label={t('arcade.hold')} />
        <div className="stat"><span className="faint">{t('arcade.lines')}</span><strong>{s.lines}</strong></div>
        <div className="stat"><span className="faint">{t('arcade.level')}</span><strong>{level}</strong></div>
        <div className="blocks-pad ltr">
          <button className="btn" aria-label={t('arcade.dirLeft')} onClick={() => act((b) => blocksMove(b, -1), 'move')}>◀</button>
          <button className="btn" aria-label={t('arcade.rotate')} onClick={() => act((b) => blocksRotate(b, 1), 'move')}>⟳</button>
          <button className="btn" aria-label={t('arcade.dirRight')} onClick={() => act((b) => blocksMove(b, 1), 'move')}>▶</button>
          <button className="btn" aria-label={t('arcade.softDrop')} onClick={() => act(blocksSoftDrop)}>▼</button>
          <button className="btn" aria-label={t('arcade.drop')} onClick={() => act(blocksHardDrop, 'hit')}>⤓</button>
          <button className="btn" aria-label={t('arcade.hold')} onClick={() => act(blocksHold, 'move')}>⇄</button>
        </div>
      </aside>
    </div>
  );
}
