import { NextResponse } from 'next/server';

import { CLERK_ENABLED } from '@/lib/auth/clerkConfig';
import { evaluateAuthHealth } from '@/lib/auth/authHealth';

/**
 * GET /api/health/auth — fail-closed authentication CONFIGURATION health
 * (Wave 0.1). Reports presence booleans only; never key material.
 *
 * Two probes make build/runtime divergence visible:
 *  - buildTimeClerk: CLERK_ENABLED imported from clerkConfig — Next.js inlined
 *    the publishable key's presence into this constant AT BUILD TIME.
 *  - runtime*: dynamic `process.env[name]` lookups, which Next cannot inline,
 *    so they read the live container environment.
 *
 * 18c9311 shipped buildTimeClerk=false with a fully configured runtime — every
 * prerendered page and the client bundle had auth compiled off. This endpoint
 * turns that silent state into a 503.
 */

export const dynamic = 'force-dynamic';

function runtimeHas(name: string): boolean {
  // Bracket access with a runtime-built key defeats build-time inlining.
  const key = String(name);
  return Boolean(process.env[key]);
}

export async function GET() {
  const report = evaluateAuthHealth({
    buildTimeClerk: CLERK_ENABLED,
    runtimePublishableKey: runtimeHas('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'),
    runtimeSecretKey: runtimeHas('CLERK_SECRET_KEY'),
    // Rotation prerequisite, not a health gate. roleCookie.ts falls back to
    // CLERK_SECRET_KEY when this is unset, so rotating the Clerk key would
    // invalidate every outstanding role cookie. The rotation runbook told
    // operators to check this endpoint for exactly this fact, which it did
    // not report until now — a healthy response read as "override is set".
    runtimeRoleCookieSecret: runtimeHas('ROLE_COOKIE_SECRET'),
    // Railway containers always carry RAILWAY_PROJECT_ID; production must
    // never run authless. Local prod builds (e2e) run without it — reported
    // honestly as auth_disabled, HTTP 200.
    authExpected: runtimeHas('RAILWAY_PROJECT_ID'),
  });

  return NextResponse.json(
    {
      service: 'web',
      check: 'auth-config',
      status: report.status,
      authExpected: report.authExpected,
      buildTimeClerk: report.buildTimeClerk,
      runtimePublishableKey: report.runtimePublishableKey,
      runtimeSecretKey: report.runtimeSecretKey,
      runtimeRoleCookieSecret: report.runtimeRoleCookieSecret,
      roleCookieSignedWithClerkKey: report.roleCookieSignedWithClerkKey,
    },
    {
      status: report.httpStatus,
      headers: { 'Cache-Control': 'private, no-store' },
    },
  );
}
