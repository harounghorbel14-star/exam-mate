export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
  signal?: AbortSignal;
}

export interface ModelStatus {
  available: boolean;
  runtime: 'none' | 'node-llama-cpp' | 'llama-server';
  modelPath?: string;
  modelName?: string;
  sizeBytes?: number;
  verified?: boolean;
  contextTokens?: number;
  gpu?: string | false;
  error?: string;
  loadMs?: number;
}

/** A locally executed language model. Implementations must never call a hosted inference API. */
export interface LocalModel {
  readonly id: string;
  status(): Promise<ModelStatus>;
  generate(prompt: string, opts?: GenerateOptions): Promise<{ text: string; tokens: number; ms: number }>;
  dispose?(): Promise<void>;
}

export class ModelUnavailableError extends Error {}
