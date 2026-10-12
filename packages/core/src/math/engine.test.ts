import { describe as d, it, expect } from 'vitest';
import { solveEquation, solveLinearSystem, differentiate, integrate, evaluateExpression, statistics, polynomialRoots, simplifySqrt, sampleFunction, simplifyExpression } from './engine.js';
import { safeEvaluate } from './mathjs.js';

d('evaluateExpression', () => {
  it('respects precedence and returns exact fractions', () => {
    expect(evaluateExpression('2 + 3 * 4').answer).toBe('14');
    expect(evaluateExpression('1/3 + 1/6').answer).toBe('1/2 ≈ 0.5');
    expect(evaluateExpression('√16 + 2²').numeric?.[0]).toBe(8);
    expect(evaluateExpression('2 + 3 * 4').verification[0]?.passed).toBe(true);
  });
  it('flags division by zero', () => {
    expect(evaluateExpression('1/0').warnings.length).toBeGreaterThan(0);
  });
  it('blocks dangerous functions', () => {
    expect(() => safeEvaluate('import({}, {})')).toThrow();
    expect(() => safeEvaluate('evaluate("1+1")')).toThrow();
  });
});

d('solveEquation', () => {
  it('solves linear equations exactly', () => {
    const r = solveEquation('2x + 3 = 7');
    expect(r.answer).toBe('x = 2');
    expect(r.verification.every((v) => v.passed)).toBe(true);
    expect(solveEquation('3x = 1').answer).toBe('x = 1/3');
  });
  it('solves quadratics with rational roots', () => {
    expect(solveEquation('x^2 - 5x + 6 = 0').numeric).toEqual([2, 3]);
  });
  it('gives simplified surds', () => {
    expect(solveEquation('x^2 - 2x - 1 = 0').answer).toBe('x = 1 ± 2√2'.replace('2√2', '√2'));
    expect(solveEquation('x^2 = 8').answer).toBe('x = ±2√2');
  });
  it('handles no real solutions', () => {
    const r = solveEquation('x^2 + 1 = 0');
    expect(r.answer).toMatch(/No real solution/);
    expect(r.warnings[0]).toMatch(/complex/i);
  });
  it('handles identities and contradictions', () => {
    expect(solveEquation('x + 1 = x + 1').answer).toMatch(/Every real number/);
    expect(solveEquation('x + 1 = x + 2').answer).toMatch(/No solution/);
  });
  it('solves cubic numerically', () => {
    expect(solveEquation('x^3 - 6x^2 + 11x - 6 = 0').numeric?.map((x) => Math.round(x * 1e6) / 1e6)).toEqual([1, 2, 3]);
  });
  it('solves transcendental equations numerically', () => {
    const r = solveEquation('exp(x) = 2');
    expect(r.numeric?.[0]).toBeCloseTo(Math.LN2, 9);
  });
  it('rejects extraneous roots of rational equations', () => {
    const r = solveEquation('x/(x-1) = 1/(x-1)');
    expect(r.numeric).toEqual([]);
  });
});

d('systems and calculus', () => {
  it('solves 2x2 systems exactly', () => {
    const r = solveLinearSystem(['2x + y = 5', 'x - y = 1']);
    expect(r.answer).toBe('x = 2, y = 1');
  });
  it('detects inconsistent systems', () => {
    expect(solveLinearSystem(['x + y = 1', 'x + y = 2']).answer).toMatch(/No solution/);
  });
  it('differentiates and verifies with finite differences', () => {
    const r = differentiate('x^3 + sin(x)');
    expect(r.verification[0]?.passed).toBe(true);
  });
  it('integrates polynomials exactly', () => {
    expect(integrate('x^2', 'x', [0, 3]).answer).toBe('9');
    expect(integrate('3x^2 + 2', 'x').verification[0]?.passed).toBe(true);
    expect(integrate('sin(x)', 'x', [0, Math.PI]).numeric?.[0]).toBeCloseTo(2, 8);
  });
  it('simplifies with independent equivalence check', () => {
    const r = simplifyExpression('2x + 3x - x');
    expect(r.answer).toBe('4 * x');
    expect(r.verification[0]?.passed).toBe(true);
  });
});

d('helpers', () => {
  it('computes statistics', () => {
    const r = statistics('2, 4, 4, 4, 5, 5, 7, 9');
    expect(r.numeric?.[0]).toBe(5);
    expect(r.numeric?.[2]).toBe(2);
  });
  it('finds polynomial roots', () => {
    expect(polynomialRoots([-1, 0, 1]).map((r) => Math.round(r.re)).sort()).toEqual([-1, 1]);
    expect(simplifySqrt(72)).toEqual({ k: 6, r: 2 });
  });
  it('samples functions with discontinuities', () => {
    const s = sampleFunction('1/x', -1, 1, 10);
    expect(s.points.some(([, y]) => y === null)).toBe(true);
  });
});

d('constants in equations', () => {
  it('treats pi and e as numbers, so large roots are found exactly', () => {
    expect(solveEquation('x = 4/3 * pi * 27').numeric?.[0]).toBeCloseTo(113.0973355, 6);
    expect(solveEquation('2x = 300 * e').numeric?.[0]).toBeCloseTo(150 * Math.E, 9);
    expect(solveEquation('x^2 = 400 * pi').numeric?.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([-35.449077, 35.449077]);
  });
});
