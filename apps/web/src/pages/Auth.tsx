import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { ErrorState } from '../components/ui';

type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export default function AuthPages({ mode }: { mode: Mode }) {
  const { t, locale } = useI18n();
  const auth = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const token = params.get('token') ?? '';

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    api('/auth/verify-email', { method: 'POST', body: { token } }).then(() => setDone(t('auth.verified'))).catch(setError);
  }, [mode, token, t]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (mode === 'login') { await auth.login(email, password); nav('/'); }
      else if (mode === 'register') { await auth.register(email, password, name, locale); nav('/onboarding'); }
      else if (mode === 'forgot') { await api('/auth/request-password-reset', { method: 'POST', body: { email } }); setDone(t('auth.resetSent')); }
      else if (mode === 'reset') { await api('/auth/reset-password', { method: 'POST', body: { token, password } }); setDone(t('common.saved')); setTimeout(() => nav('/login'), 800); }
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  const title = mode === 'login' ? t('auth.login') : mode === 'register' ? t('auth.register') : mode === 'verify' ? t('auth.verifyEmail') : t('auth.reset');
  return (
    <div style={{ maxWidth: 440, margin: '24px auto' }}>
      <div className="card glass stack">
        <h1>{title}</h1>
        {done && <div className="alert success" role="status">{done}</div>}
        {error !== null && <ErrorState error={error} />}
        {mode !== 'verify' && !done && (
          <form className="stack" onSubmit={submit}>
            {mode === 'register' && <div className="field"><label htmlFor="name">{t('auth.name')}</label><input id="name" className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></div>}
            {mode !== 'reset' && <div className="field"><label htmlFor="email">{t('auth.email')}</label><input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>}
            {mode !== 'forgot' && (
              <div className="field">
                <label htmlFor="password">{mode === 'reset' ? t('auth.newPassword') : t('auth.password')}</label>
                <input id="password" className="input" type="password" required minLength={mode === 'login' ? 1 : 10} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                {mode !== 'login' && <span className="hint">{t('auth.passwordHint')}</span>}
              </div>
            )}
            <button className="btn primary block" disabled={busy}>{busy ? t('common.loading') : title}</button>
          </form>
        )}
        {mode === 'login' && <div className="row between"><Link to="/forgot">{t('auth.forgot')}</Link><Link to="/register">{t('auth.noAccount')} {t('auth.register')}</Link></div>}
        {mode === 'register' && <Link to="/login">{t('auth.haveAccount')} {t('auth.login')}</Link>}
        {(mode === 'login' || mode === 'register') && (
          <button className="btn ghost" onClick={() => { auth.continueAsGuest(); nav('/games'); }}>{t('auth.guest')}</button>
        )}
      </div>
    </div>
  );
}
