/** Typed fetch wrapper: same-origin cookies + CSRF header, structured errors, cancellation. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

const BASE = import.meta.env.VITE_API_URL ?? '';

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-exammate-client': '1' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body); }
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'include', signal: opts.signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'network', 'Cannot reach the server');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'error', err.message ?? res.statusText, err.details);
  }
  return data as T;
}

export const get = <T,>(p: string, signal?: AbortSignal) => api<T>(p, { signal });
export const post = <T,>(p: string, body?: unknown, signal?: AbortSignal) => api<T>(p, { method: 'POST', body: body ?? {}, signal });
export const put = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PUT', body: body ?? {} });
export const patch = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body: body ?? {} });
export const del = <T,>(p: string, body?: unknown) => api<T>(p, { method: 'DELETE', body });
