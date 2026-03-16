import { type NextRequest, NextResponse } from 'next/server';
import { buildForwardHeaders } from '@/app/api/intelligence/_shared';
import { normalizeFindingDetailResponse } from '@/lib/intelligence/detail-normalizers';
import type { InvestigatorFindingDetailResponse } from '@/lib/intelligence/detail-types';
import { getApiBase } from '@/lib/api';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  getApiBase() ||
  'http://localhost:4000';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const headers = await buildForwardHeaders();
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BACKEND}/api/investigators/findings/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({}));
  const normalizedPayload = (
    payload && typeof payload === 'object' && 'finding' in payload
      ? normalizeFindingDetailResponse(payload as InvestigatorFindingDetailResponse)
      : payload
  );

  return NextResponse.json(normalizedPayload, { status: response.status });
}
