export type QuestionType = 'equation' | 'system' | 'expression' | 'mcq' | 'truefalse' | 'numeric-word' | 'chemistry-equation' | 'definition' | 'open';

export interface ParsedQuestion {
  index: number;
  text: string;
  type: QuestionType;
  choices?: string[];
}

/** Fix frequent OCR confusions in mathematical text without touching ordinary words. */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/(\d)\s*[xX×]\s*(\d)/g, '$1 × $2')
    .replace(/(?<=\d)[oO](?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const QUESTION_START = /^\s*(?:(?:Q(?:uestion)?|Exercice|Exercise|Ex\.?|سؤال|السؤال|تمرين)\s*\d+\s*[.):-]?|\d{1,2}\s*[.)-](?!\d)|[٠-٩]{1,2}\s*[.)-])\s*/i;
const CHOICE = /^\s*(?:\(?([A-Ea-e])[).:]|\(?([أبجدهـ])[).:-])\s*(.+)$/;

/** Split text that may contain several numbered questions (as produced by OCR of a worksheet). */
export function splitQuestions(raw: string): ParsedQuestion[] {
  const text = cleanOcrText(raw);
  const lines = text.split('\n');
  const blocks: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (QUESTION_START.test(line) || blocks.length === 0) blocks.push([line.replace(QUESTION_START, '')]);
    else blocks[blocks.length - 1]!.push(line);
  }
  return blocks.map((b, i) => {
    const choices: string[] = [];
    const stem: string[] = [];
    for (const l of b) {
      const c = CHOICE.exec(l);
      if (c && (stem.length > 0)) choices.push(c[3]!.trim());
      else stem.push(l);
    }
    const qText = stem.join(' ').trim();
    const type = detectQuestionType(qText, choices);
    return { index: i + 1, text: qText, type, ...(choices.length >= 2 ? { choices } : {}) };
  }).filter((q) => q.text.length > 0);
}

export function detectQuestionType(text: string, choices: string[] = []): QuestionType {
  const t = text.trim();
  if (choices.length >= 2) return 'mcq';
  if (/(->|→|⟶|⇌)/.test(t) && /[A-Z][a-z]?\d*/.test(t)) return 'chemistry-equation';
  if (/^(true or false|vrai ou faux|صح أم خطأ|صحيح أم خطأ)/i.test(t)) return 'truefalse';
  const eqCount = (t.match(/(?<![<>!=])=(?!=)/g) ?? []).length;
  const mathy = t.replace(/[\d\s+\-*/^().=a-zA-Z²³√π,]/g, '').length <= t.length * 0.1;
  if (/[;\n]/.test(t) && eqCount >= 2 && mathy) return 'system';
  if (eqCount === 1 && mathy && /[a-z]/i.test(t) && t.split(/\s+/).length < 15) return 'equation';
  if (eqCount === 0 && /^[\d\s+\-*/^().,²³√π!%a-z]+$/i.test(t) && /\d/.test(t) && !/[a-z]{4,}/i.test(t.replace(/sqrt|sin|cos|tan|log|ln|exp|abs|pi/g, ''))) return 'expression';
  if (/\d/.test(t) && /(how|what|find|calculate|determine|combien|calculer|quelle|احسب|أوجد|كم|ما)/i.test(t)) return 'numeric-word';
  if (/^(define|what is (a|an|the)|définir|qu'est-ce qu|عرّف|ما هو|ما هي)/i.test(t)) return 'definition';
  return 'open';
}
