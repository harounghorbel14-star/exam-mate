import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, dirOf, isLocale, formatLocalNumber, formatLocalDate, type Locale, type MessageKey } from '@exammate/core/i18n/index';
import { readJson, writeJson } from './kv';

interface I18n { locale: Locale; dir: 'ltr' | 'rtl'; t: (k: MessageKey, p?: Record<string, string | number>) => string; setLocale: (l: Locale) => void; num: (n: number, o?: Intl.NumberFormatOptions) => string; date: (d: Date | number | string) => string }

const Ctx = createContext<I18n | null>(null);

function initialLocale(): Locale {
  const saved = readJson<string | null>('exammate.locale', null);
  if (isLocale(saved)) return saved;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').slice(0, 2);
  return isLocale(nav) ? nav : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const dir = dirOf(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  const setLocale = useCallback((l: Locale) => { setLocaleState(l); writeJson('exammate.locale', l); }, []);
  const value = useMemo<I18n>(() => ({
    locale, dir, setLocale,
    t: (k, p) => translate(locale, k, p),
    num: (n, o) => formatLocalNumber(locale, n, o),
    date: (d) => formatLocalDate(locale, typeof d === 'string' ? new Date(d) : d),
  }), [locale, dir, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('I18nProvider missing');
  return v;
}
