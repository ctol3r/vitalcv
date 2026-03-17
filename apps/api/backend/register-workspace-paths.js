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
 * Resolution order for `require("@vitalcv/<pkg>")`:
 *   1. dist/packages/<pkg>/index.js           (tsc output)
 *   2. dist/packages/<pkg>/src/index.js        (tsc output, src layout)
 *   3. packages/<pkg>/index.js                (co-located JS in source)
 *   4. packages/<pkg>/dist/index.js           (package-local build output)
 *   5. packages/<pkg>/src/index.js            (last resort, src layout)
 *   6. Fall through to default Node resolution
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

Module._resolveFilename = function resolveWorkspacePaths(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith(WORKSPACE_PREFIX)) {
    const rest = request.slice(WORKSPACE_PREFIX.length);
    const slashIndex = rest.indexOf('/');
    const packageName = slashIndex === -1 ? rest : rest.slice(0, slashIndex);
    const subpath = slashIndex === -1 ? '' : rest.slice(slashIndex + 1);
    const entry = subpath || 'index';

    const candidates = [
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

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
