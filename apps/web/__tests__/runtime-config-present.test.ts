import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The production image must contain `next.config.mjs`.
 *
 * This is the guard for a failure mode that produced a *green* PR, a correct
 * SHA in `/api/version`, and a setting that did nothing.
 *
 * `headers()`, `redirects()` and `rewrites()` are resolved during `next build`
 * and baked into `.next/routes-manifest.json`, so they keep working with no
 * config file present — which hid its absence completely, since the security
 * headers and the `/api/*` no-store rules all ship from that manifest.
 *
 * Server OPTIONS are not baked. `next start` reads them from the config at
 * boot; with no file it uses DEFAULTS. `poweredByHeader` defaults to `true`,
 * so #1048 set it to `false`, merged, deployed — and production went on
 * sending `x-powered-by: Next.js` on every page and every 404.
 *
 * Asserting the Dockerfile is what this guard has to do. A test asserting the
 * config VALUE (the one #1048 shipped) passes whether or not the file ever
 * reaches the running server — it reads the repo, not the image. The bug lives
 * in the gap between those two, so the guard has to close that gap.
 */
const dockerfile = readFileSync(join(__dirname, '..', 'Dockerfile'), 'utf8');

/** COPY lines in the final (runtime) stage only. */
function runtimeStageLines(): string[] {
  const lines = dockerfile.split('\n');
  const stageStarts = lines
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /^FROM\s/i.test(line));
  const lastStage = stageStarts[stageStarts.length - 1];
  expect(lastStage, 'Dockerfile has no FROM stage').toBeDefined();
  return lines.slice(lastStage.i);
}

describe('the runtime image carries the runtime config', () => {
  it('copies next.config.mjs into the final stage', () => {
    const copied = runtimeStageLines().some(
      (line) => /^COPY\s/i.test(line) && line.includes('next.config.mjs'),
    );
    expect(
      copied,
      'apps/web/next.config.mjs is not COPYed into the runtime stage — `next start` ' +
        'will boot on default server options (poweredByHeader, and anything else ' +
        'read at runtime rather than baked into .next).',
    ).toBe(true);
  });

  it('still copies the build output it needs alongside it', () => {
    // Sanity: if this stage stopped copying .next, the assertion above would be
    // meaningless — a guard has to fail for the right reason.
    const lines = runtimeStageLines();
    expect(lines.some((l) => /^COPY\s/i.test(l) && l.includes('.next'))).toBe(true);
    expect(lines.some((l) => /^COPY\s/i.test(l) && l.includes('package.json'))).toBe(true);
  });
});
