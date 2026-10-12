import { shuffle } from '../exam/grading.js';
import { pick, type LocalizedText, type Locale } from '../i18n/index.js';
import { ELEMENTS } from '../chem/elements.js';
import { balanceEquation, molarMass } from '../chem/chemistry.js';
import { solvePhysics } from '../science/physics.js';
import {
  GENERAL_QUIZ, BIOLOGY_QUIZ, TRUE_FALSE, COUNTRIES, CONTINENTS, WORDS, VOCAB, FORMULA_PAIRS, COMPOUNDS, COMPOUND_KINDS,
  REACTIONS, CS_CONCEPTS, L, type McqItem,
} from '../content/banks.js';
import type { GameContext, GameDefinition, GameId, GameQuestion } from './types.js';

const tr = (ctx: GameContext, en: string, fr: string, ar: string) => pick({ en, fr, ar }, ctx.locale);
const int = (rng: () => number, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const pickOne = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

/** Build a choice question; `correct` is placed among `distractors` at a random position. */
function choiceQ(ctx: GameContext, id: string, prompt: string, correct: string, distractors: string[], extra: Partial<GameQuestion> = {}): GameQuestion {
  const uniq = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 3);
  const choices = shuffle([correct, ...uniq], ctx.rng);
  return { id, prompt, kind: 'choice', choices, answer: choices.indexOf(correct), ...extra };
}

function mcqFromItem(ctx: GameContext, item: McqItem, id: string, maxChoices = 4): GameQuestion {
  const correct = pick(item.choices[item.answer]!, ctx.locale);
  const others = shuffle(item.choices.filter((_, i) => i !== item.answer).map((c) => pick(c, ctx.locale)), ctx.rng).slice(0, maxChoices - 1);
  return choiceQ(ctx, id, pick(item.q, ctx.locale), correct, others, { topic: item.topic, ...(item.why ? { explanation: pick(item.why, ctx.locale) } : {}) });
}

function sample<T>(ctx: GameContext, xs: readonly T[], n: number): T[] {
  return shuffle(xs, ctx.rng).slice(0, n);
}

// ---------------------------------------------------------------- 1. Math Rush
function mathRushQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  let a: number, b: number, c: number, text: string, ans: number;
  const op = (lvl: number) => {
    if (lvl <= 1) return pickOne(rng, ['+', '-']);
    if (lvl === 2) return pickOne(rng, ['+', '-']);
    if (lvl === 3) return '×';
    if (lvl === 4) return pickOne(rng, ['+', '-', '×']);
    if (lvl === 5) return '÷';
    return pickOne(rng, ['+', '-', '×', '÷']);
  };
  if (level >= 8 && rng() < 0.5) {
    const p = pickOne(rng, [10, 20, 25, 50, 75]);
    b = int(rng, 1, 20) * 20;
    text = `${p}% × ${b}`; ans = (p * b) / 100;
  } else if (level >= 7) {
    a = int(rng, 2, 12); b = int(rng, 2, 12); c = int(rng, 1, 30);
    if (rng() < 0.5) { text = `${c} + ${a} × ${b}`; ans = c + a * b; } else { text = `(${c} − ${a}) × ${b}`; ans = (c - a) * b; }
  } else {
    const o = op(level);
    const range = level === 1 ? 20 : 100;
    if (o === '×') { a = int(rng, 2, level >= 6 ? 15 : 10); b = int(rng, 2, 10); ans = a * b; }
    else if (o === '÷') { b = int(rng, 2, 10); ans = int(rng, 2, 12); a = ans * b; }
    else {
      a = int(rng, level >= 6 ? -range : 1, range); b = int(rng, 1, range);
      if (o === '-' && level < 6 && b > a) [a, b] = [b, a];
      ans = o === '+' ? a + b : a - b;
    }
    text = `${a < 0 ? `(${a})` : a} ${o === '-' ? '−' : o} ${b}`;
  }
  return { id: `mr${i}`, prompt: tr(ctx, 'Calculate', 'Calcule', 'احسب'), code: `${text} = ?`, kind: 'input', answer: ans, topic: 'arithmetic' };
}

// ---------------------------------------------------------------- 2. Equation Master
function equationQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const x = int(rng, -9, 12) || 3;
  let eq: string;
  let ans = x;
  let prompt = tr(ctx, 'Solve for x', 'Résous pour x', 'أوجد قيمة x');
  const sgn = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);
  if (level === 1) { const a = int(rng, 1, 20); eq = `x ${sgn(a)} = ${x + a}`; }
  else if (level === 2) { const a = int(rng, 2, 9); eq = `${a}x = ${a * x}`; }
  else if (level === 3) { const a = int(rng, 2, 9), b = int(rng, -15, 15) || 4; eq = `${a}x ${sgn(b)} = ${a * x + b}`; }
  else if (level === 4) {
    if (rng() < 0.5) { const a = int(rng, 2, 6), b = int(rng, -8, 8) || 2; eq = `${a}(x ${sgn(b)}) = ${a * (x + b)}`; }
    else { const a = int(rng, 3, 9), c = int(rng, 1, a - 1), b = int(rng, -10, 10), d = (a - c) * x + b; eq = `${a}x ${sgn(b)} = ${c}x ${sgn(d)}`; }
  } else if (level === 5) {
    const r = int(rng, 2, 13);
    eq = `x² = ${r * r}`; ans = r;
    prompt = tr(ctx, 'Give the positive solution', 'Donne la solution positive', 'أعط الحل الموجب');
  } else {
    const r1 = int(rng, -9, 9), r2 = int(rng, -9, 9);
    const b = -(r1 + r2), c = r1 * r2;
    eq = `x² ${b === 0 ? '' : `${sgn(b)}x `}${c === 0 ? '' : sgn(c)} = 0`.replace(/\s+/g, ' ').replace('x² + 0', 'x²');
    ans = Math.max(r1, r2) + 0;
    prompt = tr(ctx, 'Give the larger solution', 'Donne la plus grande solution', 'أعط الحل الأكبر');
  }
  return { id: `eq${i}`, prompt, code: eq, kind: 'input', answer: ans, topic: level >= 5 ? 'quadratic' : 'linear' };
}

// ---------------------------------------------------------------- 6. Periodic Quest
function periodicQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const pool = ELEMENTS.slice(0, level <= 2 ? 20 : level === 3 ? 36 : level === 4 ? 54 : 118);
  const el = pickOne(rng, pool);
  const others = sample(ctx, pool.filter((e) => e.z !== el.z), 3);
  const name = (e: typeof el) => pick(e.name, ctx.locale);
  const kind = level === 1 ? 0 : level === 2 ? int(rng, 0, 1) : level === 3 ? int(rng, 0, 2) : int(rng, 0, 3);
  switch (kind) {
    case 0: return choiceQ(ctx, `pt${i}`, tr(ctx, `Which element has the symbol ${el.symbol}?`, `Quel élément a pour symbole ${el.symbol} ?`, `ما العنصر الذي رمزه ${el.symbol}؟`), name(el), others.map(name), { topic: 'symbols' });
    case 1: return { id: `pt${i}`, prompt: tr(ctx, `Type the symbol of ${name(el)}`, `Écris le symbole de : ${name(el)}`, `اكتب رمز ${name(el)}`), kind: 'input', answer: el.symbol, topic: 'symbols', explanation: `${name(el)} = ${el.symbol}` };
    case 2: return { id: `pt${i}`, prompt: tr(ctx, `What is the atomic number of ${name(el)} (${el.symbol})?`, `Quel est le numéro atomique de ${name(el)} (${el.symbol}) ?`, `ما العدد الذري لعنصر ${name(el)} (${el.symbol})؟`), kind: 'input', answer: el.z, topic: 'atomic-number' };
    default: {
      const CAT: Record<string, LocalizedText> = {
        'alkali-metal': L('Alkali metal', 'Métal alcalin', 'فلز قلوي'), 'alkaline-earth': L('Alkaline earth metal', 'Métal alcalino-terreux', 'فلز قلوي ترابي'),
        'transition-metal': L('Transition metal', 'Métal de transition', 'فلز انتقالي'), 'post-transition': L('Post-transition metal', 'Métal pauvre', 'فلز ضعيف'),
        metalloid: L('Metalloid', 'Métalloïde', 'شبه فلز'), nonmetal: L('Nonmetal', 'Non-métal', 'لافلز'), halogen: L('Halogen', 'Halogène', 'هالوجين'),
        'noble-gas': L('Noble gas', 'Gaz noble', 'غاز نبيل'), lanthanide: L('Lanthanide', 'Lanthanide', 'لانثانيد'), actinide: L('Actinide', 'Actinide', 'أكتينيد'),
      };
      const correct = pick(CAT[el.category]!, ctx.locale);
      const wrong = Object.entries(CAT).filter(([k]) => k !== el.category).map(([, v]) => pick(v, ctx.locale));
      return choiceQ(ctx, `pt${i}`, tr(ctx, `${name(el)} (${el.symbol}) is a…`, `${name(el)} (${el.symbol}) est un(e)…`, `${name(el)} (${el.symbol}) هو…`), correct, sample(ctx, wrong, 3), { topic: 'categories' });
    }
  }
}

// ---------------------------------------------------------------- 7. Physics Puzzle
interface PhysicsTemplate { level: number; build(ctx: GameContext): { prompt: string; known: Array<{ symbol: string; value: number; unit: string }>; unknown: string; unit: string } }

const PHYSICS_TEMPLATES: PhysicsTemplate[] = [
  { level: 1, build: (c) => { const d = int(c.rng, 2, 40) * 10, t = int(c.rng, 2, 20); return { prompt: tr(c, `A cyclist covers ${d} m in ${t} s. Average speed in m/s?`, `Un cycliste parcourt ${d} m en ${t} s. Vitesse moyenne en m/s ?`, `يقطع دراج ${d} م في ${t} ث. ما سرعته المتوسطة بـ م/ث؟`), known: [{ symbol: 'd', value: d, unit: 'm' }, { symbol: 't', value: t, unit: 's' }], unknown: 'v', unit: 'm/s' }; } },
  { level: 1, build: (c) => { const m = int(c.rng, 2, 50), a = int(c.rng, 1, 10); return { prompt: tr(c, `A ${m} kg cart accelerates at ${a} m/s². Net force in N?`, `Un chariot de ${m} kg accélère à ${a} m/s². Force nette en N ?`, `عربة كتلتها ${m} كغ تتسارع بـ ${a} م/ث². ما القوة المحصلة بالنيوتن؟`), known: [{ symbol: 'mass', value: m, unit: 'kg' }, { symbol: 'a', value: a, unit: 'm/s^2' }], unknown: 'F', unit: 'N' }; } },
  { level: 1, build: (c) => { const m = int(c.rng, 1, 30) * 10, v = int(c.rng, 1, 10) * 100; return { prompt: tr(c, `A block has a mass of ${m} g and a volume of ${v} cm³. Density in kg/m³?`, `Un bloc a une masse de ${m} g et un volume de ${v} cm³. Masse volumique en kg/m³ ?`, `جسم كتلته ${m} غ وحجمه ${v} سم³. ما كثافته بـ كغ/م³؟`), known: [{ symbol: 'mass', value: m, unit: 'g' }, { symbol: 'V', value: v, unit: 'cm^3' }], unknown: 'rho', unit: 'kg/m^3' }; } },
  { level: 2, build: (c) => { const r = int(c.rng, 2, 50) * 10, i = int(c.rng, 1, 20) / 10; return { prompt: tr(c, `A ${r} Ω resistor carries ${i} A. Voltage across it in V?`, `Une résistance de ${r} Ω est parcourue par ${i} A. Tension en V ?`, `مقاومة ${r} أوم يمر بها تيار ${i} أمبير. ما الجهد بالفولت؟`), known: [{ symbol: 'R', value: r, unit: 'ohm' }, { symbol: 'I', value: i, unit: 'A' }], unknown: 'U', unit: 'V' }; } },
  { level: 2, build: (c) => { const m = int(c.rng, 1, 20), v = int(c.rng, 2, 20); return { prompt: tr(c, `A ${m} kg ball moves at ${v} m/s. Kinetic energy in J?`, `Une balle de ${m} kg se déplace à ${v} m/s. Énergie cinétique en J ?`, `كرة كتلتها ${m} كغ تتحرك بسرعة ${v} م/ث. ما طاقتها الحركية بالجول؟`), known: [{ symbol: 'mass', value: m, unit: 'kg' }, { symbol: 'v', value: v, unit: 'm/s' }], unknown: 'KE', unit: 'J' }; } },
  { level: 2, build: (c) => { const u = int(c.rng, 2, 24) * 10, i = int(c.rng, 1, 10); return { prompt: tr(c, `A device runs at ${u} V and draws ${i} A. Power in W?`, `Un appareil fonctionne sous ${u} V et consomme ${i} A. Puissance en W ?`, `جهاز يعمل على ${u} فولت ويسحب ${i} أمبير. ما قدرته بالواط؟`), known: [{ symbol: 'U', value: u, unit: 'V' }, { symbol: 'I', value: i, unit: 'A' }], unknown: 'Pw', unit: 'W' }; } },
  { level: 3, build: (c) => { const a = int(c.rng, 1, 6), t = int(c.rng, 2, 12); return { prompt: tr(c, `A car starts from rest and accelerates at ${a} m/s² for ${t} s. Final speed in m/s?`, `Une voiture part du repos et accélère à ${a} m/s² pendant ${t} s. Vitesse finale en m/s ?`, `تنطلق سيارة من السكون بتسارع ${a} م/ث² لمدة ${t} ث. ما سرعتها النهائية بـ م/ث؟`), known: [{ symbol: 'u', value: 0, unit: 'm/s' }, { symbol: 'a', value: a, unit: 'm/s^2' }, { symbol: 't', value: t, unit: 's' }], unknown: 'v', unit: 'm/s' }; } },
  { level: 3, build: (c) => { const f = int(c.rng, 2, 50) * 10, lam = int(c.rng, 1, 20) / 10; return { prompt: tr(c, `A wave has frequency ${f} Hz and wavelength ${lam} m. Speed in m/s?`, `Une onde a une fréquence de ${f} Hz et une longueur d’onde de ${lam} m. Célérité en m/s ?`, `موجة ترددها ${f} هرتز وطولها ${lam} م. ما سرعتها بـ م/ث؟`), known: [{ symbol: 'f', value: f, unit: 'Hz' }, { symbol: 'lam', value: lam, unit: 'm' }], unknown: 'v', unit: 'm/s' }; } },
  { level: 3, build: (c) => { const m = int(c.rng, 1, 10), h = int(c.rng, 2, 30); return { prompt: tr(c, `A ${m} kg box is lifted ${h} m. Gain in potential energy in J? (g = 9.81 m/s²)`, `Une caisse de ${m} kg est soulevée de ${h} m. Gain d’énergie potentielle en J ? (g = 9,81 m/s²)`, `يُرفع صندوق كتلته ${m} كغ مسافة ${h} م. ما الزيادة في الطاقة الكامنة بالجول؟ (g = 9.81 م/ث²)`), known: [{ symbol: 'mass', value: m, unit: 'kg' }, { symbol: 'h', value: h, unit: 'm' }, { symbol: 'g', value: 9.81, unit: 'm/s^2' }], unknown: 'PE', unit: 'J' }; } },
  { level: 4, build: (c) => { const m = int(c.rng, 2, 10), a = int(c.rng, 1, 5), t = int(c.rng, 2, 8); return { prompt: tr(c, `A ${m} kg trolley starts from rest and accelerates at ${a} m/s² for ${t} s. Kinetic energy at the end in J?`, `Un chariot de ${m} kg part du repos et accélère à ${a} m/s² pendant ${t} s. Énergie cinétique finale en J ?`, `عربة كتلتها ${m} كغ تنطلق من السكون بتسارع ${a} م/ث² لمدة ${t} ث. ما طاقتها الحركية في النهاية بالجول؟`), known: [{ symbol: 'mass', value: m, unit: 'kg' }, { symbol: 'u', value: 0, unit: 'm/s' }, { symbol: 'a', value: a, unit: 'm/s^2' }, { symbol: 't', value: t, unit: 's' }], unknown: 'KE', unit: 'J' }; } },
  { level: 4, build: (c) => { const a = int(c.rng, 1, 5), t = int(c.rng, 2, 10); return { prompt: tr(c, `Starting from rest with acceleration ${a} m/s², how far (m) does an object travel in ${t} s?`, `Partant du repos avec une accélération de ${a} m/s², quelle distance (m) un objet parcourt-il en ${t} s ?`, `ينطلق جسم من السكون بتسارع ${a} م/ث². ما المسافة (م) التي يقطعها في ${t} ث؟`), known: [{ symbol: 'u', value: 0, unit: 'm/s' }, { symbol: 'a', value: a, unit: 'm/s^2' }, { symbol: 't', value: t, unit: 's' }], unknown: 'd', unit: 'm' }; } },
];

function physicsQuestion(ctx: GameContext, i: number): GameQuestion {
  const templates = PHYSICS_TEMPLATES.filter((t) => t.level <= ctx.level && t.level >= ctx.level - 1);
  const p = pickOne(ctx.rng, templates).build(ctx);
  const res = solvePhysics(p.known, p.unknown);
  const answer = Number(res.numeric![0]!.toPrecision(6));
  return { id: `ph${i}`, prompt: p.prompt, kind: 'input', answer, tolerance: 0.01, topic: p.unknown, explanation: res.steps.map((s) => s.description).join(' → ') };
}

// ---------------------------------------------------------------- 8. Chemistry Lab
function chemQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const kind = int(rng, 0, Math.min(4, level + 1));
  const c = pickOne(rng, COMPOUNDS);
  const others = sample(ctx, COMPOUNDS.filter((x) => x.formula !== c.formula), 3);
  if (kind === 0) return choiceQ(ctx, `ch${i}`, tr(ctx, `What is the name of ${c.formula}?`, `Quel est le nom de ${c.formula} ?`, `ما اسم المركب ${c.formula}؟`), pick(c.name, ctx.locale), others.map((o) => pick(o.name, ctx.locale)), { topic: 'nomenclature' });
  if (kind === 1) return choiceQ(ctx, `ch${i}`, tr(ctx, `Which formula is ${pick(c.name, 'en')}?`, `Quelle est la formule de : ${pick(c.name, 'fr')} ?`, `ما صيغة ${pick(c.name, 'ar')}؟`), c.formula, others.map((o) => o.formula), { topic: 'formulas' });
  if (kind === 2) {
    const wrong = Object.entries(COMPOUND_KINDS).filter(([k]) => k !== c.kind).map(([, v]) => pick(v, ctx.locale));
    return choiceQ(ctx, `ch${i}`, tr(ctx, `${c.formula} (${pick(c.name, 'en')}) is classified as…`, `${c.formula} (${pick(c.name, 'fr')}) est classé comme…`, `يُصنَّف ${c.formula} (${pick(c.name, 'ar')}) على أنه…`), pick(COMPOUND_KINDS[c.kind], ctx.locale), sample(ctx, wrong, 3), { topic: 'classification' });
  }
  if (kind === 3) {
    const reaction = pickOne(rng, REACTIONS);
    const bal = balanceEquation(reaction);
    const species = reaction.split(/\s*(?:->|\+)\s*/);
    const idx = int(rng, 0, species.length - 1);
    return { id: `ch${i}`, prompt: tr(ctx, `Balance the equation. What is the coefficient of ${species[idx]}?`, `Équilibre l’équation. Quel est le coefficient de ${species[idx]} ?`, `وازن المعادلة. ما معامل ${species[idx]}؟`), code: reaction.replace('->', '→'), kind: 'input', answer: bal.coefficients[idx]!, topic: 'balancing', explanation: bal.balanced };
  }
  const mm = molarMass(c.formula).numeric![0]!;
  const fmt = (x: number) => `${x.toFixed(1)} g/mol`;
  const wrong = [mm * 1.5, mm * 0.6, mm + 16, mm - 12].filter((x) => x > 0).map(fmt);
  return choiceQ(ctx, `ch${i}`, tr(ctx, `Molar mass of ${c.formula}?`, `Masse molaire de ${c.formula} ?`, `ما الكتلة المولية لـ ${c.formula}؟`), fmt(mm), sample(ctx, wrong, 3), { topic: 'molar-mass' });
}

// ---------------------------------------------------------------- 10. Geography Explorer
function geoQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const regions = level === 1 ? ['africa', 'asia'] : level === 2 ? ['africa', 'asia', 'europe'] : null;
  const pool = COUNTRIES.filter((c) => !regions || regions.includes(c.continent) && (level > 1 || ['TN', 'DZ', 'MA', 'EG', 'LY', 'MR', 'SD', 'SA', 'AE', 'QA', 'JO', 'LB', 'IQ', 'SY', 'OM', 'KW', 'SN', 'NG', 'KE', 'ZA', 'ET', 'GH'].includes(c.code)));
  const kind = int(rng, 0, level >= 4 ? 3 : 2);
  const c = pickOne(rng, pool);
  const n = (x: typeof c) => pick(x.name, ctx.locale);
  const cap = (x: typeof c) => pick(x.capital, ctx.locale);
  if (kind === 0) return choiceQ(ctx, `geo${i}`, tr(ctx, `What is the capital of ${n(c)}?`, `Quelle est la capitale de ce pays : ${n(c)} ?`, `ما عاصمة ${n(c)}؟`), cap(c), sample(ctx, pool.filter((x) => x.code !== c.code), 3).map(cap), { topic: 'capitals' });
  if (kind === 1) return choiceQ(ctx, `geo${i}`, tr(ctx, `${cap(c)} is the capital of…`, `${cap(c)} est la capitale de…`, `${cap(c)} عاصمة…`), n(c), sample(ctx, pool.filter((x) => x.code !== c.code), 3).map(n), { topic: 'capitals' });
  if (kind === 2) {
    const wrong = Object.entries(CONTINENTS).filter(([k]) => k !== c.continent).map(([, v]) => pick(v, ctx.locale));
    return choiceQ(ctx, `geo${i}`, tr(ctx, `On which continent is ${n(c)}?`, `Sur quel continent se trouve ce pays : ${n(c)} ?`, `في أي قارة تقع ${n(c)}؟`), pick(CONTINENTS[c.continent], ctx.locale), sample(ctx, wrong, 3), { topic: 'continents' });
  }
  // Which capital is furthest north (uses bundled coordinates). Ensure a clear gap of ≥ 3°.
  let group = sample(ctx, COUNTRIES, 4);
  for (let tries = 0; tries < 20; tries++) {
    const lats = group.map((g) => g.lat).sort((a, b) => b - a);
    if (lats[0]! - lats[1]! >= 3) break;
    group = sample(ctx, COUNTRIES, 4);
  }
  const north = [...group].sort((a, b) => b.lat - a.lat)[0]!;
  return choiceQ(ctx, `geo${i}`, tr(ctx, 'Which capital is furthest north?', 'Quelle capitale est la plus au nord ?', 'أي عاصمة تقع في أقصى الشمال؟'), cap(north), group.filter((g) => g !== north).map(cap), { topic: 'locations', explanation: group.map((g) => `${cap(g)} ${g.lat}°`).join(', ') });
}

// ---------------------------------------------------------------- 11. Code Logic
function codeQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const prompt = tr(ctx, 'What does this program print?', 'Qu’affiche ce programme ?', 'ماذا يطبع هذا البرنامج؟');
  const kind = int(rng, 0, Math.min(7, 2 + level * 2));
  switch (kind) {
    case 0: { const a = int(rng, 1, 5), b = int(rng, 6, 12); let t = 0; for (let k = a; k < b; k++) t += k; return { id: `cl${i}`, prompt, code: `total = 0\nfor i in range(${a}, ${b}):\n    total += i\nprint(total)`, kind: 'input', answer: t, topic: 'loops' }; }
    case 1: { const x = int(rng, 3, 40); const out = x % 2 === 0 ? x / 2 : 3 * x + 1; return { id: `cl${i}`, prompt, code: `x = ${x}\nif x % 2 == 0:\n    print(x // 2)\nelse:\n    print(3 * x + 1)`, kind: 'input', answer: out, topic: 'conditionals' }; }
    case 2: { const nums = Array.from({ length: 5 }, () => int(rng, 1, 99)); const k = int(rng, -2, 4); return { id: `cl${i}`, prompt, code: `nums = [${nums.join(', ')}]\nprint(nums[${k}])`, kind: 'input', answer: nums[(k + 5) % 5]!, topic: 'lists', explanation: tr(ctx, 'Indexes start at 0; negative indexes count from the end.', 'Les indices commencent à 0 ; les indices négatifs partent de la fin.', 'تبدأ الفهارس من 0، والفهارس السالبة تعد من النهاية.') }; }
    case 3: { const limit = int(rng, 20, 200); let n = 1, c = 0; while (n < limit) { n *= 2; c++; } return { id: `cl${i}`, prompt, code: `n = 1\ncount = 0\nwhile n < ${limit}:\n    n = n * 2\n    count += 1\nprint(count)`, kind: 'input', answer: c, topic: 'loops' }; }
    case 4: { const bits = Array.from({ length: int(rng, 3, 6) }, (_, j) => (j === 0 ? 1 : int(rng, 0, 1))).join(''); return { id: `cl${i}`, prompt: tr(ctx, 'Convert this binary number to decimal', 'Convertis ce nombre binaire en décimal', 'حوّل هذا العدد الثنائي إلى العشري'), code: bits, kind: 'input', answer: parseInt(bits, 2), topic: 'binary' }; }
    case 5: { const a = int(rng, 2, 5), b = int(rng, 2, 5); return { id: `cl${i}`, prompt, code: `count = 0\nfor i in range(${a}):\n    for j in range(${b}):\n        count += 1\nprint(count)`, kind: 'input', answer: a * b, topic: 'nested-loops' }; }
    case 6: {
      const words = ['exam', 'mate', 'code', 'logic', 'python', 'study'];
      const w = pickOne(rng, words);
      return { id: `cl${i}`, prompt, code: `word = "${w}"\nprint(word[::-1])`, kind: 'input', answer: [...w].reverse().join(''), topic: 'strings' };
    }
    default: return mcqFromItem(ctx, pickOne(rng, CS_CONCEPTS), `cl${i}`);
  }
}

// ---------------------------------------------------------------- 12. Pattern Detective
function patternQuestion(ctx: GameContext, i: number): GameQuestion {
  const { rng, level } = ctx;
  const kind = int(rng, Math.max(0, level - 3), Math.min(5, level));
  let seq: number[];
  let topic: string;
  switch (kind) {
    case 0: { const a = int(rng, -10, 20), d = int(rng, 2, 9) * (rng() < 0.2 ? -1 : 1); seq = Array.from({ length: 6 }, (_, k) => a + k * d); topic = 'arithmetic'; break; }
    case 1: { const a = int(rng, 1, 5), r = int(rng, 2, 3); seq = Array.from({ length: 6 }, (_, k) => a * r ** k); topic = 'geometric'; break; }
    case 2: { const p = int(rng, 2, 3), s = int(rng, 1, 4); seq = Array.from({ length: 6 }, (_, k) => (k + s) ** p); topic = p === 2 ? 'squares' : 'cubes'; break; }
    case 3: { const a = int(rng, 1, 5), b = int(rng, 1, 5); seq = [a, b]; while (seq.length < 7) seq.push(seq[seq.length - 1]! + seq[seq.length - 2]!); topic = 'fibonacci'; break; }
    case 4: { const a = int(rng, 1, 9), b = int(rng, 20, 40), da = int(rng, 1, 4), db = -int(rng, 1, 3); seq = Array.from({ length: 7 }, (_, k) => (k % 2 === 0 ? a + (k / 2) * da : b + ((k - 1) / 2) * db)); topic = 'interleaved'; break; }
    default: { const a = int(rng, 1, 3), b = int(rng, -3, 3), c = int(rng, 0, 9); seq = Array.from({ length: 6 }, (_, k) => a * k * k + b * k + c); topic = 'quadratic'; break; }
  }
  const shown = seq.slice(0, -1);
  return { id: `pd${i}`, prompt: tr(ctx, 'What number comes next?', 'Quel nombre vient ensuite ?', 'ما العدد التالي؟'), code: `${shown.join(', ')}, ?`, kind: 'input', answer: seq[seq.length - 1]!, topic };
}

// ---------------------------------------------------------------- 5. Word Master
function scramble(ctx: GameContext, word: string): string {
  const letters = [...word];
  for (let t = 0; t < 10; t++) {
    const s = shuffle(letters, ctx.rng).join('');
    if (s !== word) return s;
  }
  return [...word].reverse().join('');
}

function wordQuestions(ctx: GameContext): GameQuestion[] {
  const words = WORDS[ctx.locale];
  const sorted = [...words].sort((a, b) => [...a.word].length - [...b.word].length);
  const q = Math.ceil(sorted.length / 4);
  const pool = sorted.slice(Math.max(0, (ctx.level - 1) * q - 2), Math.min(sorted.length, ctx.level * q + 2));
  return sample(ctx, pool, 8).map((w, i) => ({
    id: `wm${i}`,
    prompt: tr(ctx, `Unscramble the word. Hint: ${w.hint}`, `Remets les lettres dans l’ordre. Indice : ${w.hint}`, `رتّب حروف الكلمة. تلميح: ${w.hint}`),
    code: [...scramble(ctx, w.word)].join(' '),
    kind: 'input' as const, answer: w.word, topic: 'spelling',
  }));
}

// ---------------------------------------------------------------- 13/4. Decks for Flashcard Sprint & Memory Cards
function bundledDeck(locale: Locale): Array<{ front: string; back: string }> {
  const other: Locale = locale === 'en' ? 'fr' : 'en';
  return [
    ...VOCAB.map((v) => ({ front: pick(v, locale), back: pick(v, other) })),
    ...FORMULA_PAIRS.map((f) => ({ front: pick(f.name, locale), back: f.formula })),
  ];
}

function flashcardQuestions(ctx: GameContext): GameQuestion[] {
  const deck = ctx.deck && ctx.deck.length >= 4 ? ctx.deck : bundledDeck(ctx.locale);
  const reversed = ctx.level >= 2;
  const n = Math.min(40, deck.length * 2);
  const out: GameQuestion[] = [];
  for (let i = 0; i < n; i++) {
    const card = deck[i % deck.length === 0 ? Math.floor(ctx.rng() * deck.length) : Math.floor(ctx.rng() * deck.length)]!;
    const flip = reversed && ctx.level >= 3 ? ctx.rng() < 0.5 : reversed;
    const front = flip ? card.back : card.front;
    const back = flip ? card.front : card.back;
    const distractors = sample(ctx, deck.filter((d) => d !== card), 3).map((d) => (flip ? d.front : d.back));
    out.push(choiceQ(ctx, `fs${i}`, front, back, distractors, { topic: 'recall' }));
  }
  return out;
}

function memoryPairs(ctx: GameContext): Array<[string, string]> {
  if (ctx.deck && ctx.deck.length >= 4) return sample(ctx, ctx.deck, Math.min(8, 3 + ctx.level)).map((c) => [c.front, c.back]);
  const n = [4, 6, 6, 8, 8][ctx.level - 1] ?? 8;
  const other: Locale = ctx.locale === 'en' ? 'fr' : 'en';
  const sources: Array<Array<[string, string]>> = [
    ELEMENTS.slice(0, 30).map((e) => [e.symbol, pick(e.name, ctx.locale)]),
    VOCAB.map((v) => [pick(v, ctx.locale), pick(v, other)]),
    FORMULA_PAIRS.map((f) => [f.formula, pick(f.name, ctx.locale)]),
    COMPOUNDS.map((c) => [c.formula, pick(c.name, ctx.locale)]),
  ];
  const src = ctx.level <= 4 ? sources[ctx.level - 1]! : sources.flat();
  return sample(ctx, src, n);
}

// ---------------------------------------------------------------- 14. True or False
function trueFalseQuestions(ctx: GameContext): GameQuestion[] {
  const statements = sample(ctx, TRUE_FALSE, TRUE_FALSE.length).map((t, i) => ({
    id: `tf${i}`, prompt: pick(t.s, ctx.locale), kind: 'truefalse' as const, choices: [tr(ctx, 'True', 'Vrai', 'صحيح'), tr(ctx, 'False', 'Faux', 'خطأ')],
    answer: t.value ? 0 : 1, topic: t.topic, ...(t.why ? { explanation: pick(t.why, ctx.locale) } : {}),
  }));
  // Mix in generated arithmetic statements so the pool never runs dry within a sprint.
  const generated: GameQuestion[] = Array.from({ length: 20 }, (_, i) => {
    const a = int(ctx.rng, 2, 12 + ctx.level * 3), b = int(ctx.rng, 2, 12);
    const truth = ctx.rng() < 0.5;
    const shown = truth ? a * b : a * b + pickOne(ctx.rng, [-2, -1, 1, 2, 10]);
    return { id: `tfg${i}`, prompt: `${a} × ${b} = ${shown}`, kind: 'truefalse' as const, choices: [tr(ctx, 'True', 'Vrai', 'صحيح'), tr(ctx, 'False', 'Faux', 'خطأ')], answer: truth ? 0 : 1, topic: 'arithmetic' };
  });
  return shuffle([...statements, ...generated], ctx.rng);
}

// ---------------------------------------------------------------- Definitions
const text = (en: string, fr: string, ar: string) => L(en, fr, ar);

export const GAMES: GameDefinition[] = [
  {
    id: 'math-rush', icon: '⚡', subject: 'math', mode: 'quiz', timing: 'sprint', timeLimitSec: 60, questionsPerRound: 80, maxLevel: 8, lives: null,
    title: text('Math Rush', 'Course au calcul', 'سباق الحساب'),
    description: text('Solve as many calculations as you can in 60 seconds.', 'Résous un maximum de calculs en 60 secondes.', 'حلّ أكبر عدد من العمليات خلال 60 ثانية.'),
    instructions: text('Type the answer and press Enter. Fast answers and streaks earn bonus points. Get 70% right with at least 10 answers to unlock the next level.', 'Tape la réponse puis Entrée. Les réponses rapides et les séries rapportent des bonus. 70 % de bonnes réponses (au moins 10) débloquent le niveau suivant.', 'اكتب الإجابة واضغط Enter. الإجابات السريعة والمتتالية تمنح نقاطًا إضافية. أجب بدقة 70٪ على 10 أسئلة على الأقل لفتح المستوى التالي.'),
    generate: (ctx) => Array.from({ length: 80 }, (_, i) => mathRushQuestion(ctx, i)),
  },
  {
    id: 'equation-master', icon: '🧮', subject: 'math', mode: 'quiz', timing: 'rounds', timeLimitSec: 40, questionsPerRound: 8, maxLevel: 6, lives: 3,
    title: text('Equation Master', 'Maître des équations', 'سيد المعادلات'),
    description: text('Solve equations from one-step to quadratics.', 'Résous des équations, du premier degré au second degré.', 'حلّ معادلات من خطوة واحدة حتى الدرجة الثانية.'),
    instructions: text('Find x and type it. You have 3 lives per round. Levels: x + a = b → ax = b → ax + b = c → brackets → x² = k → quadratics.', 'Trouve x et tape-le. Tu as 3 vies par manche. Niveaux : x + a = b → ax = b → ax + b = c → parenthèses → x² = k → second degré.', 'أوجد x واكتبه. لديك 3 محاولات في كل جولة. المستويات: x + a = b ← ax = b ← ax + b = c ← الأقواس ← x² = k ← الدرجة الثانية.'),
    generate: (ctx) => Array.from({ length: 8 }, (_, i) => equationQuestion(ctx, i)),
  },
  {
    id: 'quiz-battle', icon: '🏆', subject: 'general', mode: 'quiz', timing: 'rounds', timeLimitSec: 20, questionsPerRound: 10, maxLevel: 5, lives: null,
    title: text('Quiz Battle', 'Duel de quiz', 'معركة الأسئلة'),
    description: text('Beat Robo, an offline opponent, in a general-knowledge duel.', 'Bats Robo, un adversaire hors ligne, dans un duel de culture générale.', 'تغلّب على روبو، منافس يعمل دون اتصال، في مبارزة ثقافة عامة.'),
    instructions: text('Answer 10 questions. Robo answers too — score more points than Robo to win and unlock a tougher Robo.', 'Réponds à 10 questions. Robo répond aussi : marque plus de points que lui pour gagner et affronter un Robo plus fort.', 'أجب عن 10 أسئلة. يجيب روبو أيضًا — اجمع نقاطًا أكثر منه لتفوز وتواجه روبو أقوى.'),
    generate: (ctx) => sample(ctx, GENERAL_QUIZ, 10).map((q, i) => mcqFromItem(ctx, q, `qb${i}`)),
  },
  {
    id: 'memory-cards', icon: '🃏', subject: 'general', mode: 'memory', timing: 'rounds', timeLimitSec: 120, questionsPerRound: 0, maxLevel: 5, lives: null,
    title: text('Memory Cards', 'Cartes mémoire', 'بطاقات الذاكرة'),
    description: text('Match symbols, words and formulas with their pairs.', 'Associe symboles, mots et formules à leur paire.', 'طابق الرموز والكلمات والقوانين مع أزواجها.'),
    instructions: text('Flip two cards. If they belong together they stay open. Find all pairs in as few moves as possible.', 'Retourne deux cartes. Si elles vont ensemble, elles restent visibles. Trouve toutes les paires en un minimum de coups.', 'اقلب بطاقتين. إذا كانتا مترابطتين تبقيان مكشوفتين. اعثر على كل الأزواج بأقل عدد من الحركات.'),
    generate: () => [],
    pairs: memoryPairs,
  },
  {
    id: 'word-master', icon: '🔤', subject: 'languages', mode: 'quiz', timing: 'rounds', timeLimitSec: 30, questionsPerRound: 8, maxLevel: 4, lives: 3,
    title: text('Word Master', 'Maître des mots', 'سيد الكلمات'),
    description: text('Unscramble and spell vocabulary words.', 'Remets les lettres dans l’ordre et orthographie les mots.', 'رتّب الحروف واكتب الكلمات بشكل صحيح.'),
    instructions: text('Read the hint, rearrange the letters and type the word with correct spelling (accents are optional).', 'Lis l’indice, remets les lettres dans l’ordre et écris le mot (les accents sont facultatifs).', 'اقرأ التلميح ورتّب الحروف واكتب الكلمة بشكل صحيح (التشكيل اختياري).'),
    generate: wordQuestions,
  },
  {
    id: 'periodic-quest', icon: '⚗️', subject: 'chemistry', mode: 'quiz', timing: 'rounds', timeLimitSec: 20, questionsPerRound: 10, maxLevel: 5, lives: null,
    title: text('Periodic Table Quest', 'Quête du tableau périodique', 'مغامرة الجدول الدوري'),
    description: text('Learn element names, symbols, numbers and families.', 'Apprends noms, symboles, numéros et familles des éléments.', 'تعلّم أسماء العناصر ورموزها وأعدادها الذرية وعائلاتها.'),
    instructions: text('Answer 10 questions. Each level adds more elements (20 → 36 → 54 → 118) and new question types.', 'Réponds à 10 questions. Chaque niveau ajoute des éléments (20 → 36 → 54 → 118) et de nouveaux types de questions.', 'أجب عن 10 أسئلة. يضيف كل مستوى عناصر جديدة (20 ← 36 ← 54 ← 118) وأنواع أسئلة جديدة.'),
    generate: (ctx) => Array.from({ length: 10 }, (_, i) => periodicQuestion(ctx, i)),
  },
  {
    id: 'physics-puzzle', icon: '🚀', subject: 'physics', mode: 'quiz', timing: 'rounds', timeLimitSec: 90, questionsPerRound: 6, maxLevel: 4, lives: 3,
    title: text('Physics Puzzle', 'Énigmes de physique', 'ألغاز الفيزياء'),
    description: text('Solve motion, force, energy and circuit problems.', 'Résous des problèmes de mouvement, forces, énergie et circuits.', 'حلّ مسائل في الحركة والقوة والطاقة والدارات.'),
    instructions: text('Type a numeric answer in the requested unit. Answers within 1% are accepted. Use the Quick Tools calculator if you like.', 'Tape une réponse numérique dans l’unité demandée. Une marge de 1 % est acceptée. Tu peux utiliser la calculatrice.', 'اكتب إجابة رقمية بالوحدة المطلوبة. تُقبل الإجابات ضمن هامش 1٪. يمكنك استخدام الآلة الحاسبة.'),
    generate: (ctx) => Array.from({ length: 6 }, (_, i) => physicsQuestion(ctx, i)),
  },
  {
    id: 'chem-lab', icon: '🧪', subject: 'chemistry', mode: 'quiz', timing: 'rounds', timeLimitSec: 45, questionsPerRound: 8, maxLevel: 4, lives: 3,
    title: text('Chemistry Lab Puzzle', 'Labo de chimie', 'مختبر الكيمياء'),
    description: text('Name compounds, classify them and balance reactions.', 'Nomme des composés, classe-les et équilibre des réactions.', 'سمِّ المركبات وصنّفها ووازن التفاعلات.'),
    instructions: text('Pick or type the answer. Balancing questions ask for one coefficient of the smallest whole-number balanced equation.', 'Choisis ou tape la réponse. Pour l’équilibrage, donne un coefficient de l’équation équilibrée avec les plus petits entiers.', 'اختر الإجابة أو اكتبها. في أسئلة الموازنة أعطِ معامل مادة واحدة في المعادلة الموزونة بأصغر أعداد صحيحة.'),
    generate: (ctx) => Array.from({ length: 8 }, (_, i) => chemQuestion(ctx, i)),
  },
  {
    id: 'biology-challenge', icon: '🧬', subject: 'biology', mode: 'quiz', timing: 'rounds', timeLimitSec: 25, questionsPerRound: 8, maxLevel: 3, lives: null,
    title: text('Biology Challenge', 'Défi biologie', 'تحدي الأحياء'),
    description: text('Cells, genetics, the human body and ecology.', 'Cellules, génétique, corps humain et écologie.', 'الخلايا والوراثة وجسم الإنسان والبيئة.'),
    instructions: text('Answer 8 questions. Level 1 has 3 options; higher levels have 4 options and less time for the speed bonus.', 'Réponds à 8 questions. Le niveau 1 propose 3 choix ; les suivants 4 choix et moins de temps pour le bonus.', 'أجب عن 8 أسئلة. في المستوى 1 ثلاثة خيارات؛ والمستويات الأعلى أربعة خيارات ووقت أقل لمكافأة السرعة.'),
    generate: (ctx) => sample(ctx, BIOLOGY_QUIZ, 8).map((q, i) => mcqFromItem(ctx, q, `bio${i}`, ctx.level === 1 ? 3 : 4)),
  },
  {
    id: 'geo-explorer', icon: '🌍', subject: 'geography', mode: 'quiz', timing: 'rounds', timeLimitSec: 20, questionsPerRound: 10, maxLevel: 4, lives: null,
    title: text('Geography Explorer', 'Explorateur géo', 'مستكشف الجغرافيا'),
    description: text('Countries, capitals, continents and locations — all offline.', 'Pays, capitales, continents et localisation — entièrement hors ligne.', 'الدول والعواصم والقارات والمواقع — دون اتصال.'),
    instructions: text('Level 1: North Africa & the Middle East. Level 2 adds Europe, level 3 the whole world, level 4 adds location questions.', 'Niveau 1 : Afrique du Nord et Moyen-Orient. Le niveau 2 ajoute l’Europe, le 3 le monde entier, le 4 des questions de localisation.', 'المستوى 1: شمال أفريقيا والشرق الأوسط. يضيف المستوى 2 أوروبا، والمستوى 3 العالم كله، والمستوى 4 أسئلة المواقع.'),
    generate: (ctx) => Array.from({ length: 10 }, (_, i) => geoQuestion(ctx, i)),
  },
  {
    id: 'code-logic', icon: '💻', subject: 'cs', mode: 'quiz', timing: 'rounds', timeLimitSec: 60, questionsPerRound: 8, maxLevel: 3, lives: 3,
    title: text('Code Logic', 'Logique de code', 'منطق البرمجة'),
    description: text('Trace short programs and reason about algorithms.', 'Suis l’exécution de petits programmes et raisonne sur les algorithmes.', 'تتبّع برامج قصيرة وفكّر في الخوارزميات.'),
    instructions: text('Read the Python-style code and type exactly what it prints, or choose the right concept.', 'Lis le code de style Python et tape exactement ce qu’il affiche, ou choisis la bonne notion.', 'اقرأ الشيفرة بأسلوب بايثون واكتب ما تطبعه بالضبط، أو اختر المفهوم الصحيح.'),
    generate: (ctx) => Array.from({ length: 8 }, (_, i) => codeQuestion(ctx, i)),
  },
  {
    id: 'pattern-detective', icon: '🔍', subject: 'math', mode: 'quiz', timing: 'rounds', timeLimitSec: 45, questionsPerRound: 8, maxLevel: 6, lives: 3,
    title: text('Pattern Detective', 'Détective des suites', 'محقق الأنماط'),
    description: text('Find the rule and predict the next number.', 'Trouve la règle et devine le nombre suivant.', 'اكتشف القاعدة وتوقّع العدد التالي.'),
    instructions: text('Sequences get harder: arithmetic, geometric, powers, Fibonacci-like, interleaved and quadratic. Type the next term.', 'Les suites se compliquent : arithmétiques, géométriques, puissances, type Fibonacci, entrelacées et quadratiques. Tape le terme suivant.', 'تزداد المتتاليات صعوبة: حسابية، هندسية، قوى، شبيهة بفيبوناتشي، متداخلة وتربيعية. اكتب الحد التالي.'),
    generate: (ctx) => Array.from({ length: 8 }, (_, i) => patternQuestion(ctx, i)),
  },
  {
    id: 'flashcard-sprint', icon: '🏃', subject: 'general', mode: 'quiz', timing: 'sprint', timeLimitSec: 60, questionsPerRound: 40, maxLevel: 3, lives: null,
    title: text('Flashcard Sprint', 'Sprint de cartes', 'سباق البطاقات'),
    description: text('Race through a deck and track your recall speed.', 'Enchaîne les cartes et mesure ta vitesse de rappel.', 'راجع مجموعة بطاقات بسرعة وقِس سرعة تذكّرك.'),
    instructions: text('Pick the matching answer for each card. Uses your downloaded deck if you have one, otherwise a bundled deck. Level 2 reverses the cards; level 3 mixes both directions.', 'Choisis la bonne réponse pour chaque carte. Utilise ton paquet téléchargé s’il existe, sinon un paquet inclus. Le niveau 2 inverse les cartes ; le 3 mélange les deux sens.', 'اختر الإجابة المطابقة لكل بطاقة. تُستخدم مجموعتك المنزّلة إن وجدت، وإلا فمجموعة مضمّنة. المستوى 2 يعكس البطاقات، والمستوى 3 يخلط الاتجاهين.'),
    generate: flashcardQuestions,
  },
  {
    id: 'true-false', icon: '✅', subject: 'general', mode: 'quiz', timing: 'sprint', timeLimitSec: 45, questionsPerRound: 50, maxLevel: 4, lives: null,
    title: text('True or False', 'Vrai ou faux', 'صح أم خطأ'),
    description: text('Judge as many statements as you can in 45 seconds.', 'Juge un maximum d’affirmations en 45 secondes.', 'احكم على أكبر عدد من العبارات خلال 45 ثانية.'),
    instructions: text('Press True (T) or False (F). Wrong answers break your streak. Higher levels use larger numbers.', 'Appuie sur Vrai (T) ou Faux (F). Une erreur casse ta série. Les niveaux supérieurs utilisent de plus grands nombres.', 'اضغط صحيح (T) أو خطأ (F). الإجابة الخاطئة تقطع سلسلتك. تستخدم المستويات الأعلى أعدادًا أكبر.'),
    generate: trueFalseQuestions,
  },
  {
    id: 'daily-challenge', icon: '📅', subject: 'general', mode: 'quiz', timing: 'rounds', timeLimitSec: 40, questionsPerRound: 10, maxLevel: 1, lives: null,
    title: text('Daily Challenge', 'Défi du jour', 'تحدي اليوم'),
    description: text('Ten mixed questions, the same for everyone each day.', 'Dix questions variées, les mêmes pour tous chaque jour.', 'عشرة أسئلة متنوعة، نفسها للجميع كل يوم.'),
    instructions: text('A new set is generated from the date every day — offline. Play daily to build a streak.', 'Un nouveau défi est généré chaque jour à partir de la date — hors ligne. Joue chaque jour pour construire une série.', 'تُولَّد مجموعة جديدة كل يوم من التاريخ — دون اتصال. العب يوميًا لتبني سلسلة.'),
    generate: (ctx) => {
      const sub = { ...ctx, level: 3 };
      return [
        mathRushQuestion({ ...sub, level: 4 }, 0), mathRushQuestion({ ...sub, level: 7 }, 1),
        patternQuestion(sub, 2), equationQuestion(sub, 3),
        ...trueFalseQuestions(sub).slice(0, 2).map((q, i) => ({ ...q, id: `dc-tf${i}` })),
        mcqFromItem(ctx, pickOne(ctx.rng, GENERAL_QUIZ), 'dc-q1'),
        periodicQuestion({ ...sub, level: 2 }, 7), geoQuestion({ ...sub, level: 3 }, 8), codeQuestion({ ...sub, level: 2 }, 9),
      ].map((q, i) => ({ ...q, id: `dc${i}` }));
    },
  },
];

export const GAME_BY_ID: Record<GameId, GameDefinition> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameDefinition>;

/** Seed derived from the calendar date so every player gets the same daily challenge. */
export function dailySeed(dateKey: string): number {
  let h = 2166136261;
  for (const ch of dateKey) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
