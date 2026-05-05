/**
 * smoke-hero-routes-script.test.ts
 *
 * Structural test: verifies the smoke script exists, is executable,
 * and covers all required hero routes.
 *
 * This test does NOT start a server — it validates the script artifact.
 */
import { describe, expect, it } from 'vitest';
import { accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCRIPT_PATH = resolve(__dirname, '../../../scripts/smoke-hero-routes.sh');
const WORKFLOW_PATH = resolve(__dirname, '../../../.github/workflows/smoke-hero-routes.yml');
const ROOT_PACKAGE_JSON = resolve(__dirname, '../../../package.json');

const HERO_ROUTES = [
  '/',
  '/pilot',
  '/pricing',
  '/signup',
  '/status',
  '/docs',
  '/privacy',
  '/terms',
  '/clinician/import',
  '/legal/dpa',
  '/legal/cookies',
  '/passport',
] as const;

describe('scripts/smoke-hero-routes.sh', () => {
  it('exists, is executable, and covers all hero routes', () => {
    // Throws if file does not exist or is not executable
    accessSync(SCRIPT_PATH, constants.X_OK);

    const content = readFileSync(SCRIPT_PATH, 'utf-8');

    for (const route of HERO_ROUTES) {
      expect(content, `script must check route "${route}"`).toContain(`"${route}"`);
    }

    // Must use next start (not next dev)
    expect(content).not.toContain('next dev');
    // Must not early-exit on first failure — all routes should be checked
    expect(content).not.toMatch(/^set -e/m);
    expect(content).not.toContain('set -euo pipefail');
  });

  it('documents legal-route degraded states as warnings, not errors', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');

    expect(content).toContain(
      'check_route "/legal/dpa" "pending legal page until #242 merges"',
    );
    expect(content).toContain(
      'check_route "/legal/cookies" "pending legal page until #242 merges"',
    );
    expect(content).toContain('WARN');
    expect(content).toContain('documented degraded');
    expect(content).toContain('DEGRADED=$((DEGRADED + 1))');

    const degradedBranchIndex = content.indexOf('DEGRADED=$((DEGRADED + 1))');
    const failBranchIndex = content.indexOf('FAIL=$((FAIL + 1))');
    expect(degradedBranchIndex).toBeGreaterThan(0);
    expect(failBranchIndex).toBeGreaterThan(degradedBranchIndex);
  });

  // Hotfix wave-3m: smoke workflow must NOT pin a stale pnpm version that
  // disagrees with package.json's packageManager field. pnpm/action-setup@v4
  // auto-detects when no `version:` is supplied — that is the desired wiring.
  it('workflow uses pnpm version from package.json packageManager (no hardcoded pin)', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf-8');
    const packageJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, 'utf-8')) as {
      packageManager?: string;
    };

    expect(packageJson.packageManager).toMatch(/^pnpm@\d/);
    expect(workflow).toContain('pnpm/action-setup@v4');

    // The workflow must not hardcode a different version than package.json
    const versionMatch = workflow.match(/pnpm\/action-setup@v4[\s\S]*?with:\s*\n\s*version:\s*(\S+)/);
    if (versionMatch) {
      const pinnedInWorkflow = versionMatch[1].replace(/['"]/g, '');
      const pmVersion = packageJson.packageManager!.replace('pnpm@', '').split('+')[0];
      expect(
        pinnedInWorkflow,
        `workflow pins pnpm ${pinnedInWorkflow}, but package.json declares pnpm ${pmVersion}`,
      ).toBe(pmVersion);
    }
  });
});
