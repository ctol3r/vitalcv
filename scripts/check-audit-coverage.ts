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
// Durable audit signals (persistent AuditEvent row). Intentionally EXCLUDES the
// bare in-memory `appendAuditEvent` ledger, which is not a durable audit row.
const DURABLE_AUDIT =
  /(auditEvent\.create|AuditEvent\.create|auditIssuance|auditRevocation|auditDecision|auditPresentation|recordAuditEvent|writeAuditEvent)\b/;

/**
 * Routes may delegate the write to a shared writer instead of calling prisma
 * inline — `recordStart()` pairs a StartAttestation with its START_ATTESTED row
 * in one transaction, precisely so a caller cannot record one without the other.
 * A per-file scan cannot see through that call, and would read the delegation as
 * a NEW gap. It is the opposite: the pairing is stronger than an inline write.
 *
 * This is NOT a name allowlist. Each delegate names its module, and:
 *   1. the file must actually IMPORT from that module — `recordStart` is not a
 *      unique name (routes/activation.ts calls an unrelated one from
 *      services/activation/startEventService, which does not audit, and must
 *      keep counting as a gap); and
 *   2. the module must itself carry a durable signal — so gutting the writer
 *      stops it counting as coverage and every delegating route goes red.
 *
 * The guarantee is a closure, not a promise. `startWriter.test.ts` holds the
 * same line from the other side, behaviourally.
 */
const DELEGATED_AUDIT_WRITERS: ReadonlyArray<{
  call: RegExp;
  importSpecifier: string;
  module: string;
}> = [
  {
    call: /\brecordStart\s*\(/,
    importSpecifier: 'services/hiring/startWriter',
    module: join('apps', 'api', 'backend', 'src', 'services', 'hiring', 'startWriter.ts'),
  },
  // ADR 0007 start-writer succession: the canonical application-bound start
  // command pairs the StartAttestation with START_ATTESTED + START_RECORDED in
  // one transaction. Same closure as recordStart above — the import identifies
  // the writer, and the module itself must carry the durable signal.
  {
    call: /\bconfirmStartByAcceptance\s*\(/,
    importSpecifier: 'services/activation/applicationStartCommandService',
    module: join('apps', 'api', 'backend', 'src', 'services', 'activation', 'applicationStartCommandService.ts'),
  },
  {
    call: /\bconfirmApplicationStart\s*\(/,
    importSpecifier: 'services/activation/applicationStartCommandService',
    module: join('apps', 'api', 'backend', 'src', 'services', 'activation', 'applicationStartCommandService.ts'),
  },
];

/** True when the file delegates to a writer that it imports and that provably audits. */
function delegatesToAuditingWriter(src: string): boolean {
  return DELEGATED_AUDIT_WRITERS.some(({ call, importSpecifier, module }) => {
    if (!call.test(src)) return false;
    // The call alone is ambiguous; the import is what identifies the writer.
    if (!src.includes(importSpecifier)) return false;
    try {
      return DURABLE_AUDIT.test(readFileSync(join(repoRoot, module), 'utf8'));
    } catch {
      // Writer moved or deleted — the delegation proves nothing. Fail closed.
      return false;
    }
  });
}

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
  if (delegatesToAuditingWriter(src)) continue;
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
