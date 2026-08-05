#!/usr/bin/env tsx
/**
 * check-audit-coverage — M1-2 audit-coverage regression gate.
 *
 * Doctrine (anti-drift rule #2): "Every mutating action writes an AuditEvent
 * before 2xx — no exceptions, ever."
 *
 * This gate does NOT (yet) prove every one of the ~260 mutating routes audits —
 * that route-by-route remediation is tracked in docs/security/audit-coverage.md.
 * What it DOES do is FREEZE the current gap: it fails CI if a route file with
 * mutating handlers (POST/PUT/PATCH/DELETE) has no durable-audit signal AND is
 * not on the reviewed baseline. So no NEW unaudited mutation can silently land,
 * and the baseline can only shrink (a file removed from it once it audits).
 *
 * Durable-audit signal = a call that writes a persistent AuditEvent row
 * (prisma.auditEvent.create / auditIssuance / auditRevocation / auditDecision /
 * auditPresentation), not merely the in-memory appendAuditEvent ledger.
 *
 * Usage:  node --experimental-strip-types scripts/check-audit-coverage.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const ROUTES_DIR = join('apps', 'api', 'backend', 'src', 'routes');
const BASELINE_PATH = join('apps', 'api', 'backend', 'audit-coverage-baseline.json');

const MUTATING = /\b(router|app)\.(post|put|patch|delete)\s*\(/;
/*
 * Durable audit signals (persistent AuditEvent row). Intentionally EXCLUDES the
 * bare in-memory `appendAuditEvent` ledger, which is not a durable audit row.
 *
 * `writeActivationAudit` (2026-08-05) is a named helper that provably calls
 * `prisma.auditEvent.create`. It is recognised here because the alternative was
 * worse: this scan only reads ROUTE files, so requiring the write to appear
 * textually in the route pushes it OUT of the service where the mutation
 * happens — and therefore out of any transaction that could make a successful
 * mutation without its receipt impossible.
 *
 * A name in this list is a claim that must stay true. The real guard is a test
 * that a failing audit write blocks the 2xx; see
 * routes/__tests__/clinicianProfileRoutes.test.ts ("an audit failure prevents
 * a 2xx"). Adding a name here without such a test would make this gate a
 * formality.
 */
const DURABLE_AUDIT =
  /(auditEvent\.create|AuditEvent\.create|auditIssuance|auditRevocation|auditDecision|auditPresentation|recordAuditEvent|writeAuditEvent|writeActivationAudit)\b/;

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
      if (e.name === '__tests__') continue;
      out = out.concat(walk(p));
    } else if (/\.ts$/.test(e.name) && !/\.(test|spec|d)\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const absRoutes = join(repoRoot, ROUTES_DIR);
try {
  statSync(absRoutes);
} catch {
  console.error(`check-audit-coverage: routes dir not found: ${ROUTES_DIR}`);
  process.exit(2);
}

let baseline: Set<string>;
try {
  const parsed = JSON.parse(readFileSync(join(repoRoot, BASELINE_PATH), 'utf8'));
  baseline = new Set<string>(parsed.baselineGapFiles ?? []);
} catch {
  console.error(`check-audit-coverage: cannot read baseline ${BASELINE_PATH}`);
  process.exit(2);
}

const files = walk(absRoutes);
const currentGaps: string[] = [];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!MUTATING.test(src)) continue;
  if (DURABLE_AUDIT.test(src)) continue;
  currentGaps.push(relative(absRoutes, f));
}

const newGaps = currentGaps.filter((f) => !baseline.has(f));
// Files on the baseline that now audit (or were removed) — baseline should shrink.
const resolved = [...baseline].filter((f) => !currentGaps.includes(f));

console.log(`check-audit-coverage — ${files.length} route files, ${currentGaps.length} without durable audit (baseline: ${baseline.size}).`);

if (resolved.length > 0) {
  console.log(`\n✓ ${resolved.length} baseline file(s) now audit or were removed — trim them from the baseline:`);
  resolved.forEach((f) => console.log(`    - ${f}`));
}

if (newGaps.length > 0) {
  console.error(`\nFAIL — ${newGaps.length} NEW mutating route file(s) with no durable AuditEvent write:\n`);
  newGaps.forEach((f) => {
    console.error(`  apps/api/backend/src/routes/${f}`);
  });
  console.error('\nEvery mutating action must write a durable AuditEvent (prisma.auditEvent.create)');
  console.error('BEFORE returning 2xx. Add the audit write, or — if these POST routes are pure');
  console.error('queries (no state mutation) — document that and add to the baseline with review.');
  console.error('See docs/security/audit-coverage.md.');
  process.exit(1);
}

console.log('\nPASS — no new unaudited mutating route files beyond the reviewed baseline.');
process.exit(0);
