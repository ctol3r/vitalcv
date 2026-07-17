import { defineConfig, devices } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';

const isCI = !!process.env.CI;
const e2ePort = process.env.PORT ?? '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

// The CI web server runs the production build, where receipt signing is
// deliberately fail-closed. Give that isolated test process an ephemeral
// ES256 key so Trust and Status exercise their real render paths without
// committing or depending on a persistent private key.
const { privateKey: e2eReceiptPrivateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});
const e2eReceiptPrivateJwk = JSON.stringify(
  e2eReceiptPrivateKey.export({ format: 'jwk' }),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'list',
  timeout: 30_000,

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

  webServer: {
    command: isCI ? 'pnpm run preview:e2e' : 'pnpm run dev:e2e',
    env: {
      ...process.env,
      CLERK_SECRET_KEY: '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      RECEIPT_KID: process.env.RECEIPT_KID ?? 'vitalcv-e2e-ephemeral',
      RECEIPT_PRIVATE_KEY_JWK:
        process.env.RECEIPT_PRIVATE_KEY_JWK ?? e2eReceiptPrivateJwk,
    },
    url: baseURL,
    reuseExistingServer: !isCI,
    // In CI this command is `preview:e2e`, which does a cold `next build`
    // before serving — comfortably slower than a warm local build, so give it
    // room rather than letting the gate flake on a slow runner.
    timeout: isCI ? 420_000 : 180_000,
  },
});
