import type { MathNode } from 'mathjs';
import { create, all } from 'mathjs';
import { m, safeParse, normalizeMathInput } from './mathjs.js';

/** Independent high-precision instance used only to re-check already-validated input. */
const bigMath = create(all!, { number: 'BigNumber', precision: 40 });
import type { MathResult, SolutionStep, Verification } from './types.js';

const CONSTANTS = new Set(['pi', 'e', 'i', 'E', 'PI', 'Infinity', 'NaN', 'phi', 'tau']);
const EPS = 1e-9;

export function formatNumber(x: number, significant = 10): string {
  if (!Number.isFinite(x)) return String(x);
  if (Math.abs(x) < 1e-12) return '0';
  const rounded = Number(x.toPrecision(significant));
  if (Math.abs(rounded) >= 1e12 || Math.abs(rounded) < 1e-6) return rounded.toExponential(Math.min(significant - 1, 6));
  return String(rounded);
}

/** Return an exact fraction string when x is (numerically) a simple rational. */
export function toExactString(x: number, maxDen = 1000): string {
  if (Number.isInteger(x)) return String(x);
  const f = approximateFraction(x, maxDen);
  if (f && Math.abs(f.n / f.d - x) < 1e-12) return `${f.n}/${f.d}`;
  return formatNumber(x);
}

export function approximateFraction(x: number, maxDen = 1000): { n: number; d: number } | null {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  let v = Math.abs(x);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(v);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(v - a) < 1e-15) break;
    v = 1 / (v - a);
  }
  if (k1 === 0) return null;
  return { n: sign * h1, d: k1 };
}

function latexOfFraction(s: string): string {
  const match = /^(-?)(\d+)\/(\d+)$/.exec(s);
  if (!match) return s;
  return `${match[1]}\\frac{${match[2]}}{${match[3]}}`;
}

export function freeSymbols(node: MathNode): string[] {
  const names = new Set<string>();
  node.traverse((n: MathNode, _path: string, parent: MathNode | null) => {
    if ((n as { isSymbolNode?: boolean }).isSymbolNode) {
      const name = (n as unknown as { name: string }).name;
      const isFnName = parent && (parent as { isFunctionNode?: boolean }).isFunctionNode && (parent as unknown as { fn: MathNode }).fn === n;
      if (!isFnName && !CONSTANTS.has(name)) names.add(name);
    }
  });
  return [...names].sort();
}

function evalNode(node: MathNode, scope: Record<string, number>): number {
  const v = node.compile().evaluate({ ...scope });
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 're' in v) {
    const c = v as { re: number; im: number };
    return Math.abs(c.im) < 1e-12 ? c.re : NaN;
  }
  return Number(v);
}

/** Evaluate an arithmetic expression deterministically. */
export function evaluateExpression(raw: string): MathResult {
  const input = normalizeMathInput(raw);
  const node = safeParse(input);
  const symbols = freeSymbols(node);
  if (symbols.length > 0) {
    // Not purely numeric: simplify instead.
    return simplifyExpression(raw);
  }
  const value = node.compile().evaluate({});
  const steps: SolutionStep[] = [{ description: 'Parse the expression', latex: node.toTex() }];
  let answer: string;
  let numeric: number[] | undefined;
  const warnings: string[] = [];
  if (typeof value === 'number') {
    numeric = [value];
    const exact = toExactString(value);
    answer = exact !== formatNumber(value) ? `${exact} ≈ ${formatNumber(value)}` : formatNumber(value);
    if (!Number.isFinite(value)) warnings.push('The expression is undefined or infinite (for example, division by zero).');
  } else {
    answer = m.format(value, { precision: 10 });
  }
  steps.push({ description: 'Evaluate using exact operator precedence', latex: answer });
  const verification: Verification[] = [];
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Independent path: evaluate with BigNumber precision and compare.
    try {
      const bv = Number(bigMath.evaluate(input).toString());
      const passed = Math.abs(bv - value) <= 1e-9 * Math.max(1, Math.abs(value));
      verification.push({ method: 'high-precision re-evaluation', passed, detail: `40-digit result ${formatNumber(bv, 15)}` });
    } catch {
      verification.push({ method: 'high-precision re-evaluation', passed: false, detail: 'Not supported for this expression' });
    }
  }
  return { kind: 'evaluate', input, answer, answerLatex: latexOfFraction(answer), numeric, steps, verification, assumptions: [], warnings };
}

export function simplifyExpression(raw: string): MathResult {
  const input = normalizeMathInput(raw);
  const node = safeParse(input);
  const simplified = m.simplify(node);
  const steps: SolutionStep[] = [
    { description: 'Original expression', latex: node.toTex() },
    { description: 'Combine like terms and simplify', latex: simplified.toTex() },
  ];
  const verification = [verifyEquivalent(node, simplified, 'random-point equivalence check')];
  return {
    kind: 'simplify', input, answer: simplified.toString(), answerLatex: simplified.toTex(),
    steps, verification, assumptions: [], warnings: [],
  };
}

/** Check two expressions agree at several random points (independent of the simplifier). */
export function verifyEquivalent(a: MathNode, b: MathNode, method: string): Verification {
  const vars = [...new Set([...freeSymbols(a), ...freeSymbols(b)])];
  let checked = 0;
  for (let t = 0; t < 12; t++) {
    const scope: Record<string, number> = {};
    for (const v of vars) scope[v] = Math.round((Math.sin(t * 12.9898 + v.charCodeAt(0)) * 43758.5453 % 1) * 1000) / 100 + 0.37;
    const va = evalNode(a, scope);
    const vb = evalNode(b, scope);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    checked++;
    if (Math.abs(va - vb) > 1e-7 * Math.max(1, Math.abs(va))) {
      return { method, passed: false, detail: `Mismatch at ${JSON.stringify(scope)}` };
    }
  }
  return { method, passed: checked > 0, detail: checked > 0 ? `Agreed at ${checked} sample points` : 'No valid sample points' };
}

function splitEquation(input: string): { lhs: string; rhs: string } {
  const parts = input.split(/(?<![<>!=])=(?!=)/);
  if (parts.length === 1) return { lhs: parts[0]!, rhs: '0' };
  if (parts.length !== 2) throw new Error('An equation must contain exactly one "=" sign');
  return { lhs: parts[0]!.trim(), rhs: parts[1]!.trim() };
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function lcm(a: number, b: number) {
  return (a / gcd(a, b)) * b;
}

/** Simplify sqrt(n) for a positive integer n into k*sqrt(r). */
export function simplifySqrt(n: number): { k: number; r: number } {
  let k = 1, r = n;
  for (let f = 2; f * f <= r; f++) {
    while (r % (f * f) === 0) { k *= f; r /= f * f; }
  }
  return { k, r };
}

/** Durand–Kerner simultaneous root finding for polynomials (coeffs low→high). */
export function polynomialRoots(coeffsLowToHigh: number[]): Array<{ re: number; im: number }> {
  const c = [...coeffsLowToHigh];
  while (c.length > 1 && Math.abs(c[c.length - 1]!) < EPS) c.pop();
  const n = c.length - 1;
  if (n < 1) return [];
  const lead = c[n]!;
  const a = c.map((x) => x / lead);
  type C = { re: number; im: number };
  const mul = (x: C, y: C): C => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re });
  const sub = (x: C, y: C): C => ({ re: x.re - y.re, im: x.im - y.im });
  const div = (x: C, y: C): C => { const d = y.re * y.re + y.im * y.im; return { re: (x.re * y.re + x.im * y.im) / d, im: (x.im * y.re - x.re * y.im) / d }; };
  const evalP = (z: C): C => { let r: C = { re: 1, im: 0 }; for (let k = n - 1; k >= 0; k--) r = { re: mul(r, z).re + a[k]!, im: mul(r, z).im }; return r; };
  let roots: C[] = Array.from({ length: n }, (_, k) => {
    const p = { re: 0.4, im: 0.9 };
    let z: C = { re: 1, im: 0 };
    for (let j = 0; j < k; j++) z = mul(z, p);
    return z;
  });
  for (let iter = 0; iter < 500; iter++) {
    let delta = 0;
    roots = roots.map((r, i) => {
      let denom: C = { re: 1, im: 0 };
      roots.forEach((s, j) => { if (i !== j) denom = mul(denom, sub(r, s)); });
      const next = sub(r, div(evalP(r), denom));
      delta = Math.max(delta, Math.hypot(next.re - r.re, next.im - r.im));
      return next;
    });
    if (delta < 1e-14) break;
  }
  return roots.map((r) => ({ re: Math.abs(r.re) < 1e-10 ? 0 : r.re, im: Math.abs(r.im) < 1e-9 ? 0 : r.im }));
}

const NUMERIC_CONSTANTS: Record<string, number> = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2 };

/** Replace named constants by their values so e.g. "X = 4/3·π·27" is recognised as linear in X. */
function withNumericConstants(node: MathNode): MathNode {
  return node.transform((n: MathNode, _path: string, parent: MathNode | null) => {
    const name = (n as unknown as { name?: string }).name;
    const isFnName = parent && (parent as { isFunctionNode?: boolean }).isFunctionNode && (parent as unknown as { fn: MathNode }).fn === n;
    if (n.type === 'SymbolNode' && name && !isFnName && NUMERIC_CONSTANTS[name] !== undefined) return new m.ConstantNode(NUMERIC_CONSTANTS[name]!);
    return n;
  });
}

function tryPolynomial(expr: MathNode, variable: string): number[] | null {
  try {
    const res = m.rationalize(withNumericConstants(expr), {}, true) as unknown as { coefficients: number[]; variables: string[]; denominator?: MathNode | null };
    if (!res.coefficients || res.coefficients.length === 0) return null;
    if (res.variables.length !== 1 || res.variables[0] !== variable) return null;
    return res.coefficients.map(Number);
  } catch {
    return null;
  }
}

function findRealRootsNumerically(f: (x: number) => number, from = -100, to = 100, samples = 8000): number[] {
  const roots: number[] = [];
  const step = (to - from) / samples;
  let px = from, py = f(px);
  const refine = (a: number, b: number) => {
    let fa = f(a);
    for (let i = 0; i < 200; i++) {
      const mid = (a + b) / 2;
      const fm = f(mid);
      if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; } else b = mid;
      if (b - a < 1e-13) break;
    }
    return (a + b) / 2;
  };
  for (let i = 1; i <= samples; i++) {
    const x = from + i * step;
    const y = f(x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (py === 0) roots.push(px);
      else if (Math.sign(py) !== Math.sign(y)) {
        const r = refine(px, x);
        // Reject sign changes caused by poles (|f| large near r).
        if (Math.abs(f(r)) < 1e-6) roots.push(r);
      }
    }
    px = x; py = y;
  }
  const unique: number[] = [];
  for (const r of roots) if (!unique.some((u) => Math.abs(u - r) < 1e-7)) unique.push(r);
  return unique;
}

function substitutionCheck(lhs: MathNode, rhs: MathNode, variable: string, value: number): Verification {
  const l = evalNode(lhs, { [variable]: value });
  const r = evalNode(rhs, { [variable]: value });
  const passed = Number.isFinite(l) && Number.isFinite(r) && Math.abs(l - r) <= 1e-7 * Math.max(1, Math.abs(l), Math.abs(r));
  return {
    method: `substitute ${variable} = ${formatNumber(value)}`,
    passed,
    detail: `LHS = ${formatNumber(l)}, RHS = ${formatNumber(r)}`,
  };
}

/** Solve a single-variable equation such as "2x + 3 = 7" or "x^2 - 5x + 6 = 0". */
export function solveEquation(raw: string, preferredVariable?: string): MathResult {
  const input = normalizeMathInput(raw).replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2').replace(/\*(pi|e)\b/g, '*$1');
  const { lhs, rhs } = splitEquation(input);
  const lhsNode = safeParse(fixImplicit(lhs));
  const rhsNode = safeParse(fixImplicit(rhs));
  const vars = [...new Set([...freeSymbols(lhsNode), ...freeSymbols(rhsNode)])];
  const variable = preferredVariable && vars.includes(preferredVariable) ? preferredVariable : vars.includes('x') ? 'x' : vars[0];
  if (!variable) throw new Error('No unknown variable found in the equation');
  if (vars.length > 1) throw new Error(`The equation has several unknowns (${vars.join(', ')}). Provide a system of equations or values for the others.`);

  const expr = new m.OperatorNode('-', 'subtract', [lhsNode, rhsNode]);
  const steps: SolutionStep[] = [
    { description: 'Write the equation', latex: `${lhsNode.toTex()} = ${rhsNode.toTex()}` },
  ];
  const assumptions: string[] = [];
  const warnings: string[] = [];
  const realSolutions: number[] = [];
  const exactStrings: string[] = [];
  let complexNote: string | null = null;

  const coeffs = tryPolynomial(expr, variable);
  if (coeffs) {
    while (coeffs.length > 1 && Math.abs(coeffs[coeffs.length - 1]!) < EPS) coeffs.pop();
    const degree = coeffs.length - 1;
    const polyTex = m.rationalize(expr).toTex();
    steps.push({ description: 'Move every term to one side and collect like terms', latex: `${polyTex} = 0` });
    if (degree === 0) {
      const c = coeffs[0] ?? 0;
      return {
        kind: 'equation', input, answer: Math.abs(c) < EPS ? 'Every real number is a solution (identity)' : 'No solution (contradiction)',
        steps: [...steps, { description: Math.abs(c) < EPS ? 'Both sides are always equal' : `This reduces to ${formatNumber(c)} = 0, which is false` }],
        verification: [], assumptions, warnings,
      };
    }
    if (degree === 1) {
      const [b, a] = coeffs as [number, number];
      const x = -b / a;
      steps.push({ description: `Isolate ${variable}: ${formatNumber(a)}${variable} = ${formatNumber(-b)}` });
      steps.push({ description: `Divide both sides by ${formatNumber(a)}`, latex: `${variable} = ${latexOfFraction(toExactString(x))}` });
      realSolutions.push(x);
      exactStrings.push(toExactString(x));
    } else if (degree === 2) {
      // Scale to integers when coefficients are rational.
      let [c, b, a] = coeffs as [number, number, number];
      const fr = [a, b, c].map((v) => approximateFraction(v, 10000));
      if (fr.every((f, i) => f && Math.abs(f.n / f.d - [a, b, c][i]!) < 1e-12)) {
        const L = fr.reduce((acc, f) => lcm(acc, f!.d), 1);
        [a, b, c] = [a * L, b * L, c * L].map((v) => Math.round(v)) as [number, number, number];
      }
      const D = b * b - 4 * a * c;
      steps.push({ description: `Identify a = ${formatNumber(a)}, b = ${formatNumber(b)}, c = ${formatNumber(c)}` });
      steps.push({ description: 'Compute the discriminant Δ = b² − 4ac', latex: `\\Delta = (${formatNumber(b)})^2 - 4(${formatNumber(a)})(${formatNumber(c)}) = ${formatNumber(D)}` });
      steps.push({ description: 'Apply the quadratic formula', latex: `${variable} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}` });
      const allInt = [a, b, c].every(Number.isInteger);
      if (D > 0) {
        const r1 = (-b - Math.sqrt(D)) / (2 * a);
        const r2 = (-b + Math.sqrt(D)) / (2 * a);
        realSolutions.push(...[r1, r2].sort((p, q) => p - q));
        const sq = Math.round(Math.sqrt(D));
        if (allInt && sq * sq === D) {
          exactStrings.push(...realSolutions.map((r) => toExactString(r)));
        } else if (allInt) {
          const { k, r } = simplifySqrt(D);
          const g = gcd(gcd(b, k), 2 * a);
          const sgn = a < 0 ? -1 : 1;
          const B = (-b / g) * sgn, K = k / g, A = (2 * a / g) * sgn;
          const rad = `${K === 1 ? '' : K}√${r}`;
          const num = B === 0 ? `±${rad}` : `${B} ± ${rad}`;
          exactStrings.push(A === 1 ? num : `(${num})/${A}`);
        } else exactStrings.push(...realSolutions.map((r) => formatNumber(r)));
        steps.push({ description: 'Δ > 0, so there are two distinct real solutions' });
      } else if (Math.abs(D) < EPS) {
        const r = -b / (2 * a);
        realSolutions.push(r);
        exactStrings.push(toExactString(r));
        steps.push({ description: 'Δ = 0, so there is one repeated real solution' });
      } else {
        const re = -b / (2 * a);
        const im = Math.sqrt(-D) / (2 * Math.abs(a));
        complexNote = `${variable} = ${formatNumber(re)} ± ${formatNumber(im)}i`;
        steps.push({ description: 'Δ < 0, so there are no real solutions; the two complex solutions are conjugates' });
        warnings.push('No real solutions. Complex solutions are shown.');
      }
    } else {
      const roots = polynomialRoots(coeffs);
      const real = roots.filter((r) => r.im === 0).map((r) => r.re).sort((p, q) => p - q);
      const dedup: number[] = [];
      for (const r of real) if (!dedup.some((d) => Math.abs(d - r) < 1e-6)) dedup.push(r);
      realSolutions.push(...dedup);
      exactStrings.push(...dedup.map((r) => toExactString(Math.abs(r - Math.round(r)) < 1e-9 ? Math.round(r) : r)));
      steps.push({ description: `Degree-${degree} polynomial: find roots numerically (Durand–Kerner iteration)` });
      const complex = roots.filter((r) => r.im !== 0);
      if (complex.length) warnings.push(`${complex.length} complex root(s) omitted from the real solutions.`);
      assumptions.push('Roots of degree ≥ 3 are computed numerically and rounded to 10 significant digits.');
    }
  } else {
    const f = (x: number) => { try { return evalNode(expr, { [variable]: x }); } catch { return NaN; } };
    const roots = findRealRootsNumerically(f);
    realSolutions.push(...roots);
    exactStrings.push(...roots.map((r) => formatNumber(r)));
    steps.push({ description: 'The equation is not polynomial; search for real roots numerically (sign changes + bisection)' });
    assumptions.push('Only real solutions in the interval [−100, 100] were searched.');
    if (roots.length >= 20) warnings.push('Many solutions found; the equation may be periodic and have infinitely many.');
  }

  // Independent verification by substitution into the ORIGINAL equation.
  const verification = realSolutions.map((x) => substitutionCheck(lhsNode, rhsNode, variable, x));
  const keep = realSolutions.map((_, i) => verification[i]!.passed);
  const extraneous = realSolutions.filter((_, i) => !keep[i]);
  if (extraneous.length && coeffs) {
    warnings.push(`Rejected extraneous candidate(s): ${extraneous.map((x) => formatNumber(x)).join(', ')} (make a denominator zero or fail substitution).`);
  }
  const finalReal = realSolutions.filter((_, i) => keep[i]);
  const finalExact = exactStrings.length === realSolutions.length ? exactStrings.filter((_, i) => keep[i]) : exactStrings;

  let answer: string;
  if (finalExact.length === 0) answer = complexNote ? `No real solution (complex solutions: ${complexNote})` : 'No real solution found';
  else answer = finalExact.map((s) => `${variable} = ${s}`).join(', ');
  const answerLatex = finalExact.map((s) => `${variable} = ${latexOfFraction(s).replace(/√(\d+)/g, '\\sqrt{$1}').replace('±', '\\pm ')}`).join(',\\; ');
  if (finalReal.length) steps.push({ description: 'Check each solution by substituting it back into the original equation' });
  return { kind: 'equation', input, answer, answerLatex, numeric: finalReal, steps, verification, assumptions, warnings };
}

function fixImplicit(s: string): string {
  return s.replace(/(\d)\s*([a-zA-Z(])/g, '$1*$2').replace(/\)\s*\(/g, ')*(').replace(/\)\s*([a-zA-Z0-9])/g, ')*$1');
}

/** Solve a system of linear equations with exact rational elimination. */
export function solveLinearSystem(rawEquations: string[]): MathResult {
  const eqs = rawEquations.map((e) => normalizeMathInput(e)).filter(Boolean);
  const exprs = eqs.map((e) => {
    const { lhs, rhs } = splitEquation(e);
    return new m.OperatorNode('-', 'subtract', [safeParse(fixImplicit(lhs)), safeParse(fixImplicit(rhs))]) as MathNode;
  });
  const vars = [...new Set(exprs.flatMap((e) => freeSymbols(e)))].sort();
  if (vars.length === 0) throw new Error('No variables found');
  // Extract linear coefficients by probing.
  const rows: number[][] = exprs.map((e) => {
    const zero: Record<string, number> = Object.fromEntries(vars.map((v) => [v, 0]));
    const c0 = evalNode(e, zero);
    const row = vars.map((v) => evalNode(e, { ...zero, [v]: 1 }) - c0);
    // Linearity check at a second point.
    const probe: Record<string, number> = Object.fromEntries(vars.map((v, i) => [v, 1.7 + i * 0.9]));
    const predicted = c0 + row.reduce((s, a, i) => s + a * probe[vars[i]!]!, 0);
    if (Math.abs(predicted - evalNode(e, probe)) > 1e-7) throw new Error('The system is not linear');
    return [...row, -c0];
  });
  const steps: SolutionStep[] = [{ description: `Write the augmented matrix for unknowns ${vars.join(', ')}` }];
  // Gaussian elimination using mathjs fractions for exactness.
  const F = rows.map((r) => r.map((v) => m.fraction(v)));
  const nVars = vars.length;
  let pivotRow = 0;
  const pivotCols: number[] = [];
  for (let col = 0; col < nVars && pivotRow < F.length; col++) {
    let sel = -1;
    for (let r = pivotRow; r < F.length; r++) if (Number(F[r]![col]) !== 0) { sel = r; break; }
    if (sel === -1) continue;
    [F[pivotRow], F[sel]] = [F[sel]!, F[pivotRow]!];
    const pv = F[pivotRow]![col]!;
    F[pivotRow] = F[pivotRow]!.map((v) => m.divide(v, pv) as never);
    for (let r = 0; r < F.length; r++) {
      if (r === pivotRow) continue;
      const factor = F[r]![col]!;
      if (Number(factor) === 0) continue;
      F[r] = F[r]!.map((v, j) => m.subtract(v, m.multiply(factor, F[pivotRow]![j]!)) as never);
    }
    pivotCols.push(col);
    steps.push({ description: `Eliminate ${vars[col]} from the other equations` });
    pivotRow++;
  }
  for (let r = pivotRow; r < F.length; r++) {
    if (Number(F[r]![nVars]) !== 0) {
      return { kind: 'system', input: eqs.join('; '), answer: 'No solution (the equations are inconsistent)', steps, verification: [], assumptions: [], warnings: [] };
    }
  }
  if (pivotCols.length < nVars) {
    return { kind: 'system', input: eqs.join('; '), answer: 'Infinitely many solutions (the equations are dependent)', steps, verification: [], assumptions: [], warnings: [] };
  }
  const values: Record<string, number> = {};
  const parts: string[] = [];
  pivotCols.forEach((col, r) => {
    const fr = F[r]![nVars]!;
    values[vars[col]!] = Number(fr);
    const n = Number(fr.s) * Number(fr.n), den = Number(fr.d);
    parts.push(`${vars[col]} = ${den === 1 ? n : `${n}/${den}`}`);
  });
  const verification: Verification[] = exprs.map((e, i) => {
    const v = evalNode(e, values);
    return { method: `substitute into equation ${i + 1}`, passed: Math.abs(v) < 1e-9, detail: `residual ${formatNumber(v)}` };
  });
  return { kind: 'system', input: eqs.join('; '), answer: parts.join(', '), numeric: vars.map((v) => values[v]!), steps, verification, assumptions: [], warnings: [] };
}

export function differentiate(raw: string, variable = 'x'): MathResult {
  const input = normalizeMathInput(raw);
  const node = safeParse(fixImplicit(input));
  const d = m.derivative(node, variable);
  const simplified = m.simplify(d);
  // Independent verification: central finite differences.
  let ok = 0, total = 0;
  for (const x0 of [0.3, 1.1, 2.7, -1.4]) {
    const h = 1e-5;
    const f1 = evalNode(node, { [variable]: x0 + h });
    const f0 = evalNode(node, { [variable]: x0 - h });
    const fd = (f1 - f0) / (2 * h);
    const sym = evalNode(simplified, { [variable]: x0 });
    if (!Number.isFinite(fd) || !Number.isFinite(sym)) continue;
    total++;
    if (Math.abs(fd - sym) <= 1e-4 * Math.max(1, Math.abs(sym))) ok++;
  }
  return {
    kind: 'derivative', input, answer: simplified.toString(), answerLatex: `\\frac{d}{d${variable}}\\left(${node.toTex()}\\right) = ${simplified.toTex()}`,
    steps: [
      { description: 'Apply differentiation rules (power, product, quotient, chain)', latex: d.toTex() },
      { description: 'Simplify', latex: simplified.toTex() },
    ],
    verification: [{ method: 'finite-difference check', passed: total > 0 && ok === total, detail: `${ok}/${total} sample points agree` }],
    assumptions: [], warnings: [],
  };
}

/** Adaptive Simpson integration. */
export function integrateNumeric(f: (x: number) => number, a: number, b: number, tol = 1e-10): number {
  const simpson = (l: number, r: number, fl: number, fm: number, fr: number) => ((r - l) / 6) * (fl + 4 * fm + fr);
  const rec = (l: number, r: number, fl: number, fm: number, fr: number, whole: number, eps: number, depth: number): number => {
    const mid = (l + r) / 2;
    const lm = (l + mid) / 2, rm = (mid + r) / 2;
    const flm = f(lm), frm = f(rm);
    const left = simpson(l, mid, fl, flm, fm);
    const right = simpson(mid, r, fm, frm, fr);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * eps) return left + right + (left + right - whole) / 15;
    return rec(l, mid, fl, flm, fm, left, eps / 2, depth - 1) + rec(mid, r, fm, frm, fr, right, eps / 2, depth - 1);
  };
  const fa = f(a), fb = f(b), fm = f((a + b) / 2);
  return rec(a, b, fa, fm, fb, simpson(a, b, fa, fm, fb), tol, 40);
}

export function integrate(raw: string, variable = 'x', bounds?: [number, number]): MathResult {
  const input = normalizeMathInput(raw);
  const node = safeParse(fixImplicit(input));
  const steps: SolutionStep[] = [];
  const warnings: string[] = [];
  const coeffs = tryPolynomial(node, variable);
  let antiderivative: string | null = null;
  if (coeffs) {
    const terms = coeffs
      .map((c, k) => ({ c: c / (k + 1), k: k + 1 }))
      .filter((t) => Math.abs(t.c) > EPS)
      .reverse()
      .map((t) => `${toExactString(t.c)}*${variable}^${t.k}`);
    antiderivative = m.simplify(terms.join(' + ') || '0').toString();
    steps.push({ description: 'Integrate term by term with the power rule ∫xⁿ dx = xⁿ⁺¹/(n+1)', latex: `${m.parse(antiderivative).toTex()} + C` });
  }
  const f = (x: number) => evalNode(node, { [variable]: x });
  if (bounds) {
    const [a, b] = bounds;
    let value: number;
    let exactValue: number | null = null;
    if (antiderivative) {
      const F = safeParse(antiderivative);
      exactValue = evalNode(F, { [variable]: b }) - evalNode(F, { [variable]: a });
      steps.push({ description: `Evaluate F(${b}) − F(${a})` });
    }
    const numericValue = integrateNumeric(f, a, b);
    value = exactValue ?? numericValue;
    if (!antiderivative) steps.push({ description: 'Compute the definite integral numerically (adaptive Simpson rule)' });
    const verification: Verification[] = [{
      method: 'adaptive Simpson numerical integration',
      passed: exactValue === null ? Number.isFinite(numericValue) : Math.abs(exactValue - numericValue) < 1e-6 * Math.max(1, Math.abs(exactValue)),
      detail: `numerical value ${formatNumber(numericValue)}`,
    }];
    if (!Number.isFinite(value)) warnings.push('The integral may diverge on this interval.');
    const ex = toExactString(value);
    return { kind: 'integral', input, answer: ex === formatNumber(value) ? ex : `${ex} ≈ ${formatNumber(value)}`, numeric: [value], steps, verification, assumptions: exactValue === null ? ['Value computed numerically.'] : [], warnings };
  }
  if (!antiderivative) {
    return {
      kind: 'integral', input, answer: 'A closed-form antiderivative is not supported by the offline engine for this function',
      steps, verification: [], assumptions: [], warnings: ['Provide bounds to compute a numerical definite integral.'],
    };
  }
  const check = verifyEquivalent(m.derivative(safeParse(antiderivative), variable), node, 'differentiate the result');
  return { kind: 'integral', input, answer: `${antiderivative} + C`, answerLatex: `${m.parse(antiderivative).toTex()} + C`, steps, verification: [check], assumptions: [], warnings };
}

export interface DescriptiveStats {
  count: number; sum: number; mean: number; median: number; mode: number[];
  min: number; max: number; range: number;
  variancePopulation: number; varianceSample: number | null;
  stdPopulation: number; stdSample: number | null;
  q1: number; q3: number;
}

function quantile(sorted: number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export function describe(data: number[]): DescriptiveStats {
  if (data.length === 0) throw new Error('No data');
  const sorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  const sum = data.reduce((s, x) => s + x, 0);
  const mean = sum / n;
  const counts = new Map<number, number>();
  for (const x of data) counts.set(x, (counts.get(x) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  const mode = maxCount > 1 ? [...counts.entries()].filter(([, c]) => c === maxCount).map(([x]) => x).sort((a, b) => a - b) : [];
  const ss = data.reduce((s, x) => s + (x - mean) ** 2, 0);
  return {
    count: n, sum, mean, median: quantile(sorted, 0.5), mode,
    min: sorted[0]!, max: sorted[n - 1]!, range: sorted[n - 1]! - sorted[0]!,
    variancePopulation: ss / n, varianceSample: n > 1 ? ss / (n - 1) : null,
    stdPopulation: Math.sqrt(ss / n), stdSample: n > 1 ? Math.sqrt(ss / (n - 1)) : null,
    q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75),
  };
}

export function statistics(raw: string): MathResult {
  const nums = (normalizeMathInput(raw).match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const s = describe(nums);
  const f = (x: number | null) => (x === null ? 'n/a' : formatNumber(x, 6));
  // Independent check of the mean via mathjs.
  const mjMean = Number(m.mean(nums));
  return {
    kind: 'statistics', input: nums.join(', '),
    answer: `mean = ${f(s.mean)}, median = ${f(s.median)}, mode = ${s.mode.length ? s.mode.join(', ') : 'none'}, σ = ${f(s.stdPopulation)}, s = ${f(s.stdSample)}`,
    numeric: [s.mean, s.median, s.stdPopulation],
    steps: [
      { description: `Count n = ${s.count}, sum = ${f(s.sum)}` },
      { description: `Mean = sum / n = ${f(s.mean)}` },
      { description: `Sort the data; the median is ${f(s.median)} (Q1 = ${f(s.q1)}, Q3 = ${f(s.q3)})` },
      { description: `Population variance = ${f(s.variancePopulation)}; sample variance = ${f(s.varianceSample)}` },
    ],
    verification: [{ method: 'mathjs mean', passed: Math.abs(mjMean - s.mean) < 1e-9, detail: formatNumber(mjMean) }],
    assumptions: ['σ is the population standard deviation; s is the sample standard deviation (n − 1).'],
    warnings: nums.length < 2 ? ['At least two values are needed for a meaningful spread.'] : [],
  };
}

export interface PlotSeries { points: Array<[number, number | null]>; min: number; max: number }

/** Sample y = f(x) for plotting, breaking the line at discontinuities. */
export function sampleFunction(raw: string, from = -10, to = 10, samples = 400, variable = 'x'): PlotSeries {
  const node = safeParse(fixImplicit(normalizeMathInput(raw.replace(/^\s*y\s*=\s*/, ''))));
  const code = node.compile();
  const pts: Array<[number, number | null]> = [];
  let min = Infinity, max = -Infinity;
  let prev: number | null = null;
  for (let i = 0; i <= samples; i++) {
    const x = from + ((to - from) * i) / samples;
    let y: number | null;
    try {
      const v = code.evaluate({ [variable]: x });
      y = typeof v === 'number' && Number.isFinite(v) ? v : null;
    } catch { y = null; }
    if (y !== null && prev !== null && Math.abs(y - prev) > 1e3 * Math.max(1, (to - from) / samples * 100)) pts.push([x, null]);
    pts.push([x, y]);
    if (y !== null) { min = Math.min(min, y); max = Math.max(max, y); }
    prev = y;
  }
  return { points: pts, min, max };
}
