import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { useApp } from '../lib/app';
import { api, apiBase, getToken } from '../lib/api';
import { Badge, Button, Card, Input, Loading, P, Screen, Title } from '../components/ui';

interface Doc { id: string; title: string; status: string; page_count: number | null }

export function DocumentsScreen() {
  const { t, user, online } = useApp();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [sel, setSel] = useState<Doc | null>(null);
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<{ found: boolean; answer: string; citations: Array<{ page: number | null }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => { if (user && online) void api<{ items: Doc[] }>('/documents?limit=50').then((r) => setDocs(r.items)).catch((e) => setError(e.message)); }, [user, online]);
  useFocusEffect(load);

  const upload = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'text/markdown', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append('file', { uri: a.uri, name: a.name, type: a.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      const token = await getToken();
      const r = await fetch(`${await apiBase()}/api/documents`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error((await r.json())?.error?.message ?? 'Upload failed');
      load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const ask = async () => {
    if (!sel || !q.trim()) return;
    setBusy(true); setAnswer(null);
    try { setAnswer(await api(`/documents/${sel.id}/ask`, { method: 'POST', body: { question: q } })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (!user || !online) return <Screen><Title>{t('docs.title')}</Title><P muted>{t('auth.signInToUse')}</P><P muted>{t('common.needsInternet')}</P></Screen>;
  return (
    <Screen>
      <Title>{t('docs.title')}</Title>
      <P muted>{t('docs.privacy')}</P>
      <Button title={`⬆ ${t('docs.upload')}`} variant="primary" onPress={() => void upload()} disabled={busy} />
      {busy && <Loading />}
      {error && <P style={{ color: '#f87171' }}>{error}</P>}
      {docs?.map((d) => (
        <Card key={d.id}>
          <P style={{ fontWeight: '700' }}>{d.title}</P>
          <Badge text={d.status === 'ready' ? t('docs.ready') : d.status === 'failed' ? t('docs.failed') : t('docs.processing')} tone={d.status === 'ready' ? 'success' : d.status === 'failed' ? 'danger' : 'warning'} />
          {d.status === 'ready' && <Button title={t('docs.ask')} onPress={() => { setSel(d); setAnswer(null); }} />}
          {sel?.id === d.id && (
            <>
              <Input value={q} onChangeText={setQ} placeholder={t('docs.askPlaceholder')} />
              <Button title={t('docs.ask')} variant="primary" onPress={() => void ask()} />
              {answer && (answer.found ? <><P>{answer.answer}</P>{answer.citations.map((c, i) => <Badge key={i} text={t('docs.source', { page: c.page ?? '?' })} />)}</> : <P muted>{t('docs.noAnswer')}</P>)}
            </>
          )}
        </Card>
      ))}
      {docs?.length === 0 && <P muted>{t('docs.empty')}</P>}
    </Screen>
  );
}
