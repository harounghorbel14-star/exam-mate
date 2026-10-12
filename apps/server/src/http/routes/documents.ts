import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { config } from '../../config.js';
import { storage } from '../../services/storage.js';
import { enqueue } from '../../services/jobs.js';
import { PROCESS_DOCUMENT } from '../../services/documentJobs.js';
import { detectDocumentType, sanitizeFilename } from '../../services/fileValidation.js';
import { sha256 } from '../../auth/tokens.js';
import { audit } from '../../services/audit.js';
import { consumeQuota, limitsFor, planOf } from '../../services/plans.js';
import { summarize, generateFlashcards, generateQuiz, revisionSheet, extractDefinitions, extractFormulas, type SourceChunk } from '../../services/studyTools.js';
import { answerFromDocuments } from '../../agent/knowledge/docQa.js';
import { getModel } from '../../agent/models/manager.js';
import { asyncHandler, body, clientMeta, query, requireAuth } from '../middleware.js';
import { HttpError, badRequest, notFound, tooLarge } from '../errors.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.max(config.FREE_MAX_UPLOAD_MB, config.PREMIUM_MAX_UPLOAD_MB) * 1024 * 1024, files: 1, fields: 10 } });

const MIME: Record<string, string> = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain', md: 'text/markdown' };

documentsRouter.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  if (!req.file) throw badRequest('Attach a file in the "file" field');
  const meta = z.object({ title: z.string().trim().max(200).optional(), course: z.string().trim().max(100).optional(), exam: z.string().trim().max(100).optional(), subjectId: z.string().uuid().optional() }).parse(req.body ?? {});
  const plan = await planOf(userId);
  const limits = limitsFor(plan);
  if (req.file.size > limits.maxUploadMb * 1024 * 1024) throw tooLarge(`Your plan allows files up to ${limits.maxUploadMb} MB`);
  const { rows: cnt } = await pool.query('SELECT count(*)::int AS n FROM documents WHERE user_id = $1', [userId]);
  if (cnt[0].n >= limits.maxDocuments) throw new HttpError(429, 'quota_exceeded', `Your plan allows ${limits.maxDocuments} documents. Delete some or upgrade.`);
  const filename = sanitizeFilename(req.file.originalname);
  const type = detectDocumentType(req.file.buffer, filename);
  if (!type) {
    await audit('security.upload_rejected', userId, { ...clientMeta(req), details: { reason: 'unsupported or mismatched file type' } });
    throw badRequest('Unsupported file. Upload a PDF, DOCX, TXT or Markdown file.');
  }
  if (meta.subjectId) {
    const own = await pool.query('SELECT 1 FROM study_subjects WHERE id = $1 AND user_id = $2', [meta.subjectId, userId]);
    if (!own.rowCount) throw notFound('Subject not found');
  }
  const key = await storage.put(userId, req.file.buffer, type);
  const { rows } = await pool.query(
    `INSERT INTO documents (user_id, subject_id, course, exam, title, filename, mime, size_bytes, sha256, storage_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, title, status, created_at`,
    [userId, meta.subjectId ?? null, meta.course ?? null, meta.exam ?? null, meta.title || filename.replace(/\.[^.]+$/, ''), filename, MIME[type], req.file.size, sha256(req.file.buffer), key],
  );
  await enqueue(PROCESS_DOCUMENT, { documentId: rows[0].id, type });
  await audit('document.uploaded', userId, { ...clientMeta(req), details: { documentId: rows[0].id, type, size: req.file.size } });
  res.status(202).json({ document: rows[0] });
}));

documentsRouter.get('/', asyncHandler(async (req, res) => {
  const p = query(z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0), subjectId: z.string().uuid().optional(), course: z.string().max(100).optional(), exam: z.string().max(100).optional() }), req);
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.filename, d.mime, d.size_bytes, d.status, d.error, d.page_count, d.language, d.course, d.exam, d.subject_id, s.name AS subject_name, d.created_at
     FROM documents d LEFT JOIN study_subjects s ON s.id = d.subject_id
     WHERE d.user_id = $1 AND ($2::uuid IS NULL OR d.subject_id = $2) AND ($3::text IS NULL OR d.course = $3) AND ($4::text IS NULL OR d.exam = $4)
     ORDER BY d.created_at DESC LIMIT $5 OFFSET $6`,
    [req.user!.id, p.subjectId ?? null, p.course ?? null, p.exam ?? null, p.limit, p.offset],
  );
  const total = await pool.query('SELECT count(*)::int AS n FROM documents WHERE user_id = $1', [req.user!.id]);
  res.json({ items: rows, total: total.rows[0].n });
}));

async function ownedDocument(userId: string, id: string) {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1 AND user_id = $2', [z.string().uuid().parse(id), userId]);
  if (!rows[0]) throw notFound('Document not found');
  return rows[0];
}

async function readyChunks(userId: string, id: string): Promise<SourceChunk[]> {
  const doc = await ownedDocument(userId, id);
  if (doc.status !== 'ready') throw new HttpError(409, 'not_ready', `Document is ${doc.status}`);
  const { rows } = await pool.query('SELECT page, section, content FROM document_chunks WHERE document_id = $1 AND user_id = $2 ORDER BY ordinal', [doc.id, userId]);
  return rows;
}

documentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  delete d.storage_key;
  res.json({ document: d });
}));

documentsRouter.patch('/:id', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  const p = body(z.object({ title: z.string().trim().min(1).max(200).optional(), course: z.string().trim().max(100).nullable().optional(), exam: z.string().trim().max(100).nullable().optional() }), req);
  await pool.query('UPDATE documents SET title = COALESCE($3, title), course = CASE WHEN $4 THEN $5 ELSE course END, exam = CASE WHEN $6 THEN $7 ELSE exam END WHERE id = $1 AND user_id = $2',
    [d.id, req.user!.id, p.title ?? null, p.course !== undefined, p.course ?? null, p.exam !== undefined, p.exam ?? null]);
  res.json({ ok: true });
}));

documentsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  await pool.query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [d.id, req.user!.id]); // chunks cascade
  await storage.delete(d.storage_key);
  await audit('document.deleted', req.user!.id, { ...clientMeta(req), details: { documentId: d.id } });
  res.json({ ok: true });
}));

documentsRouter.get('/:id/pages/:page', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  const page = z.coerce.number().int().min(1).parse(req.params.page);
  const { rows } = await pool.query('SELECT section, content FROM document_chunks WHERE document_id = $1 AND user_id = $2 AND page = $3 ORDER BY ordinal', [d.id, req.user!.id, page]);
  res.json({ page, chunks: rows });
}));

documentsRouter.post('/:id/ask', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  const { question } = body(z.object({ question: z.string().trim().min(2).max(1000) }), req);
  await consumeQuota(req.user!.id, 'ai');
  const answer = await answerFromDocuments(req.user!.id, question, { documentIds: [d.id], model: getModel() });
  res.json(answer);
}));

documentsRouter.post('/:id/summary', asyncHandler(async (req, res) => {
  const chunks = await readyChunks(req.user!.id, req.params.id!);
  const { sentences } = body(z.object({ sentences: z.number().int().min(3).max(20).default(8) }), req);
  res.json({ summary: summarize(chunks, sentences), engine: 'extractive' });
}));

documentsRouter.post('/:id/flashcards', asyncHandler(async (req, res) => {
  const d = await ownedDocument(req.user!.id, req.params.id!);
  const chunks = await readyChunks(req.user!.id, d.id);
  const p = body(z.object({ max: z.number().int().min(1).max(60).default(20), save: z.boolean().default(false) }), req);
  const plan = await planOf(req.user!.id);
  const cards = generateFlashcards(chunks, Math.min(p.max, plan === 'premium' ? 60 : 15));
  let deckId: string | null = null;
  if (p.save && cards.length) {
    const { rows } = await pool.query('INSERT INTO flashcard_decks (user_id, title, source_document_id) VALUES ($1, $2, $3) RETURNING id', [req.user!.id, d.title, d.id]);
    deckId = rows[0].id;
    for (const c of cards) await pool.query('INSERT INTO flashcards (deck_id, user_id, front, back, kind, source_page) VALUES ($1, $2, $3, $4, $5, $6)', [deckId, req.user!.id, c.front, c.back, c.kind, c.page]);
  }
  res.json({ cards, deckId });
}));

documentsRouter.post('/:id/quiz', asyncHandler(async (req, res) => {
  const chunks = await readyChunks(req.user!.id, req.params.id!);
  const p = body(z.object({ count: z.number().int().min(1).max(30).default(10), seed: z.number().int().default(1) }), req);
  const plan = await planOf(req.user!.id);
  res.json({ questions: generateQuiz(chunks, Math.min(p.count, plan === 'premium' ? 30 : 5), p.seed) });
}));

documentsRouter.post('/:id/revision-sheet', asyncHandler(async (req, res) => {
  const plan = await planOf(req.user!.id);
  if (!limitsFor(plan).features.advancedDocumentAnalysis) throw new HttpError(402, 'premium_required', 'Revision sheets are part of Premium (advanced document analysis).');
  const chunks = await readyChunks(req.user!.id, req.params.id!);
  res.json({ sheet: revisionSheet(chunks) });
}));

documentsRouter.post('/:id/extract', asyncHandler(async (req, res) => {
  const chunks = await readyChunks(req.user!.id, req.params.id!);
  res.json({ definitions: extractDefinitions(chunks), formulas: extractFormulas(chunks) });
}));
