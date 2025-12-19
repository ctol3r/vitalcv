import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
};

function findMonorepoRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i += 1) {
    const hasWorkspace = fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'));
    const hasTurbo = fs.existsSync(path.join(dir, 'turbo.json'));
    const hasApps = fs.existsSync(path.join(dir, 'apps'));
    if (hasWorkspace && hasTurbo && hasApps) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function run(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString('utf8')
      .trim();
  } catch {
    return null;
  }
}

function fmt(result: CheckResult): string {
  const prefix = result.ok ? 'PASS' : 'FAIL';
  return `${prefix}  ${result.name}${result.details ? ` — ${result.details}` : ''}`;
}

function main() {
  const cwd = process.cwd();
  const root = findMonorepoRoot(cwd);

  if (!root) {
    // eslint-disable-next-line no-console
    console.error('FAIL  Monorepo root not found from:', cwd);
    // eslint-disable-next-line no-console
    console.error('      Expected to find pnpm-workspace.yaml + turbo.json + apps/');
    process.exit(1);
  }

  const checks: CheckResult[] = [];

  checks.push({
    name: 'Workspace opened at monorepo root',
    ok: path.resolve(cwd) === path.resolve(root),
    details:
      path.resolve(cwd) === path.resolve(root)
        ? root
        : `current=${cwd} (open ${root} or vitalcv.code-workspace)`,
  });

  const requiredPaths = ['apps/web', 'apps/api', 'packages', 'docs'];
  for (const rel of requiredPaths) {
    const exists = fs.existsSync(path.join(root, rel));
    checks.push({ name: `Required path exists: ${rel}`, ok: exists });
  }

  const isGitRepo =
    fs.existsSync(path.join(root, '.git')) || Boolean(run('git rev-parse --is-inside-work-tree'));
  checks.push({ name: 'Git working tree', ok: isGitRepo });

  const branch = run('git branch --show-current') || run('git rev-parse --abbrev-ref HEAD');
  if (!branch) {
    checks.push({ name: 'Git branch is main', ok: false, details: 'unable to determine branch' });
  } else if (branch === 'HEAD') {
    checks.push({ name: 'Git branch is main', ok: false, details: 'detached HEAD' });
  } else {
    checks.push({ name: 'Git branch is main', ok: branch === 'main', details: `branch=${branch}` });
  }

  const failed = checks.filter((c) => !c.ok);

  // eslint-disable-next-line no-console
  console.log(`VitalCV repo sanity (${failed.length === 0 ? 'OK' : 'ISSUES'})`);
  for (const c of checks) {
    // eslint-disable-next-line no-console
    console.log(fmt(c));
  }

  if (failed.length > 0) process.exit(1);
}

main();
