import { type NextRequest, NextResponse } from 'next/server';
import { buildForwardHeaders, fetchBackendJson } from '../../_shared';
import { getApiBase } from '@/lib/api';
import { findProviderNpi } from '@/lib/intelligence/contracts';
import { normalizeFindingDetailResponse } from '@/lib/intelligence/detail-normalizers';
import type { InvestigatorFindingDetailResponse } from '@/lib/intelligence/detail-types';
import { loadFindingStorylineLink } from '@/lib/intelligence/navigation-links';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  getApiBase() ||
  'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const search = req.nextUrl.searchParams;
  const forwardedParams = new URLSearchParams(search);
  const upstream = await fetchBackendJson<InvestigatorFindingDetailResponse>(
    `/api/investigators/findings/${path.join('/')}`,
    forwardedParams,
  );

  if (!upstream.ok || path.length !== 1 || !upstream.payload.finding) {
    return NextResponse.json(upstream.payload, { status: upstream.status });
  }

  const normalized = normalizeFindingDetailResponse(upstream.payload);
  const providerNpi = findProviderNpi(
    normalized.finding.entityIds,
    normalized.finding.metadata,
  );
  const storylineLink = normalized.finding.storylineKey
    ? await loadFindingStorylineLink(normalized.finding.findingId, providerNpi)
    : null;

  return NextResponse.json({
    ...normalized,
    finding: {
      ...normalized.finding,
      storylineId: storylineLink?.storylineId ?? null,
      storylineTitle: storylineLink?.storylineTitle ?? null,
    },
  }, { status: upstream.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const body = await req.json().catch(() => ({}));
  const headers = await buildForwardHeaders();
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BACKEND}/api/investigators/findings/${path.join('/')}`, {
    method: 'POST',
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
