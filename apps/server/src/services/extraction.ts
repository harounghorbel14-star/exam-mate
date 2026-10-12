import { detectLanguage } from '@exammate/core';
import type { AllowedDocType } from './fileValidation.js';

export interface ExtractedPage { page: number; text: string }
export interface Extracted { pages: ExtractedPage[]; language: 'en' | 'fr' | 'ar' }

export const MAX_PAGES = 500;
export const MAX_CHARS = 2_000_000;

export async function extractText(buf: Buffer, type: AllowedDocType): Promise<Extracted> {
  let pages: ExtractedPage[];
  if (type === 'pdf') {
    const { getDocumentProxy, extractText: pdfText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf), { isEvalSupported: false } as never);
    if (pdf.numPages > MAX_PAGES) throw new Error(`Document has ${pdf.numPages} pages; the limit is ${MAX_PAGES}`);
    const { text } = await pdfText(pdf, { mergePages: false });
    pages = (text as string[]).map((t, i) => ({ page: i + 1, text: normalize(t) }));
  } else if (type === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer: buf });
    pages = splitPseudoPages(normalize(value));
  } else {
    pages = splitPseudoPages(normalize(buf.toString('utf8')));
  }
  const total = pages.reduce((n, p) => n + p.text.length, 0);
  if (total > MAX_CHARS) throw new Error('Document text is too large to process');
  if (total === 0) throw new Error('No extractable text found (scanned PDFs need OCR: use Smart Scan on page images)');
  return { pages, language: detectLanguage(pages.slice(0, 3).map((p) => p.text).join(' ').slice(0, 5000)) };
}

function normalize(t: string): string {
  return t.replace(/\r/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** Formats without real pages are split into ~3000-character "sections" numbered like pages. */
function splitPseudoPages(text: string, size = 3000): ExtractedPage[] {
  const paras = text.split(/\n\s*\n/);
  const pages: ExtractedPage[] = [];
  let cur = '';
  for (const p of paras) {
    if (cur.length + p.length > size && cur) { pages.push({ page: pages.length + 1, text: cur.trim() }); cur = ''; }
    cur += `${p}\n\n`;
  }
  if (cur.trim()) pages.push({ page: pages.length + 1, text: cur.trim() });
  return pages;
}

export interface Chunk { page: number; section: string | null; ordinal: number; content: string }

const HEADING = /^(?:#{1,4}\s+.+|(?:\d+(?:\.\d+)*|[IVX]+)[.)]?\s+[^\n.]{3,80}|(?:chapter|chapitre|section|الفصل|الباب|درس|lesson|leçon)\b.{0,80})$/i;

/** Paragraph-aware chunking (~900 chars) that remembers the current heading for citations. */
export function chunkPages(pages: ExtractedPage[], target = 900): Chunk[] {
  const chunks: Chunk[] = [];
  let section: string | null = null;
  for (const { page, text } of pages) {
    let buf = '';
    const flush = () => {
      if (buf.trim()) chunks.push({ page, section, ordinal: chunks.length, content: buf.trim() });
      buf = '';
    };
    for (const line of text.split('\n')) {
      const l = line.trim();
      if (!l) { if (buf.length > target * 0.6) flush(); else buf += '\n'; continue; }
      if (HEADING.test(l) && l.length < 100) { flush(); section = l.replace(/^#+\s*/, ''); }
      if (buf.length + l.length > target) {
        // Split long paragraphs at sentence boundaries.
        const sentences = l.split(/(?<=[.!?؟])\s+/);
        for (const s of sentences) {
          if (buf.length + s.length > target && buf) flush();
          buf += `${s} `;
        }
      } else buf += `${l}\n`;
    }
    flush();
  }
  return chunks;
}
