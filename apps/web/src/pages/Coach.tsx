import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { allocateTime, guessExpectedValue, STRATEGY_TIPS, TIP_TEXT, type SectionPlan, type MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/online';
import { api } from '../lib/api';
import { PageHead } from '../components/ui';

const AREAS: Array<{ id: (typeof STRATEGY_TIPS)[number]['area']; key: MessageKey }> = [
  { id: 'time', key: 'coach.allocate' }, { id: 'mcq', key: 'coach.elimination' }, { id: 'patterns', key: 'coach.patterns' },
  { id: 'checking', key: 'coach.checking' }, { id: 'partial-credit', key: 'coach.partialCredit' }, { id: 'analysis', key: 'coach.analysis' },
];

export default function Coach() {
  const { t, locale, num } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const [total, setTotal] = useState(90);
  const [sections, setSections] = useState<SectionPlan[]>([
    { name: 'MCQ', questions: 20, pointsEach: 1, difficulty: 1 },
    { name: 'Short problems', questions: 5, pointsEach: 4, difficulty: 2 },
    { name: 'Long problem', questions: 1, pointsEach: 12, difficulty: 3 },
  ]);
  const [options, setOptions] = useState(4);
  const [eliminated, setEliminated] = useState(1);
  const [penalty, setPenalty] = useState(0);
  const [last, setLast] = useState<{ summary: { percent: number; analysis?: Array<{ topic: string; status: string; timeSpent: number; expected: number; overTime: boolean }> } } | null>(null);
  const plan = allocateTime(total, sections);
  const ev = guessExpectedValue(options, eliminated, 1, penalty);

  useEffect(() => {
    if (!user || !online) return;
    api<{ attempts: Array<{ id: string; status: string }> }>('/exams/attempts').then(async (r) => {
      const done = r.attempts.find((a) => a.status !== 'in_progress');
      if (done) setLast((await api<{ attempt: NonNullable<typeof last> }>(`/exams/attempts/${done.id}`)).attempt);
    }).catch(() => undefined);
  }, [user, online]);

  const upd = (i: number, patch: Partial<SectionPlan>) => setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const analysis = last?.summary.analysis ?? [];
  const overTime = analysis.filter((a) => a.overTime);
  const wrongFast = analysis.filter((a) => a.status === 'incorrect' && a.timeSpent < a.expected * 0.4);

  return (
    <>
      <PageHead title={t('coach.title')} subtitle={t('coach.subtitle')} />
      <div className="alert info" style={{ marginBottom: 16 }}>{t('coach.integrity')}</div>
      <div className="grid cols-2">
        <section className="card stack">
          <h2>{t('coach.allocate')}</h2>
          <label className="field"><span className="label">{t('coach.totalTime')}</span><input type="number" className="input" min={10} max={600} value={total} onChange={(e) => setTotal(Number(e.target.value))} /></label>
          <table className="table">
            <thead><tr><th>{t('coach.section')}</th><th>#</th><th>{t('exams.points')}</th><th>{t('exams.difficulty')}</th></tr></thead>
            <tbody>{sections.map((s, i) => (
              <tr key={i}>
                <td><input className="input" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} /></td>
                <td><input type="number" className="input" style={{ width: 70 }} min={1} value={s.questions} onChange={(e) => upd(i, { questions: Number(e.target.value) })} /></td>
                <td><input type="number" className="input" style={{ width: 70 }} min={0.5} step={0.5} value={s.pointsEach} onChange={(e) => upd(i, { pointsEach: Number(e.target.value) })} /></td>
                <td><select className="input" value={s.difficulty} onChange={(e) => upd(i, { difficulty: Number(e.target.value) as 1 | 2 | 3 })}><option value={1}>{t('exams.easy')}</option><option value={2}>{t('exams.medium')}</option><option value={3}>{t('exams.hard')}</option></select></td>
              </tr>))}</tbody>
          </table>
          <button className="btn sm" onClick={() => setSections([...sections, { name: `Section ${sections.length + 1}`, questions: 5, pointsEach: 2, difficulty: 2 }])}>+ {t('coach.section')}</button>
          <ol className="list">{[...plan.rows].sort((a, b) => a.order - b.order).map((r) => (
            <li key={r.name} className="list-item"><div><strong>{r.order}. {r.name}</strong><div className="faint">{r.reason}</div></div><span className="badge">{num(r.minutes)} {t('common.minutes')} · {r.perQuestionSec}s/q</span></li>))}
            <li className="list-item"><strong>{t('coach.review')}</strong><span className="badge">{plan.reviewMinutes} {t('common.minutes')}</span></li></ol>
        </section>
        <section className="card stack">
          <h2>{t('coach.elimination')}</h2>
          <div className="grid cols-3">
            <label className="field"><span className="label">{t('coach.options')}</span><input type="number" className="input" min={2} max={6} value={options} onChange={(e) => setOptions(Number(e.target.value))} /></label>
            <label className="field"><span className="label">{t('coach.eliminated')}</span><input type="number" className="input" min={0} max={options - 1} value={eliminated} onChange={(e) => setEliminated(Number(e.target.value))} /></label>
            <label className="field"><span className="label">{t('coach.penalty')}</span><input type="number" className="input" min={0} max={2} step={0.25} value={penalty} onChange={(e) => setPenalty(Number(e.target.value))} /></label>
          </div>
          <div className={`alert ${ev > 0 ? 'success' : 'warning'}`}>{t('coach.ev', { value: ev.toFixed(2) })} — {ev > 0 ? t('coach.guess') : t('coach.skip')}</div>
          <h2>{t('coach.practice')}</h2>
          <p className="muted">{t('coach.practiceHelp')}</p>
          <Link to="/exams" className="btn primary">{t('exams.strategyMode')}</Link>
          <h2>{t('coach.analysis')}</h2>
          {!last ? <p className="muted">{t('coach.noAttempt')}</p> : (
            <ul>
              <li>{t('common.score')}: {num(last.summary.percent)}%</li>
              <li>{t('coach.overTimeCount', { count: overTime.length })}{overTime.length ? `: ${[...new Set(overTime.map((o) => o.topic))].join(', ')}` : ''}</li>
              <li>{t('coach.rushedCount', { count: wrongFast.length })}</li>
              {overTime.length > 0 && <li>{t('coach.adviceOverTime')}</li>}
              {wrongFast.length > 0 && <li>{t('coach.adviceRushed')}</li>}
            </ul>
          )}
        </section>
      </div>
      <h2 style={{ marginTop: 24 }}>{t('coach.tips')}</h2>
      <div className="grid cols-3">
        {AREAS.map((a) => (
          <section key={a.id} className="card stack">
            <h3>{t(a.key)}</h3>
            {STRATEGY_TIPS.filter((x) => x.area === a.id).map((tip) => <div key={tip.id}><strong>{TIP_TEXT[tip.id]!.title[locale]}</strong><p className="muted" style={{ margin: 0 }}>{TIP_TEXT[tip.id]!.body[locale]}</p></div>)}
          </section>
        ))}
      </div>
    </>
  );
}
