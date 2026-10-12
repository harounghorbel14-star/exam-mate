import { pool, withTransaction } from '../db/pool.js';
import { storage } from './storage.js';
import { extractText, chunkPages } from './extraction.js';
import { registerJob, onJobFailed } from './jobs.js';
import type { AllowedDocType } from './fileValidation.js';

export const PROCESS_DOCUMENT = 'document.process';

/** Background job: extract text, chunk it and build the per-user retrieval index. */
export async function processDocument(payload: Record<string, unknown>): Promise<void> {
  const documentId = String(payload.documentId);
  const { rows } = await pool.query("UPDATE documents SET status = 'processing' WHERE id = $1 RETURNING user_id, storage_key, filename, mime", [documentId]);
  const doc = rows[0];
  if (!doc) return; // deleted meanwhile
  const buf = await storage.get(doc.storage_key);
  const extracted = await extractText(buf, payload.type as AllowedDocType);
  const chunks = chunkPages(extracted.pages);
  await withTransaction(async (c) => {
    await c.query('DELETE FROM document_chunks WHERE document_id = $1', [documentId]);
    // Batch insert in groups of 200 rows.
    for (let i = 0; i < chunks.length; i += 200) {
      const batch = chunks.slice(i, i + 200);
      const values: unknown[] = [];
      const placeholders = batch.map((ch, j) => {
        values.push(documentId, doc.user_id, ch.page, ch.section, ch.ordinal, ch.content);
        const b = j * 6;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`;
      });
      await c.query(`INSERT INTO document_chunks (document_id, user_id, page, section, ordinal, content) VALUES ${placeholders.join(', ')}`, values);
    }
    await c.query("UPDATE documents SET status = 'ready', page_count = $2, language = $3, processed_at = now(), error = NULL WHERE id = $1", [documentId, extracted.pages.length, extracted.language]);
  });
}

registerJob(PROCESS_DOCUMENT, processDocument);
onJobFailed(PROCESS_DOCUMENT, async (payload, error) => {
  await pool.query("UPDATE documents SET status = 'failed', error = $2 WHERE id = $1", [payload.documentId, error.slice(0, 300)]);
});
