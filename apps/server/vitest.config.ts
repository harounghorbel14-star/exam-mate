import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://exammate:exammate_dev_password@localhost:5432/exammate_test',
      STORAGE_DIR: './.test-storage/files',
      FREE_DAILY_AI_REQUESTS: '25',
      FREE_DAILY_EXAMS: '3',
      FREE_MAX_DOCUMENTS: '3',
      FREE_MAX_UPLOAD_MB: '1',
      RUN_WORKER_INLINE: 'false',
      AGENT_TIMEOUT_MS: '20000',
    },
    globalSetup: './src/test/globalSetup.ts',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
