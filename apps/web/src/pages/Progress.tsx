import { useCallback, useEffect, useState } from 'react';
import { GAMES, progressTotals, type GameProgressRecord, type WeaknessReport, type PlanTask } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/online';
import { api } from '../lib/api';
import { gameRepo } from '../lib/sync';
import { Bar, ErrorState, PageHead, Spinner, Stars } from '../components/ui';

export default function Progress() {
  const { t, locale, num } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const [report, setReport] = useState<WeaknessReport | null>(null);
  const [plan, setPlan] = useState<PlanTask[]>([]);
  const [overrides, setOverrides] = useState<{ exclude: string[]; pin: string[]; minutesPerDay: number }>({ exclude: [], pin: [], minutesPerDay: 45 });
  const [games, setGames] = useState<Record<string, GameProgressRecord>>({});
  const [error, setError] = useState<unknown>(null);
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    if (!user || !online) return;
    try {
      const [w, p] = await Promise.all([api<{ report: WeaknessReport }>('/progress/weaknesses'), api<{ plan: PlanTask[]; overrides: typeof overrides }>(`/progress/plan?days=${days}`)]);
      setReport(w.report); setPlan(p.plan); setOverrides(p.overrides);
    } catch (e) { setError(e); }
  }, [user, online, days]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void gameRepo.all().then(setGames); }, []);

  const saveOverrides = async (o: typeof overrides) => {
    setOverrides(o);
    await api('/progress/plan/overrides', { method: 'PUT', body: o }).catch(setError);
    await load();
  };

  return (
    <>
      <PageHead title={t('progress.title')} />
      {error !== null && <ErrorState error={error} onRetry={() => void load()} />}
      {user && online && (
        <div className="grid cols-2" style={{ marginBottom: 16 }}>
          <section className="card stack">
            <h2>{t('progress.weaknesses')}</h2>
            {!report ? <Spinner /> : report.topics.length === 0 ? <p className="muted">{t('progress.noData')}</p> : (
              <div className="stack">
                {report.topics.slice(0, 10).map((tp) => (
                  <div key={tp.subject + tp.topic} className="stack" style={{ gap: 4 }}>
                    <div className="bar-row"><span title={tp.topic} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tp.topic}</span><Bar value={tp.accuracy} warn={tp.accuracy < 0.6} /><span className="faint">{num(Math.round(tp.accuracy * 100))}%</span></div>
                    {tp.reasons.length > 0 && <span className="faint">{t('progress.why', { reason: tp.reasons.join('; ') })}</span>}
                    <div className="row">
                      <span className="faint">{t('progress.attempts')}: {tp.attempts}</span>
                      <button className="btn sm ghost" aria-pressed={overrides.pin.includes(tp.topic)} onClick={() => void saveOverrides({ ...overrides, pin: overrides.pin.includes(tp.topic) ? overrides.pin.filter((x) => x !== tp.topic) : [...overrides.pin, tp.topic] })}>📌 {t('progress.pin')}</button>
                      <button className="btn sm ghost" aria-pressed={overrides.exclude.includes(tp.topic)} onClick={() => void saveOverrides({ ...overrides, exclude: overrides.exclude.includes(tp.topic) ? overrides.exclude.filter((x) => x !== tp.topic) : [...overrides.exclude, tp.topic] })}>⊘ {t('progress.exclude')}</button>
                    </div>
                  </div>
                ))}
                {report.repeatedMistakes.length > 0 && <div><h3>{t('progress.repeatedMistakes')}</h3><ul>{report.repeatedMistakes.map((m) => <li key={m.tag}>{m.tag} × {m.count}</li>)}</ul></div>}
                {(report.timeManagement.slowTopics.length > 0 || report.timeManagement.rushedTopics.length > 0) && (
                  <div><h3>{t('progress.timeManagement')}</h3>
                    {report.timeManagement.slowTopics.length > 0 && <p className="muted">{t('progress.slow')}: {report.timeManagement.slowTopics.join(', ')}</p>}
                    {report.timeManagement.rushedTopics.length > 0 && <p className="muted">{t('progress.rushed')}: {report.timeManagement.rushedTopics.join(', ')}</p>}
                  </div>
                )}
              </div>
            )}
          </section>
          <section className="card stack">
            <div className="row between"><h2>{t('progress.plan')}</h2>
              <div className="row">
                <label className="faint" htmlFor="mpd">{t('progress.minutesPerDay')}</label>
                <input id="mpd" type="number" min={10} max={240} className="input" style={{ width: 90 }} value={overrides.minutesPerDay} onChange={(e) => setOverrides({ ...overrides, minutesPerDay: Number(e.target.value) })} onBlur={() => void saveOverrides(overrides)} />
                <select className="input" style={{ width: 'auto' }} aria-label={t('progress.days')} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 7, 14].map((d) => <option key={d} value={d}>{d} {t('progress.days')}</option>)}</select>
              </div>
            </div>
            {plan.length === 0 ? <p className="muted">{t('progress.noData')}</p> : (
              <ul className="list">
                {plan.map((p, i) => (
                  <li key={i} className="list-item">
                    <div><strong>{t('progress.day', { day: p.day })} · {p.topic}</strong><div className="faint">{t(`plan.activity.${p.activity}` as never)} · {t('progress.why', { reason: p.reason })}</div></div>
                    <span className="badge">{p.minutes} {t('common.minutes')}</span>
                  </li>
                ))}
              </ul>
            )}
            <span className="hint">{t('progress.overrideHint')}</span>
          </section>
        </div>
      )}
      {!user && <div className="alert info" style={{ marginBottom: 16 }}>{t('progress.signInNote')}</div>}
      <section className="card stack">
        <h2>{t('progress.gameStats')}</h2>
        <table className="table">
          <thead><tr><th>{t('nav.games')}</th><th>{t('games.highScore')}</th><th>{t('common.level')}</th><th>{t('games.stars')}</th><th>{t('games.accuracy')}</th></tr></thead>
          <tbody>
            {GAMES.map((g) => {
              const p = games[g.id];
              const tot = p ? progressTotals(p) : null;
              return (
                <tr key={g.id}><td>{g.icon} {g.title[locale]}</td><td>{num(p?.highScore ?? 0)}</td><td>{p?.unlockedLevel ?? 1}/{g.maxLevel}</td><td><Stars n={p ? Math.max(0, ...Object.values(p.stars)) : 0} /></td><td>{tot && tot.answered ? `${num(Math.round((tot.correct / tot.answered) * 100))}%` : '—'}</td></tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
