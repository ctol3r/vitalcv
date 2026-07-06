#!/usr/bin/env tsx
/**
 * check-public-claims — public-copy claim guard for the Provider Career Evidence Network.
 *
 * Scans the live public web surfaces (apps/web/app + apps/web/components) for
 * prohibited / unsupported marketing claims and fails (exit 1) on any hit, so CI
 * and `pnpm check:claims` block over-claiming copy before it ships.
 *
 * Scope: this guards PUBLIC COPY only. It intentionally skips __tests__, _archive,
 * *.stories.*, *.test.*, *.spec.* and generated output — those legitimately hold
 * banned phrases as split/join constants or fixtures. Doctrine files (CLAUDE.md,
 * MASTER_PROMPT.md) are NOT scanned: they DEFINE the banned list.
 *
 * Matching: case-insensitive, after collapsing whitespace and treating '-' as a
 * space. So "blockchain-anchored" also catches "blockchain anchored", and
 * "HIPAA certified" also catches "HIPAA-certified" — but NOT "HIPAA-aligned".
 *
 * Usage:
 *   pnpm check:claims
 *   tsx scripts/check-public-claims.ts [extraRelativeDir ...]
 *
 * Run from the repo root (pnpm sets cwd to the workspace root for root scripts).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();

// Required minimum list (GOD MODE wave §9) + CLAUDE.md banned public claims.
// Each phrase is a specific, multi-word over-claim chosen to avoid false positives.
const PROHIBITED_CLAIMS: ReadonlyArray<{ phrase: string; fix: string }> = [
  { phrase: 'hire instantly', fix: 'Time-to-start is days — say "start clinicians in days, not months".' },
  { phrase: 'instant credentialing', fix: 'Say "credential readiness head start".' },
  { phrase: 'complete credentialing', fix: 'VitalCV is the readiness wedge, not full credentialing.' },
  { phrase: 'credentialing replacement', fix: 'Say "credentialing head start".' },
  { phrase: 'automatically verified', fix: 'Sources are checked, not auto-verified — describe source coverage.' },
  { phrase: 'guaranteed verification', fix: 'Acceptance is policy-dependent; remove the guarantee.' },
  { phrase: 'no further verification required', fix: 'Say "issuer-signed evidence accepted according to verifier policy".' },
  { phrase: 'final verification without review', fix: 'Every decision is policy-reviewed — remove the phrase.' },
  { phrase: 'source confirmed before response', fix: 'Sources are checked asynchronously; do not imply pre-response confirmation.' },
  { phrase: 'legally accepted', fix: 'Acceptance is verifier-policy dependent, not a legal guarantee.' },
  { phrase: 'risk transferred', fix: 'VitalCV does not transfer legal/clinical risk.' },
  { phrase: 'final authority', fix: 'Say "source-backed decision support".' },
  { phrase: 'certified compliant', fix: 'Not certified — say "aligned with" the relevant control.' },
  { phrase: 'HIPAA certified', fix: 'Not certified — say "HIPAA-aligned".' },
  { phrase: 'HIPAA compliant', fix: 'Not certified — say "HIPAA-aligned".' },
  { phrase: 'SOC 2 certified', fix: 'Remove unless a SOC 2 certification actually exists.' },
  { phrase: 'SOC2 certified', fix: 'Remove unless a SOC 2 certification actually exists.' },
  { phrase: 'NCQA certified', fix: 'Remove unless an NCQA certification actually exists.' },
  { phrase: 'NPDB cleared', fix: 'NPDB is not integrated — remove entirely.' },
  { phrase: 'blockchain anchored', fix: 'Say "cryptographically signed".' },
  { phrase: 'zero knowledge proof', fix: 'Say "selectively disclosed (SD-JWT)".' },
  { phrase: 'zero trust ledger', fix: 'Banned framing — say "audit trail".' },
  { phrase: 'all 50 states', fix: 'Say "configured source lanes / licensed states where source access is available".' },
];

const SCAN_ROOTS: string[] = [
  join('apps', 'web', 'app'),
  join('apps', 'web', 'components'),
  join('apps', 'marketing'),
  ...process.argv.slice(2),
];

// M1-8: allowlist for legitimate technical-doc usage. Each entry is
// { file, phrase } — an exact repo-relative path + phrase intentionally present.
// Keep SMALL and reviewed; it is the escape hatch, not a mute.
interface AllowEntry { file: string; phrase: string; note?: string }
let ALLOWLIST: AllowEntry[] = [];
try {
  ALLOWLIST = JSON.parse(readFileSync(join(repoRoot, 'scripts', 'copy-audit-allowlist.json'), 'utf8'));
} catch { ALLOWLIST = []; }

const SCANNABLE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.mdx', '.json']);
const EXCLUDED_DIR_NAMES = new Set([
  'node_modules', '.next', '.turbo', 'dist', 'build', 'coverage', '__tests__', '_archive',
]);

// Meta / QA surfaces that DOCUMENT the banned-words list (like CLAUDE.md does) —
// these enumerate prohibited phrases as a style guide, they are not over-claims.
// Excluded for the same reason doctrine files are never scanned.
const EXCLUDED_PATH_SUBSTRINGS = [
  join('docs', 'visual-qa'),
];

interface Hit {
  file: string;
  line: number;
  phrase: string;
  fix: string;
  text: string;
}

const hits: Hit[] = [];

function normalize(value: string): string {
  return value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

const NORMALIZED_CLAIMS = PROHIBITED_CLAIMS.map((claim) => ({
  ...claim,
  needle: normalize(claim.phrase),
}));

function isAllowed(file: string, phrase: string): boolean {
  return ALLOWLIST.some((e) => e.file === file && normalize(e.phrase) === normalize(phrase));
}

// CLAUDE.md: "No status label may be the bare word `Verified`." Narrow detectors —
// a JSX text node (>Verified<) or a standalone quoted status value ('Verified').
const BARE_VERIFIED_JSX = />\s*Verified\s*</;
const BARE_VERIFIED_LITERAL = /(['"`])Verified\1/;

// Source-code extensions. For these we skip comment lines (a code comment is not
// public copy — CLAUDE.md itself enumerates the banned phrases in comments). We do
// NOT apply comment-skipping to .md/.mdx where a leading '*' is a list bullet.
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

// A banned phrase immediately preceded by a negation is honest copy, not an
// over-claim ("does not complete credentialing"). Matched against the normalized
// (lowercased, apostrophes preserved) text ending at the phrase.
const NEGATION_TAIL = /(?:\b(?:not|no|never|without|cannot|nor|non)|n['’]t)\s$/;

function extOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? '' : path.slice(dot);
}

function precededByNegation(haystack: string, matchIndex: number): boolean {
  return NEGATION_TAIL.test(haystack.slice(0, matchIndex));
}

function isExcludedFile(path: string): boolean {
  if (/\.(test|spec|stories)\.[cm]?[tj]sx?$/.test(path)) return true;
  if (path.endsWith('.d.ts')) return true;
  for (const sub of EXCLUDED_PATH_SUBSTRINGS) {
    if (path.includes(sub)) return true;
  }
  return false;
}

function scanFile(absPath: string): void {
  if (isExcludedFile(absPath)) return;
  const ext = extOf(absPath);
  if (!SCANNABLE_EXT.has(ext)) return;

  let content: string;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    return;
  }

  const isCode = CODE_EXT.has(ext);
  const lines = content.split(/\r?\n/);
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    if (isCode) {
      const trimmed = raw.trimStart();
      // Body/close of a multi-line block comment.
      if (inBlockComment) {
        if (raw.includes('*/')) inBlockComment = false;
        continue;
      }
      // Opens a block comment that does not close on the same line.
      if (trimmed.startsWith('/*') && !raw.includes('*/')) {
        inBlockComment = true;
        continue;
      }
      // Whole-line comment: `// ...`, JSDoc `* ...`, or a self-contained `/* ... */`.
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || /^\/\*.*\*\/\s*$/.test(trimmed)) {
        continue;
      }
    }

    const rel = relative(repoRoot, absPath);
    const haystack = normalize(raw);
    for (const claim of NORMALIZED_CLAIMS) {
      const idx = haystack.indexOf(claim.needle);
      if (idx >= 0 && !precededByNegation(haystack, idx) && !isAllowed(rel, claim.phrase)) {
        hits.push({
          file: rel,
          line: i + 1,
          phrase: claim.phrase,
          fix: claim.fix,
          text: raw.trim().slice(0, 160),
        });
      }
    }
    // Bare-"Verified" status label (skips comment lines already `continue`d above).
    if ((BARE_VERIFIED_JSX.test(raw) || BARE_VERIFIED_LITERAL.test(raw)) && !isAllowed(rel, 'Verified')) {
      hits.push({
        file: rel,
        line: i + 1,
        phrase: 'Verified (bare status label)',
        fix: 'No status label may be the bare word "Verified" — use "Checked" or a coverage state.',
        text: raw.trim().slice(0, 160),
      });
    }
  }
}

function walk(absDir: string): void {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      walk(join(absDir, entry.name));
    } else if (entry.isFile()) {
      scanFile(join(absDir, entry.name));
    }
  }
}

console.log('check-public-claims — scanning public copy for unsupported claims\n');
for (const root of SCAN_ROOTS) {
  const abs = join(repoRoot, root);
  try {
    statSync(abs);
  } catch {
    console.log(`  (skip, not found) ${root}`);
    continue;
  }
  console.log(`  scanning ${root}`);
  walk(abs);
}
console.log('');

if (hits.length === 0) {
  console.log(`PASS — no prohibited public claims found (${PROHIBITED_CLAIMS.length} phrases checked).`);
  process.exit(0);
}

console.error(`FAIL — found ${hits.length} prohibited public claim(s):\n`);
for (const hit of hits) {
  console.error(`  ${hit.file}:${hit.line}`);
  console.error(`    phrase: "${hit.phrase}"`);
  console.error(`    fix:    ${hit.fix}`);
  console.error(`    line:   ${hit.text}`);
  console.error('');
}
console.error('Public copy must not over-claim. See CLAUDE.md banned strings and');
console.error('docs/launch/career-evidence-network-alignment.md for the doctrine.');
process.exit(1);
