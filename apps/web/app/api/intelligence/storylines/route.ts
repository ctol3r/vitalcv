import { type NextRequest, NextResponse } from 'next/server';
import { normalizeStorylinesPayload } from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  canReadIntelligence,
  coerceRouteErrorPayload,
  fetchBackendJson,
  fetchPublicSnapshotJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveAccessReason,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  const limit = parsePositiveInt(
    req.nextUrl.searchParams.get('limit') ?? req.nextUrl.searchParams.get('pageSize'),
    8,
    100,
  );
  const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1, 100);
  const provider = req.nextUrl.searchParams.get('provider');
  const severity = req.nextUrl.searchParams.get('severity');
  const status = req.nextUrl.searchParams.get('status');
  const storylineType = req.nextUrl.searchParams.get('storylineType');
  const perspective = req.nextUrl.searchParams.get('perspective');
  const requiredWindow = Math.min(page * limit, 100);
  const params = new URLSearchParams({
    limit: String(Math.max(limit, requiredWindow)),
    sync: 'false',
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

  if (storylineType) {
    params.set('storylineType', storylineType);
  }

  if (perspective) {
    params.set('perspective', perspective);
  }

  try {
    const upstream = canReadIntelligence(authContext)
      ? await fetchBackendJson<{
      storylines?: Array<{
        storylineId: string;
        storylineType: string;
        perspective: string;
        title: string;
        summary: string;
        whyItMatters: string;
        severity: string;
        status: string;
        confidence: number;
        entityIds: string[];
        recommendedActions: string[];
        supportingEvidence?: Array<{
          source: string;
          bullet: string;
          observedAt: string;
          confidence: number;
        }>;
        findingIds: string[];
        progressionScore: number;
        lastActivityAt: string;
      }>;
      total?: number;
      snapshotReady?: boolean;
    }>('/api/storylines', params, 12_000, { context: authContext })
      : await fetchPublicSnapshotJson<{
      storylines?: Array<{
        storylineId: string;
        storylineType: string;
        perspective: string;
        title: string;
        summary: string;
        whyItMatters: string;
        severity: string;
        status: string;
        confidence: number;
        entityIds: string[];
        recommendedActions: string[];
        supportingEvidence?: Array<{
          source: string;
          bullet: string;
          observedAt: string;
          confidence: number;
        }>;
        findingIds: string[];
        progressionScore: number;
        lastActivityAt: string;
      }>;
      total?: number;
      snapshotReady?: boolean;
    }>('storylines', params, authContext, 12_000);

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_unavailable',
          error_description: 'Storylines unavailable. Try again when the backend is reachable.',
        }),
        { status: upstream.status >= 400 ? upstream.status : 503 },
      );
    }

    const normalized = normalizeStorylinesPayload(upstream.payload);
    const sliceStart = Math.max(0, (page - 1) * limit);
    const sliceEnd = sliceStart + limit;
    const pageStorylines = normalized.storylines.slice(sliceStart, sliceEnd);

    return NextResponse.json(attachAccessMetadata({
      ...normalized,
      storylines: pageStorylines,
      pageInfo: {
        page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(normalized.total / limit)),
        hasNextPage: sliceEnd < normalized.total,
        returned: pageStorylines.length,
      },
    }, {
      accessMode: canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
      reason: resolveAccessReason(
        authContext,
        canReadIntelligence(authContext) ? 'full' : 'public_snapshot',
        upstream.payload,
      ),
    }));
  } catch (error) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_unavailable',
        error_description: 'Storylines unavailable. Try again when the backend is reachable.',
        message: error instanceof Error ? error.message : 'Unknown request failure',
      },
      { status: 503 },
    );
  }
}
