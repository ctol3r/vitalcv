#!/usr/bin/env node
/**
 * scripts/verify-wave-materialization.ts
 *
 * Reads `docs/ops/canonical-wave-registry.md` and verifies each row
 * against the actual repo state. Reports:
 *
 *   - [OK]   row's branch + PR + audit_target resolve
 *   - [NOTE] row is conceptualized (no branch yet) -- explicit, tolerated
 *   - [WARN] row's lifecycle is below what its evidence supports
 *   - [FAIL] row claims a state it cannot satisfy:
 *             - lifecycle >= implemented but branch missing locally and on remote
 *             - lifecycle >= pr_opened but PR number does not resolve via `gh pr view`
 *             - lifecycle >= audited but audit_target file does not exist
 *
 * Sub-modes:
 *   pnpm verify:wave-reality       full sweep, exits non-zero on FAIL
 *   pnpm verify:materialization    same data, machine-readable summary
 *   pnpm verify:audit-targets      audit_target columns only
 *
 * The script is deliberately minimal:
 *   - no protocol changes
 *   - no fixtures
 *   - no governance expansion
 *   - pure read + report
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Mode = 'full' | 'materialization' | 'audit-targets';

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

type Lifecycle =
  | 'conceptualized'
  | 'implemented'
  | 'pr_opened'
  | 'audited'
  | 'merged'
  | 'archived';

interface RegistryRow {
  id: string;
  branch: string | null;
  prNumber: number | null;
  lifecycle: Lifecycle;
  auditTarget: string | null;
  route: string | null;
  tests: string | null;
}

const KNOWN_LIFECYCLES: readonly Lifecycle[] = [
  'conceptualized',
  'implemented',
  'pr_opened',
  'audited',
  'merged',
  'archived',
];

function isLifecycle(value: string): value is Lifecycle {
  return (KNOWN_LIFECYCLES as readonly string[]).includes(value);
}

// ── Parse the canonical wave registry ──────────────────────────────────────

function stripBackticks(s: string): string {
  return s.replace(/`/g, '').trim();
}

function isPlaceholder(cell: string): boolean {
  const c = cell.toLowerCase();
  return c === '' || c === 'null' || c === 'n/a' || c === '_this pr_' || c === '--' || c === 'pre-session';
}

function parseRegistry(): RegistryRow[] {
  const path = resolve(REPO_ROOT, 'docs/ops/canonical-wave-registry.md');
  if (!existsSync(path)) {
    throw new Error(`canonical wave registry missing at ${path}`);
  }
  const md = readFileSync(path, 'utf8');
  const lines = md.split('\n');
  const rows: RegistryRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // Match table rows that start with a digit-or-W identifier, then |
    // We match rows that look like the session-waves table:
    //   | W22 | Operational Waste Visibility | `feat/...` | 402 | `pr_opened` | ... |
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('|---')) continue;
    if (trimmed.startsWith('| #')) continue;
    if (trimmed.startsWith('| PR ')) continue;
    if (trimmed.startsWith('| Reference')) continue;
    if (trimmed.startsWith('| State ')) continue;
    if (trimmed.startsWith('| Column ')) continue;
    if (trimmed.startsWith('| Allowed ')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1) // drop the leading + trailing empty strings
      .map((c) => c.trim());

    // We accept two table shapes:
    //   session: 7 cells (id, wave name, branch, pr, lifecycle, audit, route, tests) -- 8 actually
    //   prior:   4 cells (PR number, branch, lifecycle, notes)
    if (cells.length === 8) {
      const [id, , branchCell, prCell, lifecycleCell, auditCell, routeCell, testsCell] = cells;
      if (!id.match(/^W\d+$/)) continue;
      const lifecycle = stripBackticks(lifecycleCell);
      if (!isLifecycle(lifecycle)) continue;
      rows.push({
        id,
        branch: isPlaceholder(branchCell) ? null : stripBackticks(branchCell),
        prNumber: isPlaceholder(prCell)
          ? null
          : parseInt(stripBackticks(prCell), 10) || null,
        lifecycle,
        auditTarget: isPlaceholder(auditCell) ? null : stripBackticks(auditCell),
        route: isPlaceholder(routeCell) ? null : stripBackticks(routeCell),
        tests: isPlaceholder(testsCell) ? null : stripBackticks(testsCell),
      });
    } else if (cells.length === 4) {
      const [prCell, branchCell, lifecycleCell] = cells;
      const prNumber = parseInt(stripBackticks(prCell), 10);
      if (!Number.isFinite(prNumber)) continue;
      const lifecycle = stripBackticks(lifecycleCell);
      if (!isLifecycle(lifecycle)) continue;
      rows.push({
        id: `PR-${prNumber}`,
        branch: isPlaceholder(branchCell) ? null : stripBackticks(branchCell),
        prNumber,
        lifecycle,
        auditTarget: null,
        route: null,
        tests: null,
      });
    }
  }
  return rows;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function safeExec(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    const buf = [e.stdout, e.stderr]
      .map((s) => (typeof s === 'string' ? s : Buffer.isBuffer(s) ? s.toString('utf8') : ''))
      .join('\n');
    return { ok: false, output: buf };
  }
}

function branchExists(branch: string): boolean {
  // Check local first, then remote.
  const local = safeExec(`git rev-parse --verify ${branch}`);
  if (local.ok) return true;
  const remote = safeExec(`git ls-remote --heads origin ${branch}`);
  if (!remote.ok) return false;
  return remote.output.trim().length > 0;
}

function prExists(n: number): { ok: boolean; state: string | null } {
  // Use gh; tolerate gh not being on PATH (CI environments etc).
  const cli = safeExec(`gh pr view ${n} --json state,number`);
  if (!cli.ok) return { ok: false, state: null };
  try {
    const parsed = JSON.parse(cli.output.trim()) as { state?: string };
    return { ok: true, state: parsed.state ?? null };
  } catch {
    return { ok: false, state: null };
  }
}

function fileExists(rel: string): boolean {
  return existsSync(resolve(REPO_ROOT, rel));
}

// ── Verification rules per lifecycle ───────────────────────────────────

function verifyRow(row: RegistryRow, opts: { skipGh?: boolean } = {}): Entry[] {
  const entries: Entry[] = [];
  const tag = `[${row.id}]`;

  // conceptualized -- no branch required
  if (row.lifecycle === 'conceptualized') {
    entries.push({ level: 'NOTE', text: `${tag} conceptualized (no branch claimed)` });
    return entries;
  }

  // implemented/pr_opened/audited/merged -- branch is required (unless archived)
  if (row.lifecycle !== 'archived') {
    if (!row.branch) {
      entries.push({
        level: 'FAIL',
        text: `${tag} lifecycle=${row.lifecycle} but no branch declared`,
      });
      return entries;
    }
    if (!branchExists(row.branch)) {
      entries.push({
        level: 'FAIL',
        text: `${tag} branch '${row.branch}' does not exist (lifecycle=${row.lifecycle})`,
      });
      return entries;
    }
    entries.push({ level: 'OK', text: `${tag} branch '${row.branch}' resolves` });
  }

  // pr_opened/audited/merged -- PR number is required
  if (row.lifecycle === 'pr_opened' || row.lifecycle === 'audited' || row.lifecycle === 'merged') {
    if (!row.prNumber) {
      entries.push({
        level: 'FAIL',
        text: `${tag} lifecycle=${row.lifecycle} but no PR number declared`,
      });
      return entries;
    }
    if (opts.skipGh) {
      entries.push({
        level: 'NOTE',
        text: `${tag} PR #${row.prNumber} not verified (gh unavailable / skipped)`,
      });
    } else {
      const pr = prExists(row.prNumber);
      if (!pr.ok) {
        entries.push({
          level: 'FAIL',
          text: `${tag} PR #${row.prNumber} did not resolve via gh`,
        });
        return entries;
      }
      entries.push({
        level: 'OK',
        text: `${tag} PR #${row.prNumber} resolves (state=${pr.state ?? 'unknown'})`,
      });
      if (row.lifecycle === 'merged' && pr.state !== 'MERGED' && pr.state !== 'CLOSED') {
        entries.push({
          level: 'WARN',
          text: `${tag} lifecycle=merged but gh reports state=${pr.state ?? 'unknown'}`,
        });
      }
    }
  }

  // audited -- audit target file must exist
  if (row.lifecycle === 'audited' || row.lifecycle === 'merged') {
    if (row.auditTarget && !fileExists(row.auditTarget)) {
      entries.push({
        level: 'FAIL',
        text: `${tag} audit target '${row.auditTarget}' does not exist`,
      });
    } else if (row.auditTarget) {
      entries.push({ level: 'OK', text: `${tag} audit target '${row.auditTarget}' exists` });
    }
  }

  // Route + tests are advisory; we report if declared but missing.
  if (row.route && !fileExists(row.route)) {
    entries.push({
      level: 'WARN',
      text: `${tag} route '${row.route}' declared but not on disk`,
    });
  }
  if (row.tests && !fileExists(row.tests)) {
    entries.push({
      level: 'WARN',
      text: `${tag} tests '${row.tests}' declared but not on disk`,
    });
  }

  return entries;
}

// ── Audit-targets sub-mode (just the doc-path checks) ──────────────────

function reportAuditTargets(rows: readonly RegistryRow[]): Entry[] {
  const entries: Entry[] = [];
  for (const row of rows) {
    if (!row.auditTarget) continue;
    const present = fileExists(row.auditTarget);
    // Strict on claim: only `audited` / `merged` lifecycles require
    // the audit target to be on the current working tree. `pr_opened`
    // rows reference targets that may live on the PR branch itself;
    // those count as NOTE (declared but not on this checkout) when
    // absent, not FAIL.
    if (present) {
      entries.push({
        level: 'OK',
        text: `[${row.id}] audit target '${row.auditTarget}'`,
      });
    } else if (row.lifecycle === 'audited' || row.lifecycle === 'merged') {
      entries.push({
        level: 'FAIL',
        text: `[${row.id}] audit target '${row.auditTarget}' missing (lifecycle=${row.lifecycle})`,
      });
    } else {
      entries.push({
        level: 'NOTE',
        text: `[${row.id}] audit target '${row.auditTarget}' not on this checkout (lifecycle=${row.lifecycle})`,
      });
    }
  }
  return entries;
}

// ── Main ───────────────────────────────────────────────────────────────

function main(): void {
  const mode = ((process.argv[2] ?? 'full') as Mode);
  const skipGh = process.argv.includes('--skip-gh');
  console.log(`# verify-wave-materialization (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  let rows: RegistryRow[];
  try {
    rows = parseRegistry();
  } catch (err) {
    console.error(`[FAIL] ${(err as Error).message}`);
    process.exit(1);
  }
  console.log(`# registry rows parsed: ${rows.length}`);

  const entries: Entry[] = [];
  switch (mode) {
    case 'audit-targets':
      entries.push(...reportAuditTargets(rows));
      break;
    case 'materialization':
    case 'full':
    default:
      for (const row of rows) {
        entries.push(...verifyRow(row, { skipGh }));
      }
      break;
  }

  for (const e of entries) {
    console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  }
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n[FAIL] reality synchronization: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`);
    process.exit(1);
  }
  console.log('\n[OK  ] reality synchronization: no drift detected');
}

main();
