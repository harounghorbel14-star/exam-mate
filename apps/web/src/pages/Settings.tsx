import { useEffect, useState } from 'react';
import { TwoFactorSection } from '../components/TwoFactor';
import { Link, useNavigate } from 'react-router-dom';
import { SUPPORTED_LOCALES, LOCALES, type Locale, type MessageKey } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { useOnline } from '../lib/online';
import { api } from '../lib/api';
import { speak, speechSynthesisSupported } from '../lib/speech';
import { ErrorState, Modal, PageHead } from '../components/ui';

interface MemoryItem { id: string; kind: string; key: string; value: string; source: 'user' | 'inferred'; expiresAt: string | null }
interface Usage { plan: 'free' | 'premium'; limits: { dailyAiRequests: number; maxDocuments: number; maxUploadMb: number; dailyExams: number }; usage: { aiRequests: number; exams: number; documents: number } }
interface AgentStatus { externalAiApis: boolean; localModel: { available: boolean; runtime: string; error?: string; modelName?: string }; classifier: { version: string }; capabilities: Record<string, unknown> }

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { user, logout } = useAuth();
  const { prefs, update } = usePrefs();
  const online = useOnline();
  const nav = useNavigate();
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [retention, setRetention] = useState('');
  const [usage, setUsage] = useState<Usage | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [hardware, setHardware] = useState<{ profile: string; recommendation: string; totalMemGb: number; cpus: number; gpu: string | false } | null>(null);
  const [checkout, setCheckout] = useState<{ sessionId: string; message: string } | null>(null);
  const [ack, setAck] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [newMem, setNewMem] = useState({ key: '', value: '' });
  const [saved, setSaved] = useState(false);

  const loadAccount = async () => {
    if (!user || !online) return;
    try {
      const [m, u] = await Promise.all([api<{ items: MemoryItem[]; retention: string }>('/account/memory'), api<Usage>('/account/usage')]);
      setMemory(m.items); setRetention(m.retention); setUsage(u);
    } catch (e) { setError(e); }
  };
  useEffect(() => { void loadAccount(); }, [user, online]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!online) return;
    api<AgentStatus>('/agent/status').then(setStatus).catch(() => undefined);
    if (user) api<{ hardware: NonNullable<typeof hardware> }>('/agent/hardware').then((r) => setHardware(r.hardware)).catch(() => undefined);
  }, [online, user]);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1200); };
  const changeLocale = (l: Locale) => { setLocale(l); if (user) void api('/account/profile', { method: 'PUT', body: { locale: l } }).catch(() => undefined); flash(); };

  const startCheckout = async () => {
    try { setCheckout(await api('/billing/checkout', { method: 'POST', body: { plan: 'premium' } })); setAck(false); } catch (e) { setError(e); }
  };
  const confirmCheckout = async () => {
    if (!checkout) return;
    try { await api('/billing/test/confirm', { method: 'POST', body: { sessionId: checkout.sessionId, acknowledgeTestMode: true } }); setCheckout(null); await loadAccount(); } catch (e) { setError(e); }
  };
  const exportData = async () => {
    try {
      const data = await api('/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'exammate-export.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e); }
  };
  const deleteAccount = async () => {
    try { await api('/account', { method: 'DELETE', body: { password } }); await logout(); localStorage.clear(); nav('/'); } catch (e) { setError(e); }
  };

  return (
    <>
      <PageHead title={t('settings.title')} actions={saved ? <span className="badge success" role="status">✓ {t('common.saved')}</span> : undefined} />
      {error !== null && <div style={{ marginBottom: 12 }}><ErrorState error={error} /></div>}
      <div className="grid cols-2">
        <section className="card stack">
          <h2>{t('settings.language')}</h2>
          <div className="chips">{SUPPORTED_LOCALES.map((l) => <button key={l} className="chip" aria-pressed={locale === l} onClick={() => changeLocale(l)}>{LOCALES[l].name}</button>)}</div>
          <h2>{t('settings.theme')}</h2>
          <div className="chips">{(['dark', 'light', 'system'] as const).map((th) => <button key={th} className="chip" aria-pressed={prefs.theme === th} onClick={() => { update({ theme: th }); flash(); }}>{t(`settings.theme.${th}`)}</button>)}</div>
          <h2>{t('settings.explanationStyle')}</h2>
          <div className="chips">{(['short', 'steps', 'simple', 'hint'] as const).map((s) => <button key={s} className="chip" aria-pressed={prefs.explanationStyle === s} onClick={() => { update({ explanationStyle: s }); flash(); }}>{t(`mode.${s}` as MessageKey)}</button>)}</div>
        </section>

        <section className="card stack">
          <h2>{t('settings.voice')}</h2>
          {speechSynthesisSupported() ? (
            <>
              <div className="field"><label htmlFor="rate">{t('settings.speechRate')}: {prefs.speechRate.toFixed(1)}×</label>
                <input id="rate" type="range" min={0.5} max={2} step={0.1} value={prefs.speechRate} onChange={(e) => update({ speechRate: Number(e.target.value) })} /></div>
              <button className="btn sm" onClick={() => speak(t('app.tagline'), locale, prefs.speechRate)}>🔊 {t('voice.speak')}</button>
            </>
          ) : <p className="muted">{t('voice.unsupported')}</p>}
          <p className="faint">{t('settings.micNote')}</p>
          <h2>{t('settings.assessmentMode')}</h2>
          <label className="row"><input type="checkbox" checked={prefs.assessmentMode} onChange={(e) => update({ assessmentMode: e.target.checked })} /> {t('settings.assessmentMode')}</label>
          <p className="faint">{t('settings.assessmentModeHelp')}</p>
        </section>

        {user && (
          <section className="card stack">
            <h2>{t('settings.memory')}</h2>
            <p className="faint">{t('settings.memoryHelp')}</p>
            <label className="row"><input type="checkbox" checked={prefs.memoryEnabled} onChange={(e) => { update({ memoryEnabled: e.target.checked }); setTimeout(() => void loadAccount(), 300); }} /> {t('settings.memoryEnabled')}</label>
            {retention && <p className="faint">{retention}</p>}
            <ul className="list">
              {memory.map((m) => (
                <li key={m.id} className="list-item">
                  <div><span className="badge">{m.kind}</span> <strong>{m.key}</strong>: {m.value} <span className="faint">({m.source === 'user' ? t('settings.memoryYou') : t('settings.memoryInferred')})</span></div>
                  <button className="btn sm danger" aria-label={`${t('common.delete')} ${m.key}`} onClick={async () => { await api(`/account/memory/${m.id}`, { method: 'DELETE' }); await loadAccount(); }}>✕</button>
                </li>
              ))}
            </ul>
            <form className="row" onSubmit={async (e) => { e.preventDefault(); await api('/account/memory', { method: 'PUT', body: { kind: 'preference', ...newMem } }); setNewMem({ key: '', value: '' }); await loadAccount(); }}>
              <input className="input" style={{ flex: 1 }} placeholder={t('settings.memoryKey')} value={newMem.key} onChange={(e) => setNewMem({ ...newMem, key: e.target.value })} required maxLength={120} />
              <input className="input" style={{ flex: 1 }} placeholder={t('settings.memoryValue')} value={newMem.value} onChange={(e) => setNewMem({ ...newMem, value: e.target.value })} required maxLength={500} />
              <button className="btn">{t('common.add')}</button>
            </form>
            <button className="btn danger" onClick={async () => { if (confirm(t('common.confirmDelete'))) { await api('/account/memory', { method: 'DELETE' }); await loadAccount(); } }}>{t('settings.memoryClear')}</button>
          </section>
        )}

        <section className="card stack">
          <h2>{t('agent.status')}</h2>
          <p><span className="badge success">✓</span> {t('agent.deterministic')}</p>
          <p className="faint">{t('agent.noExternal')}</p>
          {status && (status.localModel.available
            ? <p><span className="badge success">✓</span> {t('agent.localModel')}: {status.localModel.modelName ?? status.localModel.runtime}</p>
            : <p className="muted">{t('agent.noModel')}</p>)}
          {status && <p className="faint">{t('agent.classifierVersion')}: {status.classifier.version}</p>}
          {hardware && <p className="faint">{t('agent.hardware', { profile: hardware.profile, ram: hardware.totalMemGb, cpus: hardware.cpus })} — {hardware.recommendation}</p>}
        </section>

        {user && usage && (
          <section className="card stack">
            <h2>{t('settings.subscription')}</h2>
            <p><span className={`badge ${usage.plan === 'premium' ? 'success' : ''}`}>{t(usage.plan === 'premium' ? 'plan.premium' : 'plan.free')}</span></p>
            <p className="muted">{t('plan.usage', { used: usage.usage.aiRequests, limit: usage.limits.dailyAiRequests })}</p>
            <p className="faint">{t('plan.limitsLine', { docs: usage.limits.maxDocuments, mb: usage.limits.maxUploadMb, exams: usage.limits.dailyExams })}</p>
            {usage.plan === 'free'
              ? <button className="btn primary" onClick={() => void startCheckout()}>{t('plan.upgrade')}</button>
              : <button className="btn" onClick={async () => { await api('/billing/cancel', { method: 'POST', body: {} }); await loadAccount(); }}>{t('plan.cancel')}</button>}
            <span className="badge warning">{t('plan.testMode')}</span>
          </section>
        )}

        {user && <TwoFactorSection />}

        <section className="card stack">
          <h2>{t('settings.privacy')}</h2>
          {user ? (
            <>
              <button className="btn" onClick={() => void exportData()}>⬇ {t('settings.exportData')}</button>
              <button className="btn" onClick={() => void logout()}>{t('auth.logout')}</button>
              <button className="btn danger" onClick={() => setDeleting(true)}>{t('settings.deleteAccount')}</button>
            </>
          ) : <Link className="btn primary" to="/login">{t('auth.login')}</Link>}
          <button className="btn ghost" onClick={() => { if (confirm(t('settings.clearLocalConfirm'))) { localStorage.clear(); location.reload(); } }}>{t('settings.clearLocal')}</button>
        </section>
      </div>

      {checkout && (
        <Modal title={t('plan.upgrade')} onClose={() => setCheckout(null)}>
          <div className="stack">
            <div className="alert warning">{t('plan.testMode')}</div>
            <p>{checkout.message}</p>
            <label className="row"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> {t('plan.ackTest')}</label>
            <button className="btn primary" disabled={!ack} onClick={() => void confirmCheckout()}>{t('plan.confirm')}</button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title={t('settings.deleteAccount')} onClose={() => setDeleting(false)}>
          <div className="stack">
            <div className="alert danger">{t('settings.deleteAccountConfirm')}</div>
            <div className="field"><label htmlFor="pw">{t('auth.password')}</label><input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
            <button className="btn danger" disabled={!password} onClick={() => void deleteAccount()}>{t('settings.deleteAccount')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
