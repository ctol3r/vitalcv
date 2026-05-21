#!/usr/bin/env node
/**
 * scripts/verify-operational-health.ts
 *
 * Single deterministic dispatcher for operational health. Runs three
 * sub-checks and emits one combined report:
 *
 *   1. repo-reality  -- worktrees + branches + lockfile + tsc + packages
 *   2. stack         -- ancestry + cherry-pick + empty-diff
 *   3. codex-ready   -- current branch state vs origin
 *
 * Exits 0 when every sub-check exits 0. Exits 1 when any sub-check
 * fails.
 *
 * No CI orchestration, no parallel scheduling. Three sequential
 * subprocesses; everyone keeps their independent purpose.
 *
 * Usage:
 *   pnpm verify:operational-health
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

interface SubCheck {
  name: string;
  scriptPath: string;
  argv?: readonly string[];
}

const CHECKS: readonly SubCheck[] = [
  {
    name: 'repo-reality',
    scriptPath: 'scripts/verify-repo-reality.ts',
    argv: ['full'],
  },
  {
    name: 'stack-integrity',
    scriptPath: 'scripts/verify-stack-integrity.ts',
  },
  {
    name: 'codex-ready',
    scriptPath: 'scripts/verify-repo-reality.ts',
    argv: ['codex-ready'],
  },
];

interface SubCheckResult {
  name: string;
  exitCode: number;
  output: string;
  skipped: boolean;
  skipReason?: string;
}

function runSubCheck(check: SubCheck): SubCheckResult {
  const scriptAbs = resolve(REPO_ROOT, check.scriptPath);
  if (!existsSync(scriptAbs)) {
    return {
      name: check.name,
      exitCode: 0,
      output: '',
      skipped: true,
      skipReason: `script not present in this worktree: ${check.scriptPath}`,
    };
  }
  const args = (check.argv ?? []).join(' ');
  const cmd = `node --experimental-strip-types ${check.scriptPath}${args ? ' ' + args : ''}`;
  try {
    const stdout = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
    return { name: check.name, exitCode: 0, output: stdout, skipped: false };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    const stdout =
      typeof e.stdout === 'string'
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString('utf8')
          : '';
    return {
      name: check.name,
      exitCode: e.status ?? 1,
      output: stdout,
      skipped: false,
    };
  }
}

function main(): void {
  console.log(`# verify-operational-health  ·  ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));
  const results: SubCheckResult[] = [];
  for (const check of CHECKS) {
    const result = runSubCheck(check);
    results.push(result);
    console.log('');
    console.log(`## ${check.name}`);
    console.log('-'.padEnd(72, '-'));
    if (result.skipped) {
      console.log(`(skipped) ${result.skipReason}`);
      continue;
    }
    console.log(result.output.trim());
    if (result.exitCode !== 0) {
      console.log(`(sub-check exit code: ${result.exitCode})`);
    }
  }
  console.log('');
  console.log('#'.padEnd(72, '#'));
  const failed = results.filter((r) => !r.skipped && r.exitCode !== 0);
  if (failed.length > 0) {
    console.log(
      `[FAIL] operational health: ${failed.length}/${results.length} sub-check(s) failed -> ${failed
        .map((f) => f.name)
        .join(', ')}`,
    );
    process.exit(1);
  }
  const skipped = results.filter((r) => r.skipped);
  if (skipped.length > 0) {
    console.log(
      `[NOTE] operational health: ${skipped.length} sub-check(s) skipped (script not present) -> ${skipped
        .map((s) => s.name)
        .join(', ')}`,
    );
  }
  console.log('[OK  ] operational health passed');
}

main();
