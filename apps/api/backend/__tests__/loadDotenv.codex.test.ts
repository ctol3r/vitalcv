/**
 * loadDotenv.codex.test.ts — Codex remediation regression tests
 *
 * Covers PR #421 P2 finding: prior `loadDotenv` resolved
 * `path.resolve(__dirname, '..', '..')`. That works in the source layout
 * (`apps/api/backend/src/config/loadDotenv.ts` → `apps/api/backend`) but
 * NOT in the compiled-dist layout (`apps/api/backend/dist/apps/api/backend/
 * src/config/loadDotenv.js` → `apps/api/backend/dist/apps/api/backend`).
 *
 * The fix walks up the directory tree looking for `package.json` whose
 * `name` matches `chai-vc-platform-backend`. This test asserts the
 * resolver returns the real backend package root in both layouts and
 * falls back to `process.cwd()` when run from outside the package tree.
 */

import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { resolveBackendRootForTests } from '../src/config/loadDotenv';

const BACKEND_PACKAGE_DIR = path.resolve(__dirname, '..');
const BACKEND_PACKAGE_NAME = 'chai-vc-platform-backend';

function readPackageJsonName(dir: string): string | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      name?: unknown;
    };
    return typeof parsed.name === 'string' ? parsed.name : null;
  } catch {
    return null;
  }
}

describe('loadDotenv — Codex P2 path discovery', () => {
  it('returns the backend package root when called from a directory inside it (source layout)', () => {
    // Pretend we're the source file at backend/src/config/loadDotenv.ts
    const start = path.join(BACKEND_PACKAGE_DIR, 'src', 'config');
    const { root, source } = resolveBackendRootForTests(start);
    expect(source).toBe('package-walk');
    expect(root).toBe(BACKEND_PACKAGE_DIR);
    expect(readPackageJsonName(root)).toBe(BACKEND_PACKAGE_NAME);
  });

  it('returns the backend package root from the simulated compiled dist layout', () => {
    // Simulate compiled emission at backend/dist/apps/api/backend/src/config
    // (the layout produced by backend/tsconfig.json rootDir=../../.. + outDir=dist).
    const start = path.join(
      BACKEND_PACKAGE_DIR,
      'dist',
      'apps',
      'api',
      'backend',
      'src',
      'config',
    );
    const { root, source } = resolveBackendRootForTests(start);
    expect(source).toBe('package-walk');
    expect(root).toBe(BACKEND_PACKAGE_DIR);
    expect(readPackageJsonName(root)).toBe(BACKEND_PACKAGE_NAME);
  });

  it('falls back to process.cwd() when called from outside the package tree', () => {
    // Use the OS temp directory — guaranteed not to contain backend package.json.
    const outside = os.tmpdir();
    const { root, source } = resolveBackendRootForTests(outside);
    expect(source).toBe('cwd-fallback');
    expect(root).toBe(process.cwd());
  });

  it('walks past unrelated package.json files until it finds the backend marker', () => {
    // Repo root has its own package.json (workspace root, name "vitalcv").
    // The resolver must not stop there — it must keep walking until it
    // finds the backend marker. We start from a deep nested path inside
    // backend so the walk crosses several unrelated package.json files
    // (web, marketing, etc. live elsewhere in the tree but they're not
    // ancestors of backend/src/config so they don't affect this walk).
    const start = path.join(BACKEND_PACKAGE_DIR, 'src', 'services', 'audit');
    const { root, source } = resolveBackendRootForTests(start);
    expect(source).toBe('package-walk');
    expect(root).toBe(BACKEND_PACKAGE_DIR);
  });
});
