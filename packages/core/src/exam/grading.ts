export type ExamQuestionType = 'mcq' | 'multi' | 'numeric' | 'short' | 'written' | 'truefalse';

export interface RubricCriterion { id: string; description: string; points: number; keywords?: string[] }

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  subject: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  points: number;
  choices?: string[];
  /** Index (mcq/truefalse), indices (multi), number (numeric) or accepted strings (short). */
  answer?: number | number[] | string[];
  tolerance?: number;
  rubric?: RubricCriterion[];
  explanation?: string;
}

export interface GradeResult {
  questionId: string;
  status: 'correct' | 'partial' | 'incorrect' | 'needs_review' | 'unanswered';
  pointsAwarded: number;
  pointsPossible: number;
  feedback: string;
  /** For written answers: rubric criteria whose keywords were detected (indicative only). */
  matchedCriteria?: string[];
}

export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[ً-ْ]/g, '')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function gradeAnswer(q: ExamQuestion, response: unknown): GradeResult {
  const base = { questionId: q.id, pointsPossible: q.points };
  const empty = response === undefined || response === null || response === '' || (Array.isArray(response) && response.length === 0);
  if (empty) return { ...base, status: 'unanswered', pointsAwarded: 0, feedback: 'No answer given.' };
  switch (q.type) {
    case 'mcq':
    case 'truefalse': {
      const ok = Number(response) === q.answer;
      return { ...base, status: ok ? 'correct' : 'incorrect', pointsAwarded: ok ? q.points : 0, feedback: ok ? 'Correct.' : `The correct answer is ${q.choices?.[q.answer as number] ?? q.answer}.` };
    }
    case 'multi': {
      const expected = new Set(q.answer as number[]);
      const given = new Set((response as number[]).map(Number));
      const correctPicks = [...given].filter((g) => expected.has(g)).length;
      const wrongPicks = given.size - correctPicks;
      const fraction = Math.max(0, (correctPicks - wrongPicks) / expected.size);
      const pts = Math.round(q.points * fraction * 100) / 100;
      return { ...base, status: fraction === 1 ? 'correct' : fraction > 0 ? 'partial' : 'incorrect', pointsAwarded: pts, feedback: `${correctPicks} of ${expected.size} correct options selected${wrongPicks ? `, ${wrongPicks} incorrect` : ''}.` };
    }
    case 'numeric': {
      const value = Number(String(response).replace(',', '.'));
      if (!Number.isFinite(value)) return { ...base, status: 'incorrect', pointsAwarded: 0, feedback: 'The answer is not a number.' };
      const target = q.answer as number;
      const tol = q.tolerance ?? Math.max(1e-9, Math.abs(target) * 0.01);
      const ok = Math.abs(value - target) <= tol;
      return { ...base, status: ok ? 'correct' : 'incorrect', pointsAwarded: ok ? q.points : 0, feedback: ok ? 'Correct within tolerance.' : `Expected ${target} (± ${tol}).` };
    }
    case 'short': {
      const accepted = (q.answer as string[]).map(normalizeText);
      const given = normalizeText(String(response));
      if (accepted.includes(given)) return { ...base, status: 'correct', pointsAwarded: q.points, feedback: 'Correct.' };
      return { ...base, status: 'needs_review', pointsAwarded: 0, feedback: 'Your answer does not exactly match the accepted answers; it needs manual review.' };
    }
    case 'written': {
      // Written answers can't be reliably graded automatically. Keyword matching is shown
      // only as a hint for the reviewer; no points are awarded automatically.
      const text = normalizeText(String(response));
      const matched = (q.rubric ?? []).filter((c) => (c.keywords ?? []).some((k) => text.includes(normalizeText(k)))).map((c) => c.id);
      return { ...base, status: 'needs_review', pointsAwarded: 0, feedback: 'Written answers are marked by a reviewer using the rubric.', matchedCriteria: matched };
    }
  }
}

export interface AttemptSummary {
  score: number;
  maxScore: number;
  percent: number;
  pendingReview: number;
  byTopic: Record<string, { correct: number; total: number; points: number; max: number }>;
}

export function summarizeAttempt(questions: ExamQuestion[], grades: GradeResult[]): AttemptSummary {
  const byTopic: AttemptSummary['byTopic'] = {};
  let score = 0, maxScore = 0, pendingReview = 0;
  for (const g of grades) {
    const q = questions.find((x) => x.id === g.questionId);
    if (!q) continue;
    maxScore += g.pointsPossible;
    score += g.pointsAwarded;
    if (g.status === 'needs_review') pendingReview++;
    const key = `${q.subject}/${q.topic}`;
    const t = (byTopic[key] ??= { correct: 0, total: 0, points: 0, max: 0 });
    t.total++;
    if (g.status === 'correct') t.correct++;
    t.points += g.pointsAwarded;
    t.max += g.pointsPossible;
  }
  return { score, maxScore, percent: maxScore ? Math.round((score / maxScore) * 1000) / 10 : 0, pendingReview, byTopic };
}

/** Deterministic seeded shuffle (mulberry32) so randomized exams are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface ExamTemplate {
  subjects?: string[];
  topics?: string[];
  difficulty?: Array<1 | 2 | 3>;
  count: number;
  durationMinutes: number;
  seed: number;
}

/** Pick a randomized, balanced question set from a bank according to a template. */
export function buildExam(bank: ExamQuestion[], t: ExamTemplate): ExamQuestion[] {
  const rng = mulberry32(t.seed);
  const pool = bank.filter((q) => (!t.subjects?.length || t.subjects.includes(q.subject))
    && (!t.topics?.length || t.topics.includes(q.topic))
    && (!t.difficulty?.length || t.difficulty.includes(q.difficulty)));
  // Round-robin over topics for coverage.
  const byTopic = new Map<string, ExamQuestion[]>();
  for (const q of shuffle(pool, rng)) {
    const list = byTopic.get(q.topic) ?? [];
    list.push(q);
    byTopic.set(q.topic, list);
  }
  const out: ExamQuestion[] = [];
  const lists = [...byTopic.values()];
  while (out.length < t.count && lists.some((l) => l.length)) {
    for (const l of lists) { const q = l.shift(); if (q && out.length < t.count) out.push(q); }
  }
  // Shuffle MCQ choices deterministically while keeping the answer index correct.
  return out.map((q) => {
    if (q.type !== 'mcq' || !q.choices) return q;
    const order = shuffle(q.choices.map((_, i) => i), rng);
    return { ...q, choices: order.map((i) => q.choices![i]!), answer: order.indexOf(q.answer as number) };
  });
}
