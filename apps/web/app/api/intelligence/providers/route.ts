import { type NextRequest, NextResponse } from 'next/server';
import { normalizeProvidersPayload } from '@/lib/intelligence/contracts';
import {
  buildReadOnlyFallbackPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (authContext.status !== 'authenticated') {
    return NextResponse.json(buildReadOnlyFallbackPayload('providers', req, authContext));
  }

  const query = req.nextUrl.searchParams.get('q') ?? '';
  const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1, 200);
  const limit = parsePositiveInt(
    req.nextUrl.searchParams.get('limit') ?? req.nextUrl.searchParams.get('pageSize'),
    12,
    100,
  );
  const minTrustScore = parsePositiveInt(req.nextUrl.searchParams.get('minTrustScore'), 0, 100);
  const trimmedQuery = query.trim();
  const fetchAllForSearch = trimmedQuery.length > 0;
  const upstreamPage = fetchAllForSearch ? 1 : page;
  const upstreamLimit = fetchAllForSearch ? 1000 : limit;

  const params = new URLSearchParams({
    page: String(upstreamPage),
    pageSize: String(upstreamLimit),
    limit: String(upstreamLimit),
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
      totalProviders?: number;
      pageInfo?: {
        totalAvailable?: number;
      };
    }>('/api/directory', params, 12_000, { context: authContext });

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildReadOnlyFallbackPayload('providers', req, authContext, { log: false }));
    }

    const response = normalizeProvidersPayload(upstream.payload, query);
    const providers = fetchAllForSearch
      ? response.providers.slice((page - 1) * limit, page * limit)
      : response.providers;
    const total = fetchAllForSearch
      ? response.total
      : upstream.payload.pageInfo?.totalAvailable ?? upstream.payload.totalProviders ?? response.total;

    return NextResponse.json({
      ...response,
      providers,
      watchlist: response.watchlist.slice(0, 5),
      comparison: response.comparison.slice(0, 3),
      total,
      pageInfo: {
        page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: page * limit < total,
        returned: providers.length,
      },
    });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildReadOnlyFallbackPayload('providers', req, authContext, { log: false }));
  }
}
