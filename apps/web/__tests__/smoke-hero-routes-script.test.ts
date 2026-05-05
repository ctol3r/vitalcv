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

const HERO_ROUTES = [
  '/',
  '/pilot',
  '/pricing',
  '/signup',
  '/status',
  '/docs',
  '/privacy',
  '/terms',
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
    expect(content).not.toMatch(/set -e\b(?!uo)/);
  });
});
