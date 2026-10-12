import { mulberry32, shuffle } from '@exammate/core';
import { queryTerms } from './retrieval.js';

export interface SourceChunk { page: number | null; section: string | null; content: string }
export interface Cited<T> { item: T; page: number | null; section: string | null }

const SENTENCE_SPLIT = /(?<=[.!?؟。])\s+|\n+/;

export function sentencesOf(chunks: SourceChunk[]): Array<{ text: string; page: number | null; section: string | null; index: number }> {
  const out: Array<{ text: string; page: number | null; section: string | null; index: number }> = [];
  for (const c of chunks) {
    for (const s of c.content.split(SENTENCE_SPLIT)) {
      const t = s.trim();
      if (t.length >= 25 && t.length <= 400 && /\p{L}/u.test(t)) out.push({ text: t, page: c.page, section: c.section, index: out.length });
    }
  }
  return out;
}

function termFreq(sentences: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const s of sentences) for (const t of queryTerms(s)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

/** Extractive summary: sentences scored by document-level term centrality, kept in original order. */
export function summarize(chunks: SourceChunk[], maxSentences = 8): Array<Cited<string>> {
  const sents = sentencesOf(chunks);
  if (sents.length === 0) return [];
  const tf = termFreq(sents.map((s) => s.text));
  const scored = sents.map((s) => {
    const terms = queryTerms(s.text);
    const centrality = terms.reduce((sum, t) => sum + Math.log(1 + (tf.get(t) ?? 0)), 0) / Math.max(4, terms.length);
    const positionBonus = s.index < 3 ? 0.3 : 0;
    const definitionBonus = DEFINITION_PATTERNS.some((p) => p.test(s.text)) ? 0.4 : 0;
    return { s, score: centrality + positionBonus + definitionBonus };
  });
  const chosen: typeof scored = [];
  for (const c of scored.sort((a, b) => b.score - a.score)) {
    if (chosen.length >= maxSentences) break;
    // Avoid near-duplicates.
    const terms = new Set(queryTerms(c.s.text));
    if (chosen.some((x) => { const o = queryTerms(x.s.text); return o.filter((t) => terms.has(t)).length / Math.max(1, Math.min(o.length, terms.size)) > 0.7; })) continue;
    chosen.push(c);
  }
  return chosen.sort((a, b) => a.s.index - b.s.index).map((c) => ({ item: c.s.text, page: c.s.page, section: c.s.section }));
}

const DEFINITION_PATTERNS: RegExp[] = [
  /^(?<term>[\p{L}\p{N}' -]{2,60}?)\s+(?:is|are|refers to|is defined as|means|is called)\s+(?<def>.{10,300})$/iu,
  /^(?<term>[\p{L}\p{N}'’ -]{2,60}?)\s+(?:est|sont|désigne|se définit comme|correspond à)\s+(?<def>.{10,300})$/iu,
  /^(?<term>[\p{L}\p{N} -]{2,60}?)\s+(?:هو|هي|يُعرّف بأنه|يعرف بأنه|تُعرّف بأنها|تعرف بأنها|يقصد به)\s+(?<def>.{10,300})$/u,
  /^(?<term>[^:]{2,50}):\s+(?<def>.{10,300})$/u,
];

export interface Definition { term: string; definition: string }

export function extractDefinitions(chunks: SourceChunk[], max = 40): Array<Cited<Definition>> {
  const out: Array<Cited<Definition>> = [];
  const seen = new Set<string>();
  for (const s of sentencesOf(chunks)) {
    for (const p of DEFINITION_PATTERNS) {
      const m = p.exec(s.text);
      if (!m?.groups) continue;
      const term = m.groups.term!.trim().replace(/^(the|a|an|le|la|les|l['’]|un|une)\s+/i, '');
      if (term.split(/\s+/).length > 6 || /\d{3,}/.test(term)) continue;
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ item: { term, definition: m.groups.def!.trim().replace(/[.;]$/, '') }, page: s.page, section: s.section });
      break;
    }
    if (out.length >= max) break;
  }
  return out;
}

const FORMULA = /(?:^|[ \t(])((?:[A-Za-zΑ-Ωα-ωΔΣ][A-Za-z0-9_ΔΣα-ω]*|\d+)[ \t]*(?:=|≈|≤|≥)[ \t]*[A-Za-z0-9ΔΣα-ωπ√²³⁄+\-−*/×·^(). \t]{1,60}[A-Za-z0-9)²³πα-ω])/gmu;
/** PDF text often joins lines; start a new line wherever another "X =" begins. */
const NEXT_FORMULA = /[ \t]+(?=[A-Za-zΔΣα-ω][A-Za-z0-9_]{0,3}[ \t]*=(?!=))/g;

export function extractFormulas(chunks: SourceChunk[], max = 40): Array<Cited<string>> {
  const out: Array<Cited<string>> = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    for (const m of c.content.replace(NEXT_FORMULA, '\n').matchAll(FORMULA)) {
      const f = m[1]!.trim().replace(/\s+/g, ' ');
      // Require at least one operator or symbol beyond the equals sign to skip prose like "a = the".
      if (!/[+\-−*/×·^²³√πΔ]|\b[a-zA-Z]\s*[a-zA-Z0-9]?\b/.test(f.split(/=|≈|≤|≥/)[1] ?? '')) continue;
      if (/\b(the|and|est|les|des)\b/i.test(f)) continue;
      if (seen.has(f)) continue;
      seen.add(f);
      out.push({ item: f, page: c.page, section: c.section });
      if (out.length >= max) return out;
    }
  }
  return out;
}

export interface GeneratedCard { front: string; back: string; kind: 'definition' | 'formula' | 'basic'; page: number | null }

export function generateFlashcards(chunks: SourceChunk[], max = 30): GeneratedCard[] {
  const cards: GeneratedCard[] = [];
  for (const d of extractDefinitions(chunks, max)) cards.push({ front: d.item.term, back: d.item.definition, kind: 'definition', page: d.page });
  for (const f of extractFormulas(chunks, max)) {
    if (cards.length >= max) break;
    const [lhs] = f.item.split(/=|≈/);
    cards.push({ front: `${lhs!.trim()} = ?`, back: f.item, kind: 'formula', page: f.page });
  }
  if (cards.length < 5) {
    // Fallback: cloze cards from key summary sentences.
    for (const s of summarize(chunks, 10)) {
      if (cards.length >= max) break;
      const terms = queryTerms(s.item).filter((t) => t.length > 5).sort((a, b) => b.length - a.length);
      const target = terms[0];
      if (!target) continue;
      const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      cards.push({ front: s.item.replace(re, '_____'), back: target, kind: 'basic', page: s.page });
    }
  }
  return cards.slice(0, max);
}

export interface GeneratedQuizQuestion { prompt: string; type: 'mcq' | 'short'; choices?: string[]; answer: number | string[]; page: number | null; explanation: string }

/** Quiz from the document: definition MCQs (distractors are other definitions) plus cloze questions. */
export function generateQuiz(chunks: SourceChunk[], count = 10, seed = 1): GeneratedQuizQuestion[] {
  const rng = mulberry32(seed);
  const defs = extractDefinitions(chunks, 60);
  const qs: GeneratedQuizQuestion[] = [];
  for (const d of shuffle(defs, rng)) {
    if (qs.length >= count) break;
    const others = shuffle(defs.filter((x) => x.item.term !== d.item.term), rng).slice(0, 3).map((x) => x.item.term);
    if (others.length >= 2) {
      const choices = shuffle([d.item.term, ...others], rng);
      qs.push({ prompt: d.item.definition, type: 'mcq', choices, answer: choices.indexOf(d.item.term), page: d.page, explanation: `${d.item.term}: ${d.item.definition}` });
    }
  }
  for (const s of summarize(chunks, count * 2)) {
    if (qs.length >= count) break;
    const terms = queryTerms(s.item).filter((t) => t.length > 5).sort((a, b) => b.length - a.length);
    const target = terms[0];
    if (!target) continue;
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    qs.push({ prompt: s.item.replace(re, '_____'), type: 'short', answer: [target], page: s.page, explanation: s.item });
  }
  return qs;
}

export interface RevisionSheet { sections: Array<{ heading: string; points: Array<Cited<string>> }>; definitions: Array<Cited<Definition>>; formulas: Array<Cited<string>> }

export function revisionSheet(chunks: SourceChunk[]): RevisionSheet {
  const bySection = new Map<string, SourceChunk[]>();
  for (const c of chunks) {
    const key = c.section ?? '—';
    bySection.set(key, [...(bySection.get(key) ?? []), c]);
  }
  const sections = [...bySection.entries()].slice(0, 20).map(([heading, cs]) => ({ heading, points: summarize(cs, 3) }));
  return { sections, definitions: extractDefinitions(chunks, 20), formulas: extractFormulas(chunks, 20) };
}

export interface ExtractiveAnswer { found: boolean; answer: string; citations: Array<{ page: number | null; section: string | null; documentTitle?: string; quote: string }>; coverage: number }

/**
 * Grounded extractive answer: only sentences that actually appear in the retrieved chunks are
 * returned, each with its page. If term coverage is too low we say so instead of guessing.
 */
export function extractiveAnswer(question: string, chunks: Array<SourceChunk & { documentTitle?: string }>, minCoverage = 0.34): ExtractiveAnswer {
  const terms = queryTerms(question);
  if (terms.length === 0) return { found: false, answer: '', citations: [], coverage: 0 };
  const candidates = chunks.flatMap((c) => sentencesOf([c]).map((s) => ({ ...s, documentTitle: c.documentTitle })));
  const scored = candidates.map((s) => {
    const lower = s.text.toLowerCase();
    const hit = terms.filter((t) => lower.includes(t));
    return { s, coverage: hit.length / terms.length, density: hit.length / Math.max(1, queryTerms(s.text).length) };
  }).sort((a, b) => b.coverage - a.coverage || b.density - a.density);
  const best = scored[0];
  if (!best || best.coverage < minCoverage) return { found: false, answer: '', citations: [], coverage: best?.coverage ?? 0 };
  const picked = scored.filter((x) => x.coverage >= Math.max(minCoverage, best.coverage * 0.75)).slice(0, 3);
  return {
    found: true,
    answer: picked.map((p) => p.s.text).join(' '),
    citations: picked.map((p) => ({ page: p.s.page, section: p.s.section, documentTitle: p.s.documentTitle, quote: p.s.text })),
    coverage: best.coverage,
  };
}
