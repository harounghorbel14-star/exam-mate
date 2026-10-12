import { z } from 'zod';

const bool = z.union([z.boolean(), z.string()]).transform((v) => v === true || v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().default('postgres://exammate:exammate_dev_password@localhost:5432/exammate'),
  APP_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173'),
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  COOKIE_SECURE: bool.default(false),
  TRUST_PROXY: bool.default(false),
  STORAGE_DIR: z.string().default('./storage'),
  RUN_WORKER_INLINE: bool.default(true),
  // Quotas (configurable per plan).
  FREE_DAILY_AI_REQUESTS: z.coerce.number().default(30),
  PREMIUM_DAILY_AI_REQUESTS: z.coerce.number().default(500),
  FREE_MAX_DOCUMENTS: z.coerce.number().default(5),
  PREMIUM_MAX_DOCUMENTS: z.coerce.number().default(200),
  FREE_MAX_UPLOAD_MB: z.coerce.number().default(10),
  PREMIUM_MAX_UPLOAD_MB: z.coerce.number().default(50),
  FREE_DAILY_EXAMS: z.coerce.number().default(3),
  PREMIUM_DAILY_EXAMS: z.coerce.number().default(50),
  PREMIUM_PRICE_LABEL: z.string().default('€4.99 / month'),
  BILLING_PROVIDER: z.enum(['test', 'none']).default('test'),
  // Local inference (never a hosted API).
  LLM_MODE: z.enum(['none', 'node-llama-cpp', 'llama-server']).default('none'),
  LLM_MODEL_PATH: z.string().default(''),
  LLM_MODEL_SHA256: z.string().default(''),
  LLM_SERVER_URL: z.string().default('http://127.0.0.1:8080'),
  LLM_CONTEXT_TOKENS: z.coerce.number().default(4096),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().default(512),
  LLM_TIMEOUT_MS: z.coerce.number().default(60000),
  LLM_GPU: z.enum(['auto', 'off']).default('auto'),
  OCR_ENABLED: bool.default(true),
  AGENT_MAX_STEPS: z.coerce.number().default(8),
  AGENT_TIMEOUT_MS: z.coerce.number().default(30000),
  TRACE_RETENTION_DAYS: z.coerce.number().default(30),
  // Online multiplayer (WebSocket on the same server, path /ws).
  MP_ENABLED: bool.default(true),
  MP_TURN_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
  MP_RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(5).max(3600).default(60),
  MP_ROOM_IDLE_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const cfg = parsed.data;
  if (cfg.NODE_ENV === 'production') {
    if (!cfg.COOKIE_SECURE) throw new Error('COOKIE_SECURE must be true in production');
    if (cfg.DATABASE_URL.includes('exammate_dev_password')) throw new Error('Set a real DATABASE_URL in production');
  }
  return cfg;
}

export const config: Config = loadConfig();
