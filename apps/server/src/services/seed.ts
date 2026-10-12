import { canonicalJson, GENERAL_QUIZ, BIOLOGY_QUIZ, TRUE_FALSE, CS_CONCEPTS, COMPOUNDS, REACTIONS, balanceEquation, molarMass, L, type LocalizedText, type McqItem } from '@exammate/core';
import { pool } from '../db/pool.js';
import { createHash } from 'node:crypto';

/**
 * Bundled exam question bank (owner_id NULL). Payloads are localised: prompt/choices are
 * LocalizedText and are materialised into the user's language when an exam is created.
 */
export interface BankPayload {
  type: 'mcq' | 'truefalse' | 'numeric' | 'short' | 'written';
  prompt: LocalizedText;
  choices?: LocalizedText[];
  answer?: number | string[];
  tolerance?: number;
  points: number;
  rubric?: Array<{ id: string; description: LocalizedText; points: number; keywords: string[] }>;
  explanation?: LocalizedText;
  expectedSeconds: number;
}

type Row = { subject: string; topic: string; difficulty: 1 | 2 | 3; payload: BankPayload };

function mcqRows(items: McqItem[], subject: (i: McqItem) => string): Row[] {
  return items.map((i) => ({ subject: subject(i), topic: i.topic, difficulty: 1, payload: { type: 'mcq', prompt: i.q, choices: i.choices, answer: i.answer, points: 1, expectedSeconds: 45, ...(i.why ? { explanation: i.why } : {}) } }));
}

export function bundledBank(): Row[] {
  const rows: Row[] = [];
  const topicSubject: Record<string, string> = { astronomy: 'physics', science: 'physics', math: 'math', history: 'history', geography: 'geography', language: 'languages', technology: 'cs' };
  rows.push(...mcqRows(GENERAL_QUIZ, (i) => topicSubject[i.topic] ?? 'general'));
  rows.push(...mcqRows(BIOLOGY_QUIZ, () => 'biology'));
  rows.push(...mcqRows(CS_CONCEPTS, () => 'cs'));
  for (const t of TRUE_FALSE) {
    rows.push({ subject: topicSubject[t.topic] ?? t.topic, topic: t.topic, difficulty: 1, payload: { type: 'truefalse', prompt: t.s, choices: [L('True', 'Vrai', 'صحيح'), L('False', 'Faux', 'خطأ')], answer: t.value ? 0 : 1, points: 1, expectedSeconds: 20, ...(t.why ? { explanation: t.why } : {}) } });
  }
  // Numeric algebra questions with verified answers.
  const linear: Array<[string, number]> = [['3x + 5 = 20', 5], ['7x - 4 = 24', 4], ['2(x + 3) = 18', 6], ['5x + 2 = 3x + 10', 4], ['x/3 - 2 = 1', 9], ['4x - 9 = 2x + 7', 8]];
  for (const [eq, x] of linear) rows.push({ subject: 'math', topic: 'linear-equations', difficulty: 2, payload: { type: 'numeric', prompt: L(`Solve for x: ${eq}`, `Résous : ${eq}`, `أوجد x: ${eq}`), answer: [String(x)], tolerance: 0, points: 2, expectedSeconds: 90 } });
  const quad: Array<[string, number]> = [['x² − 7x + 12 = 0', 4], ['x² − 2x − 15 = 0', 5], ['x² + x − 20 = 0', 4], ['2x² − 18 = 0', 3]];
  for (const [eq, x] of quad) rows.push({ subject: 'math', topic: 'quadratics', difficulty: 3, payload: { type: 'numeric', prompt: L(`Give the larger solution of ${eq}`, `Donne la plus grande solution de ${eq}`, `أعط الحل الأكبر للمعادلة ${eq}`), answer: [String(x)], points: 3, expectedSeconds: 150 } });
  const pct: Array<[number, number]> = [[20, 150], [15, 60], [35, 200], [12.5, 80]];
  for (const [p, n] of pct) rows.push({ subject: 'math', topic: 'percentages', difficulty: 1, payload: { type: 'numeric', prompt: L(`What is ${p}% of ${n}?`, `Combien font ${p} % de ${n} ?`, `كم يساوي ${p}٪ من ${n}؟`), answer: [String((p * n) / 100)], points: 1, expectedSeconds: 45 } });
  for (const c of COMPOUNDS.slice(0, 10)) {
    const mm = molarMass(c.formula).numeric![0]!;
    rows.push({ subject: 'chemistry', topic: 'molar-mass', difficulty: 2, payload: { type: 'numeric', prompt: L(`Molar mass of ${c.formula} in g/mol (1 decimal)?`, `Masse molaire de ${c.formula} en g/mol (1 décimale) ?`, `الكتلة المولية لـ ${c.formula} بـ غ/مول (منزلة عشرية واحدة)؟`), answer: [mm.toFixed(1)], tolerance: 0.1, points: 2, expectedSeconds: 120 } });
  }
  for (const r of REACTIONS.slice(0, 8)) {
    const b = balanceEquation(r);
    rows.push({ subject: 'chemistry', topic: 'balancing', difficulty: 2, payload: { type: 'short', prompt: L(`Balance: ${r.replace('->', '→')} (give the coefficients separated by spaces)`, `Équilibre : ${r.replace('->', '→')} (coefficients séparés par des espaces)`, `وازن: ${r.replace('->', '→')} (اكتب المعاملات مفصولة بمسافات)`), answer: [b.coefficients.join(' ')], points: 2, expectedSeconds: 120, explanation: L(b.balanced, b.balanced, b.balanced) } });
  }
  // Written-response questions (manually reviewed, rubric shown to the reviewer).
  rows.push({ subject: 'biology', topic: 'photosynthesis', difficulty: 2, payload: { type: 'written', prompt: L('Explain the process of photosynthesis and where it occurs.', 'Explique la photosynthèse et où elle se déroule.', 'اشرح عملية البناء الضوئي وأين تحدث.'), points: 5, expectedSeconds: 300, rubric: [
    { id: 'light', description: L('Mentions light energy', 'Mentionne l’énergie lumineuse', 'يذكر الطاقة الضوئية'), points: 1, keywords: ['light', 'sun', 'lumière', 'soleil', 'ضوء', 'الشمس'] },
    { id: 'inputs', description: L('Inputs: CO₂ and water', 'Réactifs : CO₂ et eau', 'المتفاعلات: ثاني أكسيد الكربون والماء'), points: 1, keywords: ['carbon dioxide', 'co2', 'water', 'dioxyde', 'eau', 'ماء', 'ثاني أكسيد'] },
    { id: 'outputs', description: L('Outputs: glucose and oxygen', 'Produits : glucose et dioxygène', 'النواتج: الغلوكوز والأكسجين'), points: 2, keywords: ['glucose', 'oxygen', 'oxygène', 'أكسجين', 'غلوكوز'] },
    { id: 'place', description: L('Takes place in chloroplasts', 'Se déroule dans les chloroplastes', 'تحدث في البلاستيدات الخضراء'), points: 1, keywords: ['chloroplast', 'chlorophyll', 'chloroplaste', 'البلاستيدات', 'اليخضور'] },
  ] } });
  rows.push({ subject: 'history', topic: 'ww1', difficulty: 3, payload: { type: 'written', prompt: L('Describe two causes of the First World War.', 'Décris deux causes de la Première Guerre mondiale.', 'صف سببين من أسباب الحرب العالمية الأولى.'), points: 4, expectedSeconds: 360, rubric: [
    { id: 'alliances', description: L('Alliance system', 'Système d’alliances', 'نظام التحالفات'), points: 2, keywords: ['alliance', 'تحالف'] },
    { id: 'nationalism', description: L('Nationalism or imperialism', 'Nationalisme ou impérialisme', 'القومية أو الإمبريالية'), points: 2, keywords: ['nationalism', 'imperialism', 'nationalisme', 'impérialisme', 'القومية', 'الاستعمار'] },
    { id: 'trigger', description: L('Assassination in Sarajevo', 'Attentat de Sarajevo', 'اغتيال سراييفو'), points: 2, keywords: ['sarajevo', 'franz ferdinand', 'سراييفو'] },
  ] } });
  return rows;
}

export async function seedQuestionBank(): Promise<number> {
  const rows = bundledBank();
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 12);
  const { rows: existing } = await pool.query("SELECT count(*)::int AS n FROM question_bank WHERE owner_id IS NULL AND source = $1", [`bundled:${hash}`]);
  if (existing[0].n === rows.length) return 0;
  await pool.query("DELETE FROM question_bank WHERE owner_id IS NULL AND source LIKE 'bundled%'");
  for (const r of rows) {
    await pool.query('INSERT INTO question_bank (owner_id, subject, topic, difficulty, payload, source) VALUES (NULL, $1, $2, $3, $4, $5)', [r.subject, r.topic, r.difficulty, r.payload, `bundled:${hash}`]);
  }
  return rows.length;
}

/** Example downloadable content pack for the offline games (served with a SHA-256 for integrity checks). */
export async function seedContentPacks(): Promise<void> {
  const payload = {
    gameId: 'quiz-battle',
    items: [
      { topic: 'science', q: L('What is the chemical formula of table salt?', 'Quelle est la formule du sel de table ?', 'ما الصيغة الكيميائية لملح الطعام؟'), choices: [L('NaCl', 'NaCl', 'NaCl'), L('KCl', 'KCl', 'KCl'), L('CaCO3', 'CaCO3', 'CaCO3'), L('H2O', 'H2O', 'H2O')], answer: 0 },
      { topic: 'math', q: L('What is the square root of 81?', 'Quelle est la racine carrée de 81 ?', 'ما الجذر التربيعي للعدد 81؟'), choices: [L('7', '7', '7'), L('8', '8', '8'), L('9', '9', '9'), L('11', '11', '11')], answer: 2 },
      { topic: 'geography', q: L('Which country has the largest area?', 'Quel pays a la plus grande superficie ?', 'ما الدولة الأكبر مساحة؟'), choices: [L('Russia', 'Russie', 'روسيا'), L('Canada', 'Canada', 'كندا'), L('China', 'Chine', 'الصين'), L('Brazil', 'Brésil', 'البرازيل')], answer: 0 },
      { topic: 'history', q: L('In which year did humans first land on the Moon?', 'En quelle année l’Homme a-t-il marché sur la Lune ?', 'في أي عام هبط الإنسان على القمر لأول مرة؟'), choices: [L('1959', '1959', '1959'), L('1969', '1969', '1969'), L('1979', '1979', '1979'), L('1989', '1989', '1989')], answer: 1 },
    ],
  };
  const sha = createHash('sha256').update(canonicalJson(payload)).digest('hex');
  await pool.query(
    `INSERT INTO content_packs (id, game_id, version, title, payload, sha256) VALUES ('quiz-battle-extra-1', 'quiz-battle', '1', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, sha256 = EXCLUDED.sha256`,
    [L('Quiz Battle: extra pack', 'Duel de quiz : pack bonus', 'معركة الأسئلة: حزمة إضافية'), payload, sha],
  );
}
