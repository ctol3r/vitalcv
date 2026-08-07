import fs from 'node:fs';
import path from 'node:path';

/**
 * Deploy runtime contract for the API.
 *
 * The failure this guards is invisible to every PR check and only appears in a
 * real Railway build:
 *
 *   require() of ES Module .../jose/dist/webapi/index.js
 *   from apps/api/backend/src/middleware/verifiedIdentity.ts not supported.
 *
 * The backend is CommonJS, so `import ... from 'jose'` compiles to
 * `require("jose")`. jose v6 dropped its CJS build (`"type": "module"`, no
 * `require` condition in `exports`), and requiring ESM from CJS works only on
 * Node >= 22.12. Railway's pinned nixpkgs resolves `nodejs_22` to 22.11.0 —
 * one patch below the threshold — so the backend build step
 * (`tsc && ts-node src/qa/runQaSuite.ts`, which EXECUTES the code) died, and
 * every deploy from #894 onward failed regardless of content. Seven commits
 * were stranded, including a security patch (#898) and a migration (#900).
 *
 * The load-bearing invariant is therefore about MODULE FORMAT, not Node
 * version: while the backend is CommonJS, its runtime dependencies must offer a
 * CJS entry point. Pinning Node alone is not enough and was not what fixed it.
 *
 * Assertions read the repo's own files rather than `process.version`, so they
 * fail in CI on any Node when someone reintroduces the hazard.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const BACKEND_PKG = path.join(REPO_ROOT, 'apps/api/backend/package.json');

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

/** Resolve a dependency's installed package.json through the backend. */
function resolveDepManifest(name: string): Record<string, unknown> | null {
  try {
    return readJson<Record<string, unknown>>(
      require.resolve(`${name}/package.json`, { paths: [path.dirname(BACKEND_PKG)] }),
    );
  } catch {
    return null;
  }
}

/** True when CommonJS can `require()` this package without Node >= 22.12. */
function isCjsRequirable(manifest: Record<string, unknown>): boolean {
  if (manifest.type !== 'module') return true; // CJS or dual, plain require works
  const exp = manifest.exports as Record<string, unknown> | undefined;
  const root = exp?.['.'] as Record<string, unknown> | undefined;
  return Boolean(root?.require);
}

describe('API deploy runtime contract', () => {
  const backendPkg = readJson<{ type?: string; dependencies?: Record<string, string> }>(BACKEND_PKG);

  it('the backend is CommonJS — the premise of this guard', () => {
    // If this ever becomes "module", the require(esm) hazard disappears and
    // this file should be revisited rather than silently kept.
    expect(backendPkg.type).toBe('commonjs');
  });

  it('jose resolves to a build CommonJS can require', () => {
    const manifest = resolveDepManifest('jose');
    expect(manifest).not.toBeNull();
    expect(isCjsRequirable(manifest as Record<string, unknown>)).toBe(true);
  });

  it('every backend runtime dependency is requirable from CommonJS', () => {
    const offenders = Object.keys(backendPkg.dependencies ?? {})
      .map((name) => ({ name, manifest: resolveDepManifest(name) }))
      .filter(({ manifest }) => manifest !== null)
      .filter(({ manifest }) => !isCjsRequirable(manifest as Record<string, unknown>))
      .map(({ name }) => name);

    // jest's expect() takes no message argument, so surface the explanation by
    // throwing — otherwise a failure prints a bare array with no clue why.
    if (offenders.length > 0) {
      throw new Error(
        `ESM-only dependencies cannot be require()d by this CommonJS backend on ` +
          `Node < 22.12, which is what Railway runs (nixpkgs nodejs_22 -> 22.11.0). ` +
          `They break the BUILD, not just startup: ${offenders.join(', ')}`,
      );
    }
    expect(offenders).toEqual([]);
  });

  it('nixpacks still pins an explicit Node major (EOL hygiene, not the fix)', () => {
    // Node 20 reached end-of-life in April 2026. This is worth holding, but it
    // is NOT what unblocked the deploy — module format was. Comments are
    // stripped because the surrounding explanation names the old `nodejs_20`
    // pin as history, and a naive whole-file regex matches that prose instead
    // of the live value. An earlier version of this test did exactly that.
    const src = fs.readFileSync(path.join(REPO_ROOT, 'nixpacks.toml'), 'utf8');
    const configOnly = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    const nixPkgs = configOnly.match(/nixPkgs\s*=\s*\[([^\]]*)\]/);
    expect(nixPkgs).not.toBeNull();
    const major = Number((nixPkgs as RegExpMatchArray)[1].match(/nodejs[_-]?(\d+)/)?.[1]);
    expect(major).toBeGreaterThanOrEqual(22);
  });
});
