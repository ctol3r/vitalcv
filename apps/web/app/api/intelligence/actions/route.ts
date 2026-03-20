import { type NextRequest, NextResponse } from 'next/server';
import {
  generateActionsFromFindings,
  normalizeActionsPayload,
  normalizeFindingsPayload,
  type IntelligenceAction,
} from '@/lib/intelligence/contracts';
import {
  attachAccessMetadata,
  authFailureStatus,
  buildAuthFailurePayload,
  canReadIntelligence,
  coerceRouteErrorPayload,
  fetchBackendJson,
  logIntelligenceFallbackUsage,
  parsePositiveInt,
  resolveIntelligenceAuthContext,
} from '../_shared';

export const runtime = 'nodejs';

function actionKey(action: Pick<IntelligenceAction, 'actionType' | 'providerNpi' | 'sourceFindingIds'>): string {
  return [
    action.actionType.trim().toUpperCase(),
    action.providerNpi ?? '',
    [...action.sourceFindingIds].sort().join(','),
  ].join('|');
}

function matchesEntityFilter(action: IntelligenceAction, entity: string | null): boolean {
  if (!entity) {
    return true;
  }

  const normalized = entity.trim().toLowerCase();
  return (
    action.providerNpi?.toLowerCase() === normalized
    || action.targetLabel?.toLowerCase().includes(normalized) === true
  );
}

function filterActions(actions: IntelligenceAction[], filters: {
  entity: string | null;
  priority: string | null;
  actionType: string | null;
  status: string | null;
}): IntelligenceAction[] {
  return actions.filter((action) => {
    if (!matchesEntityFilter(action, filters.entity)) {
      return false;
    }

    if (filters.priority && action.priority.toLowerCase() !== filters.priority.toLowerCase()) {
      return false;
    }

    if (filters.actionType && action.actionType.toLowerCase() !== filters.actionType.toLowerCase()) {
      return false;
    }

    if (filters.status && action.status.toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }

    return true;
  });
}

export async function GET(req: NextRequest) {
  const authContext = await resolveIntelligenceAuthContext();
  if (!canReadIntelligence(authContext)) {
    return NextResponse.json(buildAuthFailurePayload(authContext), {
      status: authFailureStatus(authContext),
    });
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
  const widenedLimit = Math.min(Math.max(page * limit * 3, 60), 200);
  const params = new URLSearchParams({
    limit: String(widenedLimit),
    offset: '0',
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
    const findingsParams = new URLSearchParams({
      limit: String(widenedLimit),
      offset: '0',
    });

    if (entity && /^\d{10}$/.test(entity.trim())) {
      findingsParams.set('provider', entity);
    }

    const [upstream, findingsUpstream] = await Promise.all([
      fetchBackendJson<{
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
      }>('/api/actions', params, 12_000, { context: authContext }),
      fetchBackendJson<{
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
      }>('/api/findings', findingsParams, 12_000, { context: authContext }).catch(() => null),
    ]);

    if (!upstream.ok) {
      logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
      return NextResponse.json(
        coerceRouteErrorPayload(upstream.payload, {
          error: 'backend_request_failed',
          error_description: `Action queue backend returned ${upstream.status}.`,
        }),
        { status: upstream.status >= 400 ? upstream.status : 503 },
      );
    }

    const normalized = normalizeActionsPayload(upstream.payload);
    const synthesizedActions = findingsUpstream?.ok
      ? generateActionsFromFindings(
        normalizeFindingsPayload(findingsUpstream.payload).findings,
      )
      : [];
    const merged = new Map<string, IntelligenceAction>();

    for (const action of synthesizedActions) {
      merged.set(actionKey(action), action);
    }

    for (const action of normalized.actions) {
      merged.set(actionKey(action), action);
    }

    const mergedActions = filterActions(
      [...merged.values()].sort((left, right) => (
        right.priorityScore - left.priorityScore
        || Date.parse(right.createdAt) - Date.parse(left.createdAt)
      )),
      {
        entity,
        priority,
        actionType,
        status,
      },
    );
    const pagedActions = mergedActions.slice(offset, offset + limit);
    const total = mergedActions.length;

    return NextResponse.json(attachAccessMetadata({
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
    }, {
      accessMode: 'full',
      reason: 'ok',
    }));
  } catch (error) {
    logIntelligenceFallbackUsage(req.nextUrl.pathname, authContext, 'backend_fallback');
    return NextResponse.json(
      {
        error: 'backend_request_failed',
        error_description: error instanceof Error ? error.message : 'Action queue request failed.',
        message: error instanceof Error ? error.message : 'Unknown request failure',
      },
      { status: 503 },
    );
  }
}
