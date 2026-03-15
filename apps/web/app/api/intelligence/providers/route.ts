import { type NextRequest, NextResponse } from 'next/server';
import { normalizeProvidersPayload } from '@/lib/intelligence/contracts';
import { fetchBackendJson, parsePositiveInt } from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? '';
  const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 24, 200);
  const minTrustScore = parsePositiveInt(req.nextUrl.searchParams.get('minTrustScore'), 0, 100);

  const params = new URLSearchParams({
    limit: String(Math.max(limit, 36)),
    minTrustScore: String(minTrustScore),
  });

  try {
    const upstream = await fetchBackendJson<{
      entries?: Array<{
        npi: string;
        fullName: string;
        specialties: string[];
        credentialCount: number;
        activeCredentials: number;
        primaryIssuer: string | null;
        credentialHealth: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';
        lastVerifiedAt: string | null;
        trustScore: number;
      }>;
    }>('/api/directory', params);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Provider directory upstream returned ${upstream.status}` },
        { status: upstream.status },
      );
    }

    const response = normalizeProvidersPayload(upstream.payload, query);
    return NextResponse.json({
      ...response,
      providers: response.providers.slice(0, limit),
      watchlist: response.watchlist.slice(0, 5),
      comparison: response.comparison.slice(0, 3),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load intelligence providers',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}
