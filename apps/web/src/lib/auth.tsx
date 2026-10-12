import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';

export interface User { id: string; email: string; displayName: string; emailVerified: boolean; role?: string }
interface AuthState {
  user: User | null;
  loading: boolean;
  guest: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string, locale: string): Promise<void>;
  logout(): Promise<void>;
  continueAsGuest(): void;
  refresh(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(() => { try { return sessionStorage.getItem('exammate.guest') === '1'; } catch { return false; } });

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: User }>('/auth/me');
      setUser(r.user);
    } catch (e) {
      // Offline: keep the cached identity so local features still show the user's name.
      if (e instanceof ApiError && e.status === 0) {
        try { const cached = localStorage.getItem('exammate.user'); if (cached) setUser(JSON.parse(cached)); } catch { /* ignore */ }
      } else setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { try { if (user) localStorage.setItem('exammate.user', JSON.stringify(user)); } catch { /* ignore */ } }, [user]);

  const value: AuthState = {
    user, loading, guest, refresh,
    async login(email, password) {
      const r = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      setUser(r.user);
    },
    async register(email, password, displayName, locale) {
      const r = await api<{ user: User }>('/auth/register', { method: 'POST', body: { email, password, displayName, locale } });
      setUser(r.user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      try { localStorage.removeItem('exammate.user'); } catch { /* ignore */ }
      setUser(null);
    },
    continueAsGuest() {
      try { sessionStorage.setItem('exammate.guest', '1'); } catch { /* ignore */ }
      setGuest(true);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
