import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SolveMode } from '@exammate/core';
import { readJson, writeJson } from './kv';
import { api } from './api';
import { useAuth } from './auth';

export interface Prefs { theme: 'dark' | 'light' | 'system'; explanationStyle: SolveMode; speechRate: number; assessmentMode: boolean; memoryEnabled: boolean }
const DEFAULTS: Prefs = { theme: 'system', explanationStyle: 'steps', speechRate: 1, assessmentMode: false, memoryEnabled: true };

const Ctx = createContext<{ prefs: Prefs; update(p: Partial<Prefs>): void } | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULTS, ...readJson<Partial<Prefs>>('exammate.prefs', {}) }));

  // Server copy wins on login (remembered across devices).
  useEffect(() => {
    if (!user) return;
    api<{ preferences: Partial<Prefs> }>('/account/preferences').then((r) => setPrefs((p) => {
      const next = { ...p, ...r.preferences } as Prefs;
      writeJson('exammate.prefs', next);
      return next;
    })).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    const apply = () => {
      const theme = prefs.theme === 'system' ? (media?.matches ? 'light' : 'dark') : prefs.theme;
      document.documentElement.dataset.theme = theme;
    };
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [prefs.theme]);

  const update = (p: Partial<Prefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      writeJson('exammate.prefs', next);
      return next;
    });
    if (user) void api('/account/preferences', { method: 'PUT', body: p }).catch(() => undefined);
  };
  return <Ctx.Provider value={{ prefs, update }}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('PrefsProvider missing');
  return v;
}
