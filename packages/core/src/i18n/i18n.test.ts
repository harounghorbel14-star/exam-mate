import { describe, it, expect } from 'vitest';
import { LOCALES, translate, dirOf, detectLanguage, formatLocalNumber } from './index.js';
import { en } from './en.js';

describe('i18n', () => {
  it('has every key translated and non-empty in every locale', () => {
    for (const [code, l] of Object.entries(LOCALES)) {
      for (const key of Object.keys(en)) expect(l.messages[key as keyof typeof en], `${code}:${key}`).toBeTruthy();
    }
  });
  it('preserves placeholders across translations', () => {
    for (const l of Object.values(LOCALES)) {
      for (const [key, value] of Object.entries(en)) {
        const ph = (value.match(/\{\w+\}/g) ?? []).sort();
        expect((l.messages[key as keyof typeof en].match(/\{\w+\}/g) ?? []).sort(), key).toEqual(ph);
      }
    }
  });
  it('interpolates and reports direction', () => {
    expect(translate('en', 'home.dueCards', { count: 3 })).toBe('3 flashcards due today');
    expect(translate('ar', 'home.greeting', { name: 'سارة' })).toBe('مرحبًا، سارة');
    expect(dirOf('ar')).toBe('rtl');
    expect(formatLocalNumber('fr', 1234.5)).toMatch(/1\s?234,5/);
  });
  it('detects language', () => {
    expect(detectLanguage('احسب مساحة المثلث')).toBe('ar');
    expect(detectLanguage('Quelle est la vitesse de la voiture ?')).toBe('fr');
    expect(detectLanguage('What is the speed of the car?')).toBe('en');
  });
});
