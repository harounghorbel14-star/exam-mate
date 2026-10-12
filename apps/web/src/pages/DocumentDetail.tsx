import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { api, ApiError } from '../lib/api';
import { ErrorState, PageHead, RequireAccount, Spinner } from '../components/ui';
import type { Doc } from './Documents';

type Cited<T> = { item: T; page: number | null; section: string | null };
type Tab = 'ask' | 'summary' | 'flashcards' | 'quiz' | 'revision' | 'extract';

function Inner() {
  const { id } = useParams();
  const { t } = useI18n();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [tab, setTab] = useState<Tab>('ask');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ found: boolean; answer: string; engine: string; citations: Array<{ page: number | null; section: string | null; quote: string }>; injectionWarnings: string[] } | null>(null);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useEffect(() => { api<{ document: Doc }>(`/documents/${id}`).then((r) => setDoc(r.document)).catch(setError); }, [id]);

  const run = async (key: Tab, path: string, body: unknown = {}) => {
    setBusy(true); setError(null);
    try { setData((d) => ({ ...d, [key]: undefined })); const r = await api(path, { method: 'POST', body }); setData((d) => ({ ...d, [key]: r })); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true); setError(null); setAnswer(null);
    try { setAnswer(await api(`/documents/${id}/ask`, { method: 'POST', body: { question } })); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (tab === 'summary' && !data.summary) void run('summary', `/documents/${id}/summary`, { sentences: 8 });
    if (tab === 'extract' && !data.extract) void run('extract', `/documents/${id}/extract`);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return error ? <ErrorState error={error} /> : <Spinner />;
  const tabs: Array<[Tab, string]> = [['ask', t('docs.ask')], ['summary', t('docs.summary')], ['flashcards', t('docs.flashcards')], ['quiz', t('docs.quiz')], ['revision', t('docs.revision')], ['extract', t('docs.formulas')]];
  const page = (p: number | null) => <span className="badge">{t('docs.source', { page: p ?? '?' })}</span>;
  const summary = data.summary as { summary: Array<Cited<string>> } | undefined;
  const cards = data.flashcards as { cards: Array<{ front: string; back: string; page: number | null }>; deckId: string | null } | undefined;
  const quiz = data.quiz as { questions: Array<{ prompt: string; type: string; choices?: string[]; answer: number | string[]; page: number | null; explanation: string }> } | undefined;
  const sheet = data.revision as { sheet: { sections: Array<{ heading: string; points: Array<Cited<string>> }>; definitions: Array<Cited<{ term: string; definition: string }>>; formulas: Array<Cited<string>> } } | undefined;
  const extract = data.extract as { definitions: Array<Cited<{ term: string; definition: string }>>; formulas: Array<Cited<string>> } | undefined;

  return (
    <>
      <PageHead title={doc.title} subtitle={`${doc.filename}${doc.page_count ? ` · ${t('docs.pages', { count: doc.page_count })}` : ''}`} actions={<Link className="btn" to="/documents">{t('common.back')}</Link>} />
      <div className="tabs" role="tablist">{tabs.map(([k, label]) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>)}</div>
      {error !== null && <div style={{ marginBottom: 12 }}>{error instanceof ApiError && error.code === 'premium_required' ? <div className="alert info">{t('docs.premiumOnly')} <Link to="/settings">{t('plan.upgrade')}</Link></div> : <ErrorState error={error} />}</div>}
      {busy && <Spinner label={t('common.loading')} />}

      {tab === 'ask' && (
        <div className="stack">
          <form className="row" onSubmit={ask}><input className="input" style={{ flex: 1 }} dir="auto" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('docs.askPlaceholder')} maxLength={1000} /><button className="btn primary" disabled={busy}>{t('docs.ask')}</button></form>
          {answer && (answer.found ? (
            <div className="card stack">
              <p style={{ fontSize: '1.05rem' }}>{answer.answer}</p>
              {answer.citations.map((c, i) => <blockquote key={i} className="muted" style={{ margin: 0 }}>{page(c.page)} {c.section && <span className="faint">{c.section}</span>} “{c.quote}”</blockquote>)}
              <span className="faint">{t('docs.groundedNote')}</span>
              {answer.injectionWarnings.length > 0 && <div className="alert warning">{t('docs.injectionWarning')}</div>}
            </div>
          ) : <div className="alert warning">{t('docs.noAnswer')}</div>)}
        </div>
      )}

      {tab === 'summary' && summary && <div className="card"><ul className="stack" style={{ paddingInlineStart: 18 }}>{summary.summary.map((s, i) => <li key={i}>{s.item} {page(s.page)}</li>)}</ul></div>}

      {tab === 'flashcards' && (
        <div className="stack">
          <div className="row"><button className="btn" onClick={() => void run('flashcards', `/documents/${id}/flashcards`, { save: false })}>{t('docs.flashcards')}</button>
            <button className="btn primary" onClick={() => void run('flashcards', `/documents/${id}/flashcards`, { save: true })}>{t('docs.saveDeck')}</button></div>
          {cards?.deckId && <div className="alert success">{t('common.saved')} — <Link to="/flashcards">{t('flash.study')}</Link></div>}
          {cards && <div className="grid cols-2">{cards.cards.map((c, i) => <div key={i} className="card"><strong dir="auto">{c.front}</strong><p className="muted" dir="auto">{c.back}</p>{page(c.page)}</div>)}</div>}
        </div>
      )}

      {tab === 'quiz' && (
        <div className="stack">
          <div><button className="btn primary" onClick={() => { setRevealed({}); void run('quiz', `/documents/${id}/quiz`, { count: 10, seed: Date.now() % 100000 }); }}>{t('docs.quiz')}</button></div>
          {quiz?.questions.map((q, i) => (
            <div key={i} className="card stack">
              <strong dir="auto">{i + 1}. {q.prompt}</strong>
              {q.choices && <ol type="A">{q.choices.map((c, j) => <li key={j} style={{ fontWeight: revealed[i] && q.answer === j ? 700 : 400 }}>{c}</li>)}</ol>}
              <button className="btn sm" onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}>{t('flash.show')}</button>
              {revealed[i] && <div className="alert info">{Array.isArray(q.answer) ? q.answer.join(', ') : q.choices?.[q.answer]} — {page(q.page)}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'revision' && (
        <div className="stack">
          <div><button className="btn primary" onClick={() => void run('revision', `/documents/${id}/revision-sheet`)}>{t('docs.revision')}</button></div>
          {sheet && (
            <div className="card stack">
              {sheet.sheet.sections.map((s, i) => <section key={i}><h3>{s.heading}</h3><ul>{s.points.map((p, j) => <li key={j}>{p.item} {page(p.page)}</li>)}</ul></section>)}
              {sheet.sheet.formulas.length > 0 && <section><h3>{t('docs.formulas')}</h3><ul>{sheet.sheet.formulas.map((f, i) => <li key={i}><code className="ltr">{f.item}</code> {page(f.page)}</li>)}</ul></section>}
            </div>
          )}
        </div>
      )}

      {tab === 'extract' && extract && (
        <div className="grid cols-2">
          <div className="card"><h3>{t('docs.definitions')}</h3>{extract.definitions.length === 0 ? <p className="muted">{t('common.empty')}</p> : <dl>{extract.definitions.map((d, i) => <div key={i} style={{ marginBottom: 8 }}><dt><strong>{d.item.term}</strong> {page(d.page)}</dt><dd className="muted" style={{ margin: 0 }}>{d.item.definition}</dd></div>)}</dl>}</div>
          <div className="card"><h3>{t('docs.formulas')}</h3>{extract.formulas.length === 0 ? <p className="muted">{t('common.empty')}</p> : <ul>{extract.formulas.map((f, i) => <li key={i}><code className="ltr">{f.item}</code> {page(f.page)}</li>)}</ul>}</div>
        </div>
      )}
    </>
  );
}

export default function DocumentDetail() {
  return <RequireAccount><Inner /></RequireAccount>;
}
