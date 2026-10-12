import { mergeGameProgress, type GameProgressRecord } from '@exammate/core';
import { api } from './api';
import { gameRepo, readJson, writeJson } from './store';

const REVIEW_QUEUE = 'exammate.queue.reviews';
export interface QueuedReview { cardId: string; rating: 'again' | 'hard' | 'good' | 'easy'; at: number; elapsedMs?: number }

export async function queueReview(r: QueuedReview) {
  await writeJson(REVIEW_QUEUE, [...(await readJson<QueuedReview[]>(REVIEW_QUEUE, [])), r]);
}

/** Push queued reviews and dirty game progress, then pull merged progress (conflict-free merge in core). */
export async function syncAll(): Promise<void> {
  const reviews = await readJson<QueuedReview[]>(REVIEW_QUEUE, []);
  if (reviews.length) { await api('/flashcards/sync', { method: 'POST', body: { reviews } }); await writeJson(REVIEW_QUEUE, []); }
  const all = await gameRepo.all();
  const dirty = await gameRepo.dirty();
  const res = await api<{ progress: GameProgressRecord[] }>('/progress/games/sync', { method: 'POST', body: { records: dirty.map((id) => all[id]).filter(Boolean) } });
  for (const remote of res.progress) {
    const local = all[remote.gameId];
    await gameRepo.save(local ? mergeGameProgress(local, remote) : remote, false);
  }
  await gameRepo.clearDirty(dirty);
}
