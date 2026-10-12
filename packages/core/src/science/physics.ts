import { m } from '../math/mathjs.js';
import { solveEquation, formatNumber } from '../math/engine.js';
import type { MathResult, SolutionStep, Verification } from '../math/types.js';
import { dimensionOf, normalizeUnit } from './units.js';

export interface PhysicsVariable {
  symbol: string;
  /** SI unit used for computation. */
  unit: string;
  /** Keywords (en/fr/ar) that refer to this quantity in a word problem. */
  keywords: string[];
  /** Physical magnitudes that cannot be negative. */
  nonNegative?: boolean;
}

export interface PhysicsFormula {
  id: string;
  name: string;
  topic: 'kinematics' | 'dynamics' | 'energy' | 'electricity' | 'waves' | 'fluids' | 'thermal';
  equation: string;
  latex: string;
  variables: string[];
}

export const PHYSICS_VARIABLES: Record<string, PhysicsVariable> = {
  v: { symbol: 'v', unit: 'm/s', keywords: ['speed', 'velocity', 'final velocity', 'final speed', 'vitesse', 'سرعة', 'السرعة', 'سرعت'] },
  u: { symbol: 'u', unit: 'm/s', keywords: ['initial velocity', 'initial speed', 'starts at', 'vitesse initiale', 'السرعة الابتدائية'] },
  a: { symbol: 'a', unit: 'm/s^2', keywords: ['acceleration', 'accélération', 'تسارع', 'التسارع'] },
  t: { symbol: 't', unit: 's', keywords: ['time', 'seconds', 'how long', 'temps', 'durée', 'زمن', 'الزمن', 'الوقت'], nonNegative: true },
  d: { symbol: 'd', unit: 'm', keywords: ['distance', 'displacement', 'how far', 'travels', 'déplacement', 'مسافة', 'المسافة'] },
  F: { symbol: 'F', unit: 'N', keywords: ['force', 'net force', 'قوة', 'القوة'] },
  mass: { symbol: 'mass', unit: 'kg', keywords: ['mass', 'masse', 'كتلة', 'الكتلة'], nonNegative: true },
  g: { symbol: 'g', unit: 'm/s^2', keywords: ['gravity', 'gravitational acceleration', 'pesanteur', 'الجاذبية'] },
  Wt: { symbol: 'Wt', unit: 'N', keywords: ['weight', 'poids', 'وزن', 'الوزن'], nonNegative: true },
  W: { symbol: 'W', unit: 'J', keywords: ['work', 'travail', 'شغل', 'الشغل'] },
  Pw: { symbol: 'Pw', unit: 'W', keywords: ['power', 'puissance', 'قدرة', 'القدرة'] },
  KE: { symbol: 'KE', unit: 'J', keywords: ['kinetic energy', 'énergie cinétique', 'الطاقة الحركية'], nonNegative: true },
  PE: { symbol: 'PE', unit: 'J', keywords: ['potential energy', 'énergie potentielle', 'الطاقة الكامنة'] },
  h: { symbol: 'h', unit: 'm', keywords: ['height', 'lifted', 'raised', 'dropped from', 'hauteur', 'soulev', 'ارتفاع', 'الارتفاع', 'رفع'] },
  p: { symbol: 'p', unit: 'kg m/s', keywords: ['momentum', 'quantité de mouvement', 'كمية الحركة'] },
  rho: { symbol: 'rho', unit: 'kg/m^3', keywords: ['density', 'masse volumique', 'كثافة', 'الكثافة'], nonNegative: true },
  V: { symbol: 'V', unit: 'm^3', keywords: ['volume', 'حجم', 'الحجم'], nonNegative: true },
  Pr: { symbol: 'Pr', unit: 'Pa', keywords: ['pressure', 'pression', 'ضغط', 'الضغط'] },
  A: { symbol: 'A', unit: 'm^2', keywords: ['area', 'surface', 'aire', 'مساحة', 'المساحة'], nonNegative: true },
  U: { symbol: 'U', unit: 'V', keywords: ['voltage', 'potential difference', 'tension', 'جهد', 'الجهد', 'فرق الجهد'] },
  I: { symbol: 'I', unit: 'A', keywords: ['current', 'intensité', 'courant', 'تيار', 'شدة التيار'] },
  R: { symbol: 'R', unit: 'ohm', keywords: ['resistance', 'résistance', 'مقاومة', 'المقاومة'], nonNegative: true },
  Q: { symbol: 'Q', unit: 'C', keywords: ['charge', 'شحنة', 'الشحنة'] },
  f: { symbol: 'f', unit: 'Hz', keywords: ['frequency', 'fréquence', 'تردد', 'التردد'], nonNegative: true },
  T: { symbol: 'T', unit: 's', keywords: ['period', 'période', 'دور', 'الدور'], nonNegative: true },
  lam: { symbol: 'lam', unit: 'm', keywords: ['wavelength', 'longueur d\'onde', 'طول الموجة'], nonNegative: true },
  k: { symbol: 'k', unit: 'N/m', keywords: ['spring constant', 'stiffness', 'raideur', 'ثابت النابض'], nonNegative: true },
  x: { symbol: 'x', unit: 'm', keywords: ['extension', 'compression', 'stretched', 'compressed', 'extended', 'allongement', 'étiré', 'استطالة'] },
  Qh: { symbol: 'Qh', unit: 'J', keywords: ['heat', 'thermal energy', 'chaleur', 'حرارة', 'كمية الحرارة'] },
  c: { symbol: 'c', unit: 'J/(kg K)', keywords: ['specific heat', 'capacité thermique massique', 'السعة الحرارية'], nonNegative: true },
  dT: { symbol: 'dT', unit: 'K', keywords: ['temperature change', 'temperature rise', 'variation de température', 'تغير درجة الحرارة'] },
};

export const PHYSICS_FORMULAS: PhysicsFormula[] = [
  { id: 'speed', name: 'Average speed', topic: 'kinematics', equation: 'v = d / t', latex: 'v = \\frac{d}{t}', variables: ['v', 'd', 't'] },
  { id: 'accel', name: 'Acceleration', topic: 'kinematics', equation: 'a = (v - u) / t', latex: 'a = \\frac{v - u}{t}', variables: ['a', 'v', 'u', 't'] },
  { id: 'suvat1', name: 'Velocity–time', topic: 'kinematics', equation: 'v = u + a * t', latex: 'v = u + at', variables: ['v', 'u', 'a', 't'] },
  { id: 'suvat2', name: 'Displacement–time', topic: 'kinematics', equation: 'd = u * t + 0.5 * a * t^2', latex: 'd = ut + \\tfrac12 at^2', variables: ['d', 'u', 'a', 't'] },
  { id: 'suvat3', name: 'Velocity–displacement', topic: 'kinematics', equation: 'v^2 = u^2 + 2 * a * d', latex: 'v^2 = u^2 + 2ad', variables: ['v', 'u', 'a', 'd'] },
  { id: 'newton2', name: "Newton's second law", topic: 'dynamics', equation: 'F = mass * a', latex: 'F = ma', variables: ['F', 'mass', 'a'] },
  { id: 'weight', name: 'Weight', topic: 'dynamics', equation: 'Wt = mass * g', latex: 'W = mg', variables: ['Wt', 'mass', 'g'] },
  { id: 'momentum', name: 'Momentum', topic: 'dynamics', equation: 'p = mass * v', latex: 'p = mv', variables: ['p', 'mass', 'v'] },
  { id: 'hooke', name: "Hooke's law", topic: 'dynamics', equation: 'F = k * x', latex: 'F = kx', variables: ['F', 'k', 'x'] },
  { id: 'work', name: 'Work', topic: 'energy', equation: 'W = F * d', latex: 'W = Fd', variables: ['W', 'F', 'd'] },
  { id: 'power', name: 'Power', topic: 'energy', equation: 'Pw = W / t', latex: 'P = \\frac{W}{t}', variables: ['Pw', 'W', 't'] },
  { id: 'ke', name: 'Kinetic energy', topic: 'energy', equation: 'KE = 0.5 * mass * v^2', latex: 'E_k = \\tfrac12 mv^2', variables: ['KE', 'mass', 'v'] },
  { id: 'pe', name: 'Gravitational potential energy', topic: 'energy', equation: 'PE = mass * g * h', latex: 'E_p = mgh', variables: ['PE', 'mass', 'g', 'h'] },
  { id: 'density', name: 'Density', topic: 'fluids', equation: 'rho = mass / V', latex: '\\rho = \\frac{m}{V}', variables: ['rho', 'mass', 'V'] },
  { id: 'pressure', name: 'Pressure', topic: 'fluids', equation: 'Pr = F / A', latex: 'P = \\frac{F}{A}', variables: ['Pr', 'F', 'A'] },
  { id: 'ohm', name: "Ohm's law", topic: 'electricity', equation: 'U = I * R', latex: 'U = IR', variables: ['U', 'I', 'R'] },
  { id: 'epower', name: 'Electrical power', topic: 'electricity', equation: 'Pw = U * I', latex: 'P = UI', variables: ['Pw', 'U', 'I'] },
  { id: 'charge', name: 'Charge', topic: 'electricity', equation: 'Q = I * t', latex: 'Q = It', variables: ['Q', 'I', 't'] },
  { id: 'freq', name: 'Frequency–period', topic: 'waves', equation: 'f = 1 / T', latex: 'f = \\frac{1}{T}', variables: ['f', 'T'] },
  { id: 'wave', name: 'Wave equation', topic: 'waves', equation: 'v = f * lam', latex: 'v = f\\lambda', variables: ['v', 'f', 'lam'] },
  { id: 'heat', name: 'Specific heat', topic: 'thermal', equation: 'Qh = mass * c * dT', latex: 'Q = mc\\Delta T', variables: ['Qh', 'mass', 'c', 'dT'] },
];

export interface KnownQuantity { symbol: string; value: number; unit: string }

const STANDARD_G = 9.81;

function toSI(q: KnownQuantity): number {
  const target = PHYSICS_VARIABLES[q.symbol]!.unit;
  if (!q.unit) return q.value;
  return m.unit(q.value, normalizeUnit(q.unit)).toNumber(target);
}

/**
 * Find the unknown from known quantities by chaining formulas (breadth-first, max depth 3).
 * Every step is computed deterministically and checked by substitution.
 */
export function solvePhysics(known: KnownQuantity[], unknown: string): MathResult {
  if (!PHYSICS_VARIABLES[unknown]) throw new Error(`Unknown quantity "${unknown}"`);
  const values: Record<string, number> = {};
  const assumptions: string[] = [];
  const steps: SolutionStep[] = [];
  for (const q of known) {
    if (!PHYSICS_VARIABLES[q.symbol]) continue;
    values[q.symbol] = toSI(q);
    steps.push({ description: `Given ${q.symbol} = ${formatNumber(q.value)} ${q.unit}${q.unit && normalizeUnit(q.unit) !== PHYSICS_VARIABLES[q.symbol]!.unit ? ` = ${formatNumber(values[q.symbol]!)} ${PHYSICS_VARIABLES[q.symbol]!.unit}` : ''}` });
  }
  const verification: Verification[] = [];
  const used: string[] = [];
  for (let depth = 0; depth < 4 && values[unknown] === undefined; depth++) {
    let progressed = false;
    for (const f of PHYSICS_FORMULAS) {
      const missing = f.variables.filter((v) => values[v] === undefined);
      if (missing.length === 1 && missing[0] === 'g' && f.variables.includes(unknown) === false) continue;
      let target = missing.length === 1 ? missing[0] : undefined;
      if (missing.length === 2 && missing.includes('g') && !known.some((k) => k.symbol === 'g')) {
        values.g = STANDARD_G;
        assumptions.push('Gravitational acceleration g = 9.81 m/s² (standard value) was assumed.');
        target = missing.find((v) => v !== 'g');
      }
      if (!target) continue;
      // Only derive intermediate values that can help, or the unknown itself.
      const [lhs, rhs] = f.equation.split('=').map((s) => s.trim()) as [string, string];
      const substitute = (expr: string) => expr.replace(/\b([A-Za-z]+)\b/g, (name) => (values[name] !== undefined && name !== target ? `(${values[name]})` : name));
      const eq = `${substitute(lhs)} = ${substitute(rhs)}`;
      let res: MathResult;
      try {
        res = solveEquation(eq.replace(new RegExp(`\\b${target}\\b`, 'g'), 'X'), 'X');
      } catch { continue; }
      let candidates = res.numeric ?? [];
      if (PHYSICS_VARIABLES[target]!.nonNegative || target === 'v' && f.id === 'suvat3') candidates = candidates.filter((c) => c >= 0);
      if (candidates.length === 0) continue;
      const value = candidates.length > 1 ? Math.max(...candidates) : candidates[0]!;
      if (candidates.length > 1) assumptions.push(`${f.name}: chose the positive/physical root for ${target}.`);
      values[target] = value;
      used.push(f.id);
      steps.push({ description: `Use ${f.name}`, latex: f.latex });
      steps.push({ description: `Solve for ${target}: ${target} = ${formatNumber(value)} ${PHYSICS_VARIABLES[target]!.unit}` });
      verification.push(...res.verification.filter((v) => v.passed).slice(0, 1).map((v) => ({ ...v, method: `${f.name}: ${v.method.replace('X', target)}` })));
      progressed = true;
      if (target === unknown) break;
    }
    if (!progressed) break;
  }
  const result = values[unknown];
  if (result === undefined) {
    return {
      kind: 'formula', input: known.map((k) => `${k.symbol}=${k.value}${k.unit}`).join(', '),
      answer: 'Not enough information to determine the unknown with the formula library',
      steps, verification, assumptions, warnings: ['Check that all given quantities were recognised, or add the missing quantity.'],
    };
  }
  const unit = PHYSICS_VARIABLES[unknown]!.unit;
  // Dimensional sanity check of the final unit.
  dimensionOf(unit);
  return {
    kind: 'formula', input: known.map((k) => `${k.symbol}=${k.value}${k.unit}`).join(', '),
    answer: `${unknown === 'mass' ? 'm' : unknown} = ${formatNumber(result, 6)} ${unit}`,
    numeric: [result], steps, verification, assumptions, warnings: [],
  };
}

const NUMBER_UNIT = /(-?\d+(?:[.,]\d+)?)\s*(km\/h|m\/s\^?2|m\/s²|m\/s|km|cm|mm|m²|m\^2|m³|m\^3|kg\/m\^?3|kg|g|mg|ms|min|h|s|N\/m|kN|N|kJ|J|kW|W|mA|A|kΩ|Ω|ohm|V|Hz|kPa|Pa|°C|K|C|m)(?![a-zA-Z])/g;

const UNIT_TO_CANDIDATES: Array<{ test: (u: string) => boolean; symbols: string[] }> = [
  { test: (u) => /^(km\/h|m\/s)$/.test(u), symbols: ['v', 'u'] },
  { test: (u) => /^m\/s(\^?2|²)$/.test(u), symbols: ['a', 'g'] },
  { test: (u) => /^(km|cm|mm|m)$/.test(u), symbols: ['d', 'h', 'lam', 'x'] },
  { test: (u) => /^(ms|min|h|s)$/.test(u), symbols: ['t', 'T'] },
  { test: (u) => /^(kg|g|mg)$/.test(u), symbols: ['mass'] },
  { test: (u) => /^(kN|N)$/.test(u), symbols: ['F', 'Wt'] },
  { test: (u) => u === 'N/m', symbols: ['k'] },
  { test: (u) => u === 'K' || u === '°C', symbols: ['dT'] },
  { test: (u) => /^(kJ|J)$/.test(u), symbols: ['W', 'KE', 'PE', 'Qh'] },
  { test: (u) => /^(kW|W)$/.test(u), symbols: ['Pw'] },
  { test: (u) => /^(mA|A)$/.test(u), symbols: ['I'] },
  { test: (u) => /^(kΩ|Ω|ohm)$/.test(u), symbols: ['R'] },
  { test: (u) => u === 'V', symbols: ['U'] },
  { test: (u) => u === 'Hz', symbols: ['f'] },
  { test: (u) => /Pa$/.test(u), symbols: ['Pr'] },
  { test: (u) => /^(m²|m\^2)$/.test(u), symbols: ['A'] },
  { test: (u) => /^(m³|m\^3)$/.test(u), symbols: ['V'] },
  { test: (u) => /^kg\/m/.test(u), symbols: ['rho'] },
  { test: (u) => u === 'C', symbols: ['Q'] },
];

/** Extract known quantities and the unknown from a natural-language physics question. */
const INLINE_GIVEN = /\b([A-Za-zρ]{1,3})\s*=\s*(-?\d+(?:[.,]\d+)?)\s*((?:[A-Za-zΩ°]+(?:\^?\d)?(?:\s*[\/·*]\s*\(?[A-Za-z]+(?:\s+[A-Za-z]+)?\)?)*)?)/g;
const INLINE_SYMBOLS: Record<string, string> = {
  c: 'c', k: 'k', m: 'mass', g: 'g', v: 'v', u: 'u', a: 'a', t: 't', d: 'd', s: 'd', F: 'F', h: 'h', R: 'R', I: 'I', U: 'U', f: 'f', T: 'T',
  Q: 'Q', x: 'x', rho: 'rho', 'ρ': 'rho', V: 'V', A: 'A', W: 'W', P: 'Pw', p: 'p', KE: 'KE', PE: 'PE',
};

const ARABIC_UNITS: Array<[RegExp, string]> = [
  [/(\d)\s*كم\/سا?(?![\u0600-\u06FF])/g, '$1 km/h'], [/(\d)\s*م\/ث²(?![\u0600-\u06FF])/g, '$1 m/s^2'], [/(\d)\s*م\/ث(?![\u0600-\u06FF²])/g, '$1 m/s'],
  [/(\d)\s*كم(?![\u0600-\u06FF])/g, '$1 km'], [/(\d)\s*سم(?![\u0600-\u06FF])/g, '$1 cm'], [/(\d)\s*كغ(?![\u0600-\u06FF])/g, '$1 kg'], [/(\d)\s*غ(?![\u0600-\u06FF])/g, '$1 g'],
  [/(\d)\s*م(?![\u0600-\u06FF])/g, '$1 m'], [/(\d)\s*ث(?![\u0600-\u06FF])/g, '$1 s'], [/(\d)\s*د(?![\u0600-\u06FF])/g, '$1 min'], [/(\d)\s*ن(?![\u0600-\u06FF])/g, '$1 N'],
  [/(\d)\s*ج(?![\u0600-\u06FF])/g, '$1 J'], [/(\d)\s*واط(?![\u0600-\u06FF])/g, '$1 W'], [/(\d)\s*فولت(?![\u0600-\u06FF])/g, '$1 V'], [/(\d)\s*أمبير(?![\u0600-\u06FF])/g, '$1 A'], [/(\d)\s*أوم(?![\u0600-\u06FF])/g, '$1 Ω'],
];

export function parsePhysicsProblem(input: string): { known: KnownQuantity[]; unknown: string | null } {
  let text = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, '.');
  for (const [re, rep] of ARABIC_UNITS) text = text.replace(re, rep);
  const known: KnownQuantity[] = [];
  const taken = new Set<string>();
  // Explicit "symbol = value unit" givens, e.g. "c = 4180 J/(kg K)" or "k = 200 N/m".
  text = text.replace(INLINE_GIVEN, (whole, sym: string, num: string, unitRaw: string) => {
    const symbol = INLINE_SYMBOLS[sym];
    if (!symbol || taken.has(symbol)) return whole;
    const unit = unitRaw.trim().replace(/[.,;]+$/, '');
    let usable = unit;
    try { if (unit) m.unit(1, normalizeUnit(unit)).toNumber(PHYSICS_VARIABLES[symbol]!.unit); } catch { usable = ''; }
    known.push({ symbol, value: Number(num.replace(',', '.')), unit: usable });
    taken.add(symbol);
    return ' ';
  });
  const lower = text.toLowerCase();
  for (const match of text.matchAll(NUMBER_UNIT)) {
    const value = Number(match[1]!.replace(',', '.'));
    let unit = match[2]!.replace('²', '^2').replace('³', '^3').replace('Ω', 'ohm');
    if (unit === 'm/s2') unit = 'm/s^2';
    const cands = UNIT_TO_CANDIDATES.find((c) => c.test(match[2]!))?.symbols ?? [];
    const context = lower.slice(Math.max(0, (match.index ?? 0) - 40), (match.index ?? 0));
    let chosen = cands.find((s) => !taken.has(s) && PHYSICS_VARIABLES[s]!.keywords.some((k) => context.includes(k)));
    if (!chosen && cands.includes('u') && /(from rest|initial|starts?)/.test(context)) chosen = 'u';
    chosen ??= cands.find((s) => !taken.has(s));
    if (!chosen) continue;
    taken.add(chosen);
    known.push({ symbol: chosen, value, unit: unit === 'ohm' ? 'ohm' : unit === '°C' ? 'K' : unit });
  }
  if (/from rest|au repos|من السكون/.test(lower) && !taken.has('u')) known.push({ symbol: 'u', value: 0, unit: 'm/s' });
  // The unknown is the quantity named after a question word.
  const qPart = lower.split(/(?:what is|what's|find|calculate|determine|how (?:much|far|long|fast)|quelle est|calculer|déterminer|calcule|احسب|ما هي|ما هو|أوجد|(?:^|\s)ما\s|(?:^|\s)كم\s)/).slice(1).join(' ');
  let unknown: string | null = null;
  if (qPart) {
    let best = Infinity;
    for (const [sym, v] of Object.entries(PHYSICS_VARIABLES)) {
      for (const k of v.keywords) {
        const idx = qPart.indexOf(k);
        // Prefer earliest mention; longer keywords break ties (e.g. "kinetic energy" over "energy").
        const score = idx - k.length / 100;
        if (idx >= 0 && score < best && !taken.has(sym)) { best = score; unknown = sym; }
      }
    }
    if (/how far/.test(lower)) unknown = 'd';
    if (/how long/.test(lower)) unknown = 't';
    if (/how fast/.test(lower)) unknown = 'v';
  }
  return { known, unknown };
}
