import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { BACKEND_URL as B } from '@/lib/backend-url';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

export async function GET(_req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const { runId } = await context.params;

  try {
    const upstream = await fetchWithRetry(`${B}/api/ingest/${runId}/stream`, {
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-org-id': 'vcv-system',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: 'Stream unavailable', status: upstream.status },
        { status: 502 },
      );
    }

    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Stream endpoint unreachable.' }, { status: 503 });
  }
}
