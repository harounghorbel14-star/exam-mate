import { useState } from 'react';
import { View } from 'react-native';
import { solveLocally, type MessageKey, type SolveMode } from '@exammate/core';
import { useApp } from '../lib/app';
import { api, ApiError } from '../lib/api';
import { Button, Input, Loading, P, Screen, Title, s } from '../components/ui';
import { Solution, type MobileSolve } from '../components/Solution';

const MODES: Array<[SolveMode, MessageKey]> = [['short', 'mode.short'], ['steps', 'mode.steps'], ['simple', 'mode.simple'], ['hint', 'mode.hint'], ['check', 'mode.check'], ['similar', 'mode.similar']];

export function SolverScreen({ route }: { route?: { params?: { q?: string } } }) {
  const { t, locale, user, online } = useApp();
  const [q, setQ] = useState(route?.params?.q ?? '');
  const [mode, setMode] = useState<SolveMode>('steps');
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<MobileSolve | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solve = async () => {
    if (!q.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      if (user && online) {
        try {
          setResult(await api<MobileSolve>('/solve', { method: 'POST', body: { question: q, mode, locale, studentAnswer: mode === 'check' ? answer : undefined } }));
          return;
        } catch (e) {
          if (!(e instanceof ApiError) || e.status !== 0) throw e;
        }
      }
      setResult({ ...solveLocally(q, { mode, locale, studentAnswer: answer }), engine: 'on-device' });
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'quota_exceeded' ? t('plan.limitReached') : (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Title>{t('solver.title')}</Title>
      <P muted>{user && online ? t('solver.serverEngine') : t('solver.offlineEngine')}</P>
      <View style={s.row}>{MODES.map(([m, k]) => <Button key={m} title={t(k)} variant={mode === m ? 'primary' : 'default'} onPress={() => setMode(m)} />)}</View>
      <Input value={q} onChangeText={setQ} placeholder={t('solver.placeholder')} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} accessibilityLabel={t('solver.placeholder')} />
      {mode === 'check' && <Input value={answer} onChangeText={setAnswer} placeholder={t('solver.yourAnswer')} />}
      <Button title={busy ? t('solver.solving') : t('solver.solve')} variant="primary" onPress={() => void solve()} disabled={busy} />
      {busy && <Loading />}
      {error && <P style={{ color: '#f87171' }}>{error}</P>}
      {result && <Solution data={result} />}
    </Screen>
  );
}
