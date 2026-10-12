import { ModelUnavailableError, type LocalModel, type ModelStatus } from './types.js';

/** Used when no local model is installed: the agent falls back to deterministic tools and templates. */
export class NullModel implements LocalModel {
  readonly id = 'none';
  constructor(private reason = 'No local model configured (LLM_MODE=none)') {}
  async status(): Promise<ModelStatus> { return { available: false, runtime: 'none', error: this.reason }; }
  async generate(): Promise<never> { throw new ModelUnavailableError(this.reason); }
}
