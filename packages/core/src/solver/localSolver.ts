import { solveEquation, solveLinearSystem, differentiate, integrate, evaluateExpression, simplifyExpression, statistics, formatNumber, freeSymbols } from '../math/engine.js';
import { safeParse, normalizeMathInput } from '../math/mathjs.js';
import type { MathResult } from '../math/types.js';
import { convertUnits } from '../science/units.js';
import { parsePhysicsProblem, solvePhysics } from '../science/physics.js';
import { balanceEquation, molarMass } from '../chem/chemistry.js';
import { detectQuestionType, type QuestionType } from '../text/questions.js';
import { classifySubject, type SubjectLabel } from '../classify/index.js';
import { mulberry32 } from '../exam/grading.js';
import type { Locale } from '../i18n/index.js';
import { localizeStep } from './stepText.js';

export type SolveMode = 'short' | 'steps' | 'simple' | 'hint' | 'check' | 'similar' | 'translate';

export type ToolName = 'equation' | 'system' | 'evaluate' | 'simplify' | 'derivative' | 'integral' | 'statistics' | 'units' | 'physics' | 'chem-balance' | 'molar-mass';

export interface SolveResponse {
  status: 'solved' | 'unsupported' | 'error';
  subject: SubjectLabel;
  questionType: QuestionType;
  tool: ToolName | null;
  mode: SolveMode;
  result?: MathResult;
  /** Text tailored to the requested mode (hint, simple explanation, check verdict…). */
  modeText?: string;
  /** For mode "check". */
  check?: { correct: boolean; detail: string };
  /** For mode "similar". */
  similar?: { question: string; answer: string };
  confidence: 'verified' | 'unverified' | 'unsupported';
  error?: string;
}

interface Route { tool: ToolName; run: () => MathResult }

const DERIV = /^(?:find\s+the\s+)?(?:derivative\s+of|differentiate|d\/d([a-z])\s*|dérivée\s+de|dériver|مشتقة|اشتق)\s*(.+)$/i;
const INTEGRAL = /^(?:find\s+the\s+)?(?:integral\s+of|integrate|∫|intégrale\s+de|intégrer|تكامل)\s*(.+?)(?:\s+(?:from|de|من)\s+(-?[\d.]+|pi)\s+(?:to|à|a|إلى|الى)\s+(-?[\d.]+|pi))?(?:\s*d([a-z]))?\s*$/i;
const CONVERT = /^(?:convert\s+|convertir\s+|حوّل\s+|حول\s+)?(-?[\d.,]+)\s*([^\d\s][^\s]*(?:\s*\/\s*[^\s]+)?)\s+(?:to|in|into|en|إلى|الى)\s+([^\s?]+)\s*\??$/i;
const MOLAR = /(?:molar\s+mass\s+of|masse\s+molaire\s+(?:de|du|d['’])|الكتلة\s+المولية\s+(?:ل|لـ)?)\s*([A-Za-z0-9()[\]·]+)/i;
const STATS = /(?:mean|average|median|mode|standard\s+deviation|variance|moyenne|médiane|écart[- ]type|المتوسط|الوسيط|الانحراف)/i;
const SIMPLIFY = /^(?:simplify|simplifier|بسّط|بسط)\s+(.+)$/i;
const SOLVE_PREFIX = /^(?:solve(?:\s+for\s+[a-z])?|résoudre|résous|حل|حلّ|find\s+x|trouver\s+x)\s*[:\-]?\s*/i;

function parseBound(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  return s.toLowerCase() === 'pi' ? Math.PI : Number(s);
}

/** Decide which deterministic tool can answer the question, if any. */
export function routeQuestion(raw: string): Route | null {
  const text = raw.trim().replace(/\s+/g, ' ');
  let m: RegExpExecArray | null;
  if ((m = MOLAR.exec(text))) { const f = m[1]!; return { tool: 'molar-mass', run: () => molarMass(f) }; }
  if (/(->|→|⟶|⇌)/.test(text) && /[A-Z]/.test(text)) {
    const eq = text.replace(/^(?:balance|équilibrer|equilibrer|وازن)\s*[:\-]?\s*/i, '');
    return { tool: 'chem-balance', run: () => balanceEquation(eq) };
  }
  if (/^(?:balance|équilibrer|وازن)/i.test(text) && /=/.test(text)) {
    const eq = text.replace(/^(?:balance|équilibrer|وازن)\s*[:\-]?\s*/i, '');
    return { tool: 'chem-balance', run: () => balanceEquation(eq) };
  }
  if ((m = DERIV.exec(text))) { const v = m[1] ?? 'x'; const e = m[2]!.replace(/\s*(?:with respect to|par rapport à)\s+([a-z])$/i, ''); return { tool: 'derivative', run: () => differentiate(e, v) }; }
  if ((m = INTEGRAL.exec(text))) {
    const e = m[1]!.replace(/\s*d[a-z]\s*$/, '');
    const a = parseBound(m[2]), b = parseBound(m[3]);
    const v = m[4] ?? 'x';
    return { tool: 'integral', run: () => integrate(e, v, a !== undefined && b !== undefined ? [a, b] : undefined) };
  }
  if ((m = CONVERT.exec(text))) {
    const value = Number(m[1]!.replace(',', '.')), from = m[2]!.replace(/\s+/g, ''), to = m[3]!;
    return { tool: 'units', run: () => convertUnits(value, from, to) };
  }
  if (STATS.test(text) && /-?\d+(?:\.\d+)?(?:\s*[,;]\s*-?\d+(?:\.\d+)?){2,}/.test(text)) return { tool: 'statistics', run: () => statistics(text.replace(/^[^\d-]*/, '')) };
  if ((m = SIMPLIFY.exec(text))) { const e = m[1]!; return { tool: 'simplify', run: () => simplifyExpression(e) }; }

  const stripped = text.replace(SOLVE_PREFIX, '').replace(/[?؟]\s*$/, '');
  const parts = stripped.split(/\s*(?:;|\n|,\s*(?=[^,]*=)|\band\b|\bet\b|\bو\b)\s*/).filter((p) => p.includes('='));
  if (parts.length >= 2 && parts.every((p) => isMathy(p))) return { tool: 'system', run: () => solveLinearSystem(parts) };
  if (parts.length === 1 && isMathy(stripped)) return { tool: 'equation', run: () => solveEquation(stripped) };

  const physics = parsePhysicsProblem(text);
  if (physics.unknown && physics.known.length >= 1) {
    const { known, unknown } = physics;
    // Only route if the library can actually reach the unknown.
    const attempt = solvePhysics(known, unknown);
    if (attempt.numeric?.length) return { tool: 'physics', run: () => attempt };
  }
  const expr = stripped.replace(/^(?:what is|calculate|compute|evaluate|combien font|calcule[rz]?|احسب|كم يساوي)\s*/i, '').replace(/[=?]\s*$/, '');
  if (isMathy(expr) && /\d/.test(expr)) {
    try {
      const node = safeParse(normalizeMathInput(expr));
      if (freeSymbols(node).length === 0) return { tool: 'evaluate', run: () => evaluateExpression(expr) };
    } catch { /* not an expression */ }
  }
  return null;
}

function isMathy(s: string): boolean {
  const t = normalizeMathInput(s);
  if (t.length === 0 || t.length > 500) return false;
  const words = t.match(/[A-Za-zÀ-ɏ؀-ۿ]{3,}/g) ?? [];
  const allowed = /^(sqrt|sin|cos|tan|log|ln|exp|abs|pi|asin|acos|atan|cbrt|floor|ceil|round)$/i;
  return words.every((w) => allowed.test(w));
}

function confidenceOf(r: MathResult): SolveResponse['confidence'] {
  if (r.verification.length === 0) return 'unverified';
  return r.verification.every((v) => v.passed) ? 'verified' : 'unverified';
}

const SIMPLE_INTRO: Record<ToolName, Record<Locale, string>> = {
  equation: { en: 'We look for the value of the unknown that makes both sides equal. We undo each operation, step by step, doing the same thing to both sides.', fr: 'On cherche la valeur de l’inconnue qui rend les deux membres égaux. On annule chaque opération, pas à pas, en faisant la même chose des deux côtés.', ar: 'نبحث عن قيمة المجهول التي تجعل الطرفين متساويين. نلغي كل عملية خطوة بخطوة، ونطبق الشيء نفسه على الطرفين.' },
  system: { en: 'Several equations share the same unknowns. We combine them to remove one unknown at a time until each value is found.', fr: 'Plusieurs équations partagent les mêmes inconnues. On les combine pour éliminer une inconnue à la fois.', ar: 'عدة معادلات تشترك في المجاهيل نفسها. نجمعها لنحذف مجهولًا واحدًا في كل مرة حتى نجد كل القيم.' },
  evaluate: { en: 'We calculate in the standard order: brackets, powers, multiplication and division, then addition and subtraction.', fr: 'On calcule dans l’ordre : parenthèses, puissances, multiplications et divisions, puis additions et soustractions.', ar: 'نحسب بالترتيب المعتاد: الأقواس، ثم القوى، ثم الضرب والقسمة، ثم الجمع والطرح.' },
  simplify: { en: 'We group terms that are alike (for example all the x terms) and add them together.', fr: 'On regroupe les termes semblables (par exemple tous les termes en x) et on les additionne.', ar: 'نجمع الحدود المتشابهة (مثل كل حدود x) معًا.' },
  derivative: { en: 'A derivative tells us how fast a function changes. We apply simple rules to each part, like “bring the power down and subtract one”.', fr: 'La dérivée indique la vitesse de variation d’une fonction. On applique des règles simples à chaque partie, comme « descendre l’exposant et enlever un ».', ar: 'المشتقة تخبرنا بسرعة تغير الدالة. نطبق قواعد بسيطة على كل جزء، مثل «إنزال الأس وطرح واحد منه».' },
  integral: { en: 'An integral adds up tiny pieces — for example the area under a curve. It is the reverse of taking a derivative.', fr: 'Une intégrale additionne de petits morceaux, comme l’aire sous une courbe. C’est l’inverse de la dérivée.', ar: 'التكامل يجمع أجزاء صغيرة جدًا — مثل المساحة تحت المنحنى. وهو عكس الاشتقاق.' },
  statistics: { en: 'The mean is the “fair share” of the total; the median is the middle value; the standard deviation tells how spread out the data are.', fr: 'La moyenne est le « partage équitable » du total ; la médiane est la valeur du milieu ; l’écart-type mesure la dispersion.', ar: 'المتوسط هو «النصيب العادل» من المجموع؛ والوسيط هو القيمة الوسطى؛ والانحراف المعياري يبين مدى تشتت البيانات.' },
  units: { en: 'We rewrite the quantity using a conversion factor equal to 1 (for example 1 km = 1000 m), so the value changes but the amount does not.', fr: 'On réécrit la grandeur avec un facteur de conversion égal à 1 (par exemple 1 km = 1000 m) : la valeur change, pas la quantité.', ar: 'نعيد كتابة الكمية باستخدام معامل تحويل يساوي 1 (مثل 1 كم = 1000 م)، فتتغير القيمة لا الكمية.' },
  physics: { en: 'We list what we know, pick the formula that links it to what we want, convert to SI units and substitute.', fr: 'On liste les données, on choisit la formule qui les relie à l’inconnue, on convertit en unités SI et on remplace.', ar: 'نكتب المعطيات، ونختار القانون الذي يربطها بالمطلوب، ونحوّل إلى وحدات SI ثم نعوّض.' },
  'chem-balance': { en: 'Atoms are not created or destroyed, so each element must appear the same number of times on both sides. We choose whole numbers in front of each formula to make this true.', fr: 'Les atomes ne se créent ni ne disparaissent : chaque élément doit apparaître autant de fois de chaque côté. On choisit des nombres entiers devant chaque formule.', ar: 'الذرات لا تفنى ولا تُستحدث، لذا يجب أن يظهر كل عنصر بالعدد نفسه في الطرفين. نختار أعدادًا صحيحة أمام كل صيغة لتحقيق ذلك.' },
  'molar-mass': { en: 'We add up the masses of all the atoms in the formula, using the periodic table.', fr: 'On additionne les masses de tous les atomes de la formule, grâce au tableau périodique.', ar: 'نجمع كتل جميع الذرات في الصيغة باستخدام الجدول الدوري.' },
};

/** Generate a similar practice question by perturbing the numbers and re-solving to make sure it works. */
export function similarQuestion(question: string, seed = Date.now()): { question: string; answer: string } | null {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 12; attempt++) {
    const q = question.replace(/(?<![\w^.])(\d+)(?![\w.])/g, (num) => {
      const n = Number(num);
      if (n <= 1) return num;
      const delta = Math.max(1, Math.round(n * 0.3));
      let v = n + Math.round((rng() * 2 - 1) * delta);
      if (v <= 1) v = n + 1;
      return String(v);
    });
    if (q === question) continue;
    const route = routeQuestion(q);
    if (!route) continue;
    try {
      const r = route.run();
      if (r.numeric && r.numeric.length && r.numeric.every((x) => Number.isFinite(x)) && !/No real|No solution|Not enough/.test(r.answer)) return { question: q, answer: r.answer };
      if (route.tool === 'chem-balance') return { question: q, answer: r.answer };
    } catch { /* try again */ }
  }
  return null;
}

/** Compare a student's answer with the computed result using an independent check where possible. */
export function checkAnswer(question: string, studentAnswer: string, result: MathResult, tool: ToolName): { correct: boolean; detail: string } {
  const nums = (normalizeMathInput(studentAnswer).match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? []).map((s) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : Number(s)));
  if (tool === 'chem-balance') {
    const expected = (result as MathResult & { coefficients?: number[] }).coefficients ?? [];
    const ok = nums.length === expected.length && nums.every((n, i) => n === expected[i]);
    return { correct: ok, detail: ok ? 'Coefficients match.' : `Expected coefficients ${expected.join(', ')}.` };
  }
  if (tool === 'equation') {
    // Independent check: substitute the student's value(s) into the original equation.
    const stripped = question.replace(SOLVE_PREFIX, '');
    try {
      const all = nums.length > 0 && nums.every((v) => {
        const r = solveEquation(stripped);
        const sol = r.numeric ?? [];
        return sol.some((s) => Math.abs(s - v) <= 1e-6 * Math.max(1, Math.abs(s)));
      });
      const complete = (result.numeric ?? []).every((s) => nums.some((v) => Math.abs(s - v) <= 1e-6 * Math.max(1, Math.abs(s))));
      if (all && complete) return { correct: true, detail: 'Your value(s) satisfy the equation.' };
      if (all) return { correct: false, detail: `Partly correct: the equation has more solutions (${result.answer}).` };
      return { correct: false, detail: `Substituting your value does not satisfy the equation. Expected ${result.answer}.` };
    } catch { /* fall through */ }
  }
  const expected = result.numeric ?? [];
  if (expected.length === 0 || nums.length === 0) return { correct: false, detail: 'Could not compare automatically; compare with the worked answer.' };
  const ok = expected.every((e) => nums.some((v) => Math.abs(v - e) <= Math.max(1e-6, Math.abs(e) * 0.005)));
  return { correct: ok, detail: ok ? 'Matches the computed result (within 0.5%).' : `Expected ${result.answer}.` };
}

/** Solve offline with deterministic tools. Never fabricates an answer: returns "unsupported" instead. */
export function solveLocally(question: string, opts: { mode?: SolveMode; locale?: Locale; studentAnswer?: string; seed?: number } = {}): SolveResponse {
  const mode = opts.mode ?? 'steps';
  const locale = opts.locale ?? 'en';
  const subject = classifySubject(question).subject;
  const questionType = detectQuestionType(question);
  let route: Route | null = null;
  try { route = routeQuestion(question); } catch { route = null; }
  if (!route) return { status: 'unsupported', subject, questionType, tool: null, mode, confidence: 'unsupported' };
  let result: MathResult;
  try {
    result = route.run();
  } catch (e) {
    return { status: 'error', subject, questionType, tool: route.tool, mode, confidence: 'unsupported', error: (e as Error).message };
  }
  result = { ...result, steps: result.steps.map((s) => ({ ...s, description: localizeStep(s.description, locale) })), warnings: result.warnings.map((w) => localizeStep(w, locale)), assumptions: result.assumptions.map((a) => localizeStep(a, locale)) };
  const subjectFromTool: Partial<Record<ToolName, SubjectLabel>> = { physics: 'physics', 'chem-balance': 'chemistry', 'molar-mass': 'chemistry', units: 'physics' };
  const base: SolveResponse = { status: 'solved', subject: subjectFromTool[route.tool] ?? (subject === 'general' ? 'math' : subject), questionType, tool: route.tool, mode, result, confidence: confidenceOf(result) };
  switch (mode) {
    case 'hint': {
      const step = result.steps.find((s, i) => i > 0) ?? result.steps[0];
      return { ...base, modeText: step ? step.description : SIMPLE_INTRO[route.tool][locale], result: { ...result, answer: '', answerLatex: undefined, steps: step ? [step] : [] } };
    }
    case 'simple':
      return { ...base, modeText: SIMPLE_INTRO[route.tool][locale] };
    case 'check': {
      if (!opts.studentAnswer) return { ...base, modeText: 'Provide your answer to check it.' };
      return { ...base, check: checkAnswer(question, opts.studentAnswer, result, route.tool) };
    }
    case 'similar': {
      const sim = similarQuestion(question, opts.seed);
      return sim ? { ...base, similar: sim } : { ...base, modeText: 'Could not generate a similar question for this input.' };
    }
    case 'short':
      return { ...base, result: { ...result, steps: [] } };
    case 'translate':
      return { ...base, status: 'unsupported', confidence: 'unsupported', modeText: 'Translation of free text requires the local language model.' };
    default:
      return base;
  }
}

export { formatNumber };
