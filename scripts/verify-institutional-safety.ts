#!/usr/bin/env node
/**
 * scripts/verify-institutional-safety.ts
 *
 * Scans apps/web/app/** and apps/web/components/** for banned
 * positive-form claims that misrepresent the operational shape.
 * The contract lives in
 * docs/product/institutional-safety-remediation.md.
 *
 * Sub-modes:
 *   enforce             default; exits non-zero on FAIL
 *   report              scan + summary; never exits non-zero
 *   cryptographic-only  just the cryptographic-guarantee subset
 *
 * Excludes:
 *   _archive/   (retired code)
 *   node_modules/
 *   .next/
 *   *.test.*    (tests may reference banned phrases for negative assertions)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Mode = 'enforce' | 'report' | 'cryptographic-only';

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
  phrase: string;
  category: 'cryptographic' | 'ai-theater' | 'real-time-theater';
  level: Level; // FAIL or WARN
  replacement: string;
}

const RULES: readonly BannedRule[] = [
  // Cryptographic guarantees (FAIL on positive use)
  { phrase: 'Cryptographically Verified', category: 'cryptographic', level: 'FAIL', replacement: 'Signature confirmed against published key' },
  { phrase: 'cryptographic integrity verified', category: 'cryptographic', level: 'FAIL', replacement: 'signature confirmed' },
  { phrase: 'tamper-proof', category: 'cryptographic', level: 'FAIL', replacement: 'signature-bound' },
  { phrase: 'trustless', category: 'cryptographic', level: 'FAIL', replacement: '(remove; institutional surfaces have explicit trust owners)' },
  { phrase: 'guaranteed verification', category: 'cryptographic', level: 'FAIL', replacement: '(remove; no guarantee is provided)' },
  { phrase: 'guaranteed cryptographic', category: 'cryptographic', level: 'FAIL', replacement: '(remove)' },

  // AI / autonomous theater (FAIL on positive use)
  { phrase: 'AI-powered', category: 'ai-theater', level: 'FAIL', replacement: '(remove; do not claim AI capability)' },
  { phrase: 'AI-driven', category: 'ai-theater', level: 'FAIL', replacement: '(remove)' },
  { phrase: 'Autonomous Triggers', category: 'ai-theater', level: 'FAIL', replacement: 'Operator Triggers' },
  { phrase: 'autonomous credentialing', category: 'ai-theater', level: 'FAIL', replacement: '(remove)' },
  { phrase: 'autonomous verification', category: 'ai-theater', level: 'FAIL', replacement: '(remove)' },
  { phrase: 'self-driving credentialing', category: 'ai-theater', level: 'FAIL', replacement: '(remove)' },
  { phrase: 'fully autonomous', category: 'ai-theater', level: 'FAIL', replacement: 'bounded; operator-completed' },

  // Real-time / live-state theater (WARN — context-dependent)
  { phrase: 'real-time verification', category: 'real-time-theater', level: 'WARN', replacement: 'per-request resolution' },
  { phrase: 'live cryptographic state', category: 'real-time-theater', level: 'WARN', replacement: 'snapshot of cryptographic state' },
  { phrase: 'magical continuity', category: 'real-time-theater', level: 'FAIL', replacement: '(remove)' },

  // "Immutable" — borderline; FAIL on positive standalone use
  { phrase: ': \'Immutable\'', category: 'cryptographic', level: 'FAIL', replacement: ": 'Hash-chained, append-only'" },
  { phrase: 'Immutable Entity Record', category: 'cryptographic', level: 'FAIL', replacement: 'Hash-chained, append-only entity record' },
  { phrase: 'Immutable audit trail', category: 'cryptographic', level: 'FAIL', replacement: 'Hash-chained, append-only audit trail' },
];

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
        stack.push(join(cur, e));
      }
    } else if (stat.isFile()) {
      // Skip test files
      if (cur.includes('.test.') || cur.includes('__tests__')) continue;
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

// ── Main scan ─────────────────────────────────────────────────────────────

function scan(mode: Mode): Entry[] {
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
  const applicableRules =
    mode === 'cryptographic-only'
      ? RULES.filter((r) => r.category === 'cryptographic')
      : RULES;
  let scanned = 0;
  let failHits = 0;
  let warnHits = 0;
  for (const file of files) {
    scanned += 1;
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = file.slice(REPO_ROOT.length + 1);
    for (const rule of applicableRules) {
      if (src.includes(rule.phrase)) {
        const level = rule.level;
        if (level === 'FAIL') failHits += 1;
        if (level === 'WARN') warnHits += 1;
        entries.push({
          level,
          text: `${rel}: contains "${rule.phrase}" — replace with: ${rule.replacement}`,
        });
      }
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `scan: ${scanned} source files; ${failHits} FAIL hit(s); ${warnHits} WARN hit(s)`,
  });
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'enforce') as Mode;
  console.log(`# verify-institutional-safety (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  const entries = scan(mode);
  for (const e of entries) {
    console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  }
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (mode === 'enforce' && failed.length > 0) {
    console.log(
      `\n[FAIL] institutional safety: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] institutional safety: no FAIL drift');
}

main();
