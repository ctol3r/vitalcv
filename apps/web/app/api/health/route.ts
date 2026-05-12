/**
 * Health route — Wave 136 baseline + runtime_channel taxonomy.
 *
 * Adds runtime_channel (the 4-value VitalCV taxonomy from
 * apps/web/lib/runtime/channel.ts) so verifiers + footer renderers
 * + monitoring tooling can disambiguate operator-preview from
 * staging — something Vercel's 3-value VERCEL_ENV can't express.
 *
 * Backward-compat with Wave-136 monitoring is preserved (existing
 * config.clerk shape unchanged).
 */
import { resolveRuntimeChannel } from '@/lib/runtime/channel';

export const runtime = 'nodejs';

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const channel = resolveRuntimeChannel();

  return Response.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
      runtime_channel: channel,
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
