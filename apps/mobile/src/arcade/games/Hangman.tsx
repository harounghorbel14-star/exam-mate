import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { hangmanNew, hangmanGuess, hangmanMask, hangmanFold, HANGMAN_ALPHABET, type HangmanState, type MessageKey } from '@exammate/core';
import { a, arcadeRepo, Key, type ArcadeGameProps } from '../shared';
import { colors } from '../../lib/theme';

const STAGES = ['', '😐', '😟', '😧', '😨', '😰', '💀'];

export default function Hangman({ difficulty, locale, seed, paused, t, sfx, onFinish }: ArcadeGameProps) {
  const [s, setS] = useState<HangmanState | null>(null);
  const done = useRef(false);
  useEffect(() => { void arcadeRepo().then((r) => r.loadGame<string[]>('hangman')).then((recent) => setS(hangmanNew(locale, difficulty, seed, Array.isArray(recent) ? recent : []))); }, [locale, difficulty, seed]);
  const guess = (ch: string) => {
    if (!s || paused) return;
    const r = hangmanGuess(s, ch);
    if (r.hit === null) return;
    sfx.play(r.hit ? 'hit' : 'error'); if (!r.hit) sfx.buzz(30);
    setS(r.state);
  };
  useEffect(() => {
    if (!s || s.status === 'playing' || done.current) return;
    done.current = true;
    void arcadeRepo().then(async (r) => { const recent = await r.loadGame<string[]>('hangman'); await r.saveGame('hangman', [s.word, ...(Array.isArray(recent) ? recent : [])].slice(0, 10)); });
    sfx.play(s.status === 'won' ? 'win' : 'lose');
    onFinish({ outcome: s.status === 'won' ? 'win' : 'loss', score: s.status === 'won' ? (s.maxWrong - s.wrong.length) * 10 + s.word.length : 0, message: s.status === 'lost' ? t('arcade.wordWas', { word: s.word }) : undefined });
  }, [s, sfx, onFinish, t]);
  if (!s) return null;
  const mask = hangmanMask(s);
  const rtl = locale === 'ar';
  return (
    <View style={a.center}>
      <Text style={a.faint}>{t('arcade.category', { name: t(`arcade.hangman.${s.category}` as MessageKey) })}</Text>
      <Text style={{ fontSize: 48 }}>{STAGES[s.wrong.length]}{'🪢'}</Text>
      <View style={[a.row, { flexDirection: rtl ? 'row-reverse' : 'row' }]} accessibilityLabel={mask.map((c) => c ?? '_').join(' ')}>
        {mask.map((c, i) => (
          <Text key={i} style={{ minWidth: 22, fontSize: 28, fontWeight: '800', textAlign: 'center', color: c === null && s.status === 'lost' ? colors.danger : colors.text, borderBottomWidth: c === ' ' ? 0 : 3, borderColor: colors.muted }}>
            {c ?? (s.status === 'lost' ? s.word[i] : ' ')}
          </Text>
        ))}
      </View>
      <Text style={a.faint}>{t('arcade.wrongLeft', { n: s.maxWrong - s.wrong.length })}</Text>
      <View style={[a.row, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {HANGMAN_ALPHABET[locale].map((ch) => {
          const used = s.guessed.includes(ch) || s.wrong.includes(ch);
          const hit = s.guessed.includes(hangmanFold(ch, locale));
          return <Key key={ch} label={ch.toUpperCase()} onPress={() => guess(ch)} disabled={used || s.status !== 'playing'} active={used && hit} style={{ minWidth: 40, paddingHorizontal: 6 }} />;
        })}
      </View>
    </View>
  );
}
