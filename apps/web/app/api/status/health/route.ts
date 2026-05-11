/**
 * GET /api/status/health — institutional runtime telemetry surface.
 *
 * Read-only diagnostic endpoint. Returns structured JSON describing
 * the operational state of every backing system VitalCV depends on.
 * Designed to be:
 *   - Curl-able by operators to verify env config without exposing
 *     secret values.
 *   - Pollable by external monitoring vendors (Datadog/Sentry/UptimeRobot).
 *   - Safe to expose publicly — every field is a presence/prefix
 *     check, never a value.
 *
 * Truth contract:
 *   - The response NEVER includes a secret value. Clerk publishable
 *     key is reported as a prefix only (`pk_test_` or `pk_live_`).
 *     Secret keys are reported as `present: true/false` only.
 *   - Every field is fail-closed by default — when a env var is
 *     absent, the corresponding `present` flag is `false` and the
 *     overall `degradedSubsystems` array includes that subsystem.
 *   - The endpoint never asserts the system is "healthy" — it only
 *     reports observed presence/absence + version metadata. A
 *     verifier consuming this surface must apply its own threshold
 *     policy.
 *
 * Closes GO-LIVE-1 PR416A (Institutional Telemetry Runtime). This is
 * a poll-based telemetry surface; external aggregation (Datadog,
 * Sentry) is out of repo.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Force-dynamic — we read process.env on every request so reconfig
// without redeploy is observable.
export const dynamic = 'force-dynamic';

interface SubsystemStatus {
  readonly subsystem: string;
  readonly present: boolean;
  readonly detail: string;
  readonly meta?: Readonly<Record<string, string | number | boolean | null>>;
}

interface StatusResponse {
  readonly schema: 'vitalcv.status.health.v1';
  readonly observedAt: string;
  readonly subsystems: readonly SubsystemStatus[];
  readonly degradedSubsystems: readonly string[];
  readonly aggregate: 'ok' | 'degraded' | 'absent';
}

function presence(name: string): boolean {
  const v = process.env[name];
  return typeof v === 'string' && v.length > 0;
}

function keyPrefix(name: string, allowedPrefixes: readonly string[]): string | null {
  const v = process.env[name];
  if (typeof v !== 'string' || v.length === 0) return null;
  for (const p of allowedPrefixes) {
    if (v.startsWith(p)) return p;
  }
  // Unknown prefix — report explicitly without leaking the value.
  return 'unknown-prefix';
}

function clerkSubsystem(): SubsystemStatus {
  const pubPrefix = keyPrefix('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', ['pk_test_', 'pk_live_']);
  const secretPresent = presence('CLERK_SECRET_KEY');
  const providerEnabled = pubPrefix !== null;
  const middlewareEnabled = secretPresent;
  const present = providerEnabled && middlewareEnabled;
  return {
    subsystem: 'clerk-auth',
    present,
    detail: present
      ? `Clerk configured (${pubPrefix}); middleware will enforce auth gating.`
      : !providerEnabled
        ? 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing — <ClerkProvider> will NOT mount.'
        : 'CLERK_SECRET_KEY missing — middleware short-circuits to no-op.',
    meta: {
      publishableKeyPrefix: pubPrefix,
      secretKeyPresent: secretPresent,
      productionMode: pubPrefix === 'pk_live_',
    },
  };
}

function signingSubsystem(): SubsystemStatus {
  const publicJwkPresent = presence('VITALCV_SIGNING_PUBLIC_JWK');
  const privateJwkPresent = presence('VITALCV_SIGNING_PRIVATE_KEY_JWK');
  const kidPresent = presence('VITALCV_SIGNING_KEY_ID');
  // Public is what /.well-known/jwks.json serves; private is what
  // any signing route consumes. Both together = ready to sign +
  // verify end-to-end.
  const present = publicJwkPresent && privateJwkPresent && kidPresent;
  let detail: string;
  if (present) {
    detail = 'ES256 signing configured: public JWK + private JWK + kid all present.';
  } else if (!publicJwkPresent && !privateJwkPresent && !kidPresent) {
    detail = 'No signing key configured. JWKS endpoint will return empty {keys:[]}; signing routes degrade to unsigned envelopes.';
  } else {
    const missing: string[] = [];
    if (!publicJwkPresent) missing.push('VITALCV_SIGNING_PUBLIC_JWK');
    if (!privateJwkPresent) missing.push('VITALCV_SIGNING_PRIVATE_KEY_JWK');
    if (!kidPresent) missing.push('VITALCV_SIGNING_KEY_ID');
    detail = `Partial signing config — missing: ${missing.join(', ')}. Fail-closed: unsigned envelopes only until complete.`;
  }
  return {
    subsystem: 'es256-signing',
    present,
    detail,
    meta: {
      publicJwkPresent,
      privateJwkPresent,
      kidPresent,
    },
  };
}

function databaseSubsystem(): SubsystemStatus {
  const dbUrlPresent = presence('DATABASE_URL');
  return {
    subsystem: 'database',
    present: dbUrlPresent,
    detail: dbUrlPresent
      ? 'DATABASE_URL set. Prisma client can connect.'
      : 'DATABASE_URL absent. Persistence layer will reject all reads/writes; fail-closed.',
    meta: {
      dbUrlPresent,
    },
  };
}

function backendApiSubsystem(): SubsystemStatus {
  const backendUrl = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? '';
  const present = backendUrl.length > 0;
  return {
    subsystem: 'backend-api',
    present,
    detail: present
      ? 'Backend API URL configured.'
      : 'BACKEND_URL / NEXT_PUBLIC_API_BASE absent. Web will fall back to default; passport/lineage routes degrade.',
    meta: {
      hasExplicitBackendUrl: backendUrl.length > 0,
    },
  };
}

function statusSubsystem(): SubsystemStatus {
  const statusUrl = process.env.PUBLIC_STATUS_URL ?? process.env.STATUS_URL ?? '';
  const present = statusUrl.length > 0;
  return {
    subsystem: 'status-api',
    present,
    detail: present
      ? 'Credential status registry URL configured.'
      : 'PUBLIC_STATUS_URL / STATUS_URL absent. Revocation checks fall back to default; may not reflect production state.',
    meta: {
      hasExplicitStatusUrl: statusUrl.length > 0,
    },
  };
}

function appUrlSubsystem(): SubsystemStatus {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const present = appUrl.length > 0;
  return {
    subsystem: 'app-url',
    present,
    detail: present
      ? `App URL configured for OAuth callbacks and absolute links.`
      : 'NEXT_PUBLIC_APP_URL absent. Absolute-URL callbacks (Clerk, Stripe) may fall through to localhost.',
    meta: {
      isHttps: appUrl.startsWith('https://'),
    },
  };
}

export async function GET() {
  const subsystems: SubsystemStatus[] = [
    clerkSubsystem(),
    signingSubsystem(),
    databaseSubsystem(),
    backendApiSubsystem(),
    statusSubsystem(),
    appUrlSubsystem(),
  ];

  const degraded = subsystems.filter((s) => !s.present).map((s) => s.subsystem);
  const aggregate: StatusResponse['aggregate'] =
    degraded.length === 0
      ? 'ok'
      : degraded.length === subsystems.length
        ? 'absent'
        : 'degraded';

  const body: StatusResponse = {
    schema: 'vitalcv.status.health.v1',
    observedAt: new Date().toISOString(),
    subsystems: Object.freeze(subsystems),
    degradedSubsystems: Object.freeze(degraded),
    aggregate,
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      // Never cache — every poll must reflect the current state.
      'Cache-Control': 'no-store, must-revalidate',
      'X-Status-Aggregate': aggregate,
    },
  });
}
