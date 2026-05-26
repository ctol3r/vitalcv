import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import dotenv from 'dotenv';

/**
 * The `name` field of `apps/api/backend/package.json`. Used as the marker
 * when walking the directory tree to discover the backend package root.
 * Kept as a literal so a rename in package.json triggers a build failure
 * in this loader rather than a silent runtime miss.
 */
const BACKEND_PACKAGE_NAME = 'chai-vc-platform-backend';

/**
 * Walk upward from `start` looking for the nearest `package.json` whose
 * `name` matches the backend package. Returns the directory containing
 * that `package.json`, or `null` if not found.
 *
 * Codex finding (PR #421, P2): the prior loader resolved
 * `path.resolve(__dirname, '..', '..')` which works in the source layout
 * (`apps/api/backend/src/config/loadDotenv.ts` → `apps/api/backend`) but
 * NOT in the compiled-dist layout produced by `backend/tsconfig.json`
 * (which has `rootDir: ../../..` and `outDir: dist`). In that layout the
 * file is emitted at `apps/api/backend/dist/apps/api/backend/src/config/
 * loadDotenv.js`, and `__dirname/../..` resolves to
 * `apps/api/backend/dist/apps/api/backend` — inside `dist/`, not the
 * package root. So the packaged server never loaded `.env.local` / `.env`.
 *
 * Walking up matching on `package.json#name` is correct in both layouts:
 * the source layout finds the package immediately; the dist layout walks
 * past intermediate generated directories (which have no `package.json`)
 * until it reaches the real `apps/api/backend/package.json`.
 */
function findBackendPackageRoot(start: string): string | null {
  let cur = path.resolve(start);
  const fsRoot = path.parse(cur).root;
  while (cur !== fsRoot) {
    const pkgPath = path.join(cur, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const parsed = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: unknown };
        if (typeof parsed.name === 'string' && parsed.name === BACKEND_PACKAGE_NAME) {
          return cur;
        }
      } catch {
        // Unreadable or non-JSON package.json — keep walking. Failing
        // closed here would block legitimate loads if a sibling package
        // somewhere above us happens to be malformed.
      }
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

/**
 * Loads dotenv files for local development. `.env.local` wins over `.env`.
 * Both calls use `override: false` so platform-provided env vars (Railway,
 * Render, Vercel, shell exports) always take precedence over file values.
 *
 * Path discovery (in order):
 *   1. Walk up from `__dirname` matching on `package.json#name` ===
 *      'chai-vc-platform-backend'. Works in both source and compiled-dist
 *      layouts.
 *   2. Fallback to `process.cwd()`. Matches Railway's `npm --prefix
 *      apps/api/backend start` pattern, where cwd is the backend root.
 *
 * Missing files are silently ignored — dotenv records a "file not found"
 * error in the result object rather than throwing, and production
 * environments typically have no dotenv files at all.
 */
export function loadDotenv(): void {
  const backendRoot = findBackendPackageRoot(__dirname) ?? process.cwd();
  dotenv.config({
    path: path.join(backendRoot, '.env.local'),
    override: false,
    quiet: true,
  });
  dotenv.config({
    path: path.join(backendRoot, '.env'),
    override: false,
    quiet: true,
  });
}

/**
 * Exported for tests. Returns the resolved root + whether the walk found
 * the backend package or fell back to cwd. Tests must not depend on the
 * dotenv side-effect itself.
 */
export function resolveBackendRootForTests(start: string): {
  root: string;
  source: 'package-walk' | 'cwd-fallback';
} {
  const walked = findBackendPackageRoot(start);
  if (walked) return { root: walked, source: 'package-walk' };
  return { root: process.cwd(), source: 'cwd-fallback' };
}
