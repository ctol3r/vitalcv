/**
 * register-workspace-paths.js
 *
 * Runtime module-resolution hook for workspace packages.
 *
 * Problem: pnpm workspace links point to source packages whose `main` is
 * `./index.ts` — Node.js cannot execute TypeScript directly. The backend's
 * `tsc` build compiles workspace sources into the `dist/` tree (because
 * `rootDir` is the repo root), so compiled JS often exists there. For
 * packages that have co-located `.js` files (compiled separately), we fall
 * back to loading those directly from the source package.
 *
 * Also handles relative imports like `require("../../../packages/ingest")`
 * which tsc generates from source files outside the backend src/ dir.
 *
 * Usage (in start command):
 *   node -r ./apps/api/backend/register-workspace-paths.js \
 *        apps/api/backend/dist/apps/api/backend/src/server.js
 */

'use strict';

const Module = require('module');
const path = require('path');
const fs = require('fs');

const WORKSPACE_PREFIX = '@vitalcv/';

// Repo root — this file lives at apps/api/backend/
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DIST_PACKAGES_ROOT = path.resolve(__dirname, 'dist', 'packages');
const SRC_PACKAGES_ROOT = path.resolve(REPO_ROOT, 'packages');

const originalResolveFilename = Module._resolveFilename;

/**
 * Given a package name, return candidates for its index.js.
 */
function getCandidates(packageName, entry) {
  return [
    // 1. tsc dist output (flat)
    path.join(DIST_PACKAGES_ROOT, packageName, entry + '.js'),
    path.join(DIST_PACKAGES_ROOT, packageName, entry, 'index.js'),
    // 2. tsc dist output (src/ layout)
    path.join(DIST_PACKAGES_ROOT, packageName, 'src', entry + '.js'),
    path.join(DIST_PACKAGES_ROOT, packageName, 'src', entry, 'index.js'),
    // 3. Co-located JS in source package
    path.join(SRC_PACKAGES_ROOT, packageName, entry + '.js'),
    path.join(SRC_PACKAGES_ROOT, packageName, entry, 'index.js'),
    // 4. Package-local dist/ output
    path.join(SRC_PACKAGES_ROOT, packageName, 'dist', entry + '.js'),
    path.join(SRC_PACKAGES_ROOT, packageName, 'dist', entry, 'index.js'),
    // 5. src/ in source package
    path.join(SRC_PACKAGES_ROOT, packageName, 'src', entry + '.js'),
    path.join(SRC_PACKAGES_ROOT, packageName, 'src', entry, 'index.js'),
  ];
}

function findFirst(candidates) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Match relative paths that end up in packages/ dir
// e.g. "../../../packages/ingest" or "../../packages/crs/CrsEngine"
const RELATIVE_PACKAGES_RE = /(?:^|[/\\])packages[/\\]([^/\\]+)(?:[/\\](.+))?$/;

Module._resolveFilename = function resolveWorkspacePaths(request, parent, isMain, options) {
  // Handle @vitalcv/* imports
  if (typeof request === 'string' && request.startsWith(WORKSPACE_PREFIX)) {
    const rest = request.slice(WORKSPACE_PREFIX.length);
    const slashIndex = rest.indexOf('/');
    const packageName = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
    const subpath = slashIndex === -1 ? '' : rest.slice(slashIndex + 1);
    const entry = subpath || 'index';

    const found = findFirst(getCandidates(packageName, entry));
    if (found) return found;
  }

  // Handle relative paths that resolve into packages/ directory
  if (typeof request === 'string' && request.startsWith('.') && parent && parent.filename) {
    const parentDir = path.dirname(parent.filename);
    const resolved = path.resolve(parentDir, request);
    const match = RELATIVE_PACKAGES_RE.exec(resolved);

    if (match) {
      const packageName = match[1];
      const subpath = match[2] || '';
      const entry = subpath || 'index';

      const found = findFirst(getCandidates(packageName, entry));
      if (found) return found;
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
