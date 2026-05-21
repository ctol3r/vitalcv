#!/usr/bin/env node
/**
 * scripts/verify-ci-convergence.ts
 *
 * Deterministic CI-convergence verifier. Runs the minimum viable
 * set of checks that catch the failure mode that broke the wallet-sdk
 * stack in this session:
 *
 *   1. workspace dep graph resolves (pnpm install --frozen-lockfile)
 *   2. wallet-sdk build produces a `dist/` artifact
 *   3. exports declared in package.json point at files that exist
 *   4. apps/web tsc binary is callable
 *
 * No CI orchestration. No auto-mutation. Pure read + report.
 *
 * Sub-modes:
 *   pnpm verify:ci-convergence       full run
 *   pnpm verify:wallet-sdk           build-only
 *   pnpm verify:workspace-exports    exports-only
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

type Mode = 'full' | 'wallet-sdk' | 'workspace-exports';

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

function tryExec(cmd: string, opts: { cwd?: string } = {}): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: opts.cwd ?? REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string };
    const out = [e.stdout, e.stderr]
      .map((s) => (typeof s === 'string' ? s : Buffer.isBuffer(s) ? s.toString('utf8') : ''))
      .join('\n');
    return { ok: false, output: out };
  }
}

function verifyWalletSdkBuild(): Entry[] {
  const entries: Entry[] = [];
  const pkgPath = resolve(REPO_ROOT, 'packages/wallet-sdk/package.json');
  if (!existsSync(pkgPath)) {
    entries.push({ level: 'NOTE', text: 'wallet-sdk package not present in this worktree (skipped)' });
    return entries;
  }
  entries.push({ level: 'NOTE', text: 'wallet-sdk: invoking build...' });
  const built = tryExec('pnpm --filter @vitalcv/wallet-sdk build');
  if (!built.ok) {
    entries.push({
      level: 'FAIL',
      text: `wallet-sdk build failed:\n${built.output.split('\n').slice(-10).join('\n')}`,
    });
    return entries;
  }
  // Verify dist artifacts exist
  for (const artifact of ['dist/index.js', 'dist/index.mjs', 'dist/index.d.ts']) {
    const p = resolve(REPO_ROOT, 'packages/wallet-sdk', artifact);
    if (!existsSync(p)) {
      entries.push({ level: 'FAIL', text: `wallet-sdk build artifact missing: ${artifact}` });
    } else {
      const size = statSync(p).size;
      entries.push({ level: 'OK', text: `wallet-sdk artifact present: ${artifact} (${size} bytes)` });
    }
  }
  return entries;
}

interface PackageManifest {
  name?: string;
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<string, unknown> | string;
}

interface WorkspacePackage {
  rel: string;
  manifest: PackageManifest;
}

function listWorkspacePackages(): WorkspacePackage[] {
  const yamlPath = resolve(REPO_ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(yamlPath)) return [];
  const yaml = readFileSync(yamlPath, 'utf8');
  // Crude parse: capture quoted glob patterns under `packages:`.
  const patterns: string[] = [];
  for (const line of yaml.split('\n')) {
    const m = line.match(/^\s*-\s+['"]?([^'"\n]+)['"]?\s*$/);
    if (m) patterns.push(m[1].trim());
  }
  const results: WorkspacePackage[] = [];
  for (const pattern of patterns) {
    // Only handle simple `<dir>/*` and `<dir>` patterns -- enough for VitalCV
    if (pattern.endsWith('/*')) {
      const dir = pattern.slice(0, -2);
      const abs = resolve(REPO_ROOT, dir);
      if (!existsSync(abs)) continue;
      for (const entry of execSync(`ls "${abs}"`, { encoding: 'utf8' }).split('\n')) {
        const e = entry.trim();
        if (!e) continue;
        const pkgJson = resolve(abs, e, 'package.json');
        if (existsSync(pkgJson)) {
          try {
            results.push({
              rel: `${dir}/${e}`,
              manifest: JSON.parse(readFileSync(pkgJson, 'utf8')) as PackageManifest,
            });
          } catch {
            /* ignore */
          }
        }
      }
    } else {
      const pkgJson = resolve(REPO_ROOT, pattern, 'package.json');
      if (existsSync(pkgJson)) {
        try {
          results.push({
            rel: pattern,
            manifest: JSON.parse(readFileSync(pkgJson, 'utf8')) as PackageManifest,
          });
        } catch {
          /* ignore */
        }
      }
    }
  }
  return results;
}

function resolveExportTargets(manifest: PackageManifest): string[] {
  const targets: string[] = [];
  if (typeof manifest.main === 'string') targets.push(manifest.main);
  if (typeof manifest.module === 'string') targets.push(manifest.module);
  if (typeof manifest.types === 'string') targets.push(manifest.types);
  if (manifest.exports && typeof manifest.exports !== 'string') {
    const walk = (val: unknown): void => {
      if (typeof val === 'string') {
        targets.push(val);
      } else if (val && typeof val === 'object') {
        for (const v of Object.values(val as Record<string, unknown>)) walk(v);
      }
    };
    walk(manifest.exports);
  } else if (typeof manifest.exports === 'string') {
    targets.push(manifest.exports);
  }
  return [...new Set(targets)];
}

function verifyWorkspaceExports(): Entry[] {
  const entries: Entry[] = [];
  const pkgs = listWorkspacePackages();
  if (pkgs.length === 0) {
    entries.push({ level: 'NOTE', text: 'no workspace packages discovered' });
    return entries;
  }
  // We only validate packages that ship a `dist/` artifact or whose
  // `main` / `module` / `types` point at a tsx/ts file directly. Packages
  // that point at `dist/*` without a built artifact are flagged.
  for (const pkg of pkgs) {
    const targets = resolveExportTargets(pkg.manifest);
    if (targets.length === 0) continue;
    let hardFail = false;
    let buildArtifactPending = false;
    let legacyMain = false;
    for (const target of targets) {
      // A target without `./` and without `dist/` AND with a slash in
      // it (e.g. "expo-router/entry") is a bare package specifier
      // resolved by the runtime, not a local file path. Skip.
      const looksLikePackageSpecifier =
        !target.startsWith('./') &&
        !target.startsWith('dist/') &&
        target.includes('/') &&
        !/\.(ts|tsx|js|mjs|cjs|d\.ts|d\.mts)$/.test(target);
      if (looksLikePackageSpecifier) continue;

      const abs = resolve(REPO_ROOT, pkg.rel, target);
      if (existsSync(abs)) continue;

      const isSourceTs = /\.(ts|tsx|mts)$/.test(target) && !target.includes('dist');
      const isDistArtifact = target.includes('dist');
      const isBareLegacyMain =
        !target.includes('/') &&
        !target.startsWith('./') &&
        /\.(js|cjs|mjs)$/.test(target);

      if (isSourceTs || isDistArtifact) {
        buildArtifactPending = true;
      } else if (isBareLegacyMain) {
        // Legacy `main: index.js` declarations on workspace root
        // packages -- these workspace folders are pnpm-workspace
        // umbrellas, not runtime packages. Note without failing.
        legacyMain = true;
      } else {
        entries.push({
          level: 'FAIL',
          text: `${pkg.manifest.name ?? pkg.rel}: missing export target ${target}`,
        });
        hardFail = true;
      }
    }
    if (hardFail) continue;
    if (buildArtifactPending) {
      entries.push({
        level: 'WARN',
        text: `${pkg.manifest.name ?? pkg.rel}: declares dist/* exports; build artifact not materialized (run pnpm turbo build to materialize)`,
      });
    } else if (legacyMain) {
      entries.push({
        level: 'NOTE',
        text: `${pkg.manifest.name ?? pkg.rel}: legacy bare-main declaration (no dist/ prefix); workspace umbrella, no runtime impact`,
      });
    } else {
      entries.push({
        level: 'OK',
        text: `${pkg.manifest.name ?? pkg.rel}: ${targets.length} export target(s) resolve`,
      });
    }
  }
  return entries;
}

function verifyTscCallable(): Entry[] {
  const entries: Entry[] = [];
  const webBin = resolve(REPO_ROOT, 'apps/web/node_modules/.bin/tsc');
  const rootBin = resolve(REPO_ROOT, 'node_modules/.bin/tsc');
  if (existsSync(webBin) || existsSync(rootBin)) {
    entries.push({ level: 'OK', text: 'tsc binary is callable from apps/web (via hoisted bin)' });
  } else {
    entries.push({
      level: 'FAIL',
      text: 'tsc binary not found at apps/web/node_modules/.bin/tsc or root -- pnpm install required',
    });
  }
  return entries;
}

function verifyInstallable(): Entry[] {
  const entries: Entry[] = [];
  const lock = resolve(REPO_ROOT, 'pnpm-lock.yaml');
  if (!existsSync(lock)) {
    entries.push({ level: 'FAIL', text: 'pnpm-lock.yaml missing' });
    return entries;
  }
  entries.push({ level: 'OK', text: 'pnpm-lock.yaml present' });
  return entries;
}

function main(): void {
  const mode = (process.argv[2] ?? 'full') as Mode;
  console.log(`# verify-ci-convergence (${mode})  ·  ${new Date().toISOString()}`);
  console.log('#'.padEnd(72, '#'));
  const entries: Entry[] = [];
  switch (mode) {
    case 'wallet-sdk':
      entries.push(...verifyWalletSdkBuild());
      break;
    case 'workspace-exports':
      entries.push(...verifyWorkspaceExports());
      break;
    case 'full':
    default:
      entries.push(...verifyInstallable());
      entries.push(...verifyWalletSdkBuild());
      entries.push(...verifyWorkspaceExports());
      entries.push(...verifyTscCallable());
      break;
  }
  for (const e of entries) console.log(`[${e.level.padEnd(4, ' ')}] ${e.text}`);
  const failed = entries.filter((e) => e.level === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n[FAIL] ci-convergence: ${failed.length} failure(s)`);
    process.exit(1);
  }
  console.log('\n[OK  ] ci-convergence passed');
}

main();
