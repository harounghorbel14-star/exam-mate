import { z } from 'zod';

/** Structured output the local model must produce for open questions. */
export const OpenAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  steps: z.array(z.string().max(600)).max(12).default([]),
  uncertainty: z.enum(['low', 'medium', 'high']),
  assumptions: z.array(z.string().max(300)).max(6).default([]),
});
export type OpenAnswer = z.infer<typeof OpenAnswerSchema>;

/** Extract the first JSON object from model text and validate it. */
export function parseModelJson<T extends z.ZodTypeAny>(text: string, schema: T): z.infer<T> | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) {
      try {
        const parsed = schema.safeParse(JSON.parse(text.slice(start, i + 1)));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Every number in the verified answer must appear in a model rephrasing, or it is rejected. */
export function preservesNumbers(verifiedAnswer: string, rephrased: string): boolean {
  const nums = verifiedAnswer.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  const norm = rephrased.replace(/,/g, '.');
  return nums.every((n) => norm.includes(n.replace(',', '.')));
}
