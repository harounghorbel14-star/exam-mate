import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { readJson, writeJson } from './store';

/** Mobile API client: bearer token kept in the OS keychain/keystore (expo-secure-store). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

const TOKEN_KEY = 'exammate.token';
let cachedBase: string | null = null;

export async function apiBase(): Promise<string> {
  cachedBase ??= await readJson<string>('exammate.apiUrl', (Constants.expoConfig?.extra as { defaultApiUrl?: string } | undefined)?.defaultApiUrl ?? 'http://localhost:4000');
  return cachedBase;
}
export async function setApiBase(url: string) {
  cachedBase = url.replace(/\/+$/, '');
  await writeJson('exammate.apiUrl', cachedBase);
}

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? SecureStore.setItemAsync(TOKEN_KEY, t) : SecureStore.deleteItemAsync(TOKEN_KEY));

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form as unknown as BodyInit;
  else if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body); }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(`${await apiBase()}/api${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, signal: ctrl.signal });
  } catch {
    throw new ApiError(0, 'network', 'Cannot reach the server');
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `HTTP ${res.status}`);
  return data as T;
}
