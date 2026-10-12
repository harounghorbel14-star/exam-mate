import { config } from '../../config.js';
import { NullModel } from './nullModel.js';
import { LlamaServerModel } from './llamaServer.js';
import { NodeLlamaCppModel } from './nodeLlama.js';
import type { LocalModel } from './types.js';

let current: LocalModel | null = null;

export function createModel(cfg = config): LocalModel {
  switch (cfg.LLM_MODE) {
    case 'llama-server':
      return new LlamaServerModel(cfg.LLM_SERVER_URL, cfg.LLM_TIMEOUT_MS, cfg.LLM_MAX_OUTPUT_TOKENS);
    case 'node-llama-cpp':
      if (!cfg.LLM_MODEL_PATH) return new NullModel('LLM_MODEL_PATH is not set');
      return new NodeLlamaCppModel(cfg.LLM_MODEL_PATH, { sha256: cfg.LLM_MODEL_SHA256, contextTokens: cfg.LLM_CONTEXT_TOKENS, maxTokens: cfg.LLM_MAX_OUTPUT_TOKENS, timeoutMs: cfg.LLM_TIMEOUT_MS, gpu: cfg.LLM_GPU });
    default:
      return new NullModel();
  }
}

export function getModel(): LocalModel {
  current ??= createModel();
  return current;
}

/** Test hook / admin reload. */
export function setModel(m: LocalModel | null) {
  current = m;
}
