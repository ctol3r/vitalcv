import { type NextRequest, NextResponse } from 'next/server';
import { normalizeActionsPayload } from '@/lib/intelligence/contracts';
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
    return NextResponse.json(buildReadOnlyFallbackPayload('actions', req, authContext));
  }

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
  const entity = req.nextUrl.searchParams.get('entity');
  const priority = req.nextUrl.searchParams.get('priority');
  const actionType = req.nextUrl.searchParams.get('actionType');
  const status = req.nextUrl.searchParams.get('status');
  const widenedLimit = status
    ? Math.min(Math.max(page * limit * 3, 60), 200)
    : limit;
  const params = new URLSearchParams({
    limit: String(widenedLimit),
    offset: String(status ? 0 : offset),
  });

  if (entity) {
    params.set('entity', entity);
  }

  if (priority) {
    params.set('priority', priority);
  }

  if (actionType) {
    params.set('actionType', actionType);
  }

  if (status) {
    params.set('status', status);
  }

  try {
    const upstream = await fetchBackendJson<{
      actions?: Array<{
        actionId: string;
        actionType: string;
        priority: string;
        priorityScore: number;
        status: string;
        recommendedAction: string;
        explanation: string;
        confidence: number;
        createdAt: string;
        sourceFindingIds?: string[];
        targetEntity?: {
          entityType?: string;
          entityId?: string;
          entityLabel?: string | null;
        };
        evidence?: Array<{
          label?: string;
          snippet?: string | null;
          source?: string | null;
        }>;
      }>;
      total?: number;
    }>('/api/actions', params, 12_000, { context: authContext });

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(buildReadOnlyFallbackPayload('actions', req, authContext, { log: false }));
    }

    const normalized = normalizeActionsPayload(upstream.payload);
    const filteredActions = normalized.actions.filter((action) => {
      if (!status) {
        return true;
      }

      return action.status.toLowerCase() === status.toLowerCase();
    });
    const pagedActions = status
      ? filteredActions.slice(offset, offset + limit)
      : filteredActions;
    const total = status ? filteredActions.length : normalized.total;

    return NextResponse.json({
      ...normalized,
      actions: pagedActions,
      total,
      pageInfo: {
        page,
        pageSize: limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNextPage: offset + limit < total,
        returned: pagedActions.length,
      },
    });
  } catch (error) {
    void error;
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(buildReadOnlyFallbackPayload('actions', req, authContext, { log: false }));
  }
}
