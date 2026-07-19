import { defineConfig, devices } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';

const isCI = !!process.env.CI;
const e2ePort = process.env.PORT ?? '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

/**
 * Authed mode (J8 — real Clerk test-auth): when the Clerk DEVELOPMENT-instance
 * keys are provided, the web server boots WITH Clerk and the suite switches to
 * the `tests/e2e-authed` projects, which sign a real test user in through the
 * real sign-in UI and cross the real /holder middleware gate. Without the keys
 * (the default, and the existing CI gate) behavior is byte-identical to
 * before: Clerk stays cleared and the signed-out suite runs.
 *
 * The two suites need DIFFERENT server builds (the publishable key is baked at
 * build time), so they never run in one invocation — CI runs them as separate
 * jobs.
 */
const authedMode = !!(
  process.env.E2E_CLERK_PUBLISHABLE_KEY && process.env.E2E_CLERK_SECRET_KEY
);

export const AUTH_STATE_PATH = 'tests/e2e-authed/.auth/clinician.json';

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
  testDir: authedMode ? './tests/e2e-authed' : './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'list',
  // Real sign-in + role resolution adds network round-trips the fixture
  // suite never pays; give authed specs more room.
  timeout: authedMode ? 60_000 : 30_000,

  use: {
    baseURL,
    trace: 'on-first-retry',
  },

  projects: authedMode
    ? [
        {
          // Signs the shared test clinician in through the real UI once and
          // saves the browser state every authed spec reuses.
          name: 'authed-setup',
          testMatch: /.*\.setup\.ts/,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'authed',
          testMatch: /.*\.spec\.ts/,
          dependencies: ['authed-setup'],
          use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE_PATH },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],

  webServer: {
    command: isCI ? 'pnpm run preview:e2e' : 'pnpm run dev:e2e',
    env: {
      ...process.env,
      // Authed mode boots the REAL Clerk (development instance) so the suite
      // exercises the real gate; default mode clears it so the signed-out
      // suite stays deterministic and backend-free.
      CLERK_SECRET_KEY: authedMode ? process.env.E2E_CLERK_SECRET_KEY! : '',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: authedMode
        ? process.env.E2E_CLERK_PUBLISHABLE_KEY!
        : '',
      RECEIPT_KID: process.env.RECEIPT_KID ?? 'vitalcv-e2e-ephemeral',
      RECEIPT_PRIVATE_KEY_JWK:
        process.env.RECEIPT_PRIVATE_KEY_JWK ?? e2eReceiptPrivateJwk,
      // The MATCHA Deck e2e spec drives the fixture harness at
      // /dev/matcha-deck; the CI web server builds in production mode where
      // the harness is disabled unless explicitly enabled. The authed suite
      // never uses the harness (it crosses the real gate), but the flag is
      // harmless there.
      MATCHA_DECK_PREVIEW: '1',
      // Same for the PageStack harness at /dev/page-stack.
      PAGE_STACK_PREVIEW: '1',
      // Same for the SHD-3.1 story-rail harness at /dev/story-rail. Without
      // this, the CI production build 404s the harness (dev builds keep it
      // open, which is why story-rail.spec.ts passed locally but failed in CI).
      STORY_RAIL_PREVIEW: '1',
    },
    url: baseURL,
    reuseExistingServer: !isCI,
    // In CI this command is `preview:e2e`, which does a cold `next build`
    // before serving — comfortably slower than a warm local build, so give it
    // room rather than letting the gate flake on a slow runner.
    timeout: isCI ? 420_000 : 180_000,
  },
});
