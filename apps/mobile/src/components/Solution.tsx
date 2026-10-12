import { Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import { LOCALES, type SolveResponse } from '@exammate/core';
import { useApp } from '../lib/app';
import { Badge, Button, Card, P, s } from './ui';
import { colors } from '../lib/theme';

export type MobileSolve = SolveResponse & { engine?: string; warnings?: string[]; documentAnswer?: { found: boolean; answer: string; citations: Array<{ page: number | null; documentTitle: string }> } };

export function Solution({ data }: { data: MobileSolve }) {
  const { t, locale } = useApp();
  const r = data.result;
  const conf = data.confidence;
  const speak = () => Speech.speak([r?.answer, ...(r?.steps.map((x) => x.description) ?? []), data.documentAnswer?.answer].filter(Boolean).join('. '), { language: LOCALES[locale].speech });
  return (
    <View style={{ gap: 10 }}>
      <View style={s.row}>
        <Badge text={conf === 'verified' ? `✓ ${t('solver.confidence.verified')}` : conf === 'unverified' ? t('solver.confidence.unverified') : t('solver.confidence.unsupported')} tone={conf === 'verified' ? 'success' : conf === 'unverified' ? 'warning' : 'danger'} />
        {data.engine && <Badge text={t('solver.engine', { engine: data.engine })} />}
      </View>
      {data.error && <P style={{ color: colors.danger }}>{data.error}</P>}
      {r?.answer ? <Card><P muted>{t('solver.answer')}</P><Text style={[s.mono, { fontSize: 20, fontWeight: '700', writingDirection: 'ltr' }]} selectable>{r.answer}</Text></Card> : null}
      {data.check && <Card><P style={{ color: data.check.correct ? colors.success : colors.danger }}>{data.check.correct ? t('common.correct') : t('common.incorrect')} — {data.check.detail}</P></Card>}
      {data.similar && <Card><P muted>{t('mode.similar')}</P><Text style={s.mono}>{data.similar.question}</Text></Card>}
      {data.modeText && <Card><P>{data.modeText}</P></Card>}
      {r && r.steps.length > 0 && (
        <Card>
          <P muted>{t('solver.steps')}</P>
          {r.steps.map((st, i) => <P key={i}>{i + 1}. {st.description}</P>)}
        </Card>
      )}
      {r && r.verification.length > 0 && <Card><P muted>{t('solver.verification')}</P>{r.verification.map((v, i) => <P key={i}>{v.passed ? '✓' : '✗'} {v.method} — {v.detail}</P>)}</Card>}
      {data.documentAnswer?.found && <Card><P muted>{t('solver.fromDocuments')}</P><P>{data.documentAnswer.answer}</P>{data.documentAnswer.citations.map((c, i) => <Badge key={i} text={`${c.documentTitle} · ${t('docs.source', { page: c.page ?? '?' })}`} />)}</Card>}
      {(data.warnings ?? r?.warnings ?? []).length > 0 && <Card><P style={{ color: colors.warning }}>{[...new Set(data.warnings ?? r?.warnings)].join('\n')}</P></Card>}
      {data.status === 'unsupported' && !data.documentAnswer?.found && <Card><P style={{ fontWeight: '700' }}>{t('solver.unsupportedTitle')}</P><P muted>{t('solver.unsupportedHelp')}</P></Card>}
      {(r?.answer || data.documentAnswer?.found) && <Button title={`🔊 ${t('voice.speak')}`} variant="ghost" onPress={speak} />}
    </View>
  );
}
