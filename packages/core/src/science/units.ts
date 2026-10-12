import { m } from '../math/mathjs.js';
import { formatNumber } from '../math/engine.js';
import type { MathResult } from '../math/types.js';

const ALIASES: Record<string, string> = {
  '°C': 'degC', '℃': 'degC', 'celsius': 'degC', '°F': 'degF', 'fahrenheit': 'degF', 'kelvin': 'K',
  'kmh': 'km/h', 'kph': 'km/h', 'mph': 'mi/h', 'litre': 'L', 'liter': 'L', 'litres': 'L', 'liters': 'L',
  'metre': 'm', 'meter': 'm', 'metres': 'm', 'meters': 'm', 'gram': 'g', 'grams': 'g', 'kilogram': 'kg', 'kilograms': 'kg',
  'second': 's', 'seconds': 's', 'sec': 's', 'minute': 'min', 'minutes': 'min', 'hour': 'h', 'hours': 'h',
  'ml': 'mL', 'cc': 'cm^3', 'μm': 'um', 'µm': 'um',
};

export function normalizeUnit(u: string): string {
  const t = u.trim();
  return ALIASES[t] ?? ALIASES[t.toLowerCase()] ?? t.replace(/²/g, '^2').replace(/³/g, '^3').replace(/·/g, ' ');
}

/** Convert a value between units using mathjs's unit system (deterministic). */
export function convertUnits(value: number, from: string, to: string): MathResult {
  const fromU = normalizeUnit(from);
  const toU = normalizeUnit(to);
  const q = m.unit(value, fromU);
  let converted;
  try {
    converted = q.to(toU);
  } catch {
    throw new Error(`Cannot convert ${from} to ${to}: the dimensions do not match`);
  }
  const result = converted.toNumber(toU);
  // Independent check: convert back.
  const back = m.unit(result, toU).toNumber(fromU);
  const passed = Math.abs(back - value) <= 1e-9 * Math.max(1, Math.abs(value));
  return {
    kind: 'units',
    input: `${value} ${from} → ${to}`,
    answer: `${formatNumber(value)} ${from} = ${formatNumber(result)} ${to}`,
    numeric: [result],
    steps: [
      { description: `Express ${from} and ${to} in SI base units` },
      { description: `Multiply by the conversion factor (1 ${from} = ${formatNumber(m.unit(1, fromU).toNumber(toU))} ${to})`.replace(/= NaN.*\)/, ')') },
    ],
    verification: [{ method: 'round-trip conversion', passed, detail: `${formatNumber(result)} ${to} → ${formatNumber(back)} ${from}` }],
    assumptions: fromU.startsWith('deg') || toU.startsWith('deg') ? ['Temperature conversion treats values as absolute temperatures, not differences.'] : [],
    warnings: [],
  };
}

export type Dimension = Record<string, number>;

/** Base-dimension exponents of a unit expression, e.g. "N" → {MASS:1, LENGTH:1, TIME:-2}. */
export function dimensionOf(unit: string): Dimension {
  const u = m.unit(1, normalizeUnit(unit)) as unknown as { dimensions: number[] };
  const names = ['MASS', 'LENGTH', 'TIME', 'CURRENT', 'TEMPERATURE', 'LUMINOUS_INTENSITY', 'AMOUNT_OF_SUBSTANCE', 'ANGLE', 'BIT'];
  const dim: Dimension = {};
  u.dimensions.forEach((e, i) => { if (Math.abs(e) > 1e-12) dim[names[i]!] = e; });
  return dim;
}

export function sameDimension(a: string, b: string): boolean {
  const da = dimensionOf(a), db = dimensionOf(b);
  const keys = new Set([...Object.keys(da), ...Object.keys(db)]);
  return [...keys].every((k) => Math.abs((da[k] ?? 0) - (db[k] ?? 0)) < 1e-12);
}

/** Parse "12.5 km/h" style quantities. */
export function parseQuantity(text: string): { value: number; unit: string } | null {
  const match = /^\s*(-?\d+(?:[.,]\d+)?(?:e-?\d+)?)\s*([^\d\s].*)?$/i.exec(text);
  if (!match) return null;
  return { value: Number(match[1]!.replace(',', '.')), unit: (match[2] ?? '').trim() };
}
