import { solveEquation, formatNumber } from '../math/engine.js';
import type { MathResult, SolutionStep, Verification } from '../math/types.js';

/**
 * Geometry word problems (2D/3D measurement). Unlike physics, values keep the student's length
 * unit: all lengths are converted to the first length unit mentioned, and the answer is given in
 * that unit (², ³ for areas and volumes).
 */
export type Shape = 'rectangle' | 'square' | 'circle' | 'triangle' | 'right-triangle' | 'cuboid' | 'cube' | 'cylinder' | 'sphere' | 'cone';
type Dim = 1 | 2 | 3;

interface GeoVar { dim: Dim; keywords: string[] }

const VARS: Record<string, GeoVar> = {
  len: { dim: 1, keywords: ['length', 'long', 'longueur', 'طول', 'الطول'] },
  wid: { dim: 1, keywords: ['width', 'wide', 'largeur', 'عرض', 'العرض'] },
  hgt: { dim: 1, keywords: ['height', 'tall', 'high', 'hauteur', 'ارتفاع', 'الارتفاع'] },
  side: { dim: 1, keywords: ['side', 'edge', 'côté', 'arête', 'ضلع', 'طول الضلع'] },
  rad: { dim: 1, keywords: ['radius', 'rayon', 'نصف القطر', 'نصف قطر', 'شعاع'] },
  diam: { dim: 1, keywords: ['diameter', 'diamètre', 'قطر', 'القطر'] },
  base: { dim: 1, keywords: ['base', 'قاعدة', 'القاعدة'] },
  leg1: { dim: 1, keywords: ['legs', 'leg', 'sides of', 'côtés de l’angle droit', 'cathètes', 'ضلعا القائمة'] },
  leg2: { dim: 1, keywords: [] },
  hyp: { dim: 1, keywords: ['hypotenuse', 'hypoténuse', 'الوتر'] },
  perim: { dim: 1, keywords: ['perimeter', 'périmètre', 'محيط', 'المحيط', 'محيطه'] },
  circ: { dim: 1, keywords: ['circumference', 'circonférence', 'محيط الدائرة'] },
  area: { dim: 2, keywords: ['surface area', 'area', 'aire', 'superficie', 'مساحة', 'المساحة', 'مساحت'] },
  vol: { dim: 3, keywords: ['volume', 'حجم', 'الحجم', 'حجمه'] },
};

const FORMULAS: Record<Shape, Array<{ eq: string; name: string }>> = {
  rectangle: [{ eq: 'perim = 2 * (len + wid)', name: 'P = 2(l + w)' }, { eq: 'area = len * wid', name: 'A = l × w' }],
  square: [{ eq: 'perim = 4 * side', name: 'P = 4s' }, { eq: 'area = side^2', name: 'A = s²' }],
  circle: [{ eq: 'diam = 2 * rad', name: 'd = 2r' }, { eq: 'circ = 2 * pi * rad', name: 'C = 2πr' }, { eq: 'area = pi * rad^2', name: 'A = πr²' }],
  triangle: [{ eq: 'area = base * hgt / 2', name: 'A = b × h / 2' }],
  'right-triangle': [{ eq: 'hyp^2 = leg1^2 + leg2^2', name: 'c² = a² + b² (Pythagoras)' }, { eq: 'area = leg1 * leg2 / 2', name: 'A = a × b / 2' }],
  cuboid: [{ eq: 'vol = len * wid * hgt', name: 'V = l × w × h' }, { eq: 'area = 2 * (len * wid + len * hgt + wid * hgt)', name: 'S = 2(lw + lh + wh)' }],
  cube: [{ eq: 'vol = side^3', name: 'V = s³' }, { eq: 'area = 6 * side^2', name: 'S = 6s²' }],
  cylinder: [{ eq: 'diam = 2 * rad', name: 'd = 2r' }, { eq: 'vol = pi * rad^2 * hgt', name: 'V = πr²h' }],
  sphere: [{ eq: 'diam = 2 * rad', name: 'd = 2r' }, { eq: 'vol = 4 / 3 * pi * rad^3', name: 'V = 4/3 πr³' }, { eq: 'area = 4 * pi * rad^2', name: 'S = 4πr²' }],
  cone: [{ eq: 'diam = 2 * rad', name: 'd = 2r' }, { eq: 'vol = pi * rad^2 * hgt / 3', name: 'V = πr²h / 3' }],
};

const SHAPE_WORDS: Array<[Shape, RegExp]> = [
  ['right-triangle', /right[- ]?(angled )?triangle|triangle rectangle|مثلث قائم/i],
  ['square', /\bsquare\b|(?<![a-zà-ÿ])carré(?![a-zà-ÿ])|مربع/i],
  ['rectangle', /rectangle|مستطيل/i],
  ['circle', /circle|cercle|disque|دائرة/i],
  ['triangle', /triangle|مثلث/i],
  ['cube', /\bcube\b|مكعب/i],
  ['cuboid', /cuboid|rectangular (box|prism)|parallélépipède|pavé|متوازي/i],
  ['cylinder', /cylind|أسطوانة/i],
  ['sphere', /sphere|sphère|boule|كرة/i],
  ['cone', /\bcone\b|cône|مخروط/i],
];

const LEN_UNITS: Record<string, number> = { mm: 0.001, cm: 0.01, dm: 0.1, m: 1, km: 1000, in: 0.0254, ft: 0.3048 };
const NUM_UNIT = /(-?\d+(?:[.,]\d+)?)\s*(mm|cm|dm|km|m|in|ft)?(²|\^2|³|\^3)?(?![a-zA-Z])/g;

export interface GeometryProblem { shape: Shape; known: Record<string, number>; unknown: string; unit: string | null }

export function parseGeometryProblem(input: string): GeometryProblem | null {
  const text = input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/(\d)\s*(سم)/g, '$1 cm').replace(/(\d)\s*م(?![؀-ۿ])/g, '$1 m');
  const lower = text.toLowerCase();
  const shape = SHAPE_WORDS.find(([, re]) => re.test(text))?.[0];
  if (!shape) return null;
  const allowed = new Set(FORMULAS[shape].flatMap((f) => Object.keys(VARS).filter((v) => new RegExp(`\\b${v}\\b`).test(f.eq))));
  const qSplit = lower.search(/(what is|what's|find|calculate|determine|how (?:long|tall|wide)|quelle est|quel est|calcule|détermine|احسب|ما هو|ما هي|أوجد)/);
  const givenText = qSplit > 0 ? lower.slice(0, qSplit) : lower;
  const questionText = qSplit >= 0 ? lower.slice(qSplit) : '';
  const known: Record<string, number> = {};
  let unit: string | null = null;
  // Numbers may appear anywhere ("Find the volume of a sphere with radius 3 m").
  const matches = [...lower.matchAll(NUM_UNIT)];
  let pendingLegs = false;
  for (const m of matches) {
    let value = Number(m[1]!.replace(',', '.'));
    const u = m[2] ?? null;
    const power = m[3] ? (/[³3]/.test(m[3]) ? 3 : 2) : 1;
    if (u && unit === null) unit = u;
    if (u && unit && u !== unit) value = value * (LEN_UNITS[u]! / LEN_UNITS[unit]!) ** power;
    const before = lower.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    // Pick the variable whose keyword appears closest before the number and matches the dimension.
    let best: string | null = null;
    let bestPos = -1;
    for (const [name, v] of Object.entries(VARS)) {
      if (!allowed.has(name) || v.dim !== power || known[name] !== undefined) continue;
      for (const k of v.keywords) {
        const at = before.lastIndexOf(k);
        if (at < 0) continue;
        // Closest keyword wins (by end position); ties go to the longer, more specific keyword.
        const score = at + k.length + k.length / 1000;
        if (score > bestPos) { bestPos = score; best = name; }
      }
    }
    const after = lower.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8);
    const trailing = /^\s*(long|wide|tall|high|de long|de large|de haut)\b/.exec(after)?.[1];
    if (trailing) {
      const t = /long/.test(trailing) ? 'len' : /wide|large/.test(trailing) ? 'wid' : 'hgt';
      if (allowed.has(t) && known[t] === undefined) best = t;
    }
    if (pendingLegs && known.leg1 !== undefined && known.leg2 === undefined && allowed.has('leg2') && (best === null || best === 'leg1')) best = 'leg2';
    if (best === 'leg1') pendingLegs = true;
    if (best === null) {
      // Unlabelled length on a square/cube is its side; on a circle shape without keyword: radius.
      const fallback = power === 1 ? (['square', 'cube'].includes(shape) ? 'side' : null) : power === 2 ? 'area' : 'vol';
      if (fallback && allowed.has(fallback) && known[fallback] === undefined) best = fallback;
    }
    if (best) known[best] = value;
  }
  let unknown: string | null = null;
  let firstPos = Infinity;
  for (const [name, v] of Object.entries(VARS)) {
    if (!allowed.has(name) || known[name] !== undefined) continue;
    for (const k of v.keywords) {
      const pos = questionText.indexOf(k);
      if (pos >= 0 && pos - k.length / 100 < firstPos) { firstPos = pos - k.length / 100; unknown = name; }
    }
  }
  if (!unknown && /how long|quelle longueur/.test(questionText)) unknown = allowed.has('len') ? 'len' : 'side';
  if (!unknown || Object.keys(known).length === 0) return null;
  return { shape, known, unknown, unit };
}

/** Chain the shape's formulas (up to 4 rounds) until the unknown is found; each step is verified by substitution. */
export function solveGeometry(p: GeometryProblem): MathResult {
  const values: Record<string, number> = { ...p.known };
  const steps: SolutionStep[] = [{ description: `Shape: ${p.shape}. Given ${Object.entries(p.known).map(([k, v]) => `${k} = ${formatNumber(v)}`).join(', ')}${p.unit ? ` (${p.unit})` : ''}` }];
  const verification: Verification[] = [];
  for (let round = 0; round < 4 && values[p.unknown] === undefined; round++) {
    let progressed = false;
    for (const f of FORMULAS[p.shape]) {
      const vars = Object.keys(VARS).filter((v) => new RegExp(`\\b${v}\\b`).test(f.eq));
      const missing = vars.filter((v) => values[v] === undefined);
      if (missing.length !== 1) continue;
      const target = missing[0]!;
      const eq = f.eq.replace(/\b([a-z][a-z0-9]*)\b/g, (n) => (n === target ? 'X' : values[n] !== undefined ? `(${values[n]})` : n));
      let res: MathResult;
      try { res = solveEquation(eq, 'X'); } catch { continue; }
      const positive = (res.numeric ?? []).filter((x) => x > 0);
      if (!positive.length) continue;
      values[target] = Math.max(...positive);
      steps.push({ description: `Use ${f.name}` });
      steps.push({ description: `${target} = ${formatNumber(values[target]!)}` });
      verification.push(...res.verification.filter((v) => v.passed).slice(0, 1).map((v) => ({ ...v, method: `${f.name}: ${v.method.replace('X', target)}` })));
      progressed = true;
    }
    if (!progressed) break;
  }
  const result = values[p.unknown];
  const dimSuffix = VARS[p.unknown]!.dim === 2 ? '²' : VARS[p.unknown]!.dim === 3 ? '³' : '';
  if (result === undefined) {
    return { kind: 'formula', input: p.shape, answer: 'Not enough information to determine the unknown', steps, verification, assumptions: [], warnings: ['Check that all given measurements were recognised.'] };
  }
  return {
    kind: 'formula', input: p.shape,
    answer: `${p.unknown} = ${formatNumber(result, 8)}${p.unit ? ` ${p.unit}${dimSuffix}` : ''}`,
    numeric: [result], steps, verification,
    assumptions: p.unit ? [] : ['No unit was given; the answer is in the same unit as the data.'], warnings: [],
  };
}
