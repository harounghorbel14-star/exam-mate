import { pool } from '../db/pool.js';

export interface RetrievedChunk { id: number; documentId: string; documentTitle: string; page: number | null; section: string | null; content: string; score: number }

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'is', 'are', 'what', 'which', 'how', 'why', 'and', 'or', 'for', 'on', 'with', 'does', 'do', 'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'est', 'que', 'qui', 'quoi', 'et', 'en', 'ما', 'هو', 'هي', 'في', 'من', 'على', 'إلى', 'عن', 'هل', 'كيف', 'لماذا']);

export function queryTerms(q: string): string[] {
  const words = q.toLowerCase().normalize('NFKC').split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
  return [...new Set(words)].slice(0, 20);
}

/**
 * Hybrid lexical retrieval: Postgres full-text (OR of terms, prefix matching) for recall,
 * then re-ranking by term coverage so chunks matching more distinct terms win.
 * Scoped to the requesting user (and optionally specific documents).
 */
export async function searchChunks(userId: string, question: string, opts: { documentIds?: string[]; limit?: number } = {}): Promise<RetrievedChunk[]> {
  const terms = queryTerms(question);
  if (terms.length === 0) return [];
  const tsq = terms.map((t) => `${t.replace(/[^\p{L}\p{N}]/gu, '')}:*`).filter((t) => t.length > 2).join(' | ');
  if (!tsq) return [];
  const { rows } = await pool.query(
    `SELECT c.id, c.document_id, d.title, c.page, c.section, c.content, ts_rank_cd(c.tsv, q) AS rank
     FROM document_chunks c JOIN documents d ON d.id = c.document_id, to_tsquery('simple', $2) q
     WHERE c.user_id = $1 AND d.user_id = $1 AND c.tsv @@ q AND ($3::uuid[] IS NULL OR c.document_id = ANY($3))
     ORDER BY rank DESC LIMIT 40`,
    [userId, tsq, opts.documentIds?.length ? opts.documentIds : null],
  );
  const scored = rows.map((r) => {
    const text = (r.content as string).toLowerCase();
    const coverage = terms.filter((t) => text.includes(t)).length / terms.length;
    return { id: Number(r.id), documentId: r.document_id, documentTitle: r.title, page: r.page, section: r.section, content: r.content, score: 0.7 * coverage + 0.3 * Math.min(1, Number(r.rank) * 5) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 6);
}
