import { type NextRequest, NextResponse } from 'next/server';
import { findProviderNpi, normalizeFindingsPayload } from '@/lib/intelligence/contracts';
import { parseMinConfidenceNumber } from '@/lib/intelligence/finding-filters';
import { loadFindingStorylineLinks } from '@/lib/intelligence/navigation-links';
import {
  attachAccessMetadata,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const limit = parsePositiveInt(
    req.nextUrl.searchParams.get('limit') ?? req.nextUrl.searchParams.get('pageSize'),
    10,
    100,
  );
  const requestedPage = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1, 1_000);
  const offsetParam = req.nextUrl.searchParams.get('offset');
  const offset = offsetParam
    ? parsePositiveInt(offsetParam, 0, 10_000)
    : Math.max(0, (requestedPage - 1) * limit);
  const page = offsetParam ? Math.floor(offset / limit) + 1 : requestedPage;
  const provider = req.nextUrl.searchParams.get('provider') ?? req.nextUrl.searchParams.get('providerId');
  const severity = req.nextUrl.searchParams.get('severity');
  const status = req.nextUrl.searchParams.get('status');
  const findingType = req.nextUrl.searchParams.get('type') ?? req.nextUrl.searchParams.get('findingType');
  const investigatorId = req.nextUrl.searchParams.get('investigatorId');
  const dateFrom = req.nextUrl.searchParams.get('dateFrom');
  const dateTo = req.nextUrl.searchParams.get('dateTo');
  const minConfidence = parseMinConfidenceNumber(req.nextUrl.searchParams.get('minConfidence'));
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  if (provider) {
    params.set('provider', provider);
  }

  if (severity) {
    params.set('severity', severity);
  }

  if (status) {
    params.set('status', status);
  }

  if (findingType) {
    params.set('type', findingType);
  }

  if (investigatorId) {
    params.set('investigatorId', investigatorId);
  }

  if (dateFrom) {
    params.set('dateFrom', dateFrom);
  }

  if (dateTo) {
    params.set('dateTo', dateTo);
  }

  if (minConfidence !== null) {
    params.set('minConfidence', minConfidence.toString());
  }
  const authContext = await resolveIntelligenceAuthContext();

  try {
    const upstream = await fetchBackendJson<{
      findings?: Array<{
        findingId: string;
        investigatorId: string;
        findingType: string;
        severity: string;
        status: string;
        title: string;
        summary: string;
        explanation: string;
        entityIds?: string[];
        entities?: Array<{
          entityType?: string;
          entityId?: string;
          entityLabel?: string | null;
        }>;
        metadata?: Record<string, unknown>;
        priorityScore: number;
        confidence: number;
        storylineKey: string | null;
        supportingEvidence?: Array<{
          evidenceId?: string;
          evidenceType?: string;
          snippet?: string | null;
          sourceLabel?: string | null;
          sourceId?: string | null;
          observedAt?: string | null;
          confidence?: number | null;
          relevance?: number | null;
          url?: string | null;
          metadata?: Record<string, unknown>;
        }>;
        updatedAt: string;
      }>;
      total?: number;
      snapshotReady?: boolean;
    }>('/api/findings', params, 12_000, { context: authContext });

    if (!upstream.ok) {
      console.warn('[intelligence/findings] backend returned non-ok', {
        status: upstream.status,
        authStatus: authContext.status,
        userId: authContext.userId ? '***' : null,
      });
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Findings backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    const findings = upstream.payload.findings ?? [];
    const providerNpis = new Set<string>();
    let needsGlobalStorylineFallback = false;

    for (const finding of findings) {
      if (!finding.storylineKey) {
        continue;
      }

      const providerNpi = findProviderNpi(finding.entityIds, finding.metadata);
      if (providerNpi) {
        providerNpis.add(providerNpi);
      } else {
        needsGlobalStorylineFallback = true;
      }
    }

    const storylineLinksByFindingId = await loadFindingStorylineLinks(
      providerNpis,
      needsGlobalStorylineFallback,
    );
    const normalized = normalizeFindingsPayload(upstream.payload, {
      storylineLinksByFindingId,
    });
    const payload = attachAccessMetadata({
      ...normalized,
      pageInfo: {
        page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(normalized.total / limit)),
        hasNextPage: offset + limit < normalized.total,
        returned: normalized.findings.length,
      },
    }, {
      accessMode: 'full',
      reason: 'ok',
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[intelligence/findings] backend fetch failed', {
      error: message,
      authStatus: authContext.status,
    });
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: `Findings backend request failed: ${message}`,
      },
      { status: 503 },
    );
  }
}
