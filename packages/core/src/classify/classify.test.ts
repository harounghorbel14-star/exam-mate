import { describe, it, expect } from 'vitest';
import { classifySubject, evaluateBuiltin, trainNaiveBayes, predict, featurize } from './index.js';
import { splitQuestions, detectQuestionType } from '../text/questions.js';

describe('subject classifier', () => {
  it('reaches a minimum held-out accuracy (regression gate)', () => {
    const r = evaluateBuiltin();
    // Report for visibility in CI logs.
    console.log(`subject classifier held-out accuracy: ${(r.accuracy * 100).toFixed(1)}% on ${r.n} examples`, r.errors);
    expect(r.accuracy).toBeGreaterThanOrEqual(0.9);
  });
  it('classifies typical questions', () => {
    expect(classifySubject('Solve 3x + 2 = 11').subject).toBe('math');
    expect(classifySubject('Balance C2H6 + O2 -> CO2 + H2O').subject).toBe('chemistry');
    expect(classifySubject('اشرح عملية التنفس الخلوي').subject).toBe('biology');
  });
  it('is deterministic and serializable', () => {
    const m = trainNaiveBayes([['a', 'apple banana'], ['b', 'car truck']], { version: 't', datasetVersion: 'd' });
    const copy = JSON.parse(JSON.stringify(m));
    expect(predict(copy, 'banana').label).toBe('a');
    expect(featurize('x = 2')).toContain('__eq__');
  });
});

describe('question parsing', () => {
  it('splits numbered worksheets and detects MCQ choices', () => {
    const qs = splitQuestions('1. Solve 2x + 3 = 7\n2) What is the capital of France?\nA) Paris\nB) Rome\nC) Madrid\n3. Balance H2 + O2 -> H2O');
    expect(qs).toHaveLength(3);
    expect(qs[0]!.type).toBe('equation');
    expect(qs[1]!.type).toBe('mcq');
    expect(qs[1]!.choices).toEqual(['Paris', 'Rome', 'Madrid']);
    expect(qs[2]!.type).toBe('chemistry-equation');
  });
  it('detects types', () => {
    expect(detectQuestionType('3 * (4 + 5)^2')).toBe('expression');
    expect(detectQuestionType('A car travels 100 m in 5 s. What is its speed?')).toBe('numeric-word');
    expect(detectQuestionType('Explain the causes of World War I')).toBe('open');
  });
});

describe('OCR cleanup', () => {
  it('fixes O/0 confusion only inside chemical equations', async () => {
    const { fixChemistryLine, cleanOcrText } = await import('../text/questions.js');
    expect(fixChemistryLine('Balance H2 + 02 -> H20')).toBe('Balance H2 + O2 -> H2O');
    expect(fixChemistryLine('C3H8 + 502 -> 3C02 + 4H20')).toBe('C3H8 + 5O2 -> 3CO2 + 4H2O');
    expect(fixChemistryLine('C10H22 + O2 -> CO2')).toBe('C10H22 + O2 -> CO2');
    expect(cleanOcrText('x = 10 + 02')).toBe('x = 10 + 02');
  });
});
