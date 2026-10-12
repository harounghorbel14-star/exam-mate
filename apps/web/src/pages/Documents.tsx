import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { useOnline } from '../lib/online';
import { Empty, ErrorState, PageHead, RequireAccount, Spinner } from '../components/ui';

export interface Doc { id: string; title: string; filename: string; status: 'pending' | 'processing' | 'ready' | 'failed'; error: string | null; page_count: number | null; course: string | null; exam: string | null; subject_name: string | null; size_bytes: number; created_at: string }

function DocumentsInner() {
  const { t, date } = useI18n();
  const online = useOnline();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const [course, setCourse] = useState('');
  const [exam, setExam] = useState('');
  const [filter, setFilter] = useState('');
  const [limits, setLimits] = useState<{ maxUploadMb: number; maxDocuments: number } | null>(null);
  const PAGE = 20;

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (filter) q.set('course', filter);
      const r = await api<{ items: Doc[]; total: number }>(`/documents?${q}`);
      setDocs(r.items); setTotal(r.total); setError(null);
    } catch (e) { setError(e); }
  }, [offset, filter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api<{ limits: { maxUploadMb: number; maxDocuments: number } }>('/account/usage').then((r) => setLimits(r.limits)).catch(() => undefined); }, []);
  // Poll while documents are being processed in the background.
  useEffect(() => {
    if (!docs?.some((d) => d.status === 'pending' || d.status === 'processing')) return;
    const i = setInterval(() => void load(), 2000);
    return () => clearInterval(i);
  }, [docs, load]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      if (course) form.append('course', course);
      if (exam) form.append('exam', exam);
      await api('/documents', { form });
      await load();
    } catch (e) { setError(e); } finally { setUploading(false); }
  };

  const remove = async (d: Doc) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try { await api(`/documents/${d.id}`, { method: 'DELETE' }); await load(); } catch (e) { setError(e); }
  };

  const courses = [...new Set((docs ?? []).map((d) => d.course).filter(Boolean))] as string[];
  return (
    <>
      <PageHead title={t('docs.title')} subtitle={t('docs.privacy')} />
      {!online && <div className="alert warning" style={{ marginBottom: 12 }}>{t('common.needsInternet')}</div>}
      <div className="card glass stack">
        <div className="grid cols-3">
          <div className="field"><label htmlFor="course">{t('docs.course')}</label><input id="course" className="input" value={course} onChange={(e) => setCourse(e.target.value)} maxLength={100} /></div>
          <div className="field"><label htmlFor="exam">{t('docs.exam')}</label><input id="exam" className="input" value={exam} onChange={(e) => setExam(e.target.value)} maxLength={100} /></div>
          <div className="field"><span className="label">{t('docs.upload')}</span>
            <label className="btn primary">{uploading ? t('docs.processing') : `⬆ ${t('common.upload')}`}<input type="file" hidden accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} disabled={uploading || !online} /></label>
          </div>
        </div>
        <span className="hint">{t('docs.supported', { size: limits?.maxUploadMb ?? 10 })}{limits ? ` · ${total}/${limits.maxDocuments}` : ''}</span>
      </div>
      {error !== null && <div style={{ marginTop: 12 }}><ErrorState error={error} onRetry={() => void load()} /></div>}
      {courses.length > 0 && (
        <div className="chips" style={{ marginTop: 16 }}>
          <button className="chip" aria-pressed={!filter} onClick={() => { setFilter(''); setOffset(0); }}>{t('common.all')}</button>
          {courses.map((c) => <button key={c} className="chip" aria-pressed={filter === c} onClick={() => { setFilter(c); setOffset(0); }}>{c}</button>)}
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        {docs === null ? <Spinner /> : docs.length === 0 ? <Empty>{t('docs.empty')}</Empty> : (
          <ul className="list">
            {docs.map((d) => (
              <li key={d.id} className="list-item">
                <div style={{ minWidth: 0 }}>
                  {d.status === 'ready' ? <Link to={`/documents/${d.id}`}><strong>{d.title}</strong></Link> : <strong>{d.title}</strong>}
                  <div className="faint">{d.filename} · {(d.size_bytes / 1024).toFixed(0)} KB{d.page_count ? ` · ${t('docs.pages', { count: d.page_count })}` : ''}{d.course ? ` · ${d.course}` : ''}{d.exam ? ` · ${d.exam}` : ''} · {date(d.created_at)}</div>
                  {d.error && <div className="error-text">{d.error}</div>}
                </div>
                <div className="row">
                  <span className={`badge ${d.status === 'ready' ? 'success' : d.status === 'failed' ? 'danger' : 'info'}`}>{d.status === 'ready' ? t('docs.ready') : d.status === 'failed' ? t('docs.failed') : t('docs.processing')}</span>
                  <button className="btn sm danger" onClick={() => void remove(d)} aria-label={`${t('common.delete')} ${d.title}`}>{t('common.delete')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > PAGE && (
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>{t('common.back')}</button>
            <span className="faint">{offset + 1}–{Math.min(total, offset + PAGE)} / {total}</span>
            <button className="btn sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>{t('common.next')}</button>
          </div>
        )}
      </div>
    </>
  );
}

export default function Documents() {
  return <RequireAccount><DocumentsInner /></RequireAccount>;
}
