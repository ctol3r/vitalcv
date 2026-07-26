import { expect, type Response } from '@playwright/test';

/**
 * Assert the film route actually loaded.
 *
 * This used to guard `/dev/compete-film`, a dev-gated harness, and it carried
 * an asymmetric skip: a 404 was a legitimate local skip but a CI configuration
 * error. That asymmetry existed because a skip is silent in a way a failure is
 * not — all 19 film specs once SKIPPED in CI, the job reported "pass", and the
 * PR merged with none of them having run.
 *
 * COMPETE-1 removed the need for any of it. `/` IS the film now, so these specs
 * point at the public homepage: there is no gate, no environment variable, and
 * no condition under which a skip is correct. A homepage that does not return
 * 200 is a failure everywhere, local and CI alike.
 *
 * The dev harness at `/dev/compete-film` still exists for isolated inspection;
 * it is simply no longer what the gate measures. A gate that guards a route
 * production 404s proves nothing about production.
 */
export function requireHarness(response: Response | null): void {
  expect(
    response?.status() ?? 'no response',
    'the homepage did not return 200 — the film is the public composition at `/`, ' +
      'so this is a production failure, never a reason to skip.',
  ).toBe(200);
}
