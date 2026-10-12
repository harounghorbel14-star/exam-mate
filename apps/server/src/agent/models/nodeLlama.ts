import { ModelUnavailableError, type GenerateOptions, type LocalModel, type ModelStatus } from './types.js';
import { verifyModelFile } from './integrity.js';

/**
 * In-process inference with node-llama-cpp (llama.cpp bindings, prebuilt binaries from npm).
 * The model is loaded lazily on first use and verified (GGUF magic + optional SHA-256) first.
 */
export class NodeLlamaCppModel implements LocalModel {
  readonly id: string;
  private loading: Promise<{ completion: { generateCompletion(p: string, o: Record<string, unknown>): Promise<string> }; context: { dispose(): Promise<void> }; model: { dispose(): Promise<void> }; gpu: string | false; loadMs: number; sizeBytes: number; verified: boolean }> | null = null;
  private lastError: string | null = null;
  private busy: Promise<unknown> = Promise.resolve();

  constructor(private modelPath: string, private opts: { sha256: string; contextTokens: number; maxTokens: number; timeoutMs: number; gpu: 'auto' | 'off' }) {
    this.id = `node-llama-cpp:${modelPath.split('/').pop()}`;
  }

  private load() {
    this.loading ??= (async () => {
      const started = Date.now();
      const check = await verifyModelFile(this.modelPath, this.opts.sha256);
      if (!check.ok) throw new ModelUnavailableError(check.reason ?? 'Model verification failed');
      let mod: typeof import('node-llama-cpp');
      try {
        mod = await import('node-llama-cpp');
      } catch {
        throw new ModelUnavailableError('node-llama-cpp is not installed (optional dependency)');
      }
      const llama = await mod.getLlama({ gpu: this.opts.gpu === 'off' ? false : 'auto', build: 'never' } as never);
      const model = await llama.loadModel({ modelPath: this.modelPath });
      const context = await model.createContext({ contextSize: Math.min(this.opts.contextTokens, model.trainContextSize ?? this.opts.contextTokens) });
      const completion = new mod.LlamaCompletion({ contextSequence: context.getSequence() });
      return { completion: completion as never, context: context as never, model: model as never, gpu: llama.gpu, loadMs: Date.now() - started, sizeBytes: check.sizeBytes, verified: !!this.opts.sha256 };
    })();
    this.loading.catch((e) => { this.lastError = (e as Error).message; this.loading = null; });
    return this.loading;
  }

  async status(): Promise<ModelStatus> {
    try {
      const l = await this.load();
      return { available: true, runtime: 'node-llama-cpp', modelPath: this.modelPath, sizeBytes: l.sizeBytes, verified: l.verified, contextTokens: this.opts.contextTokens, gpu: l.gpu, loadMs: l.loadMs };
    } catch (e) {
      return { available: false, runtime: 'node-llama-cpp', modelPath: this.modelPath, error: (e as Error).message ?? this.lastError };
    }
  }

  async generate(prompt: string, opts: GenerateOptions = {}) {
    const l = await this.load();
    // One generation at a time per context sequence.
    const run = async () => {
      const started = Date.now();
      const signal = opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(this.opts.timeoutMs)]) : AbortSignal.timeout(this.opts.timeoutMs);
      let tokens = 0;
      const text = await l.completion.generateCompletion(prompt, {
        maxTokens: Math.min(opts.maxTokens ?? this.opts.maxTokens, this.opts.maxTokens), temperature: opts.temperature ?? 0.2,
        signal, stopOnAbortSignal: true, customStopTriggers: opts.stop ?? [],
        onToken: (t: unknown[]) => { tokens += t.length; },
      });
      return { text, tokens, ms: Date.now() - started };
    };
    const p = this.busy.then(run, run);
    this.busy = p.catch(() => undefined);
    return p;
  }

  async dispose() {
    if (!this.loading) return;
    const l = await this.loading.catch(() => null);
    await l?.context.dispose();
    await l?.model.dispose();
    this.loading = null;
  }
}
