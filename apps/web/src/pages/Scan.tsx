import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { splitQuestions, solveLocally } from '@exammate/core';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/auth';
import { useOnline } from '../lib/online';
import { usePrefs } from '../lib/prefs';
import { api, ApiError } from '../lib/api';
import { ErrorState, PageHead, Spinner } from '../components/ui';
import { SolutionView, type ServerSolve } from '../components/SolutionView';

type Rect = { x: number; y: number; w: number; h: number };
const OCR_LANGS: Record<string, string> = { en: 'eng', fr: 'fra+eng', ar: 'ara+eng' };

/** In-browser OCR fallback with assets served from our own origin (/ocr), usable offline once cached. */
async function browserOcr(blob: Blob, langs: string): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js');
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, document.baseURI).href;
  const worker = await createWorker(langs.split('+'), 1, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base, gzip: true, workerBlobURL: false } as never);
  try {
    const { data } = await worker.recognize(blob);
    return { text: data.text.trim(), confidence: Math.round(data.confidence) };
  } finally {
    await worker.terminate();
  }
}

export default function Scan() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const online = useOnline();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [solutions, setSolutions] = useState<Record<number, ServerSolve>>({});
  const questions = useMemo(() => splitQuestions(text), [text]);

  useEffect(() => () => stream?.getTracks().forEach((tr) => tr.stop()), [stream]);

  // Draw the current image and crop rectangle.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !image) return;
    c.width = image.width; c.height = image.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    if (crop) {
      ctx.fillStyle = 'rgba(2,6,23,0.55)';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = '#5b8cff'; ctx.lineWidth = Math.max(2, c.width / 300);
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    }
  }, [image, crop]);

  const openCamera = async () => {
    setError(null);
    try {
      // Explicit user action triggers the permission prompt; the stream stops after capture.
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
      setStream(s);
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play(); } }, 0);
    } catch (e) { setError(new Error(`${t('scan.cameraDenied')} (${(e as Error).name})`)); }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    stream?.getTracks().forEach((tr) => tr.stop());
    setStream(null); setImage(c); setCrop(null); setText(''); setSolutions({});
  };

  const importFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setError(new Error(t('scan.unsupportedImage'))); return; }
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      setImage(c); setCrop(null); setText(''); setSolutions({}); setError(null);
    };
    img.src = URL.createObjectURL(f);
  };

  const rotate = () => {
    if (!image) return;
    const c = document.createElement('canvas');
    c.width = image.height; c.height = image.width;
    const ctx = c.getContext('2d')!;
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(image, -image.width / 2, -image.height / 2);
    setImage(c); setCrop(null);
  };

  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };

  const croppedBlob = async (): Promise<Blob> => {
    const src = image!;
    const c = document.createElement('canvas');
    const r = crop && crop.w > 10 && crop.h > 10 ? crop : { x: 0, y: 0, w: src.width, h: src.height };
    c.width = r.w; c.height = r.h;
    c.getContext('2d')!.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
  };

  const recognize = async () => {
    if (!image) return;
    setBusy(true); setError(null);
    try {
      const blob = await croppedBlob();
      if (online && user) {
        try {
          const form = new FormData();
          form.append('image', blob, 'scan.png');
          form.append('langs', OCR_LANGS[locale]!.replace('+', ','));
          const r = await api<{ text: string; confidence: number }>('/scan', { form });
          setText(r.text); setConfidence(r.confidence);
          return;
        } catch (e) {
          if (!(e instanceof ApiError) || (e.status !== 0 && e.status !== 503)) throw e;
        }
      }
      const r = await browserOcr(blob, OCR_LANGS[locale]!);
      setText(r.text); setConfidence(r.confidence);
    } catch (e) {
      setError(e instanceof ApiError ? e : new Error(t('scan.ocrUnavailable')));
    } finally {
      setBusy(false);
    }
  };

  const solveOne = async (i: number, q: string) => {
    let res: ServerSolve;
    if (online && user) {
      try { res = await api<ServerSolve>('/solve', { method: 'POST', body: { question: q, locale, source: 'scan', mode: prefs.explanationStyle } }); }
      catch (e) { if (e instanceof ApiError && e.status !== 0) { setError(e); return; } res = { ...solveLocally(q, { locale }), engine: 'on-device' }; }
    } else res = { ...solveLocally(q, { locale, mode: prefs.explanationStyle }), engine: 'on-device' };
    setSolutions((s) => ({ ...s, [i]: res }));
  };

  if (prefs.assessmentMode) return (<><PageHead title={t('scan.title')} /><div className="alert warning">{t('settings.assessmentModeHelp')}</div></>);

  return (
    <>
      <PageHead title={t('scan.title')} subtitle={online && user ? t('scan.serverOcr') : t('scan.offlineOcr')} />
      <div className="card glass stack">
        <div className="row">
          <button className="btn primary" onClick={() => void openCamera()} disabled={!!stream}>📷 {t('scan.capture')}</button>
          <label className="btn">🖼 {t('scan.import')}<input type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={(e) => importFile(e.target.files?.[0])} /></label>
          {image && <button className="btn" onClick={rotate}>⟳ {t('scan.rotate')}</button>}
          {image && crop && <button className="btn ghost" onClick={() => setCrop(null)}>{t('scan.resetCrop')}</button>}
        </div>
        {stream && (
          <div className="stack">
            <video ref={videoRef} playsInline muted style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }} aria-label={t('scan.capture')} />
            <div className="row"><button className="btn primary" onClick={capture}>{t('scan.takePhoto')}</button><button className="btn" onClick={() => { stream.getTracks().forEach((tr) => tr.stop()); setStream(null); }}>{t('common.cancel')}</button></div>
          </div>
        )}
        {image && (
          <div className="stack">
            <p className="faint">{t('scan.cropHelp')}</p>
            <canvas ref={canvasRef} style={{ width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12, touchAction: 'none', cursor: 'crosshair', background: 'var(--bg-elev)' }}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); const p = toCanvasPoint(e); setDrag(p); setCrop({ x: p.x, y: p.y, w: 0, h: 0 }); }}
              onPointerMove={(e) => { if (!drag) return; const p = toCanvasPoint(e); setCrop({ x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }); }}
              onPointerUp={() => setDrag(null)} role="img" aria-label={t('scan.crop')} />
            <div className="row"><button className="btn primary lg" onClick={() => void recognize()} disabled={busy}>{busy ? t('scan.recognizing') : t('scan.recognize')}</button>{busy && <Spinner />}</div>
          </div>
        )}
        {!image && !stream && <p className="muted">{t('scan.intro')}</p>}
      </div>

      {error !== null && <div style={{ marginTop: 12 }}><ErrorState error={error} /></div>}

      {(text || image) && (
        <div className="card stack" style={{ marginTop: 16 }}>
          <div className="row between"><h2>{t('scan.extracted')}</h2>{confidence !== null && <span className={`badge ${confidence >= 80 ? 'success' : 'warning'}`}>{t('scan.ocrConfidence', { value: confidence })}</span>}</div>
          <textarea className="input mono" dir="auto" value={text} onChange={(e) => { setText(e.target.value); setSolutions({}); }} placeholder={t('scan.typeInstead')} />
          <p className="faint">{t('scan.diagramNote')}</p>
          {questions.length > 0 && (
            <>
              <div className="row between"><strong>{t('scan.questionsFound', { count: questions.length })}</strong>
                <button className="btn primary" onClick={() => questions.forEach((q, i) => void solveOne(i, q.text))}>{t('scan.solveAll')}</button></div>
              <ul className="list">
                {questions.map((q, i) => (
                  <li key={i} className="stack card">
                    <div className="row between"><span className="ltr mono">{q.index}. {q.text}</span><span className="badge">{q.type}</span></div>
                    {q.choices && <ol type="A">{q.choices.map((c, j) => <li key={j}>{c}</li>)}</ol>}
                    <div className="row"><button className="btn sm" onClick={() => void solveOne(i, q.text)}>{t('solver.solve')}</button><button className="btn sm ghost" onClick={() => nav(`/solver?q=${encodeURIComponent(q.text)}`)}>{t('scan.openInSolver')}</button></div>
                    {solutions[i] && <SolutionView data={solutions[i]!} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </>
  );
}
