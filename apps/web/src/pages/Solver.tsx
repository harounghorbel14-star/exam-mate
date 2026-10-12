import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { solveLocally, type Locale, type MessageKey, type SolveMode } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { usePrefs } from '../lib/prefs';
import { useOnline } from '../lib/online';
import { api, ApiError } from '../lib/api';
import { listenOnce, speechRecognitionSupported } from '../lib/speech';
import { ErrorState, PageHead, Spinner } from '../components/ui';
import { SolutionView, type ServerSolve } from '../components/SolutionView';

const MODES: Array<{ id: SolveMode; key: MessageKey }> = [
  { id: 'short', key: 'mode.short' }, { id: 'steps', key: 'mode.steps' }, { id: 'simple', key: 'mode.simple' }, { id: 'hint', key: 'mode.hint' },
  { id: 'check', key: 'mode.check' }, { id: 'translate', key: 'mode.translate' }, { id: 'similar', key: 'mode.similar' },
];

export default function Solver() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { prefs, update } = usePrefs();
  const online = useOnline();
  const [params] = useSearchParams();
  const [question, setQuestion] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<SolveMode>(prefs.explanationStyle);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [target, setTarget] = useState<Locale>(locale === 'en' ? 'fr' : 'en');
  const [result, setResult] = useState<ServerSolve | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [save, setSave] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const useServer = online && !!user;

  const chooseMode = (m: SolveMode) => { setMode(m); if (['short', 'steps', 'simple', 'hint'].includes(m)) update({ explanationStyle: m }); };

  const solve = useCallback(async () => {
    if (!question.trim() || prefs.assessmentMode) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true); setError(null); setResult(null);
    try {
      if (useServer) {
        const r = await api<ServerSolve>('/solve', { method: 'POST', body: { question, mode, locale, studentAnswer: mode === 'check' ? studentAnswer : undefined, targetLocale: mode === 'translate' ? target : undefined, save }, signal: ac.signal });
        setResult(r);
      } else {
        // On-device deterministic engine (works offline and without an account).
        const t0 = performance.now();
        const r = solveLocally(question, { mode, locale, studentAnswer });
        setResult({ ...r, engine: 'on-device', latencyMs: performance.now() - t0 });
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (e instanceof ApiError && e.status === 0) {
        const r = solveLocally(question, { mode, locale, studentAnswer });
        setResult({ ...r, engine: 'on-device' });
      } else setError(e);
    } finally {
      setBusy(false);
    }
  }, [question, mode, locale, studentAnswer, target, save, useServer, prefs.assessmentMode]);

  // Keyboard shortcuts: Ctrl/⌘+Enter solve, Alt+1…7 switch mode, "/" focus, Esc cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void solve(); }
      else if (e.altKey && /^[1-7]$/.test(e.key)) { e.preventDefault(); chooseMode(MODES[Number(e.key) - 1]!.id); }
      else if (e.key === '/' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus(); }
      else if (e.key === 'Escape' && busy) abortRef.current?.abort();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => { abortRef.current?.abort(); stopListenRef.current?.(); }, []);

  const toggleVoice = () => {
    if (listening) { stopListenRef.current?.(); setListening(false); return; }
    setListening(true);
    stopListenRef.current = listenOnce(locale, (txt) => setQuestion((q) => (q ? `${q} ${txt}` : txt)), (err) => { setListening(false); if (err === 'unsupported') setError(new Error(t('voice.unsupported'))); });
  };

  if (prefs.assessmentMode) {
    return (<><PageHead title={t('solver.title')} /><div className="alert warning">{t('settings.assessmentModeHelp')}</div></>);
  }

  return (
    <>
      <PageHead title={t('solver.title')} subtitle={useServer ? t('solver.serverEngine') : t('solver.offlineEngine')} />
      <div className="card glass stack">
        <div className="chips" role="radiogroup" aria-label={t('settings.explanationStyle')}>
          {MODES.map((m, i) => <button key={m.id} role="radio" aria-checked={mode === m.id} className={`chip${mode === m.id ? " active" : ""}`} onClick={() => chooseMode(m.id)} title={`Alt+${i + 1}`}>{t(m.key)}</button>)}
        </div>
        <label htmlFor="q" className="sr-only">{t('solver.placeholder')}</label>
        <textarea id="q" ref={inputRef} className="input" dir="auto" placeholder={t('solver.placeholder')} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={4000} style={{ fontSize: '1.05rem' }} />
        {mode === 'check' && <div className="field"><label htmlFor="sa">{t('solver.yourAnswer')}</label><input id="sa" className="input" dir="auto" value={studentAnswer} onChange={(e) => setStudentAnswer(e.target.value)} /></div>}
        {mode === 'translate' && (
          <div className="field"><label htmlFor="tl">{t('solver.targetLanguage')}</label>
            <select id="tl" className="input" value={target} onChange={(e) => setTarget(e.target.value as Locale)}><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option></select></div>
        )}
        <div className="row between">
          <div className="row">
            <button className="btn primary lg" onClick={() => void solve()} disabled={busy || !question.trim()}>{busy ? t('solver.solving') : t('solver.solve')}</button>
            {busy && <button className="btn" onClick={() => abortRef.current?.abort()}>{t('common.cancel')}</button>}
            {speechRecognitionSupported() && <button className={`btn${listening ? ' danger' : ''}`} aria-pressed={listening} onClick={toggleVoice}>🎙 {listening ? t('voice.stop') : t('voice.start')}</button>}
            {useServer && <label className="row faint"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> {t('solver.saveQuestion')}</label>}
          </div>
          <span className="faint">{t('solver.shortcut')}</span>
        </div>
        {listening && <div className="alert info" role="status">{t('voice.listening')}</div>}
      </div>
      <div style={{ marginTop: 16 }}>
        {busy && <Spinner label={t('solver.solving')} />}
        {error !== null && <ErrorState error={error} onRetry={() => void solve()} />}
        {result && <SolutionView data={result} />}
      </div>
    </>
  );
}
