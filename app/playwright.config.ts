import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.PLAYWRIGHT_UI_ONLY
      ? 'npm run build:client && vite preview --config client/vite.config.ts --host 127.0.0.1 --port 8000'
      : 'npm run dev',
    url: `http://localhost:${process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
