import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { BACKEND_URL as B } from '@/lib/backend-url';

export async function GET(_req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;
  const upstream = await fetch(`${B}/api/ingest/${runId}/stream`, {
    headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' },
  });
  return new Response(upstream.body, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
