#!/usr/bin/env tsx
/**
 * check-header-trust-ratchet — S5 header-trust regression gate.
 *
 * Doctrine: identity must come from a verified Clerk session JWT, never from a
 * caller-supplied header. `middleware/verifiedIdentity.ts` (#589) is the single
 * place allowed to decide who the caller is.
 *
 * This gate does NOT prove the backend is free of header trust — it is not, and
 * cannot be yet. G1 shipped deliberately as a REWRITE rather than a removal:
 * `verifiedIdentity` overwrites `x-clerk-user-id` with the verified subject
 * before routes run, so the ~40 downstream files that read that header are
 * reading verified data *provided the middleware is in front of them*. Ripping
 * those reads out is a separate, larger change.
 *
 * What this DOES do is FREEZE the blast radius: it fails CI if a backend source
 * file reads one of the three identity headers and is not on the reviewed
 * baseline. The baseline can only shrink. So the set of files whose correctness
 * depends on `verifiedIdentity` running first can never quietly grow — which is
 * what makes the eventual flip to CLERK_VERIFY_ENFORCED=enforce auditable.
 *
 * Deliberately NOT asserted here: that VERIFIER_RBAC_ENFORCED defaults true in
 * prod config. That assertion belongs to S5 but fails until S2 flips the flag,
 * so it is tracked in docs/security/header-trust-ratchet.md rather than shipped
 * red. Add it in the same PR that flips G2.
 *
 * Usage:  node --experimental-strip-types scripts/check-header-trust-ratchet.ts
 *         node --experimental-strip-types scripts/check-header-trust-ratchet.ts --update
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = process.cwd();
const SCAN_DIR = join('apps', 'api', 'backend', 'src');
const BASELINE_PATH = join('apps', 'api', 'backend', 'header-trust-baseline.json');

const HEADERS = 'x-clerk-user-id|x-user-role|x-org-id';

// A READ of an identity header. Two idioms exist in the backend today:
//   req.headers['x-clerk-user-id']      (and .headers.get(...) for Fetch-style)
//   getHeader(req, 'x-clerk-user-id')
// Deliberately NOT matched: the header name inside error strings ("Missing
// x-clerk-user-id"), JSDoc auth notes, and `attributionSource: 'x-clerk-user-id'`.
// Those mention the header without trusting it, and banning the words would
// punish the code that documents the boundary.
const HEADER_READ = new RegExp(
  String.raw`(?:(?:req|request|ctx)\s*\??\.\s*headers\s*(?:\[\s*|\.\s*get\s*\(\s*)|getHeader\s*\(\s*[A-Za-z_$][\w$]*\s*,\s*)['"\`](?:${HEADERS})`,
  'i',
);

function walk(absDir: string): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(absDir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      out = out.concat(walk(p));
    } else if (/\.ts$/.test(e.name) && !/\.(test|spec|d)\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const absScan = join(repoRoot, SCAN_DIR);
try {
  statSync(absScan);
} catch {
  console.error(`check-header-trust-ratchet: scan dir not found: ${SCAN_DIR}`);
  process.exit(2);
}

const files = walk(absScan);
const readers = files
  .filter((f) => HEADER_READ.test(readFileSync(f, 'utf8')))
  .map((f) => relative(absScan, f).split(sep).join('/'))
  .sort();

if (process.argv.includes('--update')) {
  writeFileSync(
    join(repoRoot, BASELINE_PATH),
    `${JSON.stringify(
      {
        $comment:
          'S5 header-trust ratchet. Backend files that read a caller-supplied identity header. '
          + 'This list may SHRINK, never grow. See docs/security/header-trust-ratchet.md.',
        scanDir: SCAN_DIR.split(sep).join('/'),
        baselineHeaderReaderFiles: readers,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  console.log(`check-header-trust-ratchet: wrote ${readers.length} file(s) to ${BASELINE_PATH}`);
  process.exit(0);
}

let baseline: Set<string>;
try {
  const parsed = JSON.parse(readFileSync(join(repoRoot, BASELINE_PATH), 'utf8'));
  baseline = new Set<string>(parsed.baselineHeaderReaderFiles ?? []);
} catch {
  console.error(`check-header-trust-ratchet: cannot read baseline ${BASELINE_PATH}`);
  process.exit(2);
}

const added = readers.filter((f) => !baseline.has(f));
const resolved = [...baseline].filter((f) => !readers.includes(f)).sort();

console.log(
  `check-header-trust-ratchet — ${files.length} backend source files, `
  + `${readers.length} read an identity header (baseline: ${baseline.size}).`,
);

if (resolved.length > 0) {
  console.log(`\n✓ ${resolved.length} baseline file(s) no longer read an identity header — trim them:`);
  resolved.forEach((f) => console.log(`    - ${f}`));
  console.log('    Run: node --experimental-strip-types scripts/check-header-trust-ratchet.ts --update');
}

if (added.length > 0) {
  console.error(`\nFAIL — ${added.length} NEW backend file(s) trusting a caller-supplied identity header:\n`);
  added.forEach((f) => console.error(`  ${SCAN_DIR.split(sep).join('/')}/${f}`));
  console.error('\nIdentity must be derived from the verified Clerk session, not from the request');
  console.error('headers. Use the subject that middleware/verifiedIdentity.ts resolved rather than');
  console.error("reading req.headers['x-clerk-user-id'] directly.");
  console.error('\nIf this read is genuinely behind verifiedIdentity and cannot be changed yet, add');
  console.error('it to the baseline in the same PR and say why in the PR body — that is a reviewed');
  console.error('exception, not a rubber stamp. See docs/security/header-trust-ratchet.md.');
  process.exit(1);
}

console.log('\nPASS — no new header-trusting backend files beyond the reviewed baseline.');
process.exit(0);
