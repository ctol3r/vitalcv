import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Vitest globalSetup — fail fast, and legibly, when workspace deps are unbuilt.
 *
 * WHY THIS EXISTS. Workspace packages resolve through their package.json
 * `main`/`exports`, which point at `dist/`. Run vitest without building them
 * first and 25 suites fail with errors that name the symptom and hide the
 * cause:
 *
 *     Failed to resolve entry for package "@vitalcv/domain-evidence".
 *     The package may have incorrect main/module/exports specified.
 *     Cannot find package '@vitalcv/shared/pricing'
 *
 * Nothing is wrong with those packages, and nothing is wrong with the tests.
 * The dist output simply is not there yet. CI gets this right with an explicit
 * "Build workspace package dependencies" step, and `turbo.json` declares
 * `test: { dependsOn: ["build"] }` — but the command CLAUDE.md documents for
 * local runs, `pnpm --filter @vitalcv/web exec vitest run`, bypasses turbo and
 * hits the trap head-on.
 *
 * That trap has been described in prose in three places — the CI step comment,
 * the note at the top of `vitest.config.ts`, and turbo's task graph — and it
 * still cost a full debugging session, because a comment cannot stop anyone
 * from running the command. This turns those 25 misleading failures into one
 * accurate sentence naming the fix.
 *
 * It deliberately reads the dependency list from package.json instead of
 * hard-coding it: a frozen list only describes the day it was written.
 */

const WEB_ROOT = resolve(__dirname, '..');

interface Unbuilt {
  pkg: string;
  entry: string;
}

/** Collect the file targets a package's `exports`/`main` field points at. */
function entryTargets(pkgJson: Record<string, unknown>): string[] {
  const targets: string[] = [];

  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      // Ignore wildcard subpaths — there is no single file to stat.
      if (!node.includes('*')) targets.push(node);
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) walk(value);
    }
  };

  walk(pkgJson.exports);
  for (const field of ['main', 'module'] as const) {
    const value = pkgJson[field];
    if (typeof value === 'string') targets.push(value);
  }

  // Runtime entries only. A missing .d.ts does not break module resolution, so
  // blocking a test run over one would be a false positive — and a check that
  // cries wolf gets bypassed, which costs more than the trap it guards.
  // An absent dist/ still trips this via its .js entries.
  return targets.filter((t) => !t.endsWith('.d.ts') && !t.endsWith('.d.mts'));
}

export default function requireWorkspaceBuild(): void {
  // Opt out for the rare case of debugging this check itself.
  if (process.env.VITALCV_SKIP_WORKSPACE_BUILD_CHECK === '1') return;

  let webPkg: Record<string, unknown>;
  try {
    webPkg = JSON.parse(readFileSync(join(WEB_ROOT, 'package.json'), 'utf8'));
  } catch {
    return; // Not our job to fail the run over an unreadable package.json.
  }

  const deps = {
    ...((webPkg.dependencies as Record<string, string>) ?? {}),
    ...((webPkg.devDependencies as Record<string, string>) ?? {}),
  };
  const workspaceDeps = Object.entries(deps)
    .filter(([, range]) => typeof range === 'string' && range.startsWith('workspace:'))
    .map(([name]) => name);

  const unbuilt: Unbuilt[] = [];

  for (const name of workspaceDeps) {
    const manifestPath = join(WEB_ROOT, 'node_modules', name, 'package.json');
    if (!existsSync(manifestPath)) continue; // Not installed — a different error, reported honestly by vitest.

    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      continue;
    }

    const pkgDir = dirname(manifestPath);
    // `exports`, `main` and `types` routinely name the same file three ways
    // ('./dist/index.js', 'dist/index.js', …). Dedupe on the resolved path so
    // the report lists each genuinely-missing file once.
    const seen = new Set<string>();
    for (const target of entryTargets(manifest)) {
      const absolute = join(pkgDir, target);
      if (seen.has(absolute)) continue;
      seen.add(absolute);
      if (!existsSync(absolute)) {
        unbuilt.push({ pkg: name, entry: target.replace(/^\.\//, '') });
      }
    }
  }

  if (unbuilt.length === 0) return;

  const affected = [...new Set(unbuilt.map((u) => u.pkg))];
  const detail = unbuilt
    .map((u) => `    ${u.pkg} → ${u.entry}`)
    .join('\n');

  throw new Error(
    [
      '',
      `Workspace dependencies are not built — ${affected.length} package(s) have no dist output.`,
      '',
      'These tests are not broken. Vitest resolves workspace packages through',
      'their package.json main/exports, which point at dist/. Those files do not',
      'exist yet, so any suite importing them fails with a misleading',
      '"Cannot find module" / "Failed to resolve entry" error.',
      '',
      '  Fix:',
      '',
      "    pnpm turbo build --filter='!@vitalcv/web'",
      '',
      '  Missing entry points:',
      '',
      detail,
      '',
      '  (Set VITALCV_SKIP_WORKSPACE_BUILD_CHECK=1 to bypass this check.)',
      '',
    ].join('\n'),
  );
}
