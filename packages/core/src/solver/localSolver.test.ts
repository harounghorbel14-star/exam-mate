import { describe, it, expect } from 'vitest';
import { solveLocally, routeQuestion, similarQuestion } from './localSolver.js';

describe('local solver routing', () => {
  const cases: Array<[string, string]> = [
    ['Solve 2x + 3 = 11', 'equation'],
    ['x^2 - 4 = 0', 'equation'],
    ['2x + y = 5; x - y = 1', 'system'],
    ['3 * (4 + 5)^2', 'evaluate'],
    ['What is 15/4 + 2?', 'evaluate'],
    ['derivative of x^3 + 2x', 'derivative'],
    ['integrate x^2 from 0 to 3', 'integral'],
    ['convert 72 km/h to m/s', 'units'],
    ['5 km in m', 'units'],
    ['balance H2 + O2 -> H2O', 'chem-balance'],
    ['molar mass of H2SO4', 'molar-mass'],
    ['Find the mean of 2, 4, 4, 4, 5, 5, 7, 9', 'statistics'],
    ['A car travels 150 m in 6 s. What is its average speed?', 'physics'],
    ['simplify 2x + 3x', 'simplify'],
    ['Résoudre 3x - 7 = 11', 'equation'],
    ['حل 2x + 4 = 10', 'equation'],
  ];
  it.each(cases)('%s → %s', (q, tool) => {
    expect(routeQuestion(q)?.tool).toBe(tool);
  });
  it('returns unsupported rather than inventing answers', () => {
    const r = solveLocally('Explain the causes of the French Revolution');
    expect(r.status).toBe('unsupported');
    expect(r.result).toBeUndefined();
    expect(r.subject).toBe('history');
  });
});

describe('modes', () => {
  it('marks verified answers', () => {
    const r = solveLocally('Solve 2x + 3 = 11');
    expect(r.result?.answer).toBe('x = 4');
    expect(r.confidence).toBe('verified');
  });
  it('hint hides the answer', () => {
    const r = solveLocally('Solve 2x + 3 = 11', { mode: 'hint' });
    expect(r.result?.answer).toBe('');
    expect(r.modeText).toBeTruthy();
  });
  it('checks student answers independently', () => {
    expect(solveLocally('x^2 - 5x + 6 = 0', { mode: 'check', studentAnswer: 'x = 2 or x = 3' }).check?.correct).toBe(true);
    const partial = solveLocally('x^2 - 5x + 6 = 0', { mode: 'check', studentAnswer: 'x = 2' }).check!;
    expect(partial.correct).toBe(false);
    expect(partial.detail).toMatch(/Partly/);
    expect(solveLocally('balance H2 + O2 -> H2O', { mode: 'check', studentAnswer: '2, 1, 2' }).check?.correct).toBe(true);
    expect(solveLocally('convert 1 km to m', { mode: 'check', studentAnswer: '1000' }).check?.correct).toBe(true);
  });
  it('generates solvable similar questions', () => {
    const s = similarQuestion('Solve 3x + 4 = 19', 5);
    expect(s).not.toBeNull();
    expect(s!.question).not.toBe('Solve 3x + 4 = 19');
  });
  it('localises steps to French and Arabic', () => {
    const fr = solveLocally('x^2 - 5x + 6 = 0', { locale: 'fr' });
    expect(fr.result?.steps.some((s) => s.description.includes('discriminant'))).toBe(true);
    const ar = solveLocally('x^2 - 5x + 6 = 0', { locale: 'ar' });
    expect(ar.result?.steps.some((s) => s.description.includes('المميز'))).toBe(true);
  });
  it('reports errors from tools', () => {
    expect(solveLocally('balance H2 -> O2').status).toBe('error');
  });
});

describe('robustness', () => {
  it('handles percent-of, leading words and Arabic units', () => {
    expect(solveLocally('What is 15% of 80?').result?.numeric?.[0]).toBe(12);
    expect(solveLocally('حل المعادلة 2x + 4 = 10').result?.answer).toBe('x = 3');
    expect(solveLocally('Résoudre l’équation 3x = 12').result?.answer).toBe('x = 4');
    expect(solveLocally('Calcule la dérivée de x^2').tool).toBe('derivative');
    expect(solveLocally('A 10 kg box is lifted 5 m. What is its potential energy?').result?.numeric?.[0]).toBeCloseTo(490.5, 6);
    expect(solveLocally('سيارة تقطع 200 م في 10 ث. ما سرعتها؟').result?.numeric?.[0]).toBe(20);
  });
});
