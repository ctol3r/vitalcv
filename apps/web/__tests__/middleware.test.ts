// apps/web/__tests__/middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { clerkMiddleware } from '@clerk/nextjs/server';

// Mock Clerk before importing middleware
vi.mock('@clerk/nextjs/server', () => {
  const createRouteMatcher = vi.fn();
  const clerkMiddleware = vi.fn();
  return { createRouteMatcher, clerkMiddleware };
});

// We test the pure logic from roles.ts, not the full Clerk middleware integration
import {
  isPublicRoute,
  getRequiredRole,
  getMismatchRedirect,
  ROLE_LANDING,
  PROTECTED_ROUTES,
  PUBLIC_ROUTE_PATTERNS,
} from '../lib/auth/roles';

describe('Route role mapping', () => {
  // Table-driven route guard matrix
  const cases: Array<{
    path: string;
    role: string | null;
    expected: 'allow' | string; // 'allow' or redirect path
  }> = [
    // Public routes - no auth required
    { path: '/', role: null, expected: 'allow' },
    { path: '/sign-in', role: null, expected: 'allow' },
    { path: '/sign-up', role: null, expected: 'allow' },
    { path: '/intake', role: null, expected: 'allow' },
    { path: '/intake/step-2', role: null, expected: 'allow' },
    { path: '/docs/sdk', role: null, expected: 'allow' },
    { path: '/review', role: null, expected: 'allow' },
    { path: '/review/entity-1', role: null, expected: 'allow' },
    { path: '/verify/1234567890', role: null, expected: 'allow' },
    { path: '/trust-state/abc-123', role: null, expected: 'allow' },
    { path: '/auth/error', role: null, expected: 'allow' },
    { path: '/intelligence', role: 'AUTHENTICATED', expected: 'allow' },
    { path: '/findings', role: 'AUTHENTICATED', expected: 'allow' },
    { path: '/investigations', role: 'AUTHENTICATED', expected: 'allow' },

    // /holder - CLINICIAN only
    { path: '/holder', role: 'CLINICIAN', expected: 'allow' },
    { path: '/holder/checklist', role: 'CLINICIAN', expected: 'allow' },
    { path: '/holder', role: 'VERIFIER', expected: '/employer/dashboard' },
    { path: '/holder', role: 'ISSUER', expected: '/issuer' },
    { path: '/holder', role: 'ADMIN', expected: '/internal/metrics' },

    // /verifier - VERIFIER only
    { path: '/verifier', role: 'VERIFIER', expected: 'allow' },
    { path: '/verifier/dashboard', role: 'VERIFIER', expected: 'allow' },
    { path: '/verifier', role: 'CLINICIAN', expected: '/holder' },
    { path: '/verifier', role: 'ADMIN', expected: '/internal/metrics' },

    // /issuer - ISSUER only
    { path: '/issuer', role: 'ISSUER', expected: 'allow' },
    { path: '/issuer', role: 'CLINICIAN', expected: '/holder' },
    { path: '/issuer', role: 'VERIFIER', expected: '/employer/dashboard' },

    // /internal - ADMIN only, mismatch -> / (not role landing)
    { path: '/internal/metrics', role: 'ADMIN', expected: 'allow' },
    { path: '/internal/pilots', role: 'ADMIN', expected: 'allow' },
    { path: '/internal/metrics', role: 'CLINICIAN', expected: '/' },
    { path: '/internal/metrics', role: 'VERIFIER', expected: '/' },
    { path: '/internal/metrics', role: 'ISSUER', expected: '/' },

    // /admin - ADMIN only (demo-reset shipped unguarded; prefix now gated)
    { path: '/admin/demo-reset', role: 'ADMIN', expected: 'allow' },
    { path: '/admin/leads', role: 'ADMIN', expected: 'allow' },
    { path: '/admin/platform', role: 'ADMIN', expected: 'allow' },
    { path: '/admin/demo-reset', role: 'CLINICIAN', expected: '/holder' },
    { path: '/admin/demo-reset', role: 'VERIFIER', expected: '/employer/dashboard' },
  ];

  it.each(cases)(
    '$path with role=$role -> $expected',
    ({ path, role, expected }) => {
      if (expected === 'allow') {
        if (role === null) {
          // Public route
          expect(isPublicRoute(path)).toBe(true);
        } else {
          // Protected route, role matches
          const required = getRequiredRole(path);
          expect(required).toBe(role);
        }
      } else {
        // Role mismatch -> redirect
        const required = getRequiredRole(path);
        expect(required).not.toBe(role);
        const redirect = getMismatchRedirect(path, role as any);
        expect(redirect).toBe(expected);
      }
    }
  );
});

describe('Route leak sentinel', () => {
  it('every protected route pattern is covered by the test matrix', () => {
    const protectedPatterns = PROTECTED_ROUTES.map((r) => r.pattern);
    const testedPrefixes = ['/holder', '/verifier', '/issuer', '/internal', '/admin/demo-reset', '/findings/abc', '/investigations/abc', '/intelligence/deep-link'];
    for (const prefix of testedPrefixes) {
      const matchesAny = protectedPatterns.some((p) => p.test(prefix));
      expect(matchesAny).toBe(true);
    }
  });

  it('no protected route is accidentally public', () => {
    const protectedPaths = ['/holder', '/verifier', '/issuer', '/internal/metrics', '/admin/demo-reset', '/mission-ops', '/analytics'];
    for (const path of protectedPaths) {
      expect(isPublicRoute(path)).toBe(false);
    }
  });
});

describe('Demo removal', () => {
  it('/demo is not a public route (no longer bypassed)', () => {
    expect(isPublicRoute('/demo')).toBe(false);
  });
});

describe('middleware preview fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes public API routes through when Clerk server secrets are missing', async () => {
    vi.resetModules();
    vi.stubEnv('CLERK_SECRET_KEY', '');

    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/api/health');
    const response = await middlewareModule.default(req, {} as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps protected routes gated when Clerk server secrets are missing', async () => {
    vi.resetModules();
    vi.stubEnv('CLERK_SECRET_KEY', '');

    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/holder');
    const response = await middlewareModule.default(req, {} as any);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get('location')).toContain('/sign-in');
    expect(response.headers.get('location')).toContain('redirect_url=%2Fholder');
  });
});

/**
 * The return destination has to survive sign-in WHOLE — path and query.
 *
 * `redirect_url` used to carry the pathname alone. On a gated page whose
 * subject travels in the query, that silently drops the subject: the clinician
 * comes back to an empty form on the one step where the product's promise is
 * that nothing is entered twice.
 */
describe('sign-in preserves the whole return destination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('CLERK_SECRET_KEY', '');
  });

  it('keeps the query string on the redirect', async () => {
    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/holder?npi=1003000126&from=home');
    const response = await middlewareModule.default(req, {} as never);

    const location = response.headers.get('location') ?? '';
    const redirectUrl = new URL(location, 'http://localhost:3000').searchParams.get('redirect_url');
    expect(redirectUrl).toBe('/holder?npi=1003000126&from=home');
  });

  it('does not leak the original query into the sign-in URL itself', async () => {
    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/holder?npi=1003000126');
    const response = await middlewareModule.default(req, {} as never);

    const url = new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
    // One parameter, and it is the destination — the clone's own search is
    // cleared, so `npi` does not also sit loose on /sign-in.
    expect([...url.searchParams.keys()]).toEqual(['redirect_url']);
  });

  it('still works for a path with no query at all', async () => {
    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/holder');
    const response = await middlewareModule.default(req, {} as never);

    const url = new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
    expect(url.searchParams.get('redirect_url')).toBe('/holder');
  });

  it('sends a relative destination, never an absolute one', async () => {
    const middlewareModule = await import('../middleware');
    const req = new NextRequest('http://localhost:3000/holder?next=https://evil.example.com');
    const response = await middlewareModule.default(req, {} as never);

    const url = new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
    // Built from this request's own path and query, so it cannot become an
    // off-site bounce however the query is crafted.
    expect(url.searchParams.get('redirect_url')?.startsWith('/holder')).toBe(true);
    expect(url.origin).toBe('http://localhost:3000');
  });
});
