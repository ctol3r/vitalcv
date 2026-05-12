/**
 * Health route — production activation diagnostic.
 *
 * Wave 136 baseline + production-activation expansion:
 *   - deployment_id     — Vercel deployment id (if present)
 *   - runtime_mode      — 'production' | 'preview' | 'development'
 *   - clerk_enabled     — boolean
 *   - jwks_enabled      — boolean (signing public JWK present)
 *   - issuer_enabled    — boolean (signing private JWK + kid present)
 *   - trust_endpoints_enabled — boolean (status URL + backend URL set)
 *
 * Distinct from /api/status/health (PR #327): that route is a
 * structured subsystem audit (vitalcv.status.health.v1 schema). This
 * route is the lightweight legacy probe with operator-facing flags;
 * preserved for backward-compat with Wave-136 monitoring + Vercel
 * uptime checks.
 *
 * Both routes follow the same no-secret-leak contract: presence
 * booleans only, never values.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveRuntimeMode(): 'production' | 'preview' | 'development' {
  // VERCEL_ENV is 'production' | 'preview' | 'development' on Vercel.
  const vercel = process.env.VERCEL_ENV;
  if (vercel === 'production' || vercel === 'preview' || vercel === 'development') {
    return vercel;
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function resolveDeploymentId(): string | null {
  // Prefer VERCEL_DEPLOYMENT_ID; fall back to the git commit sha.
  return (
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null
  );
}

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const clerkEnabled = publishableKey.length > 0;
  const jwksEnabled = Boolean(process.env.VITALCV_SIGNING_PUBLIC_JWK);
  const issuerEnabled =
    Boolean(process.env.VITALCV_SIGNING_PRIVATE_KEY_JWK) &&
    Boolean(process.env.VITALCV_SIGNING_KEY_ID);
  const trustEndpointsEnabled =
    Boolean(process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE) &&
    Boolean(process.env.PUBLIC_STATUS_URL ?? process.env.STATUS_URL);

  return Response.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
      // Production-activation flags (flat for monitoring scrape).
      deployment_id: resolveDeploymentId(),
      runtime_mode: resolveRuntimeMode(),
      clerk_enabled: clerkEnabled,
      jwks_enabled: jwksEnabled,
      issuer_enabled: issuerEnabled,
      trust_endpoints_enabled: trustEndpointsEnabled,
      // Backward-compat (Wave 136 + later monitoring).
      config: {
        apiBase: Boolean(process.env.NEXT_PUBLIC_API_BASE),
        clerk: {
          enabled: clerkEnabled,
          mode: publishableKey.startsWith('pk_live_')
            ? 'production'
            : publishableKey.startsWith('pk_test_')
              ? 'development'
              : 'none',
        },
        sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    },
  );
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
