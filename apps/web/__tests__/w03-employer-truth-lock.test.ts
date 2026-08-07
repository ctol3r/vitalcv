/**
 * W0.3 — truth lock on the employer surface.
 *
 * Three defects shipped together and were live in production on 2026-07-27
 * (deployed commit fca2656):
 *
 *  1. The ENTIRE `/employer/*` tree answered 200 to anonymous requests.
 *     `PROTECTED_ROUTES` guarded `/verifier/*` — a tree that is archived and
 *     404s — while the live employer workspace had no entry at all, even
 *     though the doctrine comment directly above the table claimed
 *     "/verifier/*, /employer/*, /issuer/* → VERIFIER role". A guard pointed
 *     at a dead route while the real one was open. Verified against prod:
 *     /employer/{dashboard,worklist,candidates,applications,review-queue,
 *     profile,post} all returned 200; /verifier and /holder returned 307.
 *
 *  2. `/employer/dashboard` rendered hard-coded operational data to those
 *     anonymous visitors — 12/5/3/8/2 application counts, "Time to Credential:
 *     4.2 days avg", "OIG Checks Delayed: 2 applications stuck", and invented
 *     application IDs #1029/#1030 — and the public /employers page linked
 *     straight to it ("Already set up? Open your workspace").
 *
 *  3. `deployInfo.deployedAt` fell back to `new Date().toISOString()`, so
 *     `/api/version`'s `builtAt` reported the CURRENT REQUEST TIME as the
 *     build time. Proven in prod: two calls two seconds apart returned
 *     04:14:45.950Z and 04:14:48.090Z for the same commit.
 *
 * These assert the OUTCOME (the route is gated / the value is honest), not the
 * particular mechanism that achieves it, so a better fix keeps them green.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getRequiredRole, isPublicRoute, UserRole } from '@/lib/auth/roles';

const WEB_ROOT = join(__dirname, '..');

describe('W0.3.1 — the live employer tree is gated', () => {
  const EMPLOYER_ROUTES = [
    '/employer',
    '/employer/dashboard',
    '/employer/worklist',
    '/employer/candidates',
    '/employer/applications',
    '/employer/review-queue',
    '/employer/profile',
    '/employer/post',
    '/employer/decision/abc-123',
    '/employer/review/abc-123',
  ];

  it.each(EMPLOYER_ROUTES)('%s requires the VERIFIER role', (route) => {
    expect(getRequiredRole(route)).toBe(UserRole.VERIFIER);
  });

  it.each(EMPLOYER_ROUTES)('%s is not a public route', (route) => {
    expect(isPublicRoute(route)).toBe(false);
  });

  it('leaves /employers (plural) public — it is the acquisition page', () => {
    expect(getRequiredRole('/employers')).toBeNull();
    expect(getRequiredRole('/employers/acme')).toBeNull();
  });

  it('does not let the employer guard swallow unrelated routes', () => {
    expect(getRequiredRole('/employment')).toBeNull();
    expect(getRequiredRole('/employer-guide')).toBeNull();
  });
});

describe('W0.3.2 — the employer dashboard states no fabricated operations', () => {
  const source = readFileSync(
    join(WEB_ROOT, 'app/employer/dashboard/page.tsx'),
    'utf8',
  );

  // The exact fabricated artefacts that were live. Split so this test file's
  // own constants can never be mistaken for the banned copy by a grep gate.
  const FABRICATED = [
    ['App', '#1029'],
    ['App', '#1030'],
    ['4.2', 'days avg'],
    ['OIG Checks', 'Delayed'],
    ['Applications', 'by State'],
    ['Workflow', 'Bottlenecks'],
    ['Waiting', 'for Docs'],
  ];

  it.each(FABRICATED)('no longer renders "%s %s"', (a, b) => {
    // Rendered copy only — the file's header comment documents the removed
    // strings on purpose, so strip the comment block before scanning.
    const rendered = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(rendered).not.toContain(`${a} ${b}`);
  });

  it('reads real rows instead of hard-coding counts', () => {
    expect(source).toContain('getWorklist');
  });

  it('has an explicit empty state rather than fake-fill', () => {
    expect(source).toMatch(/No receipt candidates/i);
  });

  it('publishes no average-duration metric', () => {
    // VitalCV has not measured a time-to-start or time-to-credential figure.
    // Any "N days avg" on this surface is a projection presented as a fact.
    const rendered = source.replace(/\/\*\*[\s\S]*?\*\//g, '');
    expect(rendered).not.toMatch(/\d+(\.\d+)?\s*days?\s*(avg|average)/i);
  });
});

describe('W0.3.3 — build time is honest or absent, never the request clock', () => {
  const ORIGINAL = process.env.BUILD_TIMESTAMP;

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.BUILD_TIMESTAMP;
    else process.env.BUILD_TIMESTAMP = ORIGINAL;
    // getDeployInfo reads process.env per call; no module cache to reset.
  });

  async function versionInfo() {
    const mod = await import('@/lib/deployInfo');
    return mod.getVersionInfo();
  }

  it('reports null when BUILD_TIMESTAMP is unset', async () => {
    delete process.env.BUILD_TIMESTAMP;
    expect((await versionInfo()).builtAt).toBeNull();
  });

  it('treats a blank BUILD_TIMESTAMP as unknown', async () => {
    process.env.BUILD_TIMESTAMP = '   ';
    expect((await versionInfo()).builtAt).toBeNull();
  });

  it('is stable across calls — a build time cannot advance at runtime', async () => {
    delete process.env.BUILD_TIMESTAMP;
    const first = (await versionInfo()).builtAt;
    await new Promise((r) => setTimeout(r, 25));
    const second = (await versionInfo()).builtAt;
    // The prod defect: these differed by the elapsed wall-clock time.
    expect(second).toEqual(first);
  });

  it('passes a real BUILD_TIMESTAMP through untouched', async () => {
    process.env.BUILD_TIMESTAMP = '2026-07-27T04:00:00.000Z';
    expect((await versionInfo()).builtAt).toBe('2026-07-27T04:00:00.000Z');
  });
});
