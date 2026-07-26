#!/usr/bin/env node

/**
 * Canonical public-entry copy sources — existence AND liveness.
 *
 * Why more than existence: this report used to verify only that each listed
 * file was on disk, which cannot detect the failure it exists to prevent. By
 * 2026-07-26 the homepage surface listed five copy sources — three of them dead
 * code with zero importers anywhere, and none of them rendered by `/` after the
 * homepage became the six-scene film. The report stayed green throughout,
 * because the files still existed.
 *
 * A manifest that names where copy lives, and is never checked against where
 * copy actually lives, is worse than no manifest: it is a confident wrong
 * answer. Same shape as the homepage vitest suite that went green while
 * asserting a page no visitor could load.
 *
 * THE RULE. A listed source must exist, and — unless it is itself a route
 * (`app/**​/page.tsx`) — must have at least one importer inside `apps/web`.
 * Dead modules cannot carry live copy.
 *
 * Deliberately NOT a reachability walk from the entry file. That was the first
 * cut, and it was wrong: it flagged `buyer-pilot`'s sources because `/pilot`
 * does not *import* `/employers` — they are sibling routes in one buyer
 * journey, and a surface is allowed to be a journey rather than a composition.
 * Import-liveness catches the real rot without inventing a composition model
 * the manifest never claimed.
 */

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const webRoot = path.join(repoRoot, 'apps/web');
const manifestPath = path.join(__dirname, 'public-entry-copy-sources.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const surfaces = Array.isArray(manifest.surfaces) ? manifest.surfaces : [];

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '_archive']);
const CODE = /\.(ts|tsx|js|jsx)$/;

/** Every source file under apps/web, excluding build output and archives. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (CODE.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const allFiles = walk(webRoot);
const sourceCache = new Map();
const readSource = (abs) => {
  if (!sourceCache.has(abs)) sourceCache.set(abs, fs.readFileSync(abs, 'utf8'));
  return sourceCache.get(abs);
};

const isRoute = (rel) => /^apps\/web\/app\/.*\/?page\.tsx?$/.test(rel);

/**
 * Does anything under apps/web import this file? Matched on the module
 * basename, which over-matches rather than under-matches — a false "live" is a
 * missed cleanup, while a false "dead" would block a correct manifest.
 */
function hasImporter(rel) {
  const abs = path.join(repoRoot, rel);
  const stem = path.basename(rel).replace(CODE, '');
  const needle = new RegExp(`from\\s+['"][^'"]*\\b${stem}['"]|import\\(\\s*['"][^'"]*\\b${stem}['"]`);
  for (const file of allFiles) {
    if (file === abs) continue;
    if (needle.test(readSource(file))) return true;
  }
  return false;
}

let missingCount = 0;
let deadCount = 0;

console.log('Canonical public-entry copy sources');

for (const surface of surfaces) {
  console.log(`- ${surface.label} (${surface.id})`);
  console.log(`  entry: ${surface.entryFile}`);
  if (!fs.existsSync(path.join(repoRoot, surface.entryFile))) {
    missingCount += 1;
    console.log('    [missing]');
  }

  for (const file of surface.copySources ?? []) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      missingCount += 1;
      console.log(`  source: ${file} [missing]`);
      continue;
    }
    // The importer scan only walks apps/web, so a file outside that tree can
    // never be proven live here. Check existence and move on rather than
    // reporting a backend module as dead because this script cannot see its
    // consumers.
    const inWeb = file.startsWith('apps/web/');
    if (inWeb && !isRoute(file) && !hasImporter(file)) {
      deadCount += 1;
      console.log(`  source: ${file} [DEAD — nothing under apps/web imports it]`);
      continue;
    }
    console.log(`  source: ${file}`);
  }
}

if (missingCount > 0 || deadCount > 0) {
  console.error(
    `\n${missingCount} missing, ${deadCount} dead. ` +
      'A module nothing imports cannot carry live copy — update ' +
      'scripts/public-entry-copy-sources.json to name what actually renders.',
  );
  process.exitCode = 1;
}
