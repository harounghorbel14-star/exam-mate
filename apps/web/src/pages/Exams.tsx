import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { api } from '../lib/api';
import { ErrorState, PageHead, RequireAccount, Spinner } from '../components/ui';

interface Attempt { id: string; config: { title?: string; count: number; durationMinutes: number; subjects?: string[] }; status: string; summary: { percent: number; pendingReview: number } | null; started_at: string; strategy_mode: boolean }

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'cs', 'history', 'geography', 'general'];

function Inner() {
  const { t, locale, date } = useI18n();
  const nav = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [duration, setDuration] = useState(20);
  const [difficulty, setDifficulty] = useState<number[]>([]);
  const [strategy, setStrategy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    api<{ attempts: Attempt[] }>('/exams/attempts').then((r) => setAttempts(r.attempts)).catch(setError);
    api<{ templates: Array<{ id: string; title: string }> }>('/exams/templates').then((r) => setTemplates(r.templates)).catch(() => undefined);
  }, []);

  const config = { subjects: subjects.length ? subjects : undefined, difficulty: difficulty.length ? difficulty : undefined, count, durationMinutes: duration, strategyMode: strategy, locale };
  const start = async (body: object) => {
    setBusy(true); setError(null);
    try {
      const r = await api<{ attempt: { id: string } }>('/exams/attempts', { method: 'POST', body });
      nav(`/exams/${r.attempt.id}`);
    } catch (e) { setError(e); setBusy(false); }
  };
  const saveTemplate = async () => {
    const title = prompt(t('exams.templateName'));
    if (!title) return;
    const r = await api<{ id: string }>('/exams/templates', { method: 'POST', body: { title, config } });
    setTemplates((x) => [{ id: r.id, title }, ...x]);
  };
  const toggle = <T,>(list: T[], v: T, set: (x: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <>
      <PageHead title={t('exams.title')} />
      {error !== null && <div style={{ marginBottom: 12 }}><ErrorState error={error} /></div>}
      <div className="grid cols-2">
        <section className="card glass stack">
          <h2>{t('exams.new')}</h2>
          <div className="field"><span className="label">{t('common.subject')}</span>
            <div className="chips">{SUBJECTS.map((s) => <button key={s} className="chip" aria-pressed={subjects.includes(s)} onClick={() => toggle(subjects, s, setSubjects)}>{t(`subject.${s}` as MessageKey)}</button>)}</div>
            <span className="hint">{t('exams.allSubjectsHint')}</span></div>
          <div className="field"><span className="label">{t('exams.difficulty')}</span>
            <div className="chips">{[1, 2, 3].map((d) => <button key={d} className="chip" aria-pressed={difficulty.includes(d)} onClick={() => toggle(difficulty, d, setDifficulty)}>{t(d === 1 ? 'exams.easy' : d === 2 ? 'exams.medium' : 'exams.hard')}</button>)}</div></div>
          <div className="grid cols-2">
            <div className="field"><label htmlFor="cnt">{t('exams.questions')}</label><input id="cnt" type="number" min={1} max={60} className="input" value={count} onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value))))} /></div>
            <div className="field"><label htmlFor="dur">{t('exams.duration')}</label><input id="dur" type="number" min={1} max={300} className="input" value={duration} onChange={(e) => setDuration(Math.max(1, Math.min(300, Number(e.target.value))))} /></div>
          </div>
          <label className="row"><input type="checkbox" checked={strategy} onChange={(e) => setStrategy(e.target.checked)} /> {t('exams.strategyMode')}</label>
          <div className="row"><button className="btn primary lg" disabled={busy} onClick={() => void start(config)}>{t('exams.start')}</button><button className="btn" onClick={() => void saveTemplate()}>{t('exams.saveTemplate')}</button></div>
          {templates.length > 0 && <div className="chips">{templates.map((tp) => <button key={tp.id} className="chip" onClick={() => void start({ templateId: tp.id, locale })}>▶ {tp.title}</button>)}</div>}
        </section>
        <section className="card stack">
          <h2>{t('exams.history')}</h2>
          {attempts === null ? <Spinner /> : attempts.length === 0 ? <p className="muted">{t('common.empty')}</p> : (
            <ul className="list">{attempts.map((a) => (
              <li key={a.id} className="list-item" style={{ cursor: 'pointer' }} onClick={() => nav(`/exams/${a.id}`)}>
                <div><strong>{a.config.count} {t('exams.questions')} · {a.config.durationMinutes} {t('common.minutes')}</strong><div className="faint">{date(a.started_at)}{a.strategy_mode ? ` · ${t('exams.strategyMode')}` : ''}</div></div>
                {a.status === 'in_progress' ? <span className="badge info">{t('exams.inProgress')}</span> : <span className={`badge ${a.summary && a.summary.percent >= 50 ? 'success' : 'warning'}`}>{a.summary?.percent ?? 0}%{a.summary?.pendingReview ? ` · ${t('exams.pendingReview', { count: a.summary.pendingReview })}` : ''}</span>}
              </li>))}</ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function Exams() { return <RequireAccount><Inner /></RequireAccount>; }
