import { z } from 'zod';
import { routeQuestion, classifySubject, splitQuestions, type MathResult } from '@exammate/core';
import { activeClassifier } from '../training/classifierRegistry.js';
import { searchChunks } from '../../services/retrieval.js';

/**
 * Tools the agent may call. Each declares an input schema and a permission class. Permissions
 * are granted by the caller's context (never by model output), e.g. `user-docs` only when the
 * request comes from an authenticated user and only over that user's documents.
 */
export type Permission = 'compute' | 'user-docs' | 'classify';

export interface ToolContext { userId: string | null; permissions: Set<Permission>; signal: AbortSignal }

export interface Tool<I extends z.ZodTypeAny, O> {
  name: string;
  description: string;
  permission: Permission;
  input: I;
  run(input: z.infer<I>, ctx: ToolContext): Promise<O>;
}

const mathSolve: Tool<z.ZodObject<{ question: z.ZodString }>, { tool: string; result: MathResult } | null> = {
  name: 'math.solve',
  description: 'Deterministic solver: equations, systems, calculus, statistics, units, physics formulas, chemistry balancing, molar mass.',
  permission: 'compute',
  input: z.object({ question: z.string().min(1).max(2000) }),
  async run({ question }) {
    const route = routeQuestion(question);
    if (!route) return null;
    return { tool: route.tool, result: route.run() };
  },
};

const classify: Tool<z.ZodObject<{ text: z.ZodString }>, { subject: string; scores: Array<{ label: string; score: number }> }> = {
  name: 'classify.subject',
  description: 'Naive Bayes subject classifier (trained locally, versioned in the model registry).',
  permission: 'classify',
  input: z.object({ text: z.string().min(1).max(4000) }),
  async run({ text }) {
    return classifySubject(text, await activeClassifier());
  },
};

const docsSearch: Tool<z.ZodObject<{ query: z.ZodString; documentIds: z.ZodOptional<z.ZodArray<z.ZodString>> }>, Awaited<ReturnType<typeof searchChunks>>> = {
  name: 'docs.search',
  description: "Search the requesting user's own uploaded documents (full-text, re-ranked).",
  permission: 'user-docs',
  input: z.object({ query: z.string().min(1).max(1000), documentIds: z.array(z.string().uuid()).max(50).optional() }),
  async run({ query, documentIds }, ctx) {
    if (!ctx.userId) throw new Error('docs.search requires a user');
    return searchChunks(ctx.userId, query, { documentIds });
  },
};

const splitTool: Tool<z.ZodObject<{ text: z.ZodString }>, ReturnType<typeof splitQuestions>> = {
  name: 'text.split_questions',
  description: 'Split OCR text into numbered questions and detect their types.',
  permission: 'compute',
  input: z.object({ text: z.string().max(20000) }),
  async run({ text }) { return splitQuestions(text); },
};

export const TOOLS = { 'math.solve': mathSolve, 'classify.subject': classify, 'docs.search': docsSearch, 'text.split_questions': splitTool } as const;
export type ToolName = keyof typeof TOOLS;

export async function callTool<N extends ToolName>(name: N, raw: unknown, ctx: ToolContext): Promise<Awaited<ReturnType<(typeof TOOLS)[N]['run']>>> {
  const tool = TOOLS[name] as unknown as Tool<z.ZodTypeAny, unknown>;
  if (!ctx.permissions.has(tool.permission)) throw new Error(`Permission denied for tool ${name}`);
  if (ctx.signal.aborted) throw new Error('Cancelled');
  const input = tool.input.parse(raw);
  return (await tool.run(input, ctx)) as never;
}
