import { defineConfig, devices } from '@playwright/test';

const defaultBaseURL = 'http://127.0.0.1:8787';
const configuredBaseURL = process.env.BASE_URL?.trim();
const baseURL = configuredBaseURL || defaultBaseURL;
const shouldStartLocalServer = !configuredBaseURL;

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
const persistTo = process.env.E2E_WRANGLER_PERSIST_TO?.trim();
const persistArg = persistTo ? ` --persist-to ${shellQuote(persistTo)}` : '';

const e2eWorkerVars = [
  '--var BYPASS_AUTH:1',
  '--var NODE_ENV:development',
  '--var BETTER_AUTH_URL:http://127.0.0.1:8787',
  '--var BETTER_AUTH_SECRET:e2e-test-secret-000000000000000000000000',
  '--var GOOGLE_CLIENT_ID:e2e-client',
  '--var GOOGLE_CLIENT_SECRET:e2e-secret',
  '--var ALLOWED_EMAILS:e2e@test.local',
].join(' ');

const e2eServerCommand = [
  'npm run build --workspace=apps/web',
  [
    'npm run dev --workspace=apps/worker --',
    '--local',
    '--ip 127.0.0.1',
    '--port 8787',
    '--test-scheduled',
    '--log-level error',
    persistArg.trim(),
    e2eWorkerVars,
  ]
    .filter(Boolean)
    .join(' '),
].join(' && ');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartLocalServer
    ? {
        command: e2eServerCommand,
        url: `${defaultBaseURL}/healthz`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
