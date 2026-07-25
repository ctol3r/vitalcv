import { expect, test, type Response } from '@playwright/test';

/**
 * Assert the film harness actually loaded.
 *
 * `/dev/compete-film` is dev-gated, so a local production build legitimately
 * 404s it — which is why these specs originally carried
 * `test.skip(status === 404)`. That guard was a mistake in CI.
 *
 * CI serves `preview:e2e`, a PRODUCTION build, where the route 404s unless
 * `COMPETE_FILM_PREVIEW=1` is set. It was not. So all 19 film specs SKIPPED,
 * the e2e job reported "pass", and the PR merged with none of them having run.
 * A skip is silent in a way a failure is not: nothing in the check list
 * distinguishes "19 passed" from "19 skipped".
 *
 * So the rule is asymmetric, and deliberately so:
 *
 *   - locally, a missing harness is a legitimate skip (someone running the
 *     suite against a production build they built by hand);
 *   - in CI it is a CONFIGURATION ERROR and must fail loudly, because CI is
 *     the only place the result is used as evidence.
 */
export function requireHarness(response: Response | null): void {
  const missing = !response || response.status() === 404;
  if (!missing) return;

  if (process.env.CI) {
    // Not test.skip — this must be visible in the check list.
    expect(
      response?.status() ?? 'no response',
      'film harness 404s in CI: set COMPETE_FILM_PREVIEW=1 on the e2e webServer ' +
        '(apps/web/playwright.config.ts). Skipping here would hide the whole suite.',
    ).toBe(200);
  }

  test.skip(true, 'film harness is not enabled on this server (local production build)');
}
