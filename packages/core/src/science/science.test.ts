import { describe, it, expect } from 'vitest';
import { convertUnits, sameDimension } from './units.js';
import { solvePhysics, parsePhysicsProblem } from './physics.js';
import { balanceEquation, molarMass, parseFormula } from '../chem/chemistry.js';
import { ELEMENTS } from '../chem/elements.js';

describe('units', () => {
  it('converts and round-trips', () => {
    const r = convertUnits(72, 'km/h', 'm/s');
    expect(r.numeric?.[0]).toBeCloseTo(20, 10);
    expect(r.verification[0]?.passed).toBe(true);
    expect(convertUnits(100, '°C', '°F').numeric?.[0]).toBeCloseTo(212, 8);
  });
  it('rejects mismatched dimensions', () => {
    expect(() => convertUnits(1, 'kg', 'm')).toThrow(/dimensions/);
    expect(sameDimension('N', 'kg m/s^2')).toBe(true);
  });
});

describe('physics', () => {
  it('solves direct formulas', () => {
    const r = solvePhysics([{ symbol: 'd', value: 100, unit: 'm' }, { symbol: 't', value: 5, unit: 's' }], 'v');
    expect(r.numeric?.[0]).toBe(20);
  });
  it('chains formulas and converts units', () => {
    // From rest, a = 2 m/s², t = 5 s → v = 10 m/s → KE with m = 3 kg = 150 J
    const r = solvePhysics([
      { symbol: 'u', value: 0, unit: 'm/s' }, { symbol: 'a', value: 2, unit: 'm/s^2' },
      { symbol: 't', value: 5, unit: 's' }, { symbol: 'mass', value: 3000, unit: 'g' },
    ], 'KE');
    expect(r.numeric?.[0]).toBeCloseTo(150, 9);
  });
  it('assumes standard gravity when needed', () => {
    const r = solvePhysics([{ symbol: 'mass', value: 2, unit: 'kg' }, { symbol: 'h', value: 10, unit: 'm' }], 'PE');
    expect(r.numeric?.[0]).toBeCloseTo(196.2, 6);
    expect(r.assumptions.join(' ')).toMatch(/9\.81/);
  });
  it('parses word problems', () => {
    const p = parsePhysicsProblem('A car travels 150 m in 6 s. What is its average speed?');
    expect(p.unknown).toBe('v');
    expect(p.known).toEqual([{ symbol: 'd', value: 150, unit: 'm' }, { symbol: 't', value: 6, unit: 's' }]);
    const q = parsePhysicsProblem('A 1200 kg car accelerates from rest at 3 m/s². Calculate the net force.');
    expect(q.unknown).toBe('F');
    expect(solvePhysics(q.known, q.unknown!).numeric?.[0]).toBe(3600);
    const ohm = parsePhysicsProblem('A resistor of 220 Ω carries a current of 0.05 A. Find the voltage.');
    expect(solvePhysics(ohm.known, ohm.unknown!).numeric?.[0]).toBeCloseTo(11, 9);
  });
});

describe('chemistry', () => {
  it('has all 118 elements with trilingual names', () => {
    expect(ELEMENTS).toHaveLength(118);
    expect(ELEMENTS.every((e, i) => e.z === i + 1 && e.name.ar && e.name.fr && e.mass > 0)).toBe(true);
  });
  it('parses formulas with groups and hydrates', () => {
    expect(parseFormula('Ca(OH)2').composition).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula('CuSO4·5H2O').composition).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(parseFormula('SO4^2-')).toEqual({ composition: { S: 1, O: 4 }, charge: -2 });
    expect(() => parseFormula('Xx2')).toThrow(/Unknown element/);
  });
  it('computes molar mass', () => {
    expect(molarMass('H2O').numeric?.[0]).toBeCloseTo(18.015, 3);
    expect(molarMass('H2SO4').numeric?.[0]).toBeCloseTo(98.072, 2);
  });
  it('balances equations', () => {
    expect(balanceEquation('H2 + O2 -> H2O').balanced).toBe('2H2 + O2 → 2H2O');
    expect(balanceEquation('C3H8 + O2 -> CO2 + H2O').coefficients).toEqual([1, 5, 3, 4]);
    expect(balanceEquation('Fe + O2 = Fe2O3').coefficients).toEqual([4, 3, 2]);
    expect(balanceEquation('KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2').coefficients).toEqual([2, 16, 2, 2, 8, 5]);
    const r = balanceEquation('Cu + Ag+ -> Cu2+ + Ag');
    expect(r.coefficients).toEqual([1, 2, 1, 2]);
    expect(r.verification.every((v) => v.passed)).toBe(true);
  });
  it('rejects impossible reactions', () => {
    expect(() => balanceEquation('H2 -> O2')).toThrow();
  });
});
