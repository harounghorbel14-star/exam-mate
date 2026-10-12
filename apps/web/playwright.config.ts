import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: process.env.PW_CHROMIUM ?? undefined } },
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      cwd: '../server',
      port: 4000,
      reuseExistingServer: true,
      env: { PORT: '4000', DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgres://exammate:exammate_dev_password@localhost:5432/exammate', APP_ORIGINS: 'http://localhost:4173', STORAGE_DIR: './.e2e-storage' },
    },
    { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  ],
});
