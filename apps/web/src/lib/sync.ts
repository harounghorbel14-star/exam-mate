import { GameProgressRepository } from '@exammate/core/games/engine';
import { mergeGameProgress, type GameProgressRecord } from '@exammate/core/sync/merge';
import { ArcadeRepository } from '@exammate/core/arcade/stats';
import type { ArcadeStatsRecord } from '@exammate/core/arcade/stats';
import { store, readJson, writeJson, deviceId } from './kv';
import { api } from './api';

export const gameRepo = new GameProgressRepository(store);

/** Push locally changed game progress and pull the merged server state (conflict-free merge in core). */
export async function syncGameProgress(): Promise<{ pushed: number; pulled: number }> {
  const all = await gameRepo.all();
  const dirty = await gameRepo.dirty();
  const records = dirty.map((id) => all[id]).filter(Boolean) as GameProgressRecord[];
  const res = await api<{ progress: GameProgressRecord[] }>('/progress/games/sync', { method: 'POST', body: { records } });
  let pulled = 0;
  for (const remote of res.progress) {
    const local = all[remote.gameId];
    const merged = local ? mergeGameProgress(local, remote) : remote;
    await gameRepo.save(merged, false);
    pulled++;
  }
  await gameRepo.clearDirty(dirty);
  return { pushed: records.length, pulled };
}

// Offline queues for flashcard reviews and practice records.
const REVIEW_QUEUE = 'exammate.queue.reviews';
const PRACTICE_QUEUE = 'exammate.queue.practice';

export interface QueuedReview { cardId: string; rating: 'again' | 'hard' | 'good' | 'easy'; at: number; elapsedMs?: number }
export interface QueuedPractice { subject: string; topic: string; correct: boolean; timeSpent: number; expectedTime?: number; source: string; at: number }

export function queueReview(r: QueuedReview) { writeJson(REVIEW_QUEUE, [...readJson<QueuedReview[]>(REVIEW_QUEUE, []), r]); }
export function queuePractice(r: QueuedPractice[]) { writeJson(PRACTICE_QUEUE, [...readJson<QueuedPractice[]>(PRACTICE_QUEUE, []), ...r].slice(-2000)); }
export function pendingCount(): number { return readJson<unknown[]>(REVIEW_QUEUE, []).length + readJson<unknown[]>(PRACTICE_QUEUE, []).length; }

export async function flushQueues(): Promise<void> {
  const reviews = readJson<QueuedReview[]>(REVIEW_QUEUE, []);
  if (reviews.length) { await api('/flashcards/sync', { method: 'POST', body: { reviews } }); writeJson(REVIEW_QUEUE, []); }
  const practice = readJson<QueuedPractice[]>(PRACTICE_QUEUE, []);
  if (practice.length) { await api('/progress/practice', { method: 'POST', body: { records: practice } }); writeJson(PRACTICE_QUEUE, []); }
}

/** Arcade stats sync: optional (only when signed in and online); the arcade never waits for it. */
export async function syncArcade(): Promise<number> {
  const repo = new ArcadeRepository(store, deviceId());
  const all = await repo.allStats();
  const dirty = await repo.dirty();
  const records = dirty.map((id) => all[id]).filter(Boolean) as ArcadeStatsRecord[];
  const res = await api<{ progress: unknown[] }>('/progress/arcade/sync', { method: 'POST', body: { records } });
  await repo.mergeRemote(res.progress);
  await repo.clearDirty(dirty);
  return records.length;
}

export async function syncAll(): Promise<void> {
  await flushQueues();
  await syncGameProgress();
  await syncArcade();
}
