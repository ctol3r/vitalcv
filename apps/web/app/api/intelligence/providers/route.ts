import { type NextRequest, NextResponse } from 'next/server';
import { getBackendBase } from '@/lib/api';
import { normalizeProvidersPayload } from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  buildForwardHeaders,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

interface DirectoryEntryPayload {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialCount: number;
  activeCredentials: number;
  primaryIssuer: string | null;
  credentialHealth: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';
  lastVerifiedAt: string | null;
  trustScore: number;
}

async function loadCanonicalTrustScores(
  entries: DirectoryEntryPayload[],
  authContext: Awaited<ReturnType<typeof resolveIntelligenceAuthContext>>,
): Promise<Map<string, number>> {
  const npis = [...new Set(entries.map((entry) => entry.npi).filter((npi) => /^\d{10}$/.test(npi)))];
  if (npis.length === 0) {
    return new Map();
  }

  const response = await fetch(`${getBackendBase()}/api/trust/score/batch`, {
    method: 'POST',
    headers: await buildForwardHeaders({
      'Content-Type': 'application/json',
    }, {
      context: authContext,
    }),
    body: JSON.stringify({ npis }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({})) as {
    results?: Array<{
      npi?: string;
      score?: number;
    }>;
  };

  if (!response.ok) {
    throw new Error(`Canonical provider trust batch returned ${response.status}.`);
  }

  return new Map(
    (payload.results ?? [])
      .filter((entry): entry is { npi: string; score: number } => (
        typeof entry?.npi === 'string'
        && typeof entry?.score === 'number'
        && Number.isFinite(entry.score)
      ))
      .map((entry) => [entry.npi, Math.max(0, Math.min(100, Math.round(entry.score)))])
  );
}

export async function GET(req: NextRequest) {
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
  const authContext = await resolveIntelligenceAuthContext();

  if (trimmedQuery.length > 0) {
    params.set('q', trimmedQuery);
  }

  try {
    const upstream = await fetchBackendJson<{
      entries?: DirectoryEntryPayload[];
      totalProviders?: number;
      pageInfo?: {
        totalAvailable?: number;
      };
    }>('/api/directory', params, 12_000, { context: authContext });

    if (!upstream.ok) {
      console.warn('[intelligence/providers] backend returned non-ok', {
        status: upstream.status,
        authStatus: authContext.status,
        userId: authContext.userId ? '***' : null,
      });
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Providers backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    const canonicalTrustScores = await loadCanonicalTrustScores(upstream.payload.entries ?? [], authContext);
    const response = normalizeProvidersPayload({
      ...upstream.payload,
      entries: (upstream.payload.entries ?? []).map((entry) => ({
        ...entry,
        trustScore: canonicalTrustScores.get(entry.npi) ?? entry.trustScore,
      })),
    }, query);
    const providers = fetchAllForSearch
      ? response.providers.slice((page - 1) * limit, page * limit)
      : response.providers;
    const total = fetchAllForSearch
      ? response.total
      : upstream.payload.pageInfo?.totalAvailable ?? upstream.payload.totalProviders ?? response.total;

    const payload = attachAccessMetadata({
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
    }, {
      accessMode: 'full',
      reason: 'ok',
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[intelligence/providers] backend fetch failed', {
      error: message,
      authStatus: authContext.status,
    });
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: `Providers backend request failed: ${message}`,
      },
      { status: 503 },
    );
  }
}
