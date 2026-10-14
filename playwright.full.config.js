import { defineConfig, devices } from '@playwright/test';

const external = process.env.FULL_BASE_URL;
export default defineConfig({
  testDir: './tests/fullstack',
  outputDir: './test-results-fullstack',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-full-report' }]],
  use: { baseURL: external || 'http://127.0.0.1:4175/taskforge-kanban/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external ? undefined : [
    { command: 'npx tsx server/index.ts', url: 'http://127.0.0.1:3001/api/health', reuseExistingServer: false, timeout: 30_000,
      env: { DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://taskforge:taskforge@127.0.0.1:5434/taskforge',
        SESSION_SECRET: 'fullstack-tests-only-session-secret-123456',
        APP_ORIGINS: 'http://127.0.0.1:4175', PORT: '3001', HOST: '127.0.0.1', SERVE_STATIC: 'false' } },
    { command: 'npx cross-env VITE_BACKEND_ENABLED=true vite --host 127.0.0.1 --port 4175 --strictPort',
      url: 'http://127.0.0.1:4175/taskforge-kanban/', reuseExistingServer: false },
  ],
});
