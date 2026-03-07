/**
 * Health route — Wave 136: includes Clerk production-readiness signal.
 */
export const runtime = 'nodejs';

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

  return Response.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
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
