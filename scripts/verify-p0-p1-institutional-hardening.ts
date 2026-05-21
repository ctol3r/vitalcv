#!/usr/bin/env node
/**
 * scripts/verify-p0-p1-institutional-hardening.ts
 *
 * Scans apps/web/{app,components} for the specific P0/P1 phrases
 * eliminated in Wave 37. Contract lives in
 * docs/product/p0-p1-institutional-hardening.md.
 *
 * Sub-modes:
 *   enforce               default; exit non-zero on FAIL
 *   report                scan + summary; never exit non-zero
 *   degraded-states-only  check exposure of access_required /
 *                         source_unavailable / timeout /
 *                         incomplete_evidence (NOTE-level)
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

interface BannedRule {
  pattern: RegExp;
  label: string;
  replacement: string;
}

// P0/P1 phrases. Patterns are tight to avoid catching the
// rejection-table strings in the doctrine doc (the doctrine lives
// under docs/, which is excluded from the scan).
const RULES: readonly BannedRule[] = [
  {
    pattern: /All mandatory requirements verified and continuously monitored/,
    label: 'ClearToStartBanner: "All mandatory requirements verified and continuously monitored."',
    replacement: 'Federal-source lanes were source-confirmed at the last read. Institution review still required.',
  },
  {
    pattern: /Credentials verified\.\s*Clear to proceed\./,
    label: 'ConsoleWrapper proceed-grade: "Credentials verified. Clear to proceed."',
    replacement: 'Lane evidence completed. Institution review still required.',
  },
  {
    pattern: /Continuously Monitored/,
    label: '"Continuously Monitored" (TitleCase label)',
    replacement: 'Re-checked on request',
  },
  {
    pattern: /Continuously monitored/,
    label: '"Continuously monitored" (sentence-case label)',
    replacement: 'Re-checked on request',
  },
  {
    pattern: /automatically monitored/,
    label: '"automatically monitored"',
    replacement: 'resolved per request',
  },
  {
    pattern: /PSV-backed recognition/,
    label: '"PSV-backed recognition"',
    replacement: 'Source-confirmed lane evidence',
  },
  {
    pattern: /automatically decay/,
    label: '"automatically decay"',
    replacement: 'expire against the institution’s freshness budget; re-presentation required',
  },
  {
    pattern: /cryptographically scoped/,
    label: '"cryptographically scoped"',
    replacement: 'signature-scoped',
  },
];

const DEGRADED_STATES = [
  'access_required',
  'source_unavailable',
  'timeout',
  'incomplete_evidence',
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

// ── Banned scan ───────────────────────────────────────────────────────────

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
    for (const rule of RULES) {
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
    text: `p0-p1 scan: ${scanned} source files; ${hits} FAIL hit(s)`,
  });
  return entries;
}

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
  let total = 0;
  let exposingAtLeastOne = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    // Only files that look like they render verification / readiness
    // state are candidates; library files / API helpers are skipped.
    if (!/verify|readiness|review|lane|posture/i.test(src)) continue;
    total += 1;
    const exposes = DEGRADED_STATES.some((s) => src.includes(s));
    if (exposes) exposingAtLeastOne += 1;
  }
  entries.push({
    level: 'NOTE',
    text: `degraded-states scan: ${total} verification-related file(s); ${exposingAtLeastOne} expose at least one of [${DEGRADED_STATES.join(', ')}]`,
  });
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'enforce') as Mode;
  console.log(`# verify-p0-p1-institutional-hardening (${mode}) · ${new Date().toISOString()}`);
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
      `\n[FAIL] p0-p1 institutional hardening: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] p0-p1 institutional hardening: no FAIL drift');
}

main();
