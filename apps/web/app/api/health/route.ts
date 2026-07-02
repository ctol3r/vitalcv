/**
 * Health route — Wave 136+: includes Clerk production-readiness signal
 * and backend connectivity probe.
 */
export const runtime = 'nodejs';
import { BACKEND_URL as B } from '@/lib/backend-url';

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

  // Probe backend connectivity (non-blocking — degraded, not failed).
  // Use the API's UNAUTHENTICATED canonical health route (/health); /api/health
  // is behind the API auth middleware (401) and would always read as degraded.
  let backendStatus: 'ok' | 'degraded' | 'unreachable' = 'unreachable';
  try {
    const probe = await fetch(`${B}/health`, {
      signal: AbortSignal.timeout(3000),
      headers: { 'x-org-id': 'vcv-system' },
    });
    backendStatus = probe.ok ? 'ok' : 'degraded';
  } catch {
    backendStatus = 'unreachable';
  }

  return Response.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
      backend: { url: B, status: backendStatus },
      config: {
        apiBase: Boolean(process.env.NEXT_PUBLIC_API_BASE),
        clerk: {
          enabled: Boolean(publishableKey),
          mode: publishableKey.startsWith('pk_live_')
            ? 'production'
            : publishableKey.startsWith('pk_test_')
              ? 'development'
              : 'none',
        },
        sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      },
    },
    { status: 200 },
  );
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
