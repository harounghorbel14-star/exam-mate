import { Router } from 'express';
import { z } from 'zod';
import { review as srsReview, newSchedule, buildSession, isLeech, type CardSchedule } from '@exammate/core';
import { pool, withTransaction } from '../../db/pool.js';
import { asyncHandler, body, query, requireAuth } from '../middleware.js';
import { notFound } from '../errors.js';

export const flashcardsRouter = Router();
flashcardsRouter.use(requireAuth);

const CardInput = z.object({ front: z.string().trim().min(1).max(2000), back: z.string().trim().min(1).max(4000), kind: z.enum(['basic', 'formula', 'vocabulary', 'definition']).default('basic') });

async function ownedDeck(userId: string, id: string) {
  const { rows } = await pool.query('SELECT * FROM flashcard_decks WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(id), userId]);
  if (!rows[0]) throw notFound('Deck not found');
  return rows[0];
}

flashcardsRouter.get('/decks', asyncHandler(async (req, res) => {
  const now = Date.now();
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.subject, d.source_document_id, d.updated_at,
            count(c.id) FILTER (WHERE NOT c.deleted)::int AS cards,
            count(c.id) FILTER (WHERE NOT c.deleted AND (c.schedule IS NULL OR (c.schedule->>'dueAt')::bigint <= $2))::int AS due
     FROM flashcard_decks d LEFT JOIN flashcards c ON c.deck_id = d.id
     WHERE d.user_id = $1 GROUP BY d.id ORDER BY d.updated_at DESC`,
    [req.user!.id, now],
  );
  res.json({ decks: rows });
}));

flashcardsRouter.post('/decks', asyncHandler(async (req, res) => {
  const d = body(z.object({ title: z.string().trim().min(1).max(120), subject: z.string().max(40).optional(), cards: z.array(CardInput).max(500).default([]) }), req);
  const deck = await withTransaction(async (c) => {
    const { rows } = await c.query('INSERT INTO flashcard_decks (user_id, title, subject) VALUES ($1, $2, $3) RETURNING id, title, subject', [req.user!.id, d.title, d.subject ?? null]);
    for (const card of d.cards) await c.query('INSERT INTO flashcards (deck_id, user_id, front, back, kind) VALUES ($1, $2, $3, $4, $5)', [rows[0].id, req.user!.id, card.front, card.back, card.kind]);
    return rows[0];
  });
  res.status(201).json({ deck });
}));

flashcardsRouter.delete('/decks/:id', asyncHandler(async (req, res) => {
  const d = await ownedDeck(req.user!.id, req.params.id!);
  await pool.query('DELETE FROM flashcard_decks WHERE id = $1 AND user_id = $2', [d.id, req.user!.id]);
  res.json({ ok: true });
}));

flashcardsRouter.get('/decks/:id/cards', asyncHandler(async (req, res) => {
  const d = await ownedDeck(req.user!.id, req.params.id!);
  const { rows } = await pool.query('SELECT id, front, back, kind, source_page, schedule, version, updated_at FROM flashcards WHERE deck_id = $1 AND user_id = $2 AND NOT deleted ORDER BY created_at', [d.id, req.user!.id]);
  res.json({ deck: d, cards: rows.map((r) => ({ ...r, leech: r.schedule ? isLeech(r.schedule as CardSchedule) : false })) });
}));

flashcardsRouter.post('/decks/:id/cards', asyncHandler(async (req, res) => {
  const d = await ownedDeck(req.user!.id, req.params.id!);
  const card = body(CardInput, req);
  const { rows } = await pool.query('INSERT INTO flashcards (deck_id, user_id, front, back, kind) VALUES ($1, $2, $3, $4, $5) RETURNING id, front, back, kind, version', [d.id, req.user!.id, card.front, card.back, card.kind]);
  await pool.query('UPDATE flashcard_decks SET updated_at = now() WHERE id = $1', [d.id]);
  res.status(201).json({ card: rows[0] });
}));

flashcardsRouter.put('/cards/:id', asyncHandler(async (req, res) => {
  const card = body(CardInput, req);
  const { rows } = await pool.query('UPDATE flashcards SET front = $3, back = $4, kind = $5, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2 AND NOT deleted RETURNING id, version', [z.string().uuid().parse(req.params.id), req.user!.id, card.front, card.back, card.kind]);
  if (!rows[0]) throw notFound();
  res.json({ card: rows[0] });
}));

flashcardsRouter.delete('/cards/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query('UPDATE flashcards SET deleted = true, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(req.params.id), req.user!.id]);
  if (!rowCount) throw notFound();
  res.json({ ok: true });
}));

flashcardsRouter.get('/due', asyncHandler(async (req, res) => {
  const p = query(z.object({ deckId: z.string().uuid().optional(), newLimit: z.coerce.number().int().min(0).max(100).default(10), max: z.coerce.number().int().min(1).max(200).default(50) }), req);
  const { rows } = await pool.query('SELECT c.id, c.deck_id, c.front, c.back, c.kind, c.schedule, d.title AS deck_title FROM flashcards c JOIN flashcard_decks d ON d.id = c.deck_id WHERE c.user_id = $1 AND NOT c.deleted AND ($2::uuid IS NULL OR c.deck_id = $2)', [req.user!.id, p.deckId ?? null]);
  res.json({ cards: buildSession(rows, Date.now(), p.newLimit, p.max) });
}));

/** Apply a review with the SM-2 scheduler and log it (also feeds the weakness detector). */
async function applyReview(userId: string, cardId: string, rating: 'again' | 'hard' | 'good' | 'easy', at: number, elapsedMs?: number) {
  return withTransaction(async (c) => {
    const { rows } = await c.query('SELECT c.schedule, d.title, d.subject FROM flashcards c JOIN flashcard_decks d ON d.id = c.deck_id WHERE c.id = $1 AND c.user_id = $2 AND NOT c.deleted FOR UPDATE OF c', [cardId, userId]);
    if (!rows[0]) throw notFound('Card not found');
    const next = srsReview((rows[0].schedule as CardSchedule | null) ?? newSchedule(at), rating, at);
    await c.query('UPDATE flashcards SET schedule = $3, version = version + 1, updated_at = now() WHERE id = $1 AND user_id = $2', [cardId, userId, next]);
    await c.query('INSERT INTO review_logs (card_id, user_id, rating, elapsed_ms, reviewed_at) VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))', [cardId, userId, rating, elapsedMs ?? null, at]);
    await c.query('INSERT INTO practice_records (user_id, subject, topic, correct, time_spent, source, at) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))',
      [userId, rows[0].subject ?? 'general', rows[0].title, rating !== 'again', (elapsedMs ?? 0) / 1000, 'flashcards', at]);
    return next;
  });
}

flashcardsRouter.post('/cards/:id/review', asyncHandler(async (req, res) => {
  const r = body(z.object({ rating: z.enum(['again', 'hard', 'good', 'easy']), elapsedMs: z.number().int().min(0).max(3_600_000).optional() }), req);
  const schedule = await applyReview(req.user!.id, z.string().uuid().parse(req.params.id), r.rating, Date.now(), r.elapsedMs);
  res.json({ schedule, leech: isLeech(schedule) });
}));

/** Offline sync: download decks for offline use and replay reviews made while offline (in time order). */
flashcardsRouter.get('/offline-bundle', asyncHandler(async (req, res) => {
  const decks = await pool.query('SELECT id, title, subject, updated_at FROM flashcard_decks WHERE user_id = $1', [req.user!.id]);
  const cards = await pool.query('SELECT id, deck_id, front, back, kind, schedule, version FROM flashcards WHERE user_id = $1 AND NOT deleted', [req.user!.id]);
  res.json({ generatedAt: Date.now(), decks: decks.rows, cards: cards.rows });
}));

flashcardsRouter.post('/sync', asyncHandler(async (req, res) => {
  const p = body(z.object({ reviews: z.array(z.object({ cardId: z.string().uuid(), rating: z.enum(['again', 'hard', 'good', 'easy']), at: z.number().int(), elapsedMs: z.number().int().optional() })).max(2000) }), req);
  const applied: string[] = [];
  const skipped: Array<{ cardId: string; reason: string }> = [];
  for (const r of [...p.reviews].sort((a, b) => a.at - b.at)) {
    if (r.at > Date.now() + 5 * 60_000) { skipped.push({ cardId: r.cardId, reason: 'timestamp in the future' }); continue; }
    try { await applyReview(req.user!.id, r.cardId, r.rating, r.at, r.elapsedMs); applied.push(r.cardId); }
    catch { skipped.push({ cardId: r.cardId, reason: 'card not found or deleted' }); }
  }
  res.json({ applied: applied.length, skipped });
}));
