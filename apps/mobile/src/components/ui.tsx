import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius } from '../lib/theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return scroll
    ? <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    : <View style={[s.screen, s.content]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title} accessibilityRole="header">{children}</Text>;
}

export function P({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[s.p, muted && { color: colors.muted }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'default', disabled, accessibilityLabel }: { title: string; onPress: () => void; variant?: 'default' | 'primary' | 'danger' | 'ghost'; disabled?: boolean; accessibilityLabel?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled }}
      style={({ pressed }) => [s.btn, variant === 'primary' && s.btnPrimary, variant === 'danger' && s.btnDanger, variant === 'ghost' && s.btnGhost, (pressed || disabled) && { opacity: 0.6 }]}>
      <Text style={[s.btnText, variant === 'primary' && { color: colors.bg }]}>{title}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.faint} {...props} style={[s.input, props.style]} />;
}

export function Badge({ text, tone = 'default' }: { text: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const c = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : colors.muted;
  return <Text style={[s.badge, { color: c, borderColor: c }]}>{text}</Text>;
}

export function Loading() {
  return <ActivityIndicator color={colors.primary} style={{ margin: 16 }} />;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 4, textAlign: 'auto' },
  p: { color: colors.text, fontSize: 16, lineHeight: 23, textAlign: 'auto' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius, padding: 14, gap: 8 },
  btn: { minHeight: 46, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elev, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnDanger: { borderColor: colors.danger },
  btnGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  btnText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elev, color: colors.text, paddingHorizontal: 12, fontSize: 16, textAlign: 'auto' },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 12, fontWeight: '600', overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  mono: { fontFamily: 'monospace', color: colors.text, fontSize: 16 },
});
