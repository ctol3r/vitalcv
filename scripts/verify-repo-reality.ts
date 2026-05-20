#!/usr/bin/env node
/**
 * scripts/verify-repo-reality.ts
 *
 * Deterministic repository-state verifier. Walks `git worktree list`,
 * `git for-each-ref`, and the workspace lockfile, then emits a human-
 * readable health report that operators (and Codex audits) can read
 * at a glance.
 *
 * Intentional non-goals:
 *   - no CI orchestration
 *   - no auto-mutation of repo state
 *   - no network calls beyond `git fetch --dry-run`
 *
 * Three sub-commands:
 *   pnpm verify:reality        full report
 *   pnpm verify:worktrees      worktree-only report
 *   pnpm verify:codex-ready    fast pre-merge audit gate
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Mode = 'full' | 'worktrees' | 'codex-ready';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

function gitOutput(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: REPO_ROOT }).trim();
  } catch {
    return '';
  }
}

interface Worktree {
  path: string;
  head: string;
  branch: string | null;
  prunable: boolean;
}

function parseWorktrees(): Worktree[] {
  const out = gitOutput('git worktree list --porcelain');
  const trees: Worktree[] = [];
  let current: Partial<Worktree> | null = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) trees.push(asWorktree(current));
      current = { path: line.slice('worktree '.length), prunable: false, branch: null };
    } else if (line.startsWith('HEAD ')) {
      if (current) current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      if (current) current.branch = line.slice('branch refs/heads/'.length);
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      if (current) current.prunable = true;
    } else if (line === '' && current) {
      trees.push(asWorktree(current));
      current = null;
    }
  }
  if (current) trees.push(asWorktree(current));
  return trees;
}

function asWorktree(p: Partial<Worktree>): Worktree {
  return {
    path: p.path ?? '?',
    head: p.head ?? '?',
    branch: p.branch ?? null,
    prunable: p.prunable === true,
  };
}

function aheadCount(branch: string): number | null {
  const v = gitOutput(`git rev-list --count origin/main..${branch}`);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function branchExistsLocal(branch: string): boolean {
  return gitOutput(`git show-ref --verify --quiet refs/heads/${branch} && echo ok`) === 'ok';
}

function workspacePackages(): string[] {
  const root = join(REPO_ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(root)) return [];
  const yaml = readFileSync(root, 'utf8');
  const matches = yaml.match(/-\s+['"]?([^'"\n]+)['"]?/g) ?? [];
  return matches.map((m) => m.replace(/-\s+['"]?/, '').replace(/['"]?$/, '').trim());
}

function lockfileIsCommitted(): boolean {
  const status = gitOutput('git status --porcelain pnpm-lock.yaml');
  return status === '';
}

function untrackedWorkspacePackages(): string[] {
  const out = gitOutput('git ls-files --others --exclude-standard packages/');
  if (!out) return [];
  // Pick up directories that contain a package.json
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of out.split('\n')) {
    if (!path.endsWith('package.json')) continue;
    const dir = path.split('/').slice(0, 2).join('/');
    if (seen.has(dir)) continue;
    seen.add(dir);
    result.push(dir);
  }
  return result;
}

interface ReportEntry {
  level: 'ok' | 'note' | 'warn' | 'fail';
  text: string;
}

function colorize(level: ReportEntry['level']): string {
  switch (level) {
    case 'ok':
      return 'OK  ';
    case 'note':
      return 'NOTE';
    case 'warn':
      return 'WARN';
    case 'fail':
      return 'FAIL';
  }
}

function renderReport(entries: ReportEntry[]): string {
  const lines = entries.map((e) => `[${colorize(e.level)}] ${e.text}`);
  return lines.join('\n');
}

function reportWorktrees(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const trees = parseWorktrees();
  const prunable = trees.filter((t) => t.prunable);
  const totalSize = trees.length;
  entries.push({
    level: 'note',
    text: `worktrees: total=${totalSize}, prunable=${prunable.length}`,
  });
  if (prunable.length > 0) {
    entries.push({
      level: 'warn',
      text: `${prunable.length} prunable worktree(s) — review and run "git worktree prune".`,
    });
  }
  // Surface worktrees whose branch is missing from refs/heads
  for (const tree of trees) {
    if (!tree.branch) {
      entries.push({
        level: 'warn',
        text: `detached worktree: ${tree.path} (HEAD=${tree.head.slice(0, 8)})`,
      });
      continue;
    }
    if (!branchExistsLocal(tree.branch)) {
      entries.push({
        level: 'warn',
        text: `worktree references missing branch: ${tree.path} -> ${tree.branch}`,
      });
    }
  }
  return entries;
}

function reportBranchHealth(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  // List local branches that have no remote tracking branch
  const local = gitOutput(
    "git for-each-ref refs/heads/ --format='%(refname:short)'",
  )
    .split('\n')
    .map((s) => s.replace(/^'|'$/g, ''))
    .filter(Boolean);
  const remote = new Set(
    gitOutput(
      "git for-each-ref refs/remotes/origin/ --format='%(refname:short)'",
    )
      .split('\n')
      .map((s) => s.replace(/^'|'$/g, ''))
      .map((r) => r.replace(/^origin\//, '')),
  );
  const localOnly = local.filter((b) => !remote.has(b));
  entries.push({
    level: 'note',
    text: `branches: local=${local.length}, local-only (no remote tracking)=${localOnly.length}`,
  });
  if (localOnly.length > 0 && localOnly.length <= 10) {
    for (const b of localOnly) {
      entries.push({ level: 'warn', text: `local-only branch: ${b}` });
    }
  } else if (localOnly.length > 10) {
    entries.push({
      level: 'warn',
      text: `${localOnly.length} local-only branches — too many to enumerate; investigate manually`,
    });
  }
  // Empty-diff feature branches (ahead-of-main = 0)
  for (const b of local) {
    if (!b.startsWith('feat/') && !b.startsWith('fix/')) continue;
    const ahead = aheadCount(b);
    if (ahead === 0) {
      entries.push({
        level: 'warn',
        text: `empty-diff branch: ${b} (no commits ahead of origin/main)`,
      });
    }
  }
  return entries;
}

function reportLockfile(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  if (!existsSync(join(REPO_ROOT, 'pnpm-lock.yaml'))) {
    entries.push({ level: 'fail', text: 'pnpm-lock.yaml missing — workspace integrity broken' });
    return entries;
  }
  if (!lockfileIsCommitted()) {
    entries.push({
      level: 'warn',
      text: 'pnpm-lock.yaml has uncommitted changes — verify before merge',
    });
  } else {
    entries.push({ level: 'ok', text: 'pnpm-lock.yaml is committed and clean' });
  }
  return entries;
}

function reportUntrackedPackages(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const untracked = untrackedWorkspacePackages();
  if (untracked.length === 0) {
    entries.push({ level: 'ok', text: 'no untracked workspace packages under packages/' });
  } else {
    for (const pkg of untracked) {
      entries.push({ level: 'warn', text: `untracked workspace package: ${pkg}` });
    }
  }
  return entries;
}

function reportTscBin(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const webBin = join(REPO_ROOT, 'apps/web/node_modules/.bin/tsc');
  if (existsSync(webBin)) {
    entries.push({ level: 'ok', text: 'apps/web/node_modules/.bin/tsc present' });
  } else {
    // Try to find a hoisted tsc
    const hoisted = join(REPO_ROOT, 'node_modules/.bin/tsc');
    if (existsSync(hoisted)) {
      entries.push({
        level: 'note',
        text: 'apps/web tsc is hoisted (root node_modules/.bin/tsc). Use `pnpm --filter @vitalcv/web typecheck` rather than `exec tsc`.',
      });
    } else {
      entries.push({
        level: 'fail',
        text: 'tsc binary not found in apps/web or root — pnpm install required',
      });
    }
  }
  return entries;
}

function reportCodexReady(): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const branch = gitOutput('git rev-parse --abbrev-ref HEAD');
  const headSha = gitOutput('git rev-parse HEAD');
  const status = gitOutput('git status --porcelain');
  const remoteRef = `refs/remotes/origin/${branch}`;
  const remoteSha = gitOutput(`git rev-parse ${remoteRef} 2>/dev/null`);
  entries.push({ level: 'note', text: `branch: ${branch}` });
  entries.push({ level: 'note', text: `HEAD:   ${headSha}` });
  if (status === '') {
    entries.push({ level: 'ok', text: 'working tree is clean' });
  } else {
    entries.push({
      level: 'fail',
      text: `working tree has uncommitted changes:\n${status}`,
    });
  }
  if (remoteSha) {
    if (remoteSha === headSha) {
      entries.push({ level: 'ok', text: `branch ${branch} is pushed and matches origin` });
    } else {
      const ahead = gitOutput(`git rev-list --count ${remoteRef}..HEAD`);
      const behind = gitOutput(`git rev-list --count HEAD..${remoteRef}`);
      entries.push({
        level: 'warn',
        text: `branch ${branch} diverges from origin (ahead=${ahead}, behind=${behind}); push or rebase`,
      });
    }
  } else {
    entries.push({
      level: 'warn',
      text: `branch ${branch} has no remote tracking branch — push as origin/${branch} or mark explicitly local-only`,
    });
  }
  entries.push(...reportLockfile());
  entries.push(...reportTscBin());
  entries.push(...reportUntrackedPackages());
  return entries;
}

function main(): void {
  const mode = (process.argv[2] ?? 'full') as Mode;
  let entries: ReportEntry[] = [];
  switch (mode) {
    case 'worktrees':
      entries = reportWorktrees();
      break;
    case 'codex-ready':
      entries = reportCodexReady();
      break;
    case 'full':
    default:
      entries = [
        ...reportWorktrees(),
        ...reportBranchHealth(),
        ...reportLockfile(),
        ...reportUntrackedPackages(),
        ...reportTscBin(),
      ];
      break;
  }
  console.log(`# verify-repo-reality (${mode})  ·  ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));
  console.log(renderReport(entries));
  const failures = entries.filter((e) => e.level === 'fail');
  if (failures.length > 0) process.exit(1);
}

main();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _stat = statSync;
const _resolve = resolve;
void _stat;
void _resolve;
