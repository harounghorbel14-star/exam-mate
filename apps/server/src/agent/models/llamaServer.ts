import { ModelUnavailableError, type GenerateOptions, type LocalModel, type ModelStatus } from './types.js';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Adapter for a llama.cpp `llama-server` process running on the same machine. The URL must be a
 * loopback address so user data never leaves the host and no hosted API can be configured.
 */
export class LlamaServerModel implements LocalModel {
  readonly id: string;
  private base: URL;
  constructor(url: string, private timeoutMs: number, private maxTokens: number) {
    this.base = new URL(url);
    if (!LOOPBACK.has(this.base.hostname)) throw new Error(`LLM_SERVER_URL must point to a loopback address, got ${this.base.hostname}`);
    if (this.base.protocol !== 'http:' && this.base.protocol !== 'https:') throw new Error('Unsupported protocol');
    this.id = `llama-server@${this.base.host}`;
  }

  async status(): Promise<ModelStatus> {
    try {
      const res = await fetch(new URL('/health', this.base), { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { available: false, runtime: 'llama-server', error: `health ${res.status}` };
      const props = await fetch(new URL('/props', this.base), { signal: AbortSignal.timeout(3000) }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as { default_generation_settings?: { n_ctx?: number; model?: string } };
      return { available: true, runtime: 'llama-server', modelName: props.default_generation_settings?.model, contextTokens: props.default_generation_settings?.n_ctx };
    } catch (e) {
      return { available: false, runtime: 'llama-server', error: (e as Error).message };
    }
  }

  async generate(prompt: string, opts: GenerateOptions = {}) {
    const started = Date.now();
    const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(new URL('/completion', this.base), {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal,
        body: JSON.stringify({ prompt, n_predict: Math.min(opts.maxTokens ?? this.maxTokens, this.maxTokens), temperature: opts.temperature ?? 0.2, stop: opts.stop ?? [], cache_prompt: true }),
      });
    } catch (e) {
      throw new ModelUnavailableError(`Local model server unreachable: ${(e as Error).message}`);
    }
    if (!res.ok) throw new ModelUnavailableError(`Local model server error ${res.status}`);
    const data = (await res.json()) as { content: string; tokens_predicted?: number };
    return { text: data.content, tokens: data.tokens_predicted ?? 0, ms: Date.now() - started };
  }
}
