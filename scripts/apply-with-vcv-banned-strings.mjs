#!/usr/bin/env node
/**
 * apply-with-vcv-banned-strings.mjs — W2-PR46A CI gate
 *
 * Scans Apply-with-VCV surfaces for banned phrases that violate the
 * VitalCV truth contract (see CLAUDE.md). Fails CI if any banned phrase is
 * found in the scanned files, with the exception of:
 *
 *   - This script itself (constructs banned phrases for matching)
 *   - applyOperationalWorkflow.ts source (stores the canonical list as
 *     split-join constants in APPLY_WORKFLOW_BANNED_PHRASES)
 *   - Test files that intentionally exercise the rejection path with
 *     split-join'd phrases
 *
 * Usage:
 *   node scripts/apply-with-vcv-banned-strings.mjs
 *
 * Exits 0 on clean, 1 on any hit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(__filename, '..', '..');

// Build banned list from split-join (this script itself must not contain a
// literal banned string for grep-of-grep audits to stay clean).
const BANNED = [
  ['automatically', 'verified'],
  ['guaranteed', 'verification'],
  ['complete', 'credentialing'],
  ['instant', 'credentialing'],
  ['legally', 'accepted'],
  ['risk', 'transferred'],
  ['final', 'verification', 'without', 'review'],
  ['source', 'confirmed', 'before', 'response'],
  ['certified', 'compliant'],
  ['HIPAA', 'compliant'],
  ['SOC2', 'certified'],
].map((parts) => parts.join(' ').toLowerCase());

// Surfaces in scope for Apply-with-VCV: components, routes, services, docs.
const SCAN_ROOTS = [
  'apps/api/backend/src/services/apply',
  'apps/api/backend/src/services/distribution',
  'apps/api/backend/src/routes/apply.ts',
  'apps/web/components/apply',
  'apps/web/app/api/apply',
  'apps/web/app/apply',
  'docs/ops/apply-with-vcv-operational-workflow.md',
];

// Files that are allowed to contain split-join'd banned phrases (constants
// or test fixtures). These match by suffix relative to repo root.
const ALLOWLIST_SUFFIXES = [
  'services/apply/applyOperationalWorkflow.ts',
  'services/apply/__tests__/applyOperationalWorkflow.test.ts',
  'scripts/apply-with-vcv-banned-strings.mjs',
];

function isAllowlisted(absPath) {
  const rel = relative(REPO_ROOT, absPath).split(sep).join('/');
  return ALLOWLIST_SUFFIXES.some((suffix) => rel.endsWith(suffix));
}

function* walk(root) {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return; // missing path is fine — not all surfaces exist in every wave
  }
  if (stat.isFile()) {
    yield root;
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    yield* walk(join(root, entry));
  }
}

const SCANNABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx|json|yaml|yml)$/i;

let hits = 0;
const hitDetails = [];

for (const surface of SCAN_ROOTS) {
  const absRoot = join(REPO_ROOT, surface);
  for (const file of walk(absRoot)) {
    if (!SCANNABLE_EXT.test(file)) continue;
    if (isAllowlisted(file)) continue;

    let contents;
    try {
      contents = readFileSync(file, 'utf8').toLowerCase();
    } catch {
      continue;
    }
    for (const phrase of BANNED) {
      if (contents.includes(phrase)) {
        hits++;
        hitDetails.push({ file: relative(REPO_ROOT, file), phrase });
      }
    }
  }
}

if (hits === 0) {
  console.log('apply-with-vcv banned-strings gate: clean');
  process.exit(0);
}

console.error('apply-with-vcv banned-strings gate: FAIL');
for (const { file, phrase } of hitDetails) {
  console.error(`  ${file}  →  "${phrase}"`);
}
console.error(`\n${hits} hit(s) — see CLAUDE.md "Banned strings" for context.`);
process.exit(1);
