import { NavLink, Outlet, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { useOnline } from '../lib/online';
import { pendingCount, syncAll } from '../lib/sync';

export const NAV: Array<{ to: string; key: MessageKey; icon: string; mobile?: boolean }> = [
  { to: '/', key: 'nav.home', icon: '⌂', mobile: true },
  { to: '/scan', key: 'nav.scan', icon: '◉', mobile: true },
  { to: '/solver', key: 'nav.solver', icon: '∑', mobile: true },
  { to: '/documents', key: 'nav.documents', icon: '▤' },
  { to: '/exams', key: 'nav.exams', icon: '✎' },
  { to: '/games', key: 'nav.games', icon: '◆', mobile: true },
  { to: '/arcade', key: 'nav.arcade', icon: '🕹' },
  { to: '/flashcards', key: 'nav.flashcards', icon: '❏' },
  { to: '/progress', key: 'nav.progress', icon: '↗' },
  { to: '/settings', key: 'nav.settings', icon: '⚙', mobile: true },
];
const EXTRA: Array<{ to: string; key: MessageKey; icon: string }> = [
  { to: '/tools', key: 'nav.tools', icon: '⌗' },
  { to: '/coach', key: 'nav.coach', icon: '⏱' },
];

export function Layout() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const { prefs, update } = usePrefs();
  const online = useOnline();
  const [pending, setPending] = useState(pendingCount());

  // Sync offline changes whenever we come back online.
  useEffect(() => {
    if (!online || !user) return;
    syncAll().catch(() => undefined).finally(() => setPending(pendingCount()));
  }, [online, user]);
  useEffect(() => { const i = setInterval(() => setPending(pendingCount()), 5000); return () => clearInterval(i); }, []);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">{t('a11y.skipToContent')}</a>
      <nav className="sidebar" aria-label={t('a11y.menu')}>
        <Link to="/" className="brand"><img src="/icon.svg" alt="" />{t('app.name')}</Link>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden>{n.icon}</span>{t(n.key)}
          </NavLink>
        ))}
        <div className="nav-sep" />
        {EXTRA.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon" aria-hidden>{n.icon}</span>{t(n.key)}
          </NavLink>
        ))}
      </nav>
      <div className="main">
        <header className="topbar">
          {!online && <span className="badge warning" role="status">● {t('common.offline')}</span>}
          {pending > 0 && <span className="badge info" role="status">{t('sync.pending', { count: pending })}</span>}
          {prefs.assessmentMode && <span className="badge danger">{t('settings.assessmentMode')}</span>}
          <span className="spacer" />
          <Link to="/tools" className="btn ghost sm hide-desktop" aria-label={t('nav.tools')}>⌗</Link>
          <select className="input" style={{ width: 'auto', minHeight: 34 }} aria-label={t('settings.language')} value={locale} onChange={(e) => setLocale(e.target.value as typeof locale)}>
            <option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option>
          </select>
          <button className="btn ghost icon-btn" aria-label={t('a11y.toggleTheme')} onClick={() => update({ theme: document.documentElement.dataset.theme === 'light' ? 'dark' : 'light' })}>◐</button>
          {user ? <Link to="/settings" className="btn sm">{user.displayName}</Link> : !import.meta.env.VITE_DEMO && <Link to="/login" className="btn sm primary">{t('auth.login')}</Link>}
        </header>
        {import.meta.env.VITE_DEMO && <div className="content" style={{ paddingBottom: 0 }}><div className="alert info" role="status">{t('demo.banner')}</div></div>}
        {!online && <div className="content" style={{ paddingBottom: 0 }}><div className="alert warning" role="status">{t('offline.banner')}</div></div>}
        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav" aria-label={t('a11y.menu')}>
        {NAV.filter((n) => n.mobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="nav-icon" aria-hidden>{n.icon}</span>{t(n.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
