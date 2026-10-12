import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import NetInfo from '@react-native-community/netinfo';
import { translate, isLocale, dirOf, type Locale, type MessageKey } from '@exammate/core';
import { api, setToken, getToken } from './api';
import { readJson, writeJson } from './store';
import { syncAll } from './sync';

export interface User { id: string; email: string; displayName: string }

interface AppState {
  locale: Locale;
  setLocale(l: Locale): Promise<{ needsRestart: boolean }>;
  t: (k: MessageKey, p?: Record<string, string | number>) => string;
  user: User | null;
  online: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, name: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const device = Localization.getLocales()[0]?.languageCode ?? 'en';
  const [locale, setLocaleState] = useState<Locale>(isLocale(device) ? device : 'en');
  const [user, setUser] = useState<User | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    void readJson<string | null>('exammate.locale', null).then((l) => { if (isLocale(l)) setLocaleState(l); });
    void readJson<User | null>('exammate.user', null).then(setUser);
    void getToken().then((tok) => { if (tok) api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => undefined); });
    return NetInfo.addEventListener((s) => setOnline(!!s.isConnected && s.isInternetReachable !== false));
  }, []);

  // Sync offline progress whenever connectivity returns.
  useEffect(() => { if (online && user) void syncAll().catch(() => undefined); }, [online, user]);

  const value = useMemo<AppState>(() => ({
    locale, user, online,
    t: (k, p) => translate(locale, k, p),
    async setLocale(l) {
      setLocaleState(l);
      await writeJson('exammate.locale', l);
      const rtl = dirOf(l) === 'rtl';
      I18nManager.allowRTL(true);
      const needsRestart = I18nManager.isRTL !== rtl;
      I18nManager.forceRTL(rtl);
      if (user) void api('/account/profile', { method: 'PUT', body: { locale: l } }).catch(() => undefined);
      return { needsRestart };
    },
    async login(email, password) {
      const r = await api<{ user: User; token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      await setToken(r.token); await writeJson('exammate.user', r.user); setUser(r.user);
    },
    async register(email, password, displayName) {
      const r = await api<{ user: User; token: string }>('/auth/register', { method: 'POST', body: { email, password, displayName, locale } });
      await setToken(r.token); await writeJson('exammate.user', r.user); setUser(r.user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      await setToken(null); await writeJson('exammate.user', null); setUser(null);
    },
  }), [locale, user, online]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}
