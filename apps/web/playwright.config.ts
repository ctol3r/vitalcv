import { defineConfig, devices } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';

const isCI = !!process.env.CI;
const e2ePort = process.env.PORT ?? '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

/**
 * Specs that describe the EVIDENCE FILM homepage.
 *
 * `/` serves the career loop as of Wave 1075; the film remains the tested
 * rollback. These run in their own project with the variant header so they
 * keep asserting the composition they were written for.
 */
/**
 * A film run boots the web server with PUBLIC_HOME_VARIANT=film and runs ONLY
 * the film specs. Splitting by server rather than by request keeps `/` a plain
 * synchronous server component reading one env var — a request-scoped override
 * would have made the page async and broken every renderToStaticMarkup guard,
 * and would have meant a request could decide which homepage a crawler sees.
 */
const filmRun = process.env.E2E_HOME_VARIANT === 'film';

/**
 * UX-V1: `/` serves the Easy Button experience; the career loop joins the
 * film as an env-switched rollback. A career-loop run boots the server with
 * PUBLIC_HOME_VARIANT=career-loop and runs ONLY the loop specs, exactly the
 * film mechanism.
 */
const careerLoopRun = process.env.E2E_HOME_VARIANT === 'career-loop';

const CAREER_LOOP_SPECS = [/tests\/e2e\/home-career-loop\.spec\.ts/];

const FILM_SPECS = [
  /tests\/e2e\/ask-home\.spec\.ts/,
  /tests\/e2e\/ask-npi-response\.spec\.ts/,
  /tests\/e2e\/doctrine-visual\.spec\.ts/,
  /tests\/e2e\/glass-chrome\.spec\.ts/,
  /tests\/e2e\/home-a11y-floor\.spec\.ts/,
  /tests\/e2e\/home-atmosphere\.spec\.ts/,
  /tests\/e2e\/home-layout-stability\.spec\.ts/,
  /tests\/e2e\/home-phase\.spec\.ts/,
  /tests\/e2e\/homepage-degradation\.spec\.ts/,
  /tests\/e2e\/homepage-proof-moment\.spec\.ts/,
  /tests\/e2e\/npi-truth-engine\.spec\.ts/,
];

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
          // In a variant run this project is the one that gets skipped.
          testIgnore:
            filmRun || careerLoopRun ? undefined : [...FILM_SPECS, ...CAREER_LOOP_SPECS],
          testMatch: filmRun || careerLoopRun ? /$^/ : undefined,
        },
        {
          name: 'chromium-film',
          testMatch: filmRun ? FILM_SPECS : /$^/,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'chromium-career-loop',
          testMatch: careerLoopRun ? CAREER_LOOP_SPECS : /$^/,
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
      // Same for the COMPETE-1 film harness at /dev/compete-film. Without this
      // the CI production build 404s it and all 19 film specs SKIP — which is
      // worse than the story-rail case above, because a skip is silent: the
      // e2e job reported "pass" on a PR where none of them ran. The specs now
      // fail loudly on a 404 in CI (see requireHarness) so this can't recur.
      COMPETE_FILM_PREVIEW: '1',
      // Same for the whole `/design/*` subtree, which z1-preview-story.spec.ts
      // drives at /design/z1-home. The gate there is a LAYOUT calling
      // notFound(), so without this the CI production build serves a 404 and
      // every Z1 spec fails on `element(s) not found` rather than on anything
      // about the composition. Canonical production still refuses the subtree
      // regardless of this flag (isDesignPreviewAllowed checks
      // RAILWAY_ENVIRONMENT/VERCEL_ENV first), so enabling it for the e2e
      // server cannot reach vitalcv.com.
      DESIGN_PREVIEW: '1',
      // The `/dev/*` twin of DESIGN_PREVIEW. Under CI the webServer serves a
      // PRODUCTION build (`preview:e2e`), which is exactly what the new
      // app/dev/layout.tsx gate denies — so without this every `/dev/*`
      // harness spec 404s. 34 of them did. This is the documented opt-in for
      // a production-mode local build, not a loosening of the gate:
      // canonical production never sets it, and that is what the gate exists
      // to stop.
      DEV_PREVIEW: '1',
      // UX-V1: `/` serves the Easy Button experience. A variant run flips the
      // whole server to the requested rollback so its preserved specs assert
      // the composition they were written for.
      PUBLIC_HOME_VARIANT: filmRun ? 'film' : careerLoopRun ? 'career-loop' : 'easy',
      // scene-degradation.spec.ts forces capability tiers via `?sceneTier=`;
      // readForcedTier() ignores the override in production builds unless this
      // is set at BUILD time (NEXT_PUBLIC_* is inlined by `next build`, which
      // webServer runs with this env). E2E server only — never production.
      NEXT_PUBLIC_SCENE_DEBUG: '1',
    },
    url: baseURL,
    reuseExistingServer: !isCI,
    // In CI this command is `preview:e2e`, which does a cold `next build`
    // before serving — comfortably slower than a warm local build, so give it
    // room rather than letting the gate flake on a slow runner.
    timeout: isCI ? 420_000 : 180_000,
  },
});
