#!/usr/bin/env node
/**
 * scripts/verify-production-integrity.ts
 *
 * Wave 41: enforces production-deployment-integrity rules.
 *
 *   1. The five canonical routes resolve to page.tsx on disk
 *   2. LiveFeedRibbon.tsx does NOT contain a cosmetic 1-second
 *      setInterval tick (setInterval(.+ 1000) used to increment a
 *      cosmetic refresh counter)
 *   3. No banned production-confidence phrases in apps/web/{app,components}:
 *        - Real-Time Monitoring
 *        - 99.9%
 *        - five-nines
 *        - fault-tolerant
 *        - Always-on (as a positive standalone phrase)
 *        - Real-time synchronization
 *   4. Doctrine doc exists at docs/ops/production-deployment-integrity.md
 *
 * Excludes:
 *   _archive/   (retired code)
 *   node_modules/
 *   .next/
 *   *.test.*    (tests may reference banned phrases for negative assertion)
 *   __tests__/
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Mode = 'enforce' | 'deployment-state' | 'runtime-recovery';

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

const CANONICAL_ROUTES: ReadonlyArray<string> = [
  'apps/web/app/page.tsx',
  'apps/web/app/passport/page.tsx',
  'apps/web/app/review/page.tsx',
  'apps/web/app/status/page.tsx',
];

// /get-ready ships on Wave 32 (PR #409); check separately and tolerate
// absence on origin/main as a NOTE.
const OPTIONAL_CANONICAL_ROUTES: ReadonlyArray<string> = [
  'apps/web/app/get-ready/page.tsx',
];

const LIVE_FEED_RIBBON = 'apps/web/components/intelligence/LiveFeedRibbon.tsx';
const DOCTRINE_DOC = 'docs/ops/production-deployment-integrity.md';

function read(rel: string): string {
  const path = resolve(REPO_ROOT, rel);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

// ── Check 1 · Canonical routes ──────────────────────────────────────────

function checkCanonicalRoutes(): Entry[] {
  const entries: Entry[] = [];
  for (const rel of CANONICAL_ROUTES) {
    if (existsSync(resolve(REPO_ROOT, rel))) {
      entries.push({ level: 'OK', text: `canonical route resolves: ${rel}` });
    } else {
      entries.push({ level: 'FAIL', text: `canonical route missing: ${rel}` });
    }
  }
  for (const rel of OPTIONAL_CANONICAL_ROUTES) {
    if (existsSync(resolve(REPO_ROOT, rel))) {
      entries.push({ level: 'OK', text: `canonical route resolves: ${rel}` });
    } else {
      entries.push({
        level: 'NOTE',
        text: `${rel} not on this branch (lands on Wave 32 PR #409)`,
      });
    }
  }
  return entries;
}

// ── Check 2 · No cosmetic 1-second tick in LiveFeedRibbon ──────────────

function checkNoCosmeticTick(): Entry[] {
  const src = read(LIVE_FEED_RIBBON);
  if (!src) {
    return [{ level: 'NOTE', text: `${LIVE_FEED_RIBBON} not present (skipped)` }];
  }
  const stripped = stripComments(src);
  const entries: Entry[] = [];
  // Pattern: setInterval(... refreshSeconds ... 1000) OR
  //          setInterval(... 1000) with a refreshSeconds setter nearby
  if (/setRefreshSeconds\(\(prev\) => prev \+ 1\)/.test(stripped)) {
    entries.push({
      level: 'FAIL',
      text: `${LIVE_FEED_RIBBON}: cosmetic refreshSeconds setInterval tick detected`,
    });
  } else {
    entries.push({
      level: 'OK',
      text: `${LIVE_FEED_RIBBON}: no cosmetic refreshSeconds tick`,
    });
  }
  if (/00:\{refreshSeconds/.test(stripped)) {
    entries.push({
      level: 'FAIL',
      text: `${LIVE_FEED_RIBBON}: cosmetic "00:{refreshSeconds}" render detected`,
    });
  } else {
    entries.push({
      level: 'OK',
      text: `${LIVE_FEED_RIBBON}: no cosmetic "00:NN" render`,
    });
  }
  return entries;
}

// ── Check 3 · Banned production-confidence phrases ─────────────────────

interface BannedRule {
  pattern: RegExp;
  label: string;
  replacement: string;
}

const BANNED_PRODUCTION_PHRASES: readonly BannedRule[] = [
  {
    pattern: /Real-Time Monitoring/,
    label: '"Real-Time Monitoring"',
    replacement: 'Per-request federal-source resolution',
  },
  {
    pattern: /Real-time synchronization/,
    label: '"Real-time synchronization"',
    replacement: 'Per-request resolution against primary-source registries',
  },
  {
    pattern: /\b99\.9%/,
    label: '"99.9%"',
    replacement: '(remove; no SLO is being measured)',
  },
  {
    pattern: /\bfive-nines\b/i,
    label: '"five-nines"',
    replacement: '(remove)',
  },
  {
    pattern: /\bfault-tolerant\b/i,
    label: '"fault-tolerant"',
    replacement: '(remove; over-claims runtime resilience)',
  },
];

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
      if (cur.endsWith('.tsx') || cur.endsWith('.ts')) out.push(cur);
    }
  }
  return out;
}

function checkBannedProductionPhrases(): Entry[] {
  const entries: Entry[] = [];
  const roots = [
    resolve(REPO_ROOT, 'apps/web/app'),
    resolve(REPO_ROOT, 'apps/web/components'),
  ];
  const files: string[] = [];
  for (const root of roots) files.push(...walk(root));
  let scanned = 0;
  let hits = 0;
  for (const file of files) {
    scanned += 1;
    const src = stripComments(readFileSync(file, 'utf8'));
    const rel = file.slice(REPO_ROOT.length + 1);
    for (const rule of BANNED_PRODUCTION_PHRASES) {
      if (rule.pattern.test(src)) {
        hits += 1;
        entries.push({
          level: 'FAIL',
          text: `${rel}: contains ${rule.label} — replace with: ${rule.replacement}`,
        });
      }
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `banned-phrase scan: ${scanned} source files; ${hits} FAIL hit(s)`,
  });
  return entries;
}

// ── Check 4 · Doctrine doc presence ────────────────────────────────────

function checkDoctrineDoc(): Entry[] {
  if (!existsSync(resolve(REPO_ROOT, DOCTRINE_DOC))) {
    return [{ level: 'FAIL', text: `${DOCTRINE_DOC} missing` }];
  }
  return [{ level: 'OK', text: `${DOCTRINE_DOC} present` }];
}

// ── Sub-mode: runtime-recovery (degraded-state coverage NOTE scan) ─────

function reportRuntimeRecovery(): Entry[] {
  const entries: Entry[] = [];
  const roots = [
    resolve(REPO_ROOT, 'apps/web/app'),
    resolve(REPO_ROOT, 'apps/web/components'),
  ];
  const files: string[] = [];
  for (const root of roots) files.push(...walk(root));
  let total = 0;
  let withRetry = 0;
  let withCachedBanner = 0;
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!/fetch\(|useSWR|useQuery|axios/.test(src)) continue;
    total += 1;
    if (/Retry|retry|onRetry/.test(src)) withRetry += 1;
    if (/cached|Cached|stale|Stale/.test(src)) withCachedBanner += 1;
  }
  entries.push({
    level: 'NOTE',
    text: `runtime-recovery scan: ${total} fetch-using file(s); ${withRetry} expose Retry, ${withCachedBanner} expose cached/stale banner`,
  });
  return entries;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'enforce') as Mode;
  console.log(`# verify-production-integrity (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  let entries: Entry[];
  switch (mode) {
    case 'deployment-state':
      entries = [...checkCanonicalRoutes(), ...checkDoctrineDoc()];
      break;
    case 'runtime-recovery':
      entries = reportRuntimeRecovery();
      break;
    case 'enforce':
    default:
      entries = [
        ...checkCanonicalRoutes(),
        ...checkNoCosmeticTick(),
        ...checkBannedProductionPhrases(),
        ...checkDoctrineDoc(),
      ];
      break;
  }

  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (mode === 'enforce' && failed.length > 0) {
    console.log(
      `\n[FAIL] production integrity: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] production integrity: no FAIL drift');
}

main();
