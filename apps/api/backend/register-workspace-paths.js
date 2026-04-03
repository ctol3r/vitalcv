/**
 * register-workspace-paths.js
 *
 * Runtime module-resolution hook for workspace packages.
 *
 * Problem: workspace packages resolve through node_modules, but some runtime
 * environments need a fallback to compiled workspace outputs when pnpm links
 * point at package source directories.
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

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
