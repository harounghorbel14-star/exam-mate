import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { ErrorState, PageHead, RequireAccount, Spinner, Bar } from '../components/ui';

interface Q { id: string; type: 'mcq' | 'truefalse' | 'numeric' | 'short' | 'written'; prompt: string; choices?: string[]; points: number; topic: string; expectedSeconds: number; answer?: unknown; explanation?: string; rubric?: Array<{ id: string; description: string; points: number }> }
interface Grade { questionId: string; status: string; pointsAwarded: number; pointsPossible: number; feedback: string; matchedCriteria?: string[] }
interface Attempt { id: string; status: string; questions: Q[]; responses: Record<string, unknown>; timings: Record<string, number>; deadline_at: string; grades: Grade[] | null; summary: { percent: number; score: number; maxScore: number; pendingReview: number; late?: boolean; analysis?: Array<{ questionId: string; timeSpent: number; expected: number; overTime: boolean }> } | null; strategy_mode: boolean }

function Inner() {
  const { id } = useParams();
  const { t, num } = useI18n();
  const [a, setA] = useState<Attempt | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const timings = useRef<Record<string, number>>({});
  const shownAt = useRef(Date.now());
  const dirty = useRef(false);

  const load = useCallback(() => api<{ attempt: Attempt }>(`/exams/attempts/${id}`).then((r) => { setA(r.attempt); setResponses(r.attempt.responses ?? {}); timings.current = { ...(r.attempt.timings ?? {}) }; }).catch(setError), [id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const inProgress = a?.status === 'in_progress';
  const q = a?.questions[idx];
  const accumulate = () => {
    if (!q) return;
    timings.current[q.id] = (timings.current[q.id] ?? 0) + (Date.now() - shownAt.current) / 1000;
    shownAt.current = Date.now();
  };
  const go = (i: number) => { accumulate(); setIdx(i); };

  // Autosave every 10 seconds when something changed.
  useEffect(() => {
    if (!inProgress) return;
    const i = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      accumulate();
      void api(`/exams/attempts/${id}/responses`, { method: 'PUT', body: { responses, timings: timings.current } }).catch(() => { dirty.current = true; });
    }, 10_000);
    return () => clearInterval(i);
  });

  const submit = useCallback(async () => {
    accumulate();
    try {
      await api(`/exams/attempts/${id}/submit`, { method: 'POST', body: { responses, timings: timings.current } });
      await load();
    } catch (e) { setError(e); }
  }, [id, responses, load]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = a ? Math.max(0, new Date(a.deadline_at).getTime() - now) : 0;
  useEffect(() => { if (inProgress && remaining === 0 && a) void submit(); }, [inProgress, remaining === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (v: unknown) => { if (!q) return; setResponses((r) => ({ ...r, [q.id]: v })); dirty.current = true; };

  if (!a) return error ? <ErrorState error={error} /> : <Spinner />;

  if (!inProgress) {
    const grades = a.grades ?? [];
    const review = async (qid: string, pts: number) => {
      try { await api(`/exams/attempts/${id}/review`, { method: 'POST', body: { questionId: qid, pointsAwarded: pts } }); await load(); } catch (e) { setError(e); }
    };
    return (
      <>
        <PageHead title={t('exams.results')} actions={<Link className="btn" to="/exams">{t('common.back')}</Link>} />
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <div className="card stat"><span className="value">{num(a.summary?.percent ?? 0)}%</span><span className="label">{t('common.score')}</span></div>
          <div className="card stat"><span className="value">{num(a.summary?.score ?? 0)}/{num(a.summary?.maxScore ?? 0)}</span><span className="label">{t('exams.points')}</span></div>
          <div className="card stat"><span className="value">{num(a.summary?.pendingReview ?? 0)}</span><span className="label">{t('exams.pendingReview', { count: a.summary?.pendingReview ?? 0 })}</span></div>
          <div className="card stat"><span className="value">{num(a.summary?.analysis?.filter((x) => x.overTime).length ?? 0)}</span><span className="label">{t('exams.overTime')}</span></div>
        </div>
        {error !== null && <ErrorState error={error} />}
        <ol className="stack" style={{ paddingInlineStart: 0, listStyle: 'none' }}>
          {a.questions.map((qq, i) => {
            const g = grades.find((x) => x.questionId === qq.id);
            const an = a.summary?.analysis?.find((x) => x.questionId === qq.id);
            const resp = a.responses[qq.id];
            return (
              <li key={qq.id} className="card stack">
                <div className="row between"><strong dir="auto">{i + 1}. {qq.prompt}</strong><span className={`badge ${g?.status === 'correct' ? 'success' : g?.status === 'needs_review' ? 'info' : g?.status === 'partial' ? 'warning' : 'danger'}`}>{g?.status} · {g?.pointsAwarded}/{g?.pointsPossible}</span></div>
                <div className="faint">{t('exams.yourAnswer')}: <span dir="auto">{qq.choices && typeof resp === 'number' ? qq.choices[resp] : resp === undefined ? '—' : String(resp)}</span></div>
                {g?.status !== 'correct' && qq.type !== 'written' && <div className="muted">{t('exams.correctAnswer')}: <span dir="auto">{qq.choices ? qq.choices[qq.answer as number] : Array.isArray(qq.answer) ? (qq.answer as string[]).join(' / ') : String(qq.answer)}</span></div>}
                {qq.explanation && <div className="faint">{qq.explanation}</div>}
                {an && <div className="faint">{t('common.time')}: {Math.round(an.timeSpent)}s / {an.expected}s {an.overTime && <span className="badge warning">{t('exams.overTime')}</span>}</div>}
                {g?.status === 'needs_review' && (
                  <div className="stack">
                    {qq.rubric && <ul>{qq.rubric.map((r) => <li key={r.id}>{g.matchedCriteria?.includes(r.id) ? '✓ ' : ''}{r.description} ({r.points})</li>)}</ul>}
                    <div className="row">{Array.from({ length: Math.floor(qq.points) + 1 }, (_, p) => <button key={p} className="btn sm" onClick={() => void review(qq.id, p)}>{p}/{qq.points}</button>)}</div>
                    <span className="hint">{t('exams.manualHint')}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  const answered = a.questions.filter((x) => responses[x.id] !== undefined && responses[x.id] !== '').length;
  const mm = Math.floor(remaining / 60000), ss = Math.floor((remaining % 60000) / 1000);
  const elapsedOnQ = q ? (timings.current[q.id] ?? 0) + (now - shownAt.current) / 1000 : 0;
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="timer" role="timer" aria-label={t('exams.timeLeft')}>⏱ {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</span>
        <span className="faint">{answered}/{a.questions.length}</span>
        <button className="btn primary" onClick={() => { if (confirm(t('exams.submitConfirm'))) void submit(); }}>{t('exams.finish')}</button>
      </div>
      <Bar value={answered} max={a.questions.length} />
      <div className="chips" style={{ margin: '12px 0' }}>
        {a.questions.map((x, i) => <button key={x.id} className={`chip${i === idx ? ' active' : ''}`} aria-current={i === idx} onClick={() => go(i)}>{flags.has(x.id) ? '⚑' : ''}{i + 1}{responses[x.id] !== undefined ? ' ✓' : ''}</button>)}
      </div>
      {q && (
        <div className="card glass stack">
          <div className="row between"><span className="badge">{q.topic} · {q.points} {t('exams.points')}</span>
            {a.strategy_mode && <span className={`badge ${elapsedOnQ > q.expectedSeconds ? 'warning' : 'info'}`}>{Math.round(elapsedOnQ)}s / {q.expectedSeconds}s</span>}</div>
          <h2 dir="auto">{q.prompt}</h2>
          {(q.type === 'mcq' || q.type === 'truefalse') && (
            <div className="choice-grid" role="radiogroup">
              {q.choices!.map((c, i) => <button key={i} role="radio" aria-checked={responses[q.id] === i} className={`choice${responses[q.id] === i ? ' correct' : ''}`} onClick={() => set(i)} dir="auto">{String.fromCharCode(65 + i)}. {c}</button>)}
            </div>
          )}
          {(q.type === 'numeric' || q.type === 'short') && <input className="input" dir="auto" inputMode={q.type === 'numeric' ? 'decimal' : 'text'} value={String(responses[q.id] ?? '')} onChange={(e) => set(e.target.value)} aria-label={t('exams.yourAnswer')} />}
          {q.type === 'written' && <textarea className="input" dir="auto" value={String(responses[q.id] ?? '')} onChange={(e) => set(e.target.value)} aria-label={t('exams.yourAnswer')} style={{ minHeight: 180 }} />}
          <div className="row between">
            <button className="btn" disabled={idx === 0} onClick={() => go(idx - 1)}>{t('common.back')}</button>
            <button className="btn ghost" aria-pressed={flags.has(q.id)} onClick={() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}>⚑ {t('exams.flag')}</button>
            <button className="btn primary" disabled={idx === a.questions.length - 1} onClick={() => go(idx + 1)}>{t('common.next')}</button>
          </div>
        </div>
      )}
      {error !== null && <div style={{ marginTop: 12 }}><ErrorState error={error} /></div>}
    </>
  );
}

export default function ExamTake() { return <RequireAccount><Inner /></RequireAccount>; }
