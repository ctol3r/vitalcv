#!/usr/bin/env node
/**
 * scripts/verify-verification-integrity.ts
 *
 * Scans apps/web/{app,components} for positive-form verification
 * certainty claims that misrepresent the operational posture.
 * Contract lives in docs/product/verification-integrity-hardening.md.
 *
 * Sub-modes:
 *   enforce              default; exit non-zero on FAIL
 *   report               scan + summary; never exit non-zero
 *   degraded-states-only check that verification surfaces expose
 *                        the six degraded states (NOTE-level)
 *
 * Excludes:
 *   _archive/   (retired code)
 *   node_modules/
 *   .next/
 *   *.test.*    (tests may reference banned phrases)
 *   __tests__/  (test fixtures)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Mode = 'enforce' | 'report' | 'degraded-states-only';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

type Level = 'OK' | 'NOTE' | 'WARN' | 'FAIL';
interface Entry {
  level: Level;
  text: string;
}

interface BannedPattern {
  pattern: RegExp;
  label: string;
  replacement: string;
}

// Positive-form patterns. We match against the file content with
// JSX-aware patterns so that bare-word JSX labels are caught
// without flagging variable / function names like `isVerified`.
const BANNED: readonly BannedPattern[] = [
  {
    pattern: /Credentials verified\.\s*Clear to proceed\./,
    label: 'Credentials verified. Clear to proceed.',
    replacement: 'Lane evidence completed. Institution review still required before a final decision.',
  },
  {
    pattern: />\s*Verified\s*</,
    label: '>Verified< (bare JSX label)',
    replacement: '>Source-confirmed< or >Marked review-complete<',
  },
  {
    pattern: />\s*VERIFIED\s*</,
    label: '>VERIFIED< (bare JSX uppercase label)',
    replacement: '>SOURCE-CONFIRMED< or >MARKED REVIEW-COMPLETE<',
  },
  {
    pattern: />\s*Approved\s*</,
    label: '>Approved< (bare JSX label)',
    replacement: '>Marked review-complete<',
  },
  {
    pattern: />\s*Cleared\s*</,
    label: '>Cleared< (bare JSX label)',
    replacement: '>Source-confirmed<',
  },
  {
    pattern: />\s*CLEARED\s*</,
    label: '>CLEARED< (bare JSX uppercase label)',
    replacement: '>SOURCE-CONFIRMED<',
  },
  {
    pattern: />\s*Safe\s*</,
    label: '>Safe< (bare JSX label)',
    replacement: '>Review completed< or domain-specific evidence-bounded label',
  },
  {
    pattern: /aria-label=["']Approved["']/,
    label: 'aria-label="Approved"',
    replacement: 'aria-label="Marked review-complete"',
  },
  {
    pattern: /aria-label=["']Verified["']/,
    label: 'aria-label="Verified"',
    replacement: 'aria-label="Source-confirmed"',
  },
  {
    pattern: /\bclear to proceed\b/i,
    label: '"clear to proceed" (any case)',
    replacement: 'institution review still required',
  },
  {
    pattern: /\bapproved automatically\b/i,
    label: '"approved automatically"',
    replacement: '(remove; no automated approval)',
  },
];

const DEGRADED_STATES = [
  'SOURCE_TIMEOUT',
  'SOURCE_UNAVAILABLE',
  'ACCESS_REQUIRED',
  'REVIEW_PENDING',
  'PARTIAL_COMPLETION',
  'CONTINUITY_INTERRUPTED',
] as const;

// ── File walker ───────────────────────────────────────────────────────────

function walk(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    let stat;
    try {
      stat = statSync(cur);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const entries = readdirSync(cur);
      for (const e of entries) {
        if (e.startsWith('.')) continue;
        if (e === 'node_modules') continue;
        if (e === '_archive') continue;
        if (e === '__tests__') continue;
        stack.push(join(cur, e));
      }
    } else if (stat.isFile()) {
      if (cur.includes('.test.')) continue;
      if (cur.endsWith('.tsx') || cur.endsWith('.ts')) {
        out.push(cur);
      }
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// ── Banned-pattern scan ───────────────────────────────────────────────────

function scanBanned(): Entry[] {
  const entries: Entry[] = [];
  const roots = [
    resolve(REPO_ROOT, 'apps/web/app'),
    resolve(REPO_ROOT, 'apps/web/components'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    files.push(...walk(root));
  }
  if (files.length === 0) {
    entries.push({ level: 'NOTE', text: 'no source files found under apps/web/{app,components}' });
    return entries;
  }
  let scanned = 0;
  let hits = 0;
  for (const file of files) {
    scanned += 1;
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = file.slice(REPO_ROOT.length + 1);
    for (const rule of BANNED) {
      if (rule.pattern.test(src)) {
        hits += 1;
        entries.push({
          level: 'FAIL',
          text: `${rel}: contains "${rule.label}" — replace with: ${rule.replacement}`,
        });
      }
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `verification-integrity scan: ${scanned} source files; ${hits} FAIL hit(s)`,
  });
  return entries;
}

// ── Degraded-states sub-mode ──────────────────────────────────────────────

function reportDegradedStates(): Entry[] {
  const entries: Entry[] = [];
  const roots = [
    resolve(REPO_ROOT, 'apps/web/app'),
    resolve(REPO_ROOT, 'apps/web/components'),
  ];
  const files: string[] = [];
  for (const root of roots) {
    files.push(...walk(root));
  }
  // Look for files that mention "verification" / "readiness" /
  // "review" semantics and check whether any degraded state name
  // appears in the same file. NOTE-level only; never FAIL.
  let scanned = 0;
  let exposing = 0;
  let bare = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const rel = file.slice(REPO_ROOT.length + 1);
    const looksVerifying = /verify|review|readiness|lane/i.test(src);
    if (!looksVerifying) continue;
    scanned += 1;
    const exposes = DEGRADED_STATES.some((s) => src.includes(s));
    if (exposes) {
      exposing += 1;
    } else {
      bare += 1;
      // No FAIL — many verification surfaces legitimately don't render
      // degraded states inline (they live elsewhere). Just NOTE.
    }
  }
  entries.push({
    level: 'NOTE',
    text: `degraded-states scan: ${scanned} verification-related file(s); ${exposing} expose a degraded state, ${bare} do not (NOTE-level)`,
  });
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'enforce') as Mode;
  console.log(`# verify-verification-integrity (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  let entries: Entry[];
  switch (mode) {
    case 'degraded-states-only':
      entries = reportDegradedStates();
      break;
    case 'report':
      entries = scanBanned();
      break;
    case 'enforce':
    default:
      entries = scanBanned();
      break;
  }

  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (mode === 'enforce' && failed.length > 0) {
    console.log(
      `\n[FAIL] verification integrity: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] verification integrity: no FAIL drift');
}

main();
