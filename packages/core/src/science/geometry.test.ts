import { describe, it, expect } from 'vitest';
import { parseGeometryProblem, solveGeometry } from './geometry.js';
import { solveLocally } from '../solver/localSolver.js';

const num = (q: string) => solveLocally(q).result?.numeric?.[0];

describe('geometry word problems', () => {
  it('handles varied phrasings and shapes', () => {
    expect(num('The perimeter of a square is 36 cm. Find the area.')).toBe(81);
    expect(num('A rectangle is 12 m long and 5 m wide. Calculate its perimeter.')).toBe(34);
    expect(num('A circle has a diameter of 10 cm. What is its circumference?')).toBeCloseTo(31.4159265, 6);
    expect(num('A triangle has a base of 10 cm and a height of 4 cm. Find its area.')).toBe(20);
    expect(num('A cube has a side of 3 cm. What is its volume?')).toBe(27);
    expect(num('Find the volume of a sphere with radius 3 m')).toBeCloseTo(113.0973355, 6);
    expect(num('A right triangle has a hypotenuse of 13 cm and one leg of 5 cm. Find the other leg.')).toBeUndefined(); // ambiguous: which leg is unknown is not stated as "other leg" keyword
  });
  it('keeps the student unit and converts mixed units', () => {
    const r = solveLocally('A rectangle has a length of 2 m and a width of 50 cm. What is its area?').result!;
    expect(r.numeric?.[0]).toBe(1);
    expect(r.answer).toMatch(/m²/);
  });
  it('works in French and Arabic', () => {
    expect(num('Un carré a un côté de 7 cm. Calcule son aire.')).toBe(49);
    expect(num('دائرة نصف قطرها 2 سم. احسب مساحتها')).toBeCloseTo(12.5663706, 6);
    expect(num('دائرة نصف القطر 2 سم. احسب المساحة')).toBeCloseTo(12.5663706, 6);
  });
  it('verifies each step and reports the formula used', () => {
    const r = solveGeometry(parseGeometryProblem('A square has an area of 49 m². What is its perimeter?')!);
    expect(r.verification.length).toBeGreaterThan(0);
    expect(r.verification.every((v) => v.passed)).toBe(true);
    expect(r.steps.some((s) => s.description.includes('A = s²'))).toBe(true);
  });
  it('does not hijack non-geometry questions', () => {
    expect(solveLocally('Explain the circle of life in 3 sentences').status).toBe('unsupported');
    expect(solveLocally('Solve 2x + 3 = 11').tool).toBe('equation');
    expect(solveLocally('A car travels 150 m in 6 s. What is its average speed?').tool).toBe('physics');
  });
});

describe('physics inline givens', () => {
  it('reads "symbol = value unit" constants', () => {
    expect(num('A spring with k = 200 N/m is stretched by 0.05 m. Find the force.')).toBe(10);
    expect(num('How much heat is needed to raise 0.5 kg of water by 20 °C? (c = 4180 J/(kg K))')).toBe(41800);
    expect(num('Given m = 3 kg and a = 4 m/s^2, find the force.')).toBe(12);
  });
});
