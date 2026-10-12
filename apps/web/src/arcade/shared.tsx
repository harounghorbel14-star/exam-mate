import { useEffect, useRef } from 'react';
import { ArcadeRepository, type ArcadeDifficulty, type ArcadeMode, type ArcadeOutcome, type ArcadeSettings, type Dir, type Locale, type MessageKey } from '@exammate/core';
import { store, deviceId } from '../lib/kv';

export const arcadeRepo = new ArcadeRepository(store, deviceId());

export type SfxName = 'move' | 'hit' | 'score' | 'win' | 'lose' | 'error' | 'tick' | 'pad0' | 'pad1' | 'pad2' | 'pad3' | 'pad4' | 'pad5';

export interface Sfx { play(name: SfxName): void; buzz(ms?: number | number[]): void }

const TONES: Record<SfxName, Array<[number, number]>> = {
  move: [[440, 0.04]], hit: [[660, 0.05]], tick: [[880, 0.02]],
  score: [[523, 0.08], [784, 0.1]], win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.2]],
  lose: [[392, 0.15], [330, 0.15], [262, 0.3]], error: [[160, 0.18]],
  pad0: [[330, 0.3]], pad1: [[392, 0.3]], pad2: [[494, 0.3]], pad3: [[587, 0.3]], pad4: [[659, 0.3]], pad5: [[784, 0.3]],
};

let ctx: AudioContext | null = null;

/** Synthesised sound effects (WebAudio, no audio files) and vibration, both honouring user settings. */
export function createSfx(settings: Pick<ArcadeSettings, 'sound' | 'haptics' | 'volume'>): Sfx {
  return {
    play(name) {
      if (!settings.sound || settings.volume <= 0) return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ctx ??= new AC();
        if (ctx.state === 'suspended') void ctx.resume();
        let t = ctx.currentTime;
        for (const [freq, dur] of TONES[name]) {
          const osc = ctx.createOscillator(), gain = ctx.createGain();
          osc.type = name.startsWith('pad') ? 'sine' : 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.08 * settings.volume, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t); osc.stop(t + dur);
          t += dur;
        }
      } catch { /* audio unavailable */ }
    },
    buzz(ms = 30) {
      if (!settings.haptics) return;
      try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
    },
  };
}

export interface FinishInfo { outcome: ArcadeOutcome; score?: number; timeMs?: number; /** Winner label for 2-player games. */ message?: string }

export interface ArcadeGameProps {
  difficulty: ArcadeDifficulty;
  mode: ArcadeMode;
  seed: number;
  paused: boolean;
  locale: Locale;
  t: (k: MessageKey, p?: Record<string, string | number>) => string;
  sfx: Sfx;
  onFinish(info: FinishInfo): void;
  /** Live score shown in the shell header. */
  onScore?(score: number): void;
  /** Extra option (memory grid). */
  option?: string;
}

/** setInterval that stops while paused and always calls the latest callback. */
export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** requestAnimationFrame loop with delta seconds; paused → no frames. */
export function useFrame(cb: (dt: number) => void, active: boolean) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => { ref.current((now - last) / 1000); last = now; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** Global key handler (ignored while typing in inputs). */
export function useKeys(handler: (e: KeyboardEvent) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      ref.current(e);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [active]);
}

export const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right', z: 'up', q: 'left', Z: 'up', Q: 'left',
};

/** Pointer swipe detection on an element. Physical directions (not mirrored in RTL). */
export function swipeHandlers(onSwipe: (d: Dir) => void, onTap?: () => void, min = 24) {
  let start: { x: number; y: number } | null = null;
  return {
    onPointerDown: (e: React.PointerEvent) => { start = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) { onTap?.(); return; }
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    },
    onPointerCancel: () => { start = null; },
  };
}

export function DPad({ onDir, t, extra }: { onDir: (d: Dir) => void; t: ArcadeGameProps['t']; extra?: React.ReactNode }) {
  return (
    <div className="dpad ltr" role="group">
      <span />
      <button className="btn" aria-label={t('arcade.dirUp')} onClick={() => onDir('up')}>▲</button>
      <span />
      <button className="btn" aria-label={t('arcade.dirLeft')} onClick={() => onDir('left')}>◀</button>
      <span className="dpad-center">{extra}</span>
      <button className="btn" aria-label={t('arcade.dirRight')} onClick={() => onDir('right')}>▶</button>
      <span />
      <button className="btn" aria-label={t('arcade.dirDown')} onClick={() => onDir('down')}>▼</button>
      <span />
    </div>
  );
}

export function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Stopwatch that freezes while paused. Returns elapsed ms getter. */
export function useStopwatch(running: boolean) {
  const acc = useRef(0);
  const since = useRef<number | null>(null);
  useEffect(() => {
    if (running) since.current = performance.now();
    else if (since.current !== null) { acc.current += performance.now() - since.current; since.current = null; }
  }, [running]);
  return () => acc.current + (since.current !== null ? performance.now() - since.current : 0);
}
