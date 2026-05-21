#!/usr/bin/env node
/**
 * scripts/verify-operational-convergence.ts
 *
 * Verifies that the canonical operational language in
 * docs/product/canonical-operational-language.md is intact and that
 * institutional surfaces under apps/web/app/** do not leak banned
 * vocabulary (substrate jargon, blockchain semantics, bare-word
 * Verified, etc.).
 *
 * Sub-modes:
 *   pnpm verify:operational-convergence  full sweep
 *   pnpm verify:semantic-integrity       same data, banned-phrase focus
 *   pnpm verify:canonical-language       canonical-doc-only check
 *
 * The verifier is deliberately minimal:
 *   - no feature changes
 *   - no governance additions
 *   - pure read + report
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

type Mode = 'full' | 'semantic-integrity' | 'canonical-language';

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

// ── Canonical-doc presence + shape ─────────────────────────────────────

const REQUIRED_AXES = [
  'Axis 1 · Continuity',
  'Axis 2 · Readiness',
  'Axis 3 · Interruption',
  'Axis 4 · Review ownership',
  'Axis 5 · Deployment progression',
] as const;

const REQUIRED_CANONICAL_STATES = [
  'source_confirmed',
  'evidence_pending',
  'continuity_restored',
  'continuity_interrupted',
  'ready_for_review',
  'pending_review',
  'recently_reviewed',
  'requires_followup',
  'queued',
  'in_review',
  'returned_to_operator',
  'institution_owned',
  'not_started',
  'preparing',
  'awaiting_institution',
  'deployment_ready',
] as const;

function verifyCanonicalDoc(): Entry[] {
  const entries: Entry[] = [];
  const path = resolve(REPO_ROOT, 'docs/product/canonical-operational-language.md');
  if (!existsSync(path)) {
    entries.push({
      level: 'FAIL',
      text: 'canonical-operational-language.md missing',
    });
    return entries;
  }
  const md = readFileSync(path, 'utf8');
  for (const axis of REQUIRED_AXES) {
    if (md.includes(axis)) {
      entries.push({ level: 'OK', text: `canonical doc declares ${axis}` });
    } else {
      entries.push({
        level: 'FAIL',
        text: `canonical doc missing axis declaration: ${axis}`,
      });
    }
  }
  for (const state of REQUIRED_CANONICAL_STATES) {
    if (md.includes(`\`${state}\``)) {
      // OK silently — too many to report individually
    } else {
      entries.push({
        level: 'FAIL',
        text: `canonical doc missing state: \`${state}\``,
      });
    }
  }
  entries.push({
    level: 'OK',
    text: `canonical doc has all ${REQUIRED_CANONICAL_STATES.length} required states`,
  });
  return entries;
}

// ── Banned-phrase scan on institutional surfaces ───────────────────────

interface BannedRule {
  phrase: string;
  reason: string;
}

const BANNED_RULES: readonly BannedRule[] = [
  // Substrate jargon
  { phrase: 'survivabilityScore', reason: 'substrate jargon (allowed in disclosure only)' },
  { phrase: 'dedupeKey', reason: 'substrate jargon (allowed in disclosure only)' },
  { phrase: 'lineageKey', reason: 'substrate jargon (allowed in disclosure only)' },
  { phrase: 'degradationOwnership', reason: 'substrate jargon (allowed in disclosure only)' },
  // Blockchain / trustless semantics
  { phrase: 'trustless', reason: 'blockchain semantics forbidden on institutional surface' },
  { phrase: 'permissionless', reason: 'blockchain semantics forbidden on institutional surface' },
  { phrase: 'decentralized', reason: 'blockchain semantics forbidden on institutional surface' },
  { phrase: 'on-chain', reason: 'blockchain semantics forbidden on institutional surface' },
  { phrase: 'web3', reason: 'blockchain semantics forbidden on institutional surface' },
  // Startup theater
  { phrase: 'AI-powered', reason: 'startup theater (positive positioning claim)' },
  { phrase: 'AI-driven', reason: 'startup theater (positive positioning claim)' },
  { phrase: 'revolutionary', reason: 'startup theater (positive positioning claim)' },
];

function walkAppRoutes(root: string): string[] {
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
        if (e.startsWith('.') || e === 'node_modules') continue;
        // _archive/* trees hold retired code; the canonical-language
        // contract does not apply to them. The verifier excludes
        // them so a stale archived surface never blocks a release.
        if (e === '_archive') continue;
        stack.push(join(cur, e));
      }
    } else if (stat.isFile() && (cur.endsWith('.tsx') || cur.endsWith('.ts'))) {
      out.push(cur);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function verifyBannedPhrases(): Entry[] {
  const entries: Entry[] = [];
  const appDir = resolve(REPO_ROOT, 'apps/web/app');
  const files = walkAppRoutes(appDir);
  if (files.length === 0) {
    entries.push({
      level: 'NOTE',
      text: 'apps/web/app not present; skipped banned-phrase scan',
    });
    return entries;
  }
  let scanned = 0;
  let hits = 0;
  for (const file of files) {
    scanned += 1;
    const src = stripComments(readFileSync(file, 'utf8')).toLowerCase();
    const rel = file.slice(REPO_ROOT.length + 1);
    for (const rule of BANNED_RULES) {
      if (src.includes(rule.phrase.toLowerCase())) {
        hits += 1;
        entries.push({
          level: 'WARN',
          text: `${rel}: contains "${rule.phrase}" (${rule.reason})`,
        });
      }
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `banned-phrase scan: ${scanned} files; ${hits} hit(s) (WARN, not FAIL)`,
  });
  return entries;
}

// ── Bare-word "Verified" detector ─────────────────────────────────────

function verifyNoBareVerified(): Entry[] {
  const entries: Entry[] = [];
  const appDir = resolve(REPO_ROOT, 'apps/web/app');
  const files = walkAppRoutes(appDir);
  if (files.length === 0) {
    entries.push({
      level: 'NOTE',
      text: 'apps/web/app not present; skipped bare-Verified scan',
    });
    return entries;
  }
  // Look for the literal `>Verified<` (a bare-word label between JSX
  // tags). Other forms (`isVerified`, `Verified credential`, etc.)
  // are allowed and not flagged here.
  const PATTERN = />\s*Verified\s*</g;
  let scanned = 0;
  let hits = 0;
  for (const file of files) {
    scanned += 1;
    const src = readFileSync(file, 'utf8');
    if (PATTERN.test(src)) {
      hits += 1;
      const rel = file.slice(REPO_ROOT.length + 1);
      entries.push({
        level: 'FAIL',
        text: `${rel}: bare-word "Verified" label detected (per CLAUDE.md banned-string rule)`,
      });
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `bare-Verified scan: ${scanned} file(s); ${hits} hit(s)`,
  });
  return entries;
}

// ── Convergence-audit doc presence ────────────────────────────────────

function verifyAuditDoc(): Entry[] {
  const path = resolve(REPO_ROOT, 'docs/ops/operational-convergence-audit.md');
  if (!existsSync(path)) {
    return [{ level: 'FAIL', text: 'operational-convergence-audit.md missing' }];
  }
  return [{ level: 'OK', text: 'operational-convergence-audit.md present' }];
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'full') as Mode;
  console.log(`# verify-operational-convergence (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  const entries: Entry[] = [];
  switch (mode) {
    case 'canonical-language':
      entries.push(...verifyCanonicalDoc());
      break;
    case 'semantic-integrity':
      entries.push(...verifyBannedPhrases());
      entries.push(...verifyNoBareVerified());
      break;
    case 'full':
    default:
      entries.push(...verifyCanonicalDoc());
      entries.push(...verifyAuditDoc());
      entries.push(...verifyBannedPhrases());
      entries.push(...verifyNoBareVerified());
      break;
  }

  for (const e of entries) {
    console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  }
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(
      `\n[FAIL] operational convergence: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] operational convergence: no drift detected');
}

main();
