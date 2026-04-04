import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL as B } from '@/lib/backend-url';
export const runtime = 'nodejs';

/**
 * Proxy for passport lookups by entity ID (UUID) or NPI.
 * NPI → backend /api/passport/npi/:npi (returns canonical PassportData).
 * UUID → backend /api/passport/entity/:id.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isNpi = /^\d{10}$/.test(id);

  const upstream = isNpi
    ? `${B}/api/passport/npi/${id}`
    : `${B}/api/passport/entity/${id}`;

  try {
    const res = await fetch(upstream, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Passport unavailable' },
      { status: 503 },
    );
  }
}
