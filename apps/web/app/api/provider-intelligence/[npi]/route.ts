import { fetchBackendJson } from '../../intelligence/_shared';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const NPI_RE = /^\d{10}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ npi: string }> }) {
  const { npi } = await params;

  if (!NPI_RE.test(npi)) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  try {
    const upstream = await fetchBackendJson(`/api/provider-intelligence/${npi}`, undefined, 20_000);
    return NextResponse.json(upstream.payload, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load provider intelligence',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
