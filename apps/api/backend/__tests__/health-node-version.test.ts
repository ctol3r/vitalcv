/**
 * `/health` must publish the container's Node version.
 *
 * Not trivia. Whether a CommonJS `require()` can load an ESM-only dependency
 * is decided entirely by this number — `require(esm)` ships from Node 22.12.
 * Two production failures on 2026-07-27 turned on it:
 *
 *   jose v6                 ERR_REQUIRE_ESM during build -> ~6h of failed API
 *                           deploys, 8 commits stranded
 *   @noble/post-quantum     ERR_REQUIRE_ESM at startup -> all signing silently
 *                           downgraded to classical behind one WARN
 *
 * Both times the version had to be *inferred* from an error string, because
 * nothing reported it. `nixpacks.toml` pins `nodejs_22` while its own comment
 * asserts ">= 22.12" — a claim that was unfalsifiable from outside the box and
 * is, on the evidence of those two errors, false.
 *
 * This test deliberately does NOT assert a minimum version. CI runs a different
 * Node than the container, so such an assertion would either pass vacuously or
 * fail for the wrong reason — the same class of mistake that let both bugs
 * ship green. It asserts only that the value is PUBLISHED, so the next person
 * can read it instead of deducing it:
 *
 *   curl -s https://api.vitalcv.com/health | jq -r .node_version
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('/health publishes the runtime Node version', () => {
  const src = readFileSync(join(__dirname, '../src/app.ts'), 'utf8');

  it('the /health payload includes node_version from process.version', () => {
    const health = src.slice(
      src.indexOf("app.get(['/health', '/health/']"),
      src.indexOf("app.get('/readyz'"),
    );
    expect(health.length).toBeGreaterThan(80); // the slice actually found the handler
    expect(health).toMatch(/node_version:\s*process\.version/);
  });

  it('reports a real, parseable version at runtime', () => {
    // process.version is what the handler serves; assert it is a usable
    // semver-ish string rather than an empty default.
    expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
    const major = Number(process.version.slice(1).split('.')[0]);
    expect(Number.isFinite(major)).toBe(true);
    expect(major).toBeGreaterThan(0);
  });
});
