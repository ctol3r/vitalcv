export const runtime = 'nodejs';

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      service: 'web',
      timestamp: new Date().toISOString(),
      config: {
        apiBase: Boolean(process.env.NEXT_PUBLIC_API_BASE),
        clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
        sentry: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      },
    },
    { status: 200 },
  );
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

