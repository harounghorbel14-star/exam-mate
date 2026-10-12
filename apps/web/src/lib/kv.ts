import type { KeyValueStore } from '@exammate/core/games/engine';

/** localStorage-backed store; failures (private mode, quota) degrade to in-memory. */
export class LocalStore implements KeyValueStore {
  private mem = new Map<string, string>();
  async getItem(k: string) {
    try { return localStorage.getItem(k) ?? this.mem.get(k) ?? null; } catch { return this.mem.get(k) ?? null; }
  }
  async setItem(k: string, v: string) {
    this.mem.set(k, v);
    try { localStorage.setItem(k, v); } catch { /* keep in memory */ }
  }
  async removeItem(k: string) {
    this.mem.delete(k);
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

export const store = new LocalStore();

export function readJson<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function deviceId(): string {
  let id = readJson<string | null>('exammate.device', null);
  if (!id) { id = `web-${Math.random().toString(36).slice(2, 10)}`; writeJson('exammate.device', id); }
  return id;
}
