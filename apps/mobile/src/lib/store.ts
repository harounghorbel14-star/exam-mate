import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameProgressRepository, type KeyValueStore } from '@exammate/core';

/** AsyncStorage-backed store for offline data (game progress, decks, queues). */
export const kv: KeyValueStore = {
  getItem: (k) => AsyncStorage.getItem(k),
  setItem: (k, v) => AsyncStorage.setItem(k, v),
  removeItem: (k) => AsyncStorage.removeItem(k),
};

export const gameRepo = new GameProgressRepository(kv);

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try { const v = await AsyncStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function deviceId(): Promise<string> {
  let id = await readJson<string | null>('exammate.device', null);
  if (!id) { id = `mobile-${Math.random().toString(36).slice(2, 10)}`; await writeJson('exammate.device', id); }
  return id;
}
