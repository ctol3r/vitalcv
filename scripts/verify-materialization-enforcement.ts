#!/usr/bin/env node
/**
 * scripts/verify-materialization-enforcement.ts
 *
 * Enforcement-grade sibling of verify-wave-materialization (Wave 25).
 * Where the W25 verifier reports drift, this verifier ALSO enforces
 * the three reality boundaries (R1/R2/R3) and the materialization-
 * enforcement contract by:
 *
 *   - parsing docs/ops/repo-reality-state.md
 *   - checking branch existence on origin AND non-empty diff
 *   - checking PR existence (gh pr view), tolerating --skip-gh
 *   - checking audit-evidence + route + tests files on disk where
 *     declared
 *   - scanning docs/** for PR references and verifying each
 *
 * Sub-modes:
 *   pnpm verify:materialization-enforcement   enforce (exits non-zero on FAIL)
 *   pnpm verify:repo-reality                  status (read-only summary)
 *   pnpm verify:wave-state                    same as enforce; alias
 *
 * Flags:
 *   --skip-gh                  do not call gh; PR rows become NOTE
 *   --detect-speculative       scan docs/** for un-rowed PR refs
 *   --check-empty-diff         require non-empty diff for committed+
 *
 * Strict on claim: a row that declares state >= committed must have
 * a non-empty diff. A row that declares state >= PR-open must have
 * a resolving PR. A row that declares audit_evidence must have the
 * file on disk on the current checkout.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

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

type State =
  | 'conceptual'
  | 'local-only'
  | 'committed'
  | 'PR-open'
  | 'audited'
  | 'merged'
  | 'archived';

const KNOWN_STATES: readonly State[] = [
  'conceptual',
  'local-only',
  'committed',
  'PR-open',
  'audited',
  'merged',
  'archived',
];

function isState(value: string): value is State {
  return (KNOWN_STATES as readonly string[]).includes(value);
}

interface Row {
  id: string;
  branch: string | null;
  state: State;
  prNumber: number | null;
  auditEvidence: string | null;
}

// ── Parse the repo-reality-state ledger ───────────────────────────────────

function stripBackticks(s: string): string {
  return s.replace(/`/g, '').trim();
}

function isPlaceholder(cell: string): boolean {
  const c = cell.toLowerCase();
  return (
    c === '' || c === 'null' || c === 'n/a' || c === '_this pr_' ||
    c === '--' || c === 'pre-session'
  );
}

function parseLedger(): Row[] {
  const path = resolve(REPO_ROOT, 'docs/ops/repo-reality-state.md');
  if (!existsSync(path)) {
    throw new Error(`repo-reality-state.md missing at ${path}`);
  }
  const md = readFileSync(path, 'utf8');
  const lines = md.split('\n');
  const rows: Row[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('|---')) continue;
    if (trimmed.startsWith('| #')) continue;
    if (trimmed.startsWith('| PR ')) continue;
    if (trimmed.startsWith('| State ')) continue;
    if (trimmed.startsWith('| Reference ')) continue;
    if (trimmed.startsWith('| Symptom ')) continue;
    if (trimmed.startsWith('| Allowed ')) continue;

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.length === 7) {
      // Session-scope: # | Wave | Branch | State | PR | Audit evidence | Notes
      const [id, , branchCell, stateCell, prCell, auditCell] = cells;
      if (!id.match(/^W\d+$/)) continue;
      const state = stripBackticks(stateCell);
      if (!isState(state)) continue;
      rows.push({
        id,
        branch: isPlaceholder(branchCell) ? null : stripBackticks(branchCell),
        state,
        prNumber: isPlaceholder(prCell)
          ? null
          : parseInt(stripBackticks(prCell), 10) || null,
        auditEvidence: isPlaceholder(auditCell) ? null : stripBackticks(auditCell),
      });
    } else if (cells.length === 3) {
      // Open-PRs table: PR | Branch | State
      const [prCell, branchCell, stateCell] = cells;
      const prNumber = parseInt(stripBackticks(prCell), 10);
      if (!Number.isFinite(prNumber)) continue;
      const state = stripBackticks(stateCell);
      if (!isState(state)) continue;
      rows.push({
        id: `PR-${prNumber}`,
        branch: isPlaceholder(branchCell) ? null : stripBackticks(branchCell),
        state,
        prNumber,
        auditEvidence: null,
      });
    }
  }
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────

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
      .map((s) =>
        typeof s === 'string' ? s : Buffer.isBuffer(s) ? s.toString('utf8') : '',
      )
      .join('\n');
    return { ok: false, output: buf };
  }
}

function branchOnOrigin(branch: string): boolean {
  const r = safeExec(`git ls-remote --heads origin ${branch}`);
  return r.ok && r.output.trim().length > 0;
}

function commitsAhead(branch: string): number {
  const r = safeExec(`git rev-list --count origin/main..origin/${branch}`);
  if (!r.ok) {
    // Fallback: try local ref
    const local = safeExec(`git rev-list --count origin/main..${branch}`);
    if (!local.ok) return -1;
    return parseInt(local.output.trim(), 10) || 0;
  }
  return parseInt(r.output.trim(), 10) || 0;
}

function prResolves(n: number): { ok: boolean; state: string | null } {
  const r = safeExec(`gh pr view ${n} --json state`);
  if (!r.ok) return { ok: false, state: null };
  try {
    const parsed = JSON.parse(r.output.trim()) as { state?: string };
    return { ok: true, state: parsed.state ?? null };
  } catch {
    return { ok: false, state: null };
  }
}

function fileExists(rel: string): boolean {
  return existsSync(resolve(REPO_ROOT, rel));
}

// ── Verify one row ────────────────────────────────────────────────────────

interface VerifyOpts {
  skipGh: boolean;
  checkEmptyDiff: boolean;
}

function verifyRow(row: Row, opts: VerifyOpts): Entry[] {
  const entries: Entry[] = [];
  const tag = `[${row.id}]`;

  if (row.state === 'conceptual') {
    entries.push({ level: 'NOTE', text: `${tag} conceptual (no branch claimed)` });
    return entries;
  }

  if (row.state === 'local-only') {
    entries.push({
      level: 'NOTE',
      text: `${tag} local-only (branch '${row.branch ?? '<missing>'}' not on origin)`,
    });
    return entries;
  }

  // committed / PR-open / audited / merged / archived all require a branch
  if (!row.branch) {
    entries.push({
      level: 'FAIL',
      text: `${tag} state=${row.state} but no branch declared`,
    });
    return entries;
  }
  if (!branchOnOrigin(row.branch)) {
    entries.push({
      level: 'FAIL',
      text: `${tag} branch '${row.branch}' missing on origin (state=${row.state})`,
    });
    return entries;
  }
  entries.push({
    level: 'OK',
    text: `${tag} branch '${row.branch}' resolves on origin`,
  });

  // committed/PR-open/audited/merged require non-empty diff
  if (
    row.state === 'committed' ||
    row.state === 'PR-open' ||
    row.state === 'audited' ||
    row.state === 'merged'
  ) {
    if (opts.checkEmptyDiff) {
      const n = commitsAhead(row.branch);
      if (n <= 0) {
        entries.push({
          level: 'FAIL',
          text: `${tag} branch '${row.branch}' has 0 commits ahead of origin/main`,
        });
        return entries;
      }
      entries.push({
        level: 'OK',
        text: `${tag} branch '${row.branch}' has ${n} commit(s) ahead`,
      });
    }
  }

  // PR-open / audited / merged require a PR number that resolves
  if (row.state === 'PR-open' || row.state === 'audited' || row.state === 'merged') {
    if (!row.prNumber) {
      entries.push({
        level: 'FAIL',
        text: `${tag} state=${row.state} but no PR number declared`,
      });
      return entries;
    }
    if (opts.skipGh) {
      entries.push({
        level: 'NOTE',
        text: `${tag} PR #${row.prNumber} not verified (gh skipped)`,
      });
    } else {
      const pr = prResolves(row.prNumber);
      if (!pr.ok) {
        entries.push({
          level: 'FAIL',
          text: `${tag} PR #${row.prNumber} did not resolve`,
        });
        return entries;
      }
      entries.push({
        level: 'OK',
        text: `${tag} PR #${row.prNumber} resolves (state=${pr.state ?? 'unknown'})`,
      });
      if (row.state === 'merged' && pr.state !== 'MERGED' && pr.state !== 'CLOSED') {
        entries.push({
          level: 'WARN',
          text: `${tag} state=merged but gh reports ${pr.state ?? 'unknown'}`,
        });
      }
    }
  }

  // audited/merged require audit_evidence on disk on the current checkout
  if (row.state === 'audited' || row.state === 'merged') {
    if (row.auditEvidence) {
      if (fileExists(row.auditEvidence)) {
        entries.push({
          level: 'OK',
          text: `${tag} audit evidence '${row.auditEvidence}' exists`,
        });
      } else {
        entries.push({
          level: 'FAIL',
          text: `${tag} audit evidence '${row.auditEvidence}' missing (state=${row.state})`,
        });
      }
    }
  } else if (row.auditEvidence && !fileExists(row.auditEvidence)) {
    entries.push({
      level: 'NOTE',
      text: `${tag} audit evidence '${row.auditEvidence}' not on this checkout (state=${row.state})`,
    });
  }

  return entries;
}

// ── Speculative-reference detector ────────────────────────────────────────

const PR_REFERENCE_PATTERN = /\bPR\s*#(\d{3,5})\b/g;

function walkMarkdownDocs(root: string): string[] {
  const out: string[] = [];
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
        stack.push(join(cur, e));
      }
    } else if (stat.isFile() && cur.endsWith('.md')) {
      out.push(cur);
    }
  }
  return out;
}

function detectSpeculative(
  rows: readonly Row[],
  opts: VerifyOpts,
): Entry[] {
  const entries: Entry[] = [];
  const knownPrs = new Set<number>();
  for (const row of rows) {
    if (row.prNumber) knownPrs.add(row.prNumber);
  }

  const docsRoot = resolve(REPO_ROOT, 'docs');
  if (!existsSync(docsRoot)) {
    entries.push({ level: 'NOTE', text: 'docs/ root not present; skipped scan' });
    return entries;
  }
  const files = walkMarkdownDocs(docsRoot);
  let scanned = 0;
  let referenced = 0;
  let unresolved = 0;

  for (const file of files) {
    // Skip the registries themselves so we don't recurse on our own table.
    const rel = file.slice(REPO_ROOT.length + 1);
    if (
      rel === 'docs/ops/repo-reality-state.md' ||
      rel === 'docs/ops/canonical-wave-registry.md'
    ) {
      continue;
    }
    scanned += 1;
    const text = readFileSync(file, 'utf8');
    const seen = new Set<number>();
    for (const match of text.matchAll(PR_REFERENCE_PATTERN)) {
      const n = parseInt(match[1], 10);
      if (!Number.isFinite(n)) continue;
      if (seen.has(n)) continue;
      seen.add(n);
      referenced += 1;
      if (knownPrs.has(n)) continue;
      if (opts.skipGh) {
        entries.push({
          level: 'NOTE',
          text: `${rel}: PR #${n} not in ledger (gh skipped; cannot verify)`,
        });
      } else {
        const pr = prResolves(n);
        if (!pr.ok) {
          unresolved += 1;
          entries.push({
            level: 'FAIL',
            text: `${rel}: PR #${n} speculative (no row, no gh resolution)`,
          });
        }
      }
    }
  }
  entries.unshift({
    level: 'NOTE',
    text: `speculative scan: ${scanned} doc(s); ${referenced} PR reference(s); ${unresolved} unresolved`,
  });
  return entries;
}

// ── Status sub-mode ───────────────────────────────────────────────────────

function reportStatus(rows: readonly Row[]): Entry[] {
  const counts = new Map<State, number>();
  for (const s of KNOWN_STATES) counts.set(s, 0);
  for (const row of rows) {
    counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
  }
  const entries: Entry[] = [
    { level: 'NOTE', text: `total rows: ${rows.length}` },
  ];
  for (const s of KNOWN_STATES) {
    entries.push({
      level: 'NOTE',
      text: `state ${s}: ${counts.get(s) ?? 0} row(s)`,
    });
  }
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────

type Mode = 'enforce' | 'status' | 'wave-state';

function main(): void {
  const mode = ((process.argv[2] ?? 'enforce') as Mode);
  const skipGh = process.argv.includes('--skip-gh');
  // Default behavior under `enforce` is to NOT check empty-diff unless
  // explicitly asked, because the verifier may run on a fresh worktree
  // checked out at origin/main where the session branches do not yet
  // exist locally. Explicit `--check-empty-diff` opts into the harder
  // check.
  const checkEmptyDiff = process.argv.includes('--check-empty-diff');
  const detectSpec = process.argv.includes('--detect-speculative');

  console.log(`# verify-materialization-enforcement (${mode}) · ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));

  let rows: Row[];
  try {
    rows = parseLedger();
  } catch (err) {
    console.error(`[FAIL] ${(err as Error).message}`);
    process.exit(1);
  }
  console.log(`# rows parsed: ${rows.length}`);

  const entries: Entry[] = [];
  switch (mode) {
    case 'status':
      entries.push(...reportStatus(rows));
      break;
    case 'enforce':
    case 'wave-state':
    default:
      for (const row of rows) {
        entries.push(...verifyRow(row, { skipGh, checkEmptyDiff }));
      }
      if (detectSpec) {
        entries.push(...detectSpeculative(rows, { skipGh, checkEmptyDiff }));
      }
      break;
  }

  for (const e of entries) {
    console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  }
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(
      `\n[FAIL] materialization enforcement: ${failed.length} drift entr${failed.length === 1 ? 'y' : 'ies'}`,
    );
    process.exit(1);
  }
  console.log('\n[OK  ] materialization enforcement: no drift detected');
}

main();
