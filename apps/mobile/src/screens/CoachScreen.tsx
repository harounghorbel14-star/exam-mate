import { useState } from 'react';
import { View } from 'react-native';
import { allocateTime, guessExpectedValue, STRATEGY_TIPS, TIP_TEXT, type SectionPlan } from '@exammate/core';
import { useApp } from '../lib/app';
import { Badge, Card, Input, P, Screen, Title, s } from '../components/ui';

export function CoachScreen() {
  const { t, locale } = useApp();
  const [total, setTotal] = useState('90');
  const [sections] = useState<SectionPlan[]>([
    { name: 'MCQ', questions: 20, pointsEach: 1, difficulty: 1 },
    { name: 'Short problems', questions: 5, pointsEach: 4, difficulty: 2 },
    { name: 'Long problem', questions: 1, pointsEach: 12, difficulty: 3 },
  ]);
  const [options, setOptions] = useState('4');
  const [elim, setElim] = useState('1');
  const [penalty, setPenalty] = useState('0');
  const plan = allocateTime(Math.max(10, Number(total) || 90), sections);
  const ev = guessExpectedValue(Number(options) || 4, Number(elim) || 0, 1, Number(penalty) || 0);
  return (
    <Screen>
      <Title>{t('coach.title')}</Title>
      <P muted>{t('coach.integrity')}</P>
      <Card>
        <P style={{ fontWeight: '700' }}>{t('coach.allocate')}</P>
        <Input value={total} onChangeText={setTotal} keyboardType="number-pad" accessibilityLabel={t('coach.totalTime')} />
        {[...plan.rows].sort((a, b) => a.order - b.order).map((r) => <P key={r.name}>{r.order}. {r.name}: {r.minutes} {t('common.minutes')} ({r.perQuestionSec}s/q) — {r.reason}</P>)}
        <P muted>{t('coach.review')}: {plan.reviewMinutes} {t('common.minutes')}</P>
      </Card>
      <Card>
        <P style={{ fontWeight: '700' }}>{t('coach.elimination')}</P>
        <View style={s.row}>
          <Input value={options} onChangeText={setOptions} keyboardType="number-pad" accessibilityLabel={t('coach.options')} style={{ flex: 1 }} />
          <Input value={elim} onChangeText={setElim} keyboardType="number-pad" accessibilityLabel={t('coach.eliminated')} style={{ flex: 1 }} />
          <Input value={penalty} onChangeText={setPenalty} keyboardType="numbers-and-punctuation" accessibilityLabel={t('coach.penalty')} style={{ flex: 1 }} />
        </View>
        <P muted>{t('coach.options')} · {t('coach.eliminated')} · {t('coach.penalty')}</P>
        <Badge text={`${t('coach.ev', { value: ev.toFixed(2) })} — ${ev > 0 ? t('coach.guess') : t('coach.skip')}`} tone={ev > 0 ? 'success' : 'warning'} />
      </Card>
      {STRATEGY_TIPS.map((tip) => <Card key={tip.id}><P style={{ fontWeight: '700' }}>{TIP_TEXT[tip.id]!.title[locale]}</P><P muted>{TIP_TEXT[tip.id]!.body[locale]}</P></Card>)}
    </Screen>
  );
}
