import { useState } from 'react';
import { Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { splitQuestions, solveLocally } from '@exammate/core';
import { useApp } from '../lib/app';
import { api, apiBase, getToken } from '../lib/api';
import { Badge, Button, Card, Input, Loading, P, Screen, Title, s } from '../components/ui';
import { Solution, type MobileSolve } from '../components/Solution';

const LANGS = { en: 'eng', fr: 'fra,eng', ar: 'ara,eng' } as const;

export function ScanScreen() {
  const { t, locale, user, online } = useApp();
  const [uri, setUri] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solutions, setSolutions] = useState<Record<number, MobileSolve>>({});
  const questions = splitQuestions(text);

  const pick = async (camera: boolean) => {
    setError(null);
    // Permission is requested only when the user taps the button.
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t('scan.cameraDenied')); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 0.8 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) { setUri(res.assets[0].uri); setText(''); setSolutions({}); }
  };

  const recognize = async () => {
    if (!uri) return;
    if (!user || !online) { setError(t('scan.mobileNeedsServer')); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('image', { uri, name: 'scan.jpg', type: 'image/jpeg' } as unknown as Blob);
      form.append('langs', LANGS[locale]);
      const token = await getToken();
      const res = await fetch(`${await apiBase()}/api/scan`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'OCR failed');
      setText(data.text); setConfidence(data.confidence);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const solve = async (i: number, q: string) => {
    let r: MobileSolve;
    try { r = user && online ? await api<MobileSolve>('/solve', { method: 'POST', body: { question: q, locale, source: 'scan' } }) : { ...solveLocally(q, { locale }), engine: 'on-device' }; }
    catch { r = { ...solveLocally(q, { locale }), engine: 'on-device' }; }
    setSolutions((x) => ({ ...x, [i]: r }));
  };

  return (
    <Screen>
      <Title>{t('scan.title')}</Title>
      <P muted>{t('scan.intro')}</P>
      <View style={s.row}>
        <Button title={`📷 ${t('scan.capture')}`} variant="primary" onPress={() => void pick(true)} />
        <Button title={`🖼 ${t('scan.import')}`} onPress={() => void pick(false)} />
      </View>
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 260, borderRadius: 12 }} resizeMode="contain" accessibilityLabel={t('scan.crop')} />}
      {uri && <Button title={busy ? t('scan.recognizing') : t('scan.recognize')} variant="primary" onPress={() => void recognize()} disabled={busy} />}
      {busy && <Loading />}
      {error && <P style={{ color: '#f87171' }}>{error}</P>}
      {(uri || text) ? (
        <Card>
          <P muted>{t('scan.extracted')}</P>
          {confidence !== null && <Badge text={t('scan.ocrConfidence', { value: confidence })} tone={confidence > 80 ? 'success' : 'warning'} />}
          <Input value={text} onChangeText={setText} multiline style={{ minHeight: 100, fontFamily: 'monospace' }} placeholder={t('scan.typeInstead')} />
          <P muted>{t('scan.diagramNote')}</P>
        </Card>
      ) : null}
      {questions.length > 0 && <P>{t('scan.questionsFound', { count: questions.length })}</P>}
      {questions.map((q, i) => (
        <Card key={i}>
          <P>{q.index}. {q.text}</P>
          <Badge text={q.type} />
          <Button title={t('solver.solve')} onPress={() => void solve(i, q.text)} />
          {solutions[i] && <Solution data={solutions[i]!} />}
        </Card>
      ))}
    </Screen>
  );
}
