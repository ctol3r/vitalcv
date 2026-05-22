#!/usr/bin/env node
/**
 * scripts/verify-deterministic-confidence.ts
 *
 * Wave 39: enforces deterministic posture computation.
 *
 *   1. ConsoleWrapper.tsx does NOT contain a manifest.tier
 *      short-circuit (`manifest?.tier === 'decision_grade'`)
 *   2. ConsoleWrapper.tsx declares the required-lane constant
 *      `REQUIRED_LANES_FOR_DECISION_GRADE`
 *   3. EmployerDecisionConsole.tsx uses the four bounded labels
 *      (no `READY TO PROCEED`, no `PROCEED WITH REVIEW`, no bare
 *      `BLOCKED`, no `NEEDS MORE DATA`)
 *   4. ConsoleWrapper.tsx does NOT contain `Clear to proceed` or
 *      `Credentials verified` or `proceed with a head start`
 *   5. The doctrine doc exists and enumerates the required-lane list
 *
 * Sub-modes:
 *   enforce              default; exit non-zero on FAIL
 *   report               scan + summary; never exit non-zero
 *   required-lanes-only  check the required-lane constant only
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Mode = 'enforce' | 'report' | 'required-lanes-only';

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

const CONSOLE_WRAPPER = 'apps/web/app/review/[entityId]/ConsoleWrapper.tsx';
const EMPLOYER_DECISION_CONSOLE = 'apps/web/components/review/EmployerDecisionConsole.tsx';
const DOCTRINE_DOC = 'docs/product/deterministic-confidence-enforcement.md';

const REQUIRED_LANES = [
  'nppes_identity',
  'oig_exclusions',
  'state_license',
  'employment_history',
] as const;

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

// ── Check 1 · No manifest-tier short-circuit ─────────────────────────────

function checkNoManifestTierShortcut(): Entry[] {
  const src = read(CONSOLE_WRAPPER);
  if (!src) {
    return [{ level: 'FAIL', text: `${CONSOLE_WRAPPER} missing` }];
  }
  const stripped = stripComments(src);
  const patterns = [
    /manifest\?\.tier\s*===\s*['"]decision_grade['"]/,
    /manifest\.tier\s*===\s*['"]decision_grade['"]/,
    /\.tier\s*===\s*['"]decision_grade['"][^?]*\?[^:]*['"]decision_grade['"]/,
  ];
  const entries: Entry[] = [];
  for (const re of patterns) {
    if (re.test(stripped)) {
      entries.push({
        level: 'FAIL',
        text: `${CONSOLE_WRAPPER}: manifest-tier short-circuit detected (${re.toString()})`,
      });
    }
  }
  if (entries.length === 0) {
    entries.push({ level: 'OK', text: `${CONSOLE_WRAPPER}: no manifest-tier short-circuit` });
  }
  return entries;
}

// ── Check 2 · Required-lane constant declared ───────────────────────────

function checkRequiredLaneConstant(): Entry[] {
  const src = read(CONSOLE_WRAPPER);
  if (!src) {
    return [{ level: 'FAIL', text: `${CONSOLE_WRAPPER} missing` }];
  }
  const entries: Entry[] = [];
  if (!/REQUIRED_LANES_FOR_DECISION_GRADE/.test(src)) {
    entries.push({
      level: 'FAIL',
      text: `${CONSOLE_WRAPPER}: REQUIRED_LANES_FOR_DECISION_GRADE constant not declared`,
    });
    return entries;
  }
  entries.push({
    level: 'OK',
    text: `${CONSOLE_WRAPPER}: REQUIRED_LANES_FOR_DECISION_GRADE declared`,
  });
  for (const lane of REQUIRED_LANES) {
    if (!src.includes(`'${lane}'`)) {
      entries.push({
        level: 'FAIL',
        text: `${CONSOLE_WRAPPER}: REQUIRED_LANES_FOR_DECISION_GRADE missing lane "${lane}"`,
      });
    }
  }
  return entries;
}

// ── Check 3 · Bounded decision labels in EmployerDecisionConsole ────────

function checkBoundedDecisionLabels(): Entry[] {
  const src = read(EMPLOYER_DECISION_CONSOLE);
  if (!src) {
    return [{ level: 'FAIL', text: `${EMPLOYER_DECISION_CONSOLE} missing` }];
  }
  const stripped = stripComments(src);
  const entries: Entry[] = [];
  const banned = [
    { pattern: /label:\s*['"]READY TO PROCEED['"]/, label: '"READY TO PROCEED"' },
    { pattern: /label:\s*['"]PROCEED WITH REVIEW['"]/, label: '"PROCEED WITH REVIEW"' },
    { pattern: /label:\s*['"]BLOCKED['"]/, label: 'bare "BLOCKED"' },
    { pattern: /label:\s*['"]NEEDS MORE DATA['"]/, label: '"NEEDS MORE DATA"' },
  ];
  for (const rule of banned) {
    if (rule.pattern.test(stripped)) {
      entries.push({
        level: 'FAIL',
        text: `${EMPLOYER_DECISION_CONSOLE}: contains ${rule.label} — replace with bounded label that names institution review`,
      });
    }
  }
  if (entries.length === 0) {
    entries.push({
      level: 'OK',
      text: `${EMPLOYER_DECISION_CONSOLE}: uses bounded decision labels`,
    });
  }
  return entries;
}

// ── Check 4 · No "Clear to proceed" / "Credentials verified" copy ───────

function checkNoProceedCopy(): Entry[] {
  const src = read(CONSOLE_WRAPPER);
  if (!src) {
    return [{ level: 'FAIL', text: `${CONSOLE_WRAPPER} missing` }];
  }
  const stripped = stripComments(src);
  const entries: Entry[] = [];
  const banned = [
    { pattern: /Clear to proceed\./, label: '"Clear to proceed."' },
    { pattern: /Credentials verified\./, label: '"Credentials verified."' },
    { pattern: /proceed with a head start/, label: '"proceed with a head start"' },
  ];
  for (const rule of banned) {
    if (rule.pattern.test(stripped)) {
      entries.push({
        level: 'FAIL',
        text: `${CONSOLE_WRAPPER}: contains ${rule.label}`,
      });
    }
  }
  if (entries.length === 0) {
    entries.push({
      level: 'OK',
      text: `${CONSOLE_WRAPPER}: no decision-grade proceed copy`,
    });
  }
  return entries;
}

// ── Check 5 · Doctrine doc shape ────────────────────────────────────────

function checkDoctrineDoc(): Entry[] {
  const md = read(DOCTRINE_DOC);
  if (!md) {
    return [{ level: 'FAIL', text: `${DOCTRINE_DOC} missing` }];
  }
  const entries: Entry[] = [
    { level: 'OK', text: `${DOCTRINE_DOC} present` },
  ];
  for (const lane of REQUIRED_LANES) {
    if (!md.includes(`\`${lane}\``)) {
      entries.push({
        level: 'FAIL',
        text: `${DOCTRINE_DOC}: required-lane list missing \`${lane}\``,
      });
    }
  }
  return entries;
}

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const mode = (process.argv[2] ?? 'enforce') as Mode;
  console.log(`# verify-deterministic-confidence (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  let entries: Entry[];
  switch (mode) {
    case 'required-lanes-only':
      entries = [
        ...checkRequiredLaneConstant(),
        ...checkDoctrineDoc(),
      ];
      break;
    case 'report':
    case 'enforce':
    default:
      entries = [
        ...checkNoManifestTierShortcut(),
        ...checkRequiredLaneConstant(),
        ...checkBoundedDecisionLabels(),
        ...checkNoProceedCopy(),
        ...checkDoctrineDoc(),
      ];
      break;
  }

  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (mode !== 'report' && failed.length > 0) {
    console.log(
      `\n[FAIL] deterministic confidence: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] deterministic confidence: no FAIL drift');
}

main();
