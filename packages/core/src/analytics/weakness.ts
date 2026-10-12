export interface PracticeRecord {
  subject: string;
  topic: string;
  correct: boolean;
  /** Seconds spent on the question. */
  timeSpent: number;
  /** Expected seconds for this question type (from the exam template or defaults). */
  expectedTime?: number;
  /** Short tag describing the error, e.g. "sign error", when known. */
  mistakeTag?: string;
  at: number;
}

export interface TopicInsight {
  subject: string;
  topic: string;
  attempts: number;
  accuracy: number;
  /** Accuracy over the most recent 5 attempts. */
  recentAccuracy: number;
  avgTimeRatio: number;
  /** 0 (strong) … 1 (weak), combining accuracy, recency and timing. */
  weaknessScore: number;
  reasons: string[];
}

export interface WeaknessReport {
  topics: TopicInsight[];
  weakSubjects: string[];
  repeatedMistakes: Array<{ tag: string; count: number }>;
  timeManagement: { slowTopics: string[]; rushedTopics: string[] };
}

export function analyzeWeaknesses(records: PracticeRecord[], minAttempts = 3): WeaknessReport {
  const groups = new Map<string, PracticeRecord[]>();
  for (const r of records) {
    const key = `${r.subject}\u0000${r.topic}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const topics: TopicInsight[] = [];
  for (const [key, list] of groups) {
    const [subject, topic] = key.split('\u0000') as [string, string];
    const sorted = [...list].sort((a, b) => a.at - b.at);
    const accuracy = sorted.filter((r) => r.correct).length / sorted.length;
    const recent = sorted.slice(-5);
    const recentAccuracy = recent.filter((r) => r.correct).length / recent.length;
    const ratios = sorted.filter((r) => r.expectedTime).map((r) => r.timeSpent / r.expectedTime!);
    const avgTimeRatio = ratios.length ? ratios.reduce((s, x) => s + x, 0) / ratios.length : 1;
    const reasons: string[] = [];
    if (accuracy < 0.6) reasons.push(`accuracy ${Math.round(accuracy * 100)}% is below 60%`);
    if (recentAccuracy < accuracy - 0.15) reasons.push('recent results are getting worse');
    if (avgTimeRatio > 1.5) reasons.push(`takes ${avgTimeRatio.toFixed(1)}× the expected time`);
    if (avgTimeRatio < 0.4 && accuracy < 0.7) reasons.push('answers are rushed and often wrong');
    // Confidence shrinkage: few attempts pull the score towards neutral (0.5).
    const confidence = Math.min(1, sorted.length / (minAttempts * 2));
    const raw = 0.6 * (1 - accuracy) + 0.25 * (1 - recentAccuracy) + 0.15 * Math.min(1, Math.max(0, avgTimeRatio - 1));
    const weaknessScore = Math.round((confidence * raw + (1 - confidence) * 0.5 * raw) * 1000) / 1000;
    topics.push({ subject, topic, attempts: sorted.length, accuracy, recentAccuracy, avgTimeRatio, weaknessScore, reasons });
  }
  topics.sort((a, b) => b.weaknessScore - a.weaknessScore);
  const subjects = new Map<string, { c: number; n: number }>();
  for (const r of records) {
    const s = subjects.get(r.subject) ?? { c: 0, n: 0 };
    s.n++; if (r.correct) s.c++;
    subjects.set(r.subject, s);
  }
  const weakSubjects = [...subjects.entries()].filter(([, s]) => s.n >= minAttempts && s.c / s.n < 0.6).map(([k]) => k);
  const mistakes = new Map<string, number>();
  for (const r of records) if (!r.correct && r.mistakeTag) mistakes.set(r.mistakeTag, (mistakes.get(r.mistakeTag) ?? 0) + 1);
  const repeatedMistakes = [...mistakes.entries()].filter(([, c]) => c >= 2).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  return {
    topics, weakSubjects, repeatedMistakes,
    timeManagement: {
      slowTopics: topics.filter((t) => t.avgTimeRatio > 1.5).map((t) => t.topic),
      rushedTopics: topics.filter((t) => t.avgTimeRatio < 0.4 && t.accuracy < 0.7).map((t) => t.topic),
    },
  };
}

export interface PlanTask { day: number; subject: string; topic: string; minutes: number; activity: 'review' | 'practice' | 'flashcards' | 'timed-drill'; reason: string }

export interface StudyPlanOptions {
  days: number;
  minutesPerDay: number;
  /** Topics the user chose to exclude or prioritise (overrides). */
  exclude?: string[];
  pin?: string[];
}

/** Turn a weakness report into a realistic daily plan with an explanation per task. */
export function buildStudyPlan(report: WeaknessReport, opts: StudyPlanOptions): PlanTask[] {
  const minutes = Math.max(10, Math.min(opts.minutesPerDay, 240));
  const candidates = report.topics.filter((t) => !opts.exclude?.includes(t.topic));
  const pinned = candidates.filter((t) => opts.pin?.includes(t.topic));
  const rest = candidates.filter((t) => !opts.pin?.includes(t.topic) && t.weaknessScore > 0.15);
  const ordered = [...pinned, ...rest];
  const tasks: PlanTask[] = [];
  if (ordered.length === 0) return tasks;
  for (let day = 1; day <= opts.days; day++) {
    // Two focus topics per day, rotating, plus a short flashcard block.
    const focus = [ordered[(day * 2 - 2) % ordered.length]!, ordered[(day * 2 - 1) % ordered.length]!];
    const unique = focus.filter((t, i) => focus.findIndex((x) => x.topic === t.topic) === i);
    const flash = Math.round(minutes * 0.2);
    const per = Math.floor((minutes - flash) / unique.length);
    for (const t of unique) {
      const activity: PlanTask['activity'] = t.avgTimeRatio > 1.5 ? 'timed-drill' : t.accuracy < 0.5 ? 'review' : 'practice';
      const why = opts.pin?.includes(t.topic) ? 'you pinned this topic' : t.reasons.length ? t.reasons.join('; ') : `weakness score ${t.weaknessScore}`;
      tasks.push({ day, subject: t.subject, topic: t.topic, minutes: per, activity, reason: why });
    }
    tasks.push({ day, subject: 'all', topic: 'due flashcards', minutes: flash, activity: 'flashcards', reason: 'spaced repetition keeps earlier topics fresh' });
  }
  return tasks;
}
