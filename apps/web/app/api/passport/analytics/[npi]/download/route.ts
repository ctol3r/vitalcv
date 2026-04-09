import { type NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { BACKEND_URL as BACKEND } from '@/lib/backend-url';
import { trackServerFunnelEvent } from '@/lib/analytics/funnel-server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;
  try {
    const up = await fetch(`${BACKEND}/api/passport/analytics/${encodeURIComponent(npi)}/download`, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const payload = await up.json().catch(() => null);
    if (!up.ok) {
      const error = typeof (payload as { error?: unknown } | null)?.error === 'string'
        ? (payload as { error: string }).error
        : 'Passport analytics unavailable';
      return NextResponse.json({ error }, { status: up.status });
    }

    // Fire-and-forget analytics — never delay the response
    trackServerFunnelEvent('packet_downloaded', {
      npi_length: npi.length,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
    });

    return NextResponse.json(payload ?? {}, { status: up.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Passport analytics unavailable',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
