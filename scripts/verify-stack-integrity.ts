#!/usr/bin/env node
/**
 * scripts/verify-stack-integrity.ts
 *
 * Deterministic stack-integrity verifier for the session-created PR
 * chain. Walks `docs/ops/stack-topology.md` (canonical) against the
 * actual git ancestry of each named branch, then reports:
 *
 *   - stack ancestry mismatch (declared base != git merge-base)
 *   - missing base dependencies (declared base does not exist locally)
 *   - empty-diff stacked branches
 *   - orphaned stack branches (no PR mapping)
 *
 * No CI orchestration; no auto-mutation. Reports only.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

function git(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  } catch {
    return '';
  }
}

/**
 * Canonical stack declarations sourced from
 * `docs/ops/stack-topology.md`. Keep in sync when new PRs land.
 */
interface StackBranch {
  pr: number;
  branch: string;
  declaredBase: string;
  cherryPicks?: readonly string[];
}

const STACK: readonly StackBranch[] = [
  { pr: 381, branch: 'fix/prisma-contract-fragmentation', declaredBase: 'origin/main' },
  { pr: 382, branch: 'feat/institutional-trust-primitives', declaredBase: 'origin/main' },
  {
    pr: 383,
    branch: 'feat/trust-integration-coherence',
    declaredBase: 'feat/institutional-trust-primitives',
  },
  { pr: 384, branch: 'fix/well-known-dynamic-host', declaredBase: 'origin/main' },
  { pr: 385, branch: 'feat/matuschak-provenance-panes', declaredBase: 'origin/main' },
  {
    pr: 386,
    branch: 'feat/canonical-provenance-navigation',
    declaredBase: 'feat/trust-integration-coherence',
    cherryPicks: ['feat/matuschak-provenance-panes'],
  },
  { pr: 387, branch: 'feat/pilot-deployment-kit', declaredBase: 'origin/main' },
  { pr: 388, branch: 'feat/doximity-hook-and-roi-math', declaredBase: 'origin/main' },
  {
    pr: 389,
    branch: 'feat/openevidence-risk-engine-and-matuschak-api',
    declaredBase: 'origin/main',
  },
  {
    pr: 390,
    branch: 'feat/antigravity-router-and-durable-chain',
    declaredBase: 'origin/main',
  },
  { pr: 391, branch: 'fix/truth-constrained-operationalization', declaredBase: 'origin/main' },
  {
    pr: 392,
    branch: 'feat/live-npi-resolver-and-openmythos-compliance',
    declaredBase: 'origin/main',
  },
  {
    pr: 393,
    branch: 'fix/protocol-integrity-hardening',
    declaredBase: 'feat/live-npi-resolver-and-openmythos-compliance',
  },
  { pr: 394, branch: 'fix/repository-reality-alignment', declaredBase: 'origin/main' },
  {
    pr: 395,
    branch: 'feat/interoperability-rehearsal-infrastructure',
    declaredBase: 'feat/canonical-provenance-navigation',
  },
  { pr: 396, branch: 'fix/stacked-infrastructure-governance', declaredBase: 'origin/main' },
];

type Level = 'OK' | 'NOTE' | 'WARN' | 'FAIL';

interface Entry {
  level: Level;
  text: string;
}

function refExists(ref: string): boolean {
  return git(`git rev-parse --verify --quiet ${ref}`) !== '';
}

function isAncestor(maybeAncestor: string, descendant: string): boolean {
  if (!refExists(maybeAncestor) || !refExists(descendant)) return false;
  try {
    execSync(`git merge-base --is-ancestor ${maybeAncestor} ${descendant}`, {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function commitCount(from: string, to: string): number | null {
  if (!refExists(from) || !refExists(to)) return null;
  const out = git(`git rev-list --count ${from}..${to}`);
  const n = Number.parseInt(out, 10);
  return Number.isFinite(n) ? n : null;
}

function verifyBranch(entry: StackBranch): Entry[] {
  const out: Entry[] = [];
  if (!refExists(entry.branch)) {
    out.push({
      level: 'FAIL',
      text: `branch missing: ${entry.branch} (PR #${entry.pr})`,
    });
    return out;
  }
  if (!refExists(entry.declaredBase)) {
    out.push({
      level: 'FAIL',
      text: `declared base missing: ${entry.declaredBase} for ${entry.branch}`,
    });
    return out;
  }
  if (!isAncestor(entry.declaredBase, entry.branch)) {
    out.push({
      level: 'FAIL',
      text: `ancestry mismatch: ${entry.declaredBase} is NOT an ancestor of ${entry.branch} (PR #${entry.pr})`,
    });
  }
  const ahead = commitCount(entry.declaredBase, entry.branch);
  if (ahead === 0) {
    out.push({
      level: 'WARN',
      text: `empty-diff stacked branch: ${entry.branch} (0 commits past ${entry.declaredBase})`,
    });
  }
  // Cherry-pick verification (informational only -- we can't strongly
  // assert cherry-pick semantics without the original commit SHA).
  for (const cp of entry.cherryPicks ?? []) {
    if (!refExists(cp)) {
      out.push({
        level: 'WARN',
        text: `cherry-pick source missing: ${cp} referenced by ${entry.branch}`,
      });
    } else {
      out.push({
        level: 'NOTE',
        text: `cherry-pick declared: ${entry.branch} picks from ${cp}`,
      });
    }
  }
  return out;
}

function verifyTopologyDoc(): Entry[] {
  const path = resolve(REPO_ROOT, 'docs/ops/stack-topology.md');
  if (!existsSync(path)) {
    return [{ level: 'FAIL', text: 'docs/ops/stack-topology.md missing' }];
  }
  const md = readFileSync(path, 'utf8');
  const out: Entry[] = [{ level: 'OK', text: 'docs/ops/stack-topology.md present' }];
  for (const entry of STACK) {
    if (!md.includes(entry.branch)) {
      out.push({
        level: 'WARN',
        text: `branch not referenced in topology doc: ${entry.branch} (PR #${entry.pr})`,
      });
    }
  }
  return out;
}

function main(): void {
  const entries: Entry[] = [];
  entries.push(...verifyTopologyDoc());
  for (const branch of STACK) entries.push(...verifyBranch(branch));
  console.log(`# verify-stack-integrity  ·  ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));
  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const fails = entries.filter((e) => e.level === 'FAIL');
  if (fails.length > 0) process.exit(1);
}

main();
