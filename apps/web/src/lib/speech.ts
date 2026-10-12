import { LOCALES, type Locale } from '@exammate/core/i18n/index';

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
}

/**
 * Start listening ONCE (no continuous recording). The browser asks for microphone permission;
 * recognition stops automatically after the user stops speaking or when stop() is called.
 */
export function listenOnce(locale: Locale, onText: (t: string) => void, onEnd: (error?: string) => void): () => void {
  const Ctor = ((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognition) | undefined;
  if (!Ctor) { onEnd('unsupported'); return () => undefined; }
  const rec = new Ctor();
  rec.lang = LOCALES[locale].speech;
  rec.interimResults = false;
  rec.continuous = false;
  rec.onresult = (e) => { const r = e.results[0]?.[0]; if (r) onText(r.transcript); };
  rec.onerror = (e) => onEnd(e.error);
  rec.onend = () => onEnd();
  rec.start();
  return () => rec.abort();
}

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, locale: Locale, rate = 1): void {
  if (!speechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALES[locale].speech;
  u.rate = rate;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(LOCALES[locale].speech.slice(0, 2)));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
