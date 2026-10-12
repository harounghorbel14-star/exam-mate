import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Dimensions, PanResponder, Pressable, StyleSheet, Text, Vibration, View, type ViewStyle } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { ArcadeRepository, type ArcadeDifficulty, type ArcadeMode, type ArcadeOutcome, type ArcadeSettings, type Dir, type Locale, type MessageKey } from '@exammate/core';
import { kv, deviceId } from '../lib/store';
import { colors } from '../lib/theme';

let repoPromise: Promise<ArcadeRepository> | null = null;
/** Local-first arcade storage (AsyncStorage). */
export function arcadeRepo(): Promise<ArcadeRepository> {
  repoPromise ??= deviceId().then((id) => new ArcadeRepository(kv, id));
  return repoPromise;
}

export type SfxName = 'move' | 'hit' | 'score' | 'win' | 'lose' | 'error' | 'tick' | 'pad0' | 'pad1' | 'pad2' | 'pad3' | 'pad4' | 'pad5';
export interface Sfx { play(name: SfxName): void; buzz(ms?: number | number[]): void }

// Bundled, locally generated sounds (scripts/make-sfx.mjs) — no network needed.
const SOURCES: Record<SfxName, number> = {
  move: require('../../assets/sfx/move.wav'), hit: require('../../assets/sfx/hit.wav'), score: require('../../assets/sfx/score.wav'),
  win: require('../../assets/sfx/win.wav'), lose: require('../../assets/sfx/lose.wav'), error: require('../../assets/sfx/error.wav'),
  tick: require('../../assets/sfx/tick.wav'), pad0: require('../../assets/sfx/pad0.wav'), pad1: require('../../assets/sfx/pad1.wav'),
  pad2: require('../../assets/sfx/pad2.wav'), pad3: require('../../assets/sfx/pad3.wav'), pad4: require('../../assets/sfx/pad4.wav'), pad5: require('../../assets/sfx/pad5.wav'),
};
const players = new Map<SfxName, AudioPlayer>();

export function createSfx(settings: Pick<ArcadeSettings, 'sound' | 'haptics' | 'volume'>): Sfx {
  return {
    play(name) {
      if (!settings.sound || settings.volume <= 0) return;
      try {
        let p = players.get(name);
        if (!p) { p = createAudioPlayer(SOURCES[name]); players.set(name, p); }
        p.volume = settings.volume;
        void p.seekTo(0);
        p.play();
      } catch { /* audio unavailable */ }
    },
    buzz(ms = 20) {
      if (!settings.haptics) return;
      try { Vibration.vibrate(ms as number); } catch { /* unsupported */ }
    },
  };
}

export interface FinishInfo { outcome: ArcadeOutcome; score?: number; timeMs?: number; message?: string }
export interface ArcadeGameProps {
  difficulty: ArcadeDifficulty; mode: ArcadeMode; seed: number; paused: boolean; locale: Locale;
  t: (k: MessageKey, p?: Record<string, string | number>) => string;
  sfx: Sfx; onFinish(info: FinishInfo): void; onScore?(n: number): void; option?: string;
}

export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Swipe/tap detection; returns handlers to spread on a View. */
export function useSwipe(onSwipe: (d: Dir) => void, onTap?: () => void, min = 20) {
  const cb = useRef({ onSwipe, onTap });
  cb.current = { onSwipe, onTap };
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_e, g) => {
      if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < min) { cb.current.onTap?.(); return; }
      cb.current.onSwipe(Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'right' : 'left') : (g.dy > 0 ? 'down' : 'up'));
    },
  }).panHandlers, [min]);
}

export const boardWidth = () => Math.min(Dimensions.get('window').width - 32, 460);

export function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function Status({ children }: { children: ReactNode }) {
  return <Text style={a.status} accessibilityLiveRegion="polite">{children}</Text>;
}

export function Key({ label, onPress, style, disabled, a11y, active }: { label: string; onPress: () => void; style?: ViewStyle; disabled?: boolean; a11y?: string; active?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y ?? label} accessibilityState={{ disabled, selected: active }}
      style={({ pressed }) => [a.key, active && { backgroundColor: colors.primary, borderColor: colors.primary }, style, (pressed || disabled) && { opacity: 0.55 }]}>
      <Text style={[a.keyText, active && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function DPad({ onDir, t }: { onDir: (d: Dir) => void; t: ArcadeGameProps['t'] }) {
  return (
    <View style={a.dpad}>
      <View style={a.dpadRow}><Key label="▲" a11y={t('arcade.dirUp')} onPress={() => onDir('up')} style={a.dkey} /></View>
      <View style={a.dpadRow}>
        <Key label="◀" a11y={t('arcade.dirLeft')} onPress={() => onDir('left')} style={a.dkey} />
        <View style={a.dkey} />
        <Key label="▶" a11y={t('arcade.dirRight')} onPress={() => onDir('right')} style={a.dkey} />
      </View>
      <View style={a.dpadRow}><Key label="▼" a11y={t('arcade.dirDown')} onPress={() => onDir('down')} style={a.dkey} /></View>
    </View>
  );
}

export const a = StyleSheet.create({
  center: { alignItems: 'center', gap: 12 },
  status: { color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center', minHeight: 22 },
  key: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elev, alignItems: 'center', justifyContent: 'center' },
  keyText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  dpad: { alignItems: 'center', gap: 6, direction: 'ltr' },
  dpadRow: { flexDirection: 'row', gap: 6 },
  dkey: { width: 58, height: 52 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  ltr: { direction: 'ltr' },
  faint: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
