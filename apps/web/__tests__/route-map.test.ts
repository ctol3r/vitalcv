import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Filesystem-derived route map gate (RELEASE-ROUTE-MAP-1).
 *
 * Asserts that `docs/ops/route-map.md` matches the output of
 * `scripts/generate-route-map.mjs` on the current `apps/web/app/`
 * tree. If a contributor adds a route without regenerating the
 * map, this test fails with the exact remediation command.
 *
 * Truth contract:
 *   - This is a static check: it does not exercise the route at
 *     runtime, does not assert auth, and does not assert response
 *     shape. It only enforces that the generated artifact stays in
 *     sync with the filesystem.
 */
describe('route map (RELEASE-ROUTE-MAP-1)', () => {
  it('docs/ops/route-map.md matches the filesystem-derived inventory', () => {
    const repoRoot = resolve(__dirname, '..', '..', '..');
    const cmd = `node ${resolve(repoRoot, 'scripts/generate-route-map.mjs')} --check`;
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(cmd, {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      exitCode = e.status ?? 1;
      output = (e.stderr ?? '') + (e.stdout ?? '');
    }

    if (exitCode !== 0) {
      throw new Error(
        `route-map drift detected.\n${output}\nFix: run \`node scripts/generate-route-map.mjs\` and commit the result.`,
      );
    }

    expect(output).toMatch(/route-map: \d+ routes — up to date\./);
  });
});
