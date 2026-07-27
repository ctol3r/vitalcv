import fs from 'node:fs';
import path from 'node:path';

/**
 * Runtime contract: the API's deploy Node must be able to `require()` an
 * ES-module dependency.
 *
 * This exists because the failure it guards is invisible everywhere except a
 * real deploy. The backend is CommonJS, so `import ... from 'jose'` compiles to
 * `require("jose")`. jose v6 is ESM-only. Requiring ESM from CJS works only on
 * Node >= 22.12; on Node 20 it throws ERR_REQUIRE_ESM as the server starts, the
 * healthcheck never passes, and Railway fails the deploy.
 *
 * On 2026-07-27 that combination stranded seven commits — a security dependency
 * patch and a database migration among them — while every PR check stayed
 * green, because CI runs Node 22 and the backend suite runs under ts-jest,
 * neither of which is the production `require()` path.
 *
 * The assertions are deliberately about the DEPLOY CONFIG rather than about
 * `process.version`: the test must fail in CI (any Node) when someone edits
 * nixpacks.toml, not merely on the machine that happens to be too old.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');

/** Minimum Node with `require(esm)` support, per Node's release notes. */
const MIN_MAJOR = 22;
const MIN_MINOR_ON_22 = 12;

function readNixpacks(): string {
  return fs.readFileSync(path.join(REPO_ROOT, 'nixpacks.toml'), 'utf8');
}

/**
 * `nodejs_22` / `nodejs_22_x` / `nodejs-22_x` → 22, read from the actual
 * `nixPkgs` assignment.
 *
 * Comments are stripped first, deliberately: the surrounding explanation in
 * nixpacks.toml names the broken `nodejs_20` pin as history, and a naive
 * whole-file regex matches that prose instead of the live value. This test
 * caught exactly that on its first run.
 */
function pinnedMajor(source: string): number | null {
  const configOnly = source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  const nixPkgs = configOnly.match(/nixPkgs\s*=\s*\[([^\]]*)\]/);
  if (!nixPkgs) return null;
  const m = nixPkgs[1].match(/nodejs[_-]?(\d+)/);
  return m ? Number(m[1]) : null;
}

describe('API deploy runtime contract', () => {
  it('nixpacks.toml exists and pins an explicit Node version', () => {
    const src = readNixpacks();
    expect(src).toMatch(/\[phases\.setup\]/);
    expect(pinnedMajor(src)).not.toBeNull();
  });

  it('pins Node >= 22, so the CJS backend can require ESM-only deps like jose', () => {
    const major = pinnedMajor(readNixpacks());
    expect(major).toBeGreaterThanOrEqual(MIN_MAJOR);
  });

  it('the backend is still CommonJS — the premise of this guard', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'apps/api/backend/package.json'), 'utf8'),
    ) as { type?: string; dependencies?: Record<string, string> };
    // If this ever flips to "module", the require(esm) constraint disappears
    // and this whole guard can be reconsidered.
    expect(pkg.type).toBe('commonjs');
  });

  it('jose is still a backend dependency at a major that is ESM-only', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'apps/api/backend/package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const range = pkg.dependencies?.jose;
    expect(range).toBeDefined();
    const major = Number(String(range).replace(/[^\d.]/g, '').split('.')[0]);
    // jose >= 5 dropped the CJS build. Below that, the constraint would not apply.
    expect(major).toBeGreaterThanOrEqual(5);
  });

  it('documents why the pin matters, so a future edit reads the reason first', () => {
    const src = readNixpacks();
    expect(src).toMatch(/ERR_REQUIRE_ESM/);
    expect(src).toMatch(/22\.12/);
  });

  it('Node 22.12 is the documented floor for require(esm)', () => {
    // Guards the constant itself against a careless edit.
    expect(MIN_MAJOR).toBe(22);
    expect(MIN_MINOR_ON_22).toBe(12);
  });
});
