import { create, all, type MathJsInstance, type MathNode } from 'mathjs';

/**
 * Shared mathjs instance. User input is never evaluated directly: `safeParse` rejects
 * any tree that references functions able to mutate the instance or evaluate nested
 * code (per the mathjs security guidance), and rejects assignments, so host code can
 * safely simplify / differentiate / compile parsed trees.
 */
const full: MathJsInstance = create(all!, { number: 'number', precision: 64 });

export const m = full;

const BLOCKED = new Set([
  'import', 'createUnit', 'evaluate', 'parse', 'simplify', 'derivative', 'compile', 'reviver',
  'resolve', 'rationalize', 'parser', 'config', 'chain', 'typed', 'help', 'map', 'forEach', 'filter',
]);

export const MAX_EXPRESSION_LENGTH = 2000;

export function safeParse(expr: string): MathNode {
  if (expr.length > MAX_EXPRESSION_LENGTH) throw new Error('Expression is too long');
  const node = full.parse(expr);
  node.traverse((n: MathNode) => {
    const t = n.type;
    if (t === 'AssignmentNode' || t === 'FunctionAssignmentNode' || t === 'BlockNode') {
      throw new Error('Assignments are not allowed');
    }
    if (t === 'SymbolNode' && BLOCKED.has((n as unknown as { name: string }).name)) {
      throw new Error(`Function ${(n as unknown as { name: string }).name} is disabled`);
    }
    if (t === 'AccessorNode' || t === 'ObjectNode') throw new Error('Property access is not allowed');
  });
  return node;
}

export function safeEvaluate(expr: string, scope: Record<string, unknown> = {}): unknown {
  return safeParse(expr).compile().evaluate({ ...scope });
}

/** Normalise common typographic variants students type or OCR produces. */
export function normalizeMathInput(input: string): string {
  return input
    .replace(/[−–—]/g, '-')
    .replace(/[×✕✖·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([0-9a-zA-Z.]+)/g, 'sqrt($1)')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
