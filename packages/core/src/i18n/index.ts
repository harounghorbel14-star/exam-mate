import { en, type MessageKey } from './en.js';
import { fr } from './fr.js';
import { ar } from './ar.js';

export type Locale = 'en' | 'fr' | 'ar';
export type { MessageKey };

/** Registry of locales. To add a language: create a dictionary typed Record<MessageKey,string> and register it here. */
export const LOCALES: Record<Locale, { name: string; dir: 'ltr' | 'rtl'; messages: Record<MessageKey, string>; speech: string }> = {
  en: { name: 'English', dir: 'ltr', messages: en, speech: 'en-US' },
  fr: { name: 'Français', dir: 'ltr', messages: fr, speech: 'fr-FR' },
  ar: { name: 'العربية', dir: 'rtl', messages: ar, speech: 'ar-SA' },
};

export const SUPPORTED_LOCALES = Object.keys(LOCALES) as Locale[];

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && x in LOCALES;
}

export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const template = LOCALES[locale]?.messages[key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (params[k] !== undefined ? formatParam(locale, params[k]!) : `{${k}}`));
}

function formatParam(locale: Locale, v: string | number): string {
  return typeof v === 'number' ? formatLocalNumber(locale, v) : v;
}

export function dirOf(locale: Locale): 'ltr' | 'rtl' {
  return LOCALES[locale].dir;
}

/** Localised number formatting. Arabic UI uses Western digits by default (common in Maghreb schools) unless requested. */
export function formatLocalNumber(locale: Locale, n: number, opts: Intl.NumberFormatOptions = {}, arabicIndic = false): string {
  const tag = locale === 'ar' ? (arabicIndic ? 'ar-EG' : 'ar-u-nu-latn') : locale;
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 6, ...opts }).format(n);
}

export function formatLocalDate(locale: Locale, d: Date | number, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const tag = locale === 'ar' ? 'ar-u-nu-latn' : locale;
  return new Intl.DateTimeFormat(tag, opts).format(d);
}

/** Wrap mathematical text in Unicode LTR isolates so it renders correctly inside RTL paragraphs. */
export function ltrIsolate(s: string): string {
  return `⁦${s}⁩`;
}

export interface LocalizedText { en: string; fr: string; ar: string }

export function pick(t: LocalizedText | string, locale: Locale): string {
  return typeof t === 'string' ? t : t[locale] || t.en;
}

/** Very small script-based language detector used for OCR language selection and routing. */
export function detectLanguage(text: string): Locale {
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (arabic > latin * 0.5 && arabic > 0) return 'ar';
  const lower = ` ${text.toLowerCase()} `;
  const frHits = [' le ', ' la ', ' les ', ' des ', ' est ', ' une ', ' du ', ' et ', ' que ', ' quelle', ' calculer', 'é', 'è', 'à', 'ç', ' combien'].filter((w) => lower.includes(w)).length;
  const enHits = [' the ', ' is ', ' what ', ' of ', ' and ', ' find ', ' calculate', ' which ', ' how '].filter((w) => lower.includes(w)).length;
  return frHits > enHits ? 'fr' : 'en';
}
