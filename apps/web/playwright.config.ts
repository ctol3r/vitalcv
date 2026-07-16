import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'list',
  timeout: 30_000,

  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: isCI ? 'pnpm run preview:e2e' : 'pnpm run dev:e2e',
    env: {
      ...process.env,
      CLERK_SECRET_KEY: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !isCI,
    // In CI this command is `preview:e2e`, which does a cold `next build`
    // before serving — comfortably slower than a warm local build, so give it
    // room rather than letting the gate flake on a slow runner.
    timeout: isCI ? 420_000 : 180_000,
  },
});
