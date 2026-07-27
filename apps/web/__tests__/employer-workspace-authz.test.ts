// apps/web/__tests__/employer-workspace-authz.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getRequiredRole, isPublicRoute } from '../lib/auth/roles';

/**
 * W0.3 regression contract.
 *
 * Two defects shipped together and must not come back together:
 *
 *   1. /employer/* answered 200 to anonymous visitors. lib/auth/roles.ts had
 *      documented the tree as a VERIFIER surface since its doctrine block was
 *      written, but the pattern was never added to PROTECTED_ROUTES. The
 *      archived /verifier/* tree (which 404s) stayed guarded instead.
 *
 *   2. /employer/dashboard rendered hard-coded application counts, a
 *      "4.2 days avg" time-to-credential figure, and invented application IDs
 *      — fabricated operational data on a public route.
 *
 * These assert the OUTCOME (the route is gated; the page has no invented
 * numbers), not the mechanism, so a better fix later still passes.
 */

const EMPLOYER_WORKSPACE_ROUTES = [
  '/employer',
  '/employer/dashboard',
  '/employer/worklist',
  '/employer/review-queue',
  '/employer/candidates',
  '/employer/applications',
  '/employer/profile',
  '/employer/post',
  '/employer/review',
] as const;

describe('employer workspace is role-gated', () => {
  for (const route of EMPLOYER_WORKSPACE_ROUTES) {
    it(`${route} requires the VERIFIER role`, () => {
      expect(getRequiredRole(route)).toBe('VERIFIER');
    });

    it(`${route} is not a public route`, () => {
      expect(isPublicRoute(route)).toBe(false);
    });
  }
});

describe('the public acquisition page stays public', () => {
  // /employers (plural) is the marketing surface. The guard pattern is
  // anchored `^\/employer(\/.*)?$` precisely so it cannot swallow this.
  for (const route of ['/employers', '/employers/some-health-system'] as const) {
    it(`${route} does not require a role`, () => {
      expect(getRequiredRole(route)).toBeNull();
    });
  }
});

describe('the employer dashboard presents no fabricated operational data', () => {
  const raw = readFileSync(
    join(__dirname, '..', 'app', 'employer', 'dashboard', 'page.tsx'),
    'utf8',
  );

  // Strip comments before scanning. The file's docstring deliberately names
  // the old fabricated values to explain what was removed and why — that
  // prose must not be what keeps this test honest, and must not fail it.
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  // The exact values the route used to render to anonymous visitors.
  const FABRICATED = [
    'Time to Credential',
    '4.2 days',
    'OIG Checks Delayed',
    'App #1029',
    'App #1030',
    'License copy missing',
    'Missing NPI state',
  ];

  for (const literal of FABRICATED) {
    it(`does not render "${literal}"`, () => {
      expect(source).not.toContain(literal);
    });
  }

  it('sources its numbers from the session-authorized dashboard component', () => {
    expect(source).toContain('EmployerWorkflowDashboard');
  });
});
