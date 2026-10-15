import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { ErrorState, Modal } from './ui';

interface Status { enabled: boolean; recoveryCodesRemaining: number }

/** Settings section: turn TOTP two-factor sign-in on or off and manage recovery codes. */
export function TwoFactorSection() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable' | 'regen'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string; svg: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Status>('/auth/mfa').then(setStatus).catch(() => setStatus(null));
  useEffect(() => { void load(); }, []);
  const reset = () => { setStep('idle'); setPassword(''); setCode(''); setSetup(null); setError(null); };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e); } finally { setBusy(false); } };

  const startSetup = () => run(async () => {
    const r = await api<{ secret: string; otpauthUri: string }>('/auth/mfa/setup', { method: 'POST', body: { password } });
    // The QR code is rendered locally from the otpauth URI; the secret never leaves this page.
    const svg = await QRCode.toString(r.otpauthUri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    setSetup({ ...r, svg }); setPassword(''); setStep('scan');
  });
  const confirm = () => run(async () => {
    const r = await api<{ recoveryCodes: string[] }>('/auth/mfa/enable', { method: 'POST', body: { code: code.replace(/\s/g, '') } });
    setCodes(r.recoveryCodes); setCode(''); setSetup(null); setStep('codes'); await load();
  });
  const disable = () => run(async () => {
    const c = code.trim();
    await api('/auth/mfa/disable', { method: 'POST', body: { password, ...(/^\d{6}$/.test(c.replace(/\s/g, '')) ? { code: c.replace(/\s/g, '') } : { recoveryCode: c }) } });
    reset(); await load();
  });
  const regenerate = () => run(async () => {
    const r = await api<{ recoveryCodes: string[] }>('/auth/mfa/recovery-codes', { method: 'POST', body: { code: code.replace(/\s/g, '') } });
    setCodes(r.recoveryCodes); setCode(''); setStep('codes'); await load();
  });
  const download = () => {
    const url = URL.createObjectURL(new Blob([`ExamMate AI recovery codes\n\n${codes.join('\n')}\n`], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = 'exammate-recovery-codes.txt'; a.click(); URL.revokeObjectURL(url);
  };

  if (!status) return null;
  const codeInput = (
    <div className="field"><label htmlFor="mfa-setup-code">{t('mfa.code')}</label>
      <input id="mfa-setup-code" className="input mono" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={7} /></div>
  );
  return (
    <section className="card stack" aria-labelledby="mfa-h">
      <div className="row between"><h2 id="mfa-h" style={{ margin: 0 }}>🔐 {t('mfa.title')}</h2><span className={`badge ${status.enabled ? 'success' : ''}`}>{status.enabled ? t('mfa.on') : t('mfa.off')}</span></div>
      <p className="muted" style={{ margin: 0 }}>{t('mfa.intro')}</p>
      {status.enabled ? (
        <>
          <p className="faint" style={{ margin: 0 }}>{t('mfa.remaining', { n: status.recoveryCodesRemaining })}</p>
          <div className="row">
            <button className="btn" onClick={() => setStep('regen')}>{t('mfa.regenerate')}</button>
            <button className="btn danger" onClick={() => setStep('disable')}>{t('mfa.disable')}</button>
          </div>
        </>
      ) : <button className="btn primary" onClick={() => setStep('password')}>{t('mfa.enable')}</button>}

      {step !== 'idle' && (
        <Modal title={t('mfa.title')} onClose={() => { if (step !== 'codes') reset(); }}>
          <div className="stack">
            {error !== null && <ErrorState error={error} />}
            {step === 'password' && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); void startSetup(); }}>
                <div className="field"><label htmlFor="mfa-pw">{t('mfa.confirmPassword')}</label><input id="mfa-pw" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <button className="btn primary" disabled={busy || !password}>{t('mfa.continue')}</button>
              </form>
            )}
            {step === 'scan' && setup && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
                <p>{t('mfa.scan')}</p>
                <div className="mfa-qr" role="img" aria-label="QR code" dangerouslySetInnerHTML={{ __html: setup.svg }} />
                <div className="field"><span className="faint">{t('mfa.manualKey')}</span><code className="mono ltr mfa-secret" data-testid="mfa-secret">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code></div>
                {codeInput}
                <button className="btn primary" disabled={busy || code.replace(/\s/g, '').length !== 6}>{t('mfa.verify')}</button>
              </form>
            )}
            {step === 'codes' && (
              <div className="stack">
                <h3 style={{ margin: 0 }}>{t('mfa.recoveryTitle')}</h3>
                <p className="muted" style={{ margin: 0 }}>{t('mfa.recoveryHelp')}</p>
                <ul className="mfa-codes ltr" data-testid="recovery-codes">{codes.map((c) => <li key={c} className="mono">{c}</li>)}</ul>
                <div className="row"><button className="btn" onClick={download}>⬇ {t('mfa.download')}</button><button className="btn primary" onClick={() => { setCodes([]); reset(); }}>{t('mfa.done')}</button></div>
              </div>
            )}
            {step === 'disable' && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); void disable(); }}>
                <div className="field"><label htmlFor="mfa-pw2">{t('mfa.confirmPassword')}</label><input id="mfa-pw2" type="password" className="input" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div className="field"><label htmlFor="mfa-setup-code">{t('mfa.code')} / {t('mfa.recoveryCode')}</label><input id="mfa-setup-code" className="input mono" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" /></div>
                <button className="btn danger" disabled={busy || !password || !code}>{t('mfa.disable')}</button>
              </form>
            )}
            {step === 'regen' && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); void regenerate(); }}>
                {codeInput}
                <button className="btn primary" disabled={busy || code.replace(/\s/g, '').length !== 6}>{t('mfa.regenerate')}</button>
              </form>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}
