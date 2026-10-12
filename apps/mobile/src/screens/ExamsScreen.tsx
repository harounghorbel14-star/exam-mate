import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import type { MessageKey } from '@exammate/core';
import { useApp } from '../lib/app';
import { api } from '../lib/api';
import { Badge, Button, Card, Input, Loading, P, Screen, Title, s } from '../components/ui';
import { colors } from '../lib/theme';

interface Q { id: string; type: 'mcq' | 'truefalse' | 'numeric' | 'short' | 'written'; prompt: string; choices?: string[]; points: number; topic: string; answer?: unknown }
interface Grade { questionId: string; status: string; pointsAwarded: number; pointsPossible: number; feedback: string }
interface Attempt { id: string; questions: Q[]; deadline_at: string }
interface Result { grades: Grade[]; summary: { percent: number; score: number; maxScore: number; pendingReview: number }; questions: Q[] }

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'cs', 'history', 'geography'];

export function ExamsScreen() {
  const { t, locale, user, online } = useApp();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [count, setCount] = useState('10');
  const [minutes, setMinutes] = useState('15');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const timings = useRef<Record<string, number>>({});
  const shownAt = useRef(Date.now());

  const start = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api<{ attempt: Attempt }>('/exams/attempts', { method: 'POST', body: { subjects: subjects.length ? subjects : undefined, count: Math.max(1, Math.min(60, Number(count) || 10)), durationMinutes: Math.max(1, Math.min(300, Number(minutes) || 15)), locale } });
      setAttempt(r.attempt); setIdx(0); setResponses({}); timings.current = {}; shownAt.current = Date.now();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const accumulate = () => {
    const q = attempt?.questions[idx];
    if (q) timings.current[q.id] = (timings.current[q.id] ?? 0) + (Date.now() - shownAt.current) / 1000;
    shownAt.current = Date.now();
  };

  const submit = useCallback(async () => {
    if (!attempt) return;
    accumulate();
    setBusy(true);
    try { setResult(await api<Result>(`/exams/attempts/${attempt.id}/submit`, { method: 'POST', body: { responses, timings: timings.current } })); setAttempt(null); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }, [attempt, responses]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!attempt) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [attempt]);
  const remaining = attempt ? Math.max(0, new Date(attempt.deadline_at).getTime() - now) : 0;
  useEffect(() => { if (attempt && remaining === 0) void submit(); }, [remaining === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !online) return <Screen><Title>{t('exams.title')}</Title><P muted>{t('auth.signInToUse')}</P></Screen>;

  if (result) {
    return (
      <Screen>
        <Title>{t('exams.results')}</Title>
        <Card><P style={{ fontSize: 28, fontWeight: '800' }}>{result.summary.percent}%</P><P muted>{result.summary.score}/{result.summary.maxScore} · {t('exams.pendingReview', { count: result.summary.pendingReview })}</P></Card>
        {result.questions.map((q, i) => {
          const g = result.grades.find((x) => x.questionId === q.id)!;
          return (
            <Card key={q.id}>
              <P style={{ fontWeight: '700' }}>{i + 1}. {q.prompt}</P>
              <Badge text={`${g.status} · ${g.pointsAwarded}/${g.pointsPossible}`} tone={g.status === 'correct' ? 'success' : g.status === 'needs_review' ? 'warning' : 'danger'} />
              {g.status !== 'correct' && q.type !== 'written' && <P muted>{t('exams.correctAnswer')}: {q.choices ? q.choices[q.answer as number] : Array.isArray(q.answer) ? (q.answer as string[]).join(' / ') : String(q.answer)}</P>}
            </Card>
          );
        })}
        <P muted>{t('exams.manualHint')}</P>
        <Button title={t('exams.new')} variant="primary" onPress={() => setResult(null)} />
      </Screen>
    );
  }

  if (attempt) {
    const q = attempt.questions[idx]!;
    const set = (v: unknown) => setResponses((r) => ({ ...r, [q.id]: v }));
    const mm = Math.floor(remaining / 60000), ss = Math.floor((remaining % 60000) / 1000);
    return (
      <Screen>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Badge text={`⏱ ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`} tone={remaining < 60_000 ? 'danger' : 'default'} />
          <Badge text={`${idx + 1}/${attempt.questions.length}`} />
        </View>
        <Card>
          <P muted>{q.topic} · {q.points} {t('exams.points')}</P>
          <P style={{ fontSize: 19, fontWeight: '700' }}>{q.prompt}</P>
          {(q.type === 'mcq' || q.type === 'truefalse') && q.choices!.map((c, i) => <Button key={i} title={`${String.fromCharCode(65 + i)}. ${c}`} variant={responses[q.id] === i ? 'primary' : 'default'} onPress={() => set(i)} />)}
          {(q.type === 'numeric' || q.type === 'short') && <Input value={String(responses[q.id] ?? '')} onChangeText={set} keyboardType={q.type === 'numeric' ? 'numbers-and-punctuation' : 'default'} accessibilityLabel={t('exams.yourAnswer')} />}
          {q.type === 'written' && <Input value={String(responses[q.id] ?? '')} onChangeText={set} multiline style={{ minHeight: 140, textAlignVertical: 'top' }} accessibilityLabel={t('exams.yourAnswer')} />}
        </Card>
        <View style={s.row}>
          <Button title={t('common.back')} disabled={idx === 0} onPress={() => { accumulate(); setIdx(idx - 1); }} />
          <Button title={t('common.next')} disabled={idx === attempt.questions.length - 1} onPress={() => { accumulate(); setIdx(idx + 1); }} />
          <Button title={t('exams.finish')} variant="primary" onPress={() => Alert.alert(t('exams.finish'), t('exams.submitConfirm'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.submit'), onPress: () => void submit() }])} />
        </View>
        {busy && <Loading />}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('exams.title')}</Title>
      <Card>
        <P style={{ fontWeight: '700' }}>{t('exams.new')}</P>
        <View style={s.row}>{SUBJECTS.map((x) => <Button key={x} title={t(`subject.${x}` as MessageKey)} variant={subjects.includes(x) ? 'primary' : 'default'} onPress={() => setSubjects(subjects.includes(x) ? subjects.filter((y) => y !== x) : [...subjects, x])} />)}</View>
        <P muted>{t('exams.allSubjectsHint')}</P>
        <P muted>{t('exams.questions')}</P><Input value={count} onChangeText={setCount} keyboardType="number-pad" />
        <P muted>{t('exams.duration')}</P><Input value={minutes} onChangeText={setMinutes} keyboardType="number-pad" />
        <Button title={t('exams.start')} variant="primary" onPress={() => void start()} disabled={busy} />
      </Card>
      {busy && <Loading />}
      {error && <P style={{ color: colors.danger }}>{error}</P>}
    </Screen>
  );
}
