import os from 'node:os';

export type DeploymentProfile = 'lightweight' | 'standard' | 'high-performance';

export interface HardwareReport {
  cpus: number;
  totalMemGb: number;
  freeMemGb: number;
  arch: string;
  platform: string;
  gpu: string | false | 'unknown';
  profile: DeploymentProfile;
  recommendation: string;
  limits: { maxModelParamsB: number; contextTokens: number; quantization: string };
}

/**
 * Pick a deployment profile from measured hardware. These are conservative guidelines for
 * quantised GGUF models; the actual speed must be measured with `npm run model:verify`.
 */
export function profileFor(totalMemGb: number, gpu: string | false | 'unknown'): Pick<HardwareReport, 'profile' | 'recommendation' | 'limits'> {
  const hasGpu = gpu && gpu !== 'unknown';
  if (hasGpu && totalMemGb >= 16) {
    return { profile: 'high-performance', recommendation: 'GPU-accelerated 7–8B instruct model at Q4_K_M or higher; long context; optional LoRA fine-tuning.', limits: { maxModelParamsB: 8, contextTokens: 8192, quantization: 'Q4_K_M–Q6_K' } };
  }
  if (totalMemGb >= 8) {
    return { profile: 'standard', recommendation: 'CPU inference of a 1.5–3B instruct model at Q4_K_M; expect a few tokens per second on 4 cores.', limits: { maxModelParamsB: 3, contextTokens: 4096, quantization: 'Q4_K_M' } };
  }
  return { profile: 'lightweight', recommendation: 'Deterministic tools and OCR only, or a ≤1B model at Q4 for short explanations. Do not run larger models on this device.', limits: { maxModelParamsB: 1, contextTokens: 2048, quantization: 'Q4_0' } };
}

export async function detectHardware(): Promise<HardwareReport> {
  const totalMemGb = Math.round((os.totalmem() / 2 ** 30) * 10) / 10;
  let gpu: HardwareReport['gpu'] = 'unknown';
  try {
    const mod = await import('node-llama-cpp');
    const llama = await mod.getLlama({ gpu: 'auto', build: 'never' } as never);
    gpu = llama.gpu;
  } catch {
    gpu = 'unknown';
  }
  return {
    cpus: os.cpus().length, totalMemGb, freeMemGb: Math.round((os.freemem() / 2 ** 30) * 10) / 10, arch: os.arch(), platform: os.platform(), gpu,
    ...profileFor(totalMemGb, gpu),
  };
}
