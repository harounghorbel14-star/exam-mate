import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="row" role="status"><span className="spinner" aria-hidden />{label && <span className="muted">{label}</span>}</span>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const e = error as ApiError;
  const msg = e?.code === 'account_locked' ? t('error.accountLocked') : e?.status === 0 ? t('error.network') : e?.status === 401 ? t('error.unauthorized') : e?.code === 'quota_exceeded' ? t('plan.limitReached') : e?.status === 429 ? t('error.rateLimited') : (e?.message || t('common.error'));
  return (
    <div className="alert danger" role="alert">
      <div style={{ flex: 1 }}>{msg}</div>
      {onRetry && <button className="btn sm" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <div className="card" style={{ textAlign: 'center', padding: 32 }}><p className="muted" style={{ margin: 0 }}>{children ?? t('common.empty')}</p></div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="row between" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>{title}</h2><button className="btn ghost icon-btn" aria-label="Close" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

/** Wraps features that need an account; offline features never use this. */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <Spinner />;
  if (!user) return (
    <div className="card stack" style={{ maxWidth: 520 }}>
      <p>{import.meta.env.VITE_DEMO ? t('demo.needsServer') : t('auth.signInToUse')}</p>
      {!import.meta.env.VITE_DEMO && <div className="row"><Link className="btn primary" to="/login">{t('auth.login')}</Link><Link className="btn" to="/register">{t('auth.register')}</Link></div>}
    </div>
  );
  return <>{children}</>;
}

export function Stars({ n }: { n: number }) {
  return <span className="stars" aria-label={`${n}/3`}>{'★'.repeat(n)}{'☆'.repeat(3 - n)}</span>;
}

export function Bar({ value, max = 1, warn }: { value: number; max?: number; warn?: boolean }) {
  return <div className={`progress${warn ? ' warn' : ''}`} role="progressbar" aria-valuenow={Math.round((value / max) * 100)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
}
