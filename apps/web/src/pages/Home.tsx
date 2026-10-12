import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAMES, todayKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { gameRepo } from '../lib/sync';
import { useOnline } from '../lib/online';
import { PageHead } from '../components/ui';

interface Summary { streakDays: number; today: { answered: number; correct: number }; exams: { count: number; averagePercent: number | null }; dueFlashcards: number }
interface PlanTask { day: number; topic: string; subject: string; minutes: number; activity: string; reason: string }

export default function Home() {
  const { t, num, locale } = useI18n();
  const { user } = useAuth();
  const online = useOnline();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [plan, setPlan] = useState<PlanTask[]>([]);
  const [recent, setRecent] = useState<Array<{ id: string; text: string; latest_solution: { answer: string } | null }>>([]);
  const [dailyDone, setDailyDone] = useState(false);

  useEffect(() => {
    if (!user || !online) return;
    api<Summary>('/progress/summary').then(setSummary).catch(() => undefined);
    api<{ plan: PlanTask[] }>('/progress/plan?days=1').then((r) => setPlan(r.plan.slice(0, 3))).catch(() => undefined);
    api<{ items: typeof recent }>('/questions?limit=5').then((r) => setRecent(r.items)).catch(() => undefined);
  }, [user, online]);
  useEffect(() => {
    void gameRepo.get('daily-challenge').then((p) => setDailyDone(!!p && new Date(p.updatedAt).toDateString() === new Date().toDateString()));
  }, []);

  const actions = [
    { to: '/scan', label: t('nav.scan'), icon: '◉' }, { to: '/solver', label: t('nav.solver'), icon: '∑' },
    { to: '/exams', label: t('exams.new'), icon: '✎' }, { to: '/flashcards', label: t('flash.study'), icon: '❏' },
    { to: '/tools', label: t('nav.tools'), icon: '⌗' }, { to: '/coach', label: t('nav.coach'), icon: '⏱' },
  ];
  return (
    <>
      <PageHead title={user ? t('home.greeting', { name: user.displayName }) : t('app.name')} subtitle={t('app.tagline')} />
      {user && summary && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <div className="card stat"><span className="value">{num(summary.streakDays)}</span><span className="label">{t('home.streak', { count: summary.streakDays })}</span></div>
          <div className="card stat"><span className="value">{num(summary.dueFlashcards)}</span><span className="label">{t('home.dueCards', { count: summary.dueFlashcards })}</span></div>
          <div className="card stat"><span className="value">{num(summary.today.answered)}</span><span className="label">{t('home.answeredToday')}</span></div>
          <div className="card stat"><span className="value">{summary.exams.averagePercent === null ? '—' : `${num(summary.exams.averagePercent)}%`}</span><span className="label">{t('home.examAverage')}</span></div>
        </div>
      )}
      <div className="grid cols-2">
        <section className="card glass stack">
          <h2>{t('home.quickActions')}</h2>
          <div className="grid cols-3">
            {actions.map((a) => <Link key={a.to + a.label} to={a.to} className="btn lg" style={{ justifyContent: 'flex-start' }}><span aria-hidden>{a.icon}</span>{a.label}</Link>)}
          </div>
        </section>
        <section className="card stack">
          <div className="row between"><h2>{t('home.dailyChallenge')}</h2><span className="badge success">{t('common.offlineReady')}</span></div>
          <p className="muted">{GAMES.find((g) => g.id === 'daily-challenge')!.description[locale]}</p>
          <p className="faint">{todayKey()}</p>
          <Link to="/games/daily-challenge" className="btn primary">{dailyDone ? t('home.playAgain') : t('common.start')}</Link>
        </section>
        {plan.length > 0 && (
          <section className="card stack">
            <h2>{t('home.recommended')}</h2>
            <ul className="list">{plan.map((p, i) => <li key={i} className="list-item"><div><strong>{p.topic}</strong><div className="faint">{t('progress.why', { reason: p.reason })}</div></div><span className="badge">{p.minutes} {t('common.minutes')}</span></li>)}</ul>
            <Link to="/progress" className="btn sm">{t('progress.plan')}</Link>
          </section>
        )}
        {recent.length > 0 && (
          <section className="card stack">
            <h2>{t('home.continue')}</h2>
            <ul className="list">{recent.map((q) => <li key={q.id} className="list-item"><span className="ltr" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text}</span><span className="faint ltr">{q.latest_solution?.answer?.slice(0, 40)}</span></li>)}</ul>
          </section>
        )}
        {!user && (
          <section className="card stack">
            <h2>{t('home.guestTitle')}</h2>
            <p className="muted">{t('home.guestBody')}</p>
            <div className="row"><Link className="btn primary" to="/register">{t('auth.register')}</Link><Link className="btn" to="/games">{t('nav.games')}</Link></div>
          </section>
        )}
      </div>
    </>
  );
}
