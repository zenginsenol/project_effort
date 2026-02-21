import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3200);
const E2E_HOST = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${E2E_HOST}:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
      command: `pnpm build && pnpm exec next start -p ${E2E_PORT} -H ${E2E_HOST}`,
      port: E2E_PORT,
      reuseExistingServer: false,
      timeout: 180_000,
    },
});
