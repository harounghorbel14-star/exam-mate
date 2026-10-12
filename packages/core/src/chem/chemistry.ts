import { m } from '../math/mathjs.js';
import { formatNumber } from '../math/engine.js';
import type { MathResult } from '../math/types.js';
import { ELEMENT_BY_SYMBOL } from './elements.js';

export type Composition = Record<string, number>;

/**
 * Parse a chemical formula such as "Ca(OH)2", "CuSO4·5H2O", "[Fe(CN)6]3-" into element counts.
 * Charges are stripped and returned separately ("e" key is never used for electrons).
 */
export function parseFormula(formula: string): { composition: Composition; charge: number } {
  let f = formula.trim().replace(/\s+/g, '');
  let charge = 0;
  const chargeMatch = /\^?(\d*)([+-])$/.exec(f);
  if (chargeMatch && /[A-Za-z)\]\d]/.test(f.slice(0, chargeMatch.index))) {
    charge = (chargeMatch[1] ? Number(chargeMatch[1]) : 1) * (chargeMatch[2] === '-' ? -1 : 1);
    f = f.slice(0, chargeMatch.index);
  }
  f = f.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
  const parts = f.split(/[·.*]/);
  const total: Composition = {};
  for (const part of parts) {
    const leading = /^(\d+)(.*)$/.exec(part);
    const multiplier = leading ? Number(leading[1]) : 1;
    const comp = parseGroup(leading ? leading[2]! : part);
    for (const [el, n] of Object.entries(comp)) total[el] = (total[el] ?? 0) + n * multiplier;
  }
  if (Object.keys(total).length === 0) throw new Error(`Invalid formula "${formula}"`);
  return { composition: total, charge };
}

function parseGroup(s: string): Composition {
  const stack: Composition[] = [{}];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === '(' || ch === '[') { stack.push({}); i++; continue; }
    if (ch === ')' || ch === ']') {
      i++;
      let num = '';
      while (i < s.length && /\d/.test(s[i]!)) num += s[i++];
      const group = stack.pop();
      if (!group || stack.length === 0) throw new Error('Unbalanced brackets in formula');
      const k = num ? Number(num) : 1;
      const top = stack[stack.length - 1]!;
      for (const [el, n] of Object.entries(group)) top[el] = (top[el] ?? 0) + n * k;
      continue;
    }
    const match = /^([A-Z][a-z]?)(\d*)/.exec(s.slice(i));
    if (!match) throw new Error(`Unexpected character "${ch}" in formula`);
    const sym = match[1]!;
    if (!ELEMENT_BY_SYMBOL.has(sym)) throw new Error(`Unknown element symbol "${sym}"`);
    const top = stack[stack.length - 1]!;
    top[sym] = (top[sym] ?? 0) + (match[2] ? Number(match[2]) : 1);
    i += match[0].length;
  }
  if (stack.length !== 1) throw new Error('Unbalanced brackets in formula');
  return stack[0]!;
}

export function molarMass(formula: string): MathResult {
  const { composition } = parseFormula(formula);
  let total = 0;
  const steps = Object.entries(composition).map(([el, n]) => {
    const mass = ELEMENT_BY_SYMBOL.get(el)!.mass;
    total += mass * n;
    return { description: `${el}: ${n} × ${mass} = ${formatNumber(mass * n, 6)} g/mol` };
  });
  // Independent check: sum in a different order.
  const reverse = Object.entries(composition).reverse().reduce((s, [el, n]) => s + ELEMENT_BY_SYMBOL.get(el)!.mass * n, 0);
  return {
    kind: 'formula', input: formula, answer: `M(${formula}) = ${formatNumber(total, 6)} g/mol`, numeric: [total],
    steps: [...steps, { description: `Sum: ${formatNumber(total, 6)} g/mol` }],
    verification: [{ method: 'independent summation', passed: Math.abs(reverse - total) < 1e-9, detail: formatNumber(reverse, 8) }],
    assumptions: ['Standard atomic weights (IUPAC conventional values) were used.'], warnings: [],
  };
}

function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

/**
 * Balance a chemical equation using the exact rational null space of the composition matrix.
 * Accepts "->", "→", "=" or "⇌" as the arrow.
 */
export function balanceEquation(equation: string): MathResult & { coefficients: number[]; balanced: string } {
  const [lhsRaw, rhsRaw] = equation.split(/\s*(?:->|→|⟶|=|⇌|<=>)\s*/);
  if (!lhsRaw || !rhsRaw) throw new Error('Write the equation with an arrow, e.g. "H2 + O2 -> H2O"');
  const split = (side: string) => side.split(/\s+\+\s+|\s*\+\s*(?=[A-Z0-9(\[])/).map((s) => s.trim().replace(/^\d+(?=[A-Z(\[])/, '')).filter(Boolean);
  const reactants = split(lhsRaw);
  const products = split(rhsRaw);
  const species = [...reactants, ...products];
  const parsed = species.map((s) => parseFormula(s));
  const elements = [...new Set(parsed.flatMap((p) => Object.keys(p.composition)))];
  const hasCharge = parsed.some((p) => p.charge !== 0);
  const rows = elements.map((el) => parsed.map((p, j) => (p.composition[el] ?? 0) * (j < reactants.length ? 1 : -1)));
  if (hasCharge) rows.push(parsed.map((p, j) => p.charge * (j < reactants.length ? 1 : -1)));

  // Reduced row echelon form with exact fractions.
  const n = species.length;
  const A = rows.map((r) => r.map((v) => m.fraction(v)));
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < n && r < A.length; c++) {
    const sel = A.findIndex((row, idx) => idx >= r && Number(row[c]) !== 0);
    if (sel === -1) continue;
    [A[r], A[sel]] = [A[sel]!, A[r]!];
    const pv = A[r]![c]!;
    A[r] = A[r]!.map((v) => m.divide(v, pv) as never);
    for (let k = 0; k < A.length; k++) {
      if (k === r || Number(A[k]![c]) === 0) continue;
      const factor = A[k]![c]!;
      A[k] = A[k]!.map((v, j) => m.subtract(v, m.multiply(factor, A[r]![j]!)) as never);
    }
    pivots.push(c);
    r++;
  }
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  if (free.length !== 1) {
    throw new Error(free.length === 0 ? 'This equation cannot be balanced (only the trivial solution exists)' : 'The equation has more than one independent balancing; split it into separate reactions');
  }
  const fc = free[0]!;
  const coeffs: Array<{ n: number; d: number }> = Array.from({ length: n }, () => ({ n: 0, d: 1 }));
  coeffs[fc] = { n: 1, d: 1 };
  pivots.forEach((pc, row) => {
    const v = m.unaryMinus(A[row]![fc]!) as unknown as { s: number | bigint; n: number | bigint; d: number | bigint };
    coeffs[pc] = { n: Number(v.s) * Number(v.n), d: Number(v.d) };
  });
  const L = coeffs.reduce((acc, c) => (acc / gcd(acc, c.d)) * c.d, 1);
  let ints = coeffs.map((c) => (c.n * L) / c.d);
  if (ints.some((x) => x < 0) && ints.every((x) => x <= 0)) ints = ints.map((x) => -x);
  if (ints.some((x) => x <= 0)) throw new Error('No positive balancing exists; check the reactants and products');
  const g = ints.reduce((acc, x) => gcd(acc, x), 0);
  ints = ints.map((x) => x / g);
  const fmt = (list: string[], offset: number) => list.map((s, i) => `${ints[i + offset] === 1 ? '' : ints[i + offset]}${s}`).join(' + ');
  const balanced = `${fmt(reactants, 0)} → ${fmt(products, reactants.length)}`;
  // Verification: atom count per element on each side.
  const verification = elements.map((el) => {
    const left = parsed.slice(0, reactants.length).reduce((s, p, i) => s + (p.composition[el] ?? 0) * ints[i]!, 0);
    const right = parsed.slice(reactants.length).reduce((s, p, i) => s + (p.composition[el] ?? 0) * ints[i + reactants.length]!, 0);
    return { method: `count ${el} atoms`, passed: left === right, detail: `${left} on the left, ${right} on the right` };
  });
  if (hasCharge) {
    const left = parsed.slice(0, reactants.length).reduce((s, p, i) => s + p.charge * ints[i]!, 0);
    const right = parsed.slice(reactants.length).reduce((s, p, i) => s + p.charge * ints[i + reactants.length]!, 0);
    verification.push({ method: 'conservation of charge', passed: left === right, detail: `${left} vs ${right}` });
  }
  return {
    kind: 'formula', input: equation, answer: balanced, coefficients: ints, balanced,
    steps: [
      { description: `List the elements present: ${elements.join(', ')}` },
      { description: 'Write one conservation equation per element (atoms in = atoms out)' },
      { description: 'Solve the linear system for the smallest whole-number coefficients' },
      { description: balanced },
    ],
    verification, assumptions: [], warnings: [],
  };
}
