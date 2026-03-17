import { getApiBase } from '@/lib/api';
import {
  normalizeActionsPayload,
  normalizeFindingsPayload,
  normalizeProvidersPayload,
  normalizeStorylinesPayload,
  normalizeSystemHealthPayload,
  summarizeGraph,
  type IntelligenceAccessMode,
  type IntelligenceAccessReason,
} from '@/lib/intelligence/contracts';
import type { WorkspaceList } from '@/types/workspace';
import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

const FALLBACK_BACKEND = 'http://localhost:4000';
const WORKSPACE_SWITCH_HREF = '/workspace/switch';
const SIGN_IN_HREF = '/sign-in';

export type IntelligenceAuthStatus = 'authenticated' | 'missing_session' | 'missing_org';

/**
 * Whether the user has enough auth to read intelligence data.
 * Both 'authenticated' (with org) and 'missing_org' (user logged in, no org)
 * can read — the backend skips tenant context for /api/intelligence/* paths.
 */
export function canReadIntelligence(context: IntelligenceAuthContext): boolean {
  return context.status === 'authenticated' || context.status === 'missing_org';
}

export interface IntelligenceAuthContext {
  status: IntelligenceAuthStatus;
  userId: string | null;
  email: string | null;
  role: string | null;
  orgId: string | null;
}

export type ReadOnlyFallbackKind =
  | 'actions'
  | 'calibration'
  | 'feed'
  | 'findings'
  | 'graph'
  | 'investigation-workbench'
  | 'outcomes'
  | 'providers'
  | 'storylines'
  | 'system-health';

export type PublicSnapshotKind =
  | 'findings'
  | 'graph'
  | 'investigation-workbench'
  | 'providers'
  | 'storylines';

interface BuildForwardHeadersOptions {
  context?: IntelligenceAuthContext;
}

interface FetchBackendJsonOptions extends BuildForwardHeadersOptions {
  headers?: HeadersInit;
}

interface AccessMetadataShape {
  accessMode?: IntelligenceAccessMode;
  reason?: IntelligenceAccessReason;
}

interface RouteErrorPayload {
  error?: unknown;
  error_description?: unknown;
  message?: unknown;
}

function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    getApiBase() ||
    process.env.NEXT_PUBLIC_API_URL ||
    FALLBACK_BACKEND
  );
}

function parseSessionEmail(session: Awaited<ReturnType<typeof auth>>): string | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  return typeof claims?.email === 'string' ? claims.email : null;
}

function parseSessionRole(session: Awaited<ReturnType<typeof auth>>): string | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const vitalcv = claims?.vitalcv;
  const vitalcvRole = (
    vitalcv && typeof vitalcv === 'object' && 'role' in vitalcv && typeof vitalcv.role === 'string'
      ? vitalcv.role
      : null
  );

  const role = typeof claims?.role === 'string'
    ? claims.role
    : typeof claims?.org_role === 'string'
      ? claims.org_role
      : vitalcvRole;

  return role;
}

function parseSessionOrgId(session: Awaited<ReturnType<typeof auth>>): string | null {
  return typeof (session as { orgId?: unknown }).orgId === 'string'
    ? (session as { orgId: string }).orgId
    : null;
}

async function resolveActiveWorkspaceOrgId(
  session: Awaited<ReturnType<typeof auth>>,
): Promise<string | null> {
  if (!session.userId) {
    return null;
  }

  const headers = new Headers();
  headers.set('x-clerk-user-id', session.userId);

  const email = parseSessionEmail(session);
  if (email) {
    headers.set('x-clerk-user-email', email);
  }

  try {
    const response = await fetch(`${backendBase()}/api/me/workspaces`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as WorkspaceList | null;
    const activeOrgId = payload?.activeOrgId;
    return typeof activeOrgId === 'string' && activeOrgId.trim().length > 0
      ? activeOrgId
      : null;
  } catch {
    return null;
  }
}

export function decorateAuthFailurePayload<T>(payload: T, status: number): T {
  if (!payload || typeof payload !== 'object' || status < 400) {
    return payload;
  }

  const record = payload as Record<string, unknown>;

  if (record.error === 'organization_context_required') {
    return {
      ...record,
      error_description: typeof record.error_description === 'string' && record.error_description.trim().length > 0
        ? record.error_description
        : 'Organization workspace required. Switch to an organization workspace to continue.',
      workspaceSwitchHref: typeof record.workspaceSwitchHref === 'string'
        ? record.workspaceSwitchHref
        : WORKSPACE_SWITCH_HREF,
    } as T;
  }

  if (record.error === 'authentication_required' || record.error === 'unauthorized') {
    return {
      ...record,
      error_description: typeof record.error_description === 'string' && record.error_description.trim().length > 0
        ? record.error_description
        : 'Sign in to access intelligence.',
      signInHref: typeof record.signInHref === 'string'
        ? record.signInHref
        : SIGN_IN_HREF,
    } as T;
  }

  return payload;
}

export async function resolveIntelligenceAuthContext(): Promise<IntelligenceAuthContext> {
  const session = await auth();
  const userId = session.userId ?? null;
  const email = parseSessionEmail(session);
  const role = parseSessionRole(session);
  const orgId = userId
    ? (parseSessionOrgId(session) ?? await resolveActiveWorkspaceOrgId(session))
    : null;

  if (!userId) {
    return {
      status: 'missing_session',
      userId: null,
      email,
      role,
      orgId: null,
    };
  }

  if (!orgId) {
    return {
      status: 'missing_org',
      userId,
      email,
      role,
      orgId: null,
    };
  }

  return {
    status: 'authenticated',
    userId,
    email,
    role,
    orgId,
  };
}

export function buildAuthFailurePayload(context: IntelligenceAuthContext) {
  if (context.status === 'missing_session') {
    return {
      error: 'authentication_required',
      error_description: 'Sign in to access intelligence.',
      signInHref: SIGN_IN_HREF,
    };
  }

  return {
    error: 'organization_context_required',
    error_description: 'Organization workspace required. Switch to an organization workspace to continue.',
    workspaceSwitchHref: WORKSPACE_SWITCH_HREF,
  };
}

export function authFailureStatus(context: IntelligenceAuthContext): number {
  return context.status === 'missing_session' ? 401 : 403;
}

export function logIntelligenceFallbackUsage(
  route: string,
  context: IntelligenceAuthContext,
  mode: 'read_fallback' | 'write_block' | 'backend_fallback',
) {
  const event = {
    event: 'intelligence_auth_fallback',
    route,
    mode,
    authStatus: context.status,
    hasUserId: Boolean(context.userId),
    hasOrgId: Boolean(context.orgId),
    hasRole: Boolean(context.role),
  };

  if (mode === 'backend_fallback') {
    console.warn(JSON.stringify(event));
    return;
  }

  console.info(JSON.stringify(event));
}

export function buildPageInfo(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasNextPage: page * pageSize < total,
    returned: total === 0 ? 0 : Math.min(pageSize, Math.max(0, total - ((page - 1) * pageSize))),
  };
}

function parsePage(searchParams: URLSearchParams, fallback: number) {
  return parsePositiveInt(searchParams.get('page'), fallback, 1_000);
}

function parsePageSize(searchParams: URLSearchParams, fallback: number, max: number) {
  return parsePositiveInt(
    searchParams.get('limit') ?? searchParams.get('pageSize'),
    fallback,
    max,
  );
}

export function buildReadOnlyFallbackPayload(
  kind: ReadOnlyFallbackKind,
  request: Pick<NextRequest, 'nextUrl'>,
  context: IntelligenceAuthContext,
  options: {
    log?: boolean;
  } = {},
) {
  const generatedAt = new Date().toISOString();
  const searchParams = request.nextUrl.searchParams;

  if (options.log !== false) {
    logIntelligenceFallbackUsage(request.nextUrl.pathname, context, 'read_fallback');
  }

  switch (kind) {
    case 'providers': {
      const page = parsePage(searchParams, 1);
      const pageSize = parsePageSize(searchParams, 12, 100);
      const query = searchParams.get('q') ?? '';
      return {
        ...normalizeProvidersPayload({ entries: [] }, query),
        pageInfo: buildPageInfo(page, pageSize, 0),
        accessMode: 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    }
    case 'findings': {
      const pageSize = parsePageSize(searchParams, 10, 100);
      const page = searchParams.get('offset')
        ? Math.floor(parsePositiveInt(searchParams.get('offset'), 0, 10_000) / pageSize) + 1
        : parsePage(searchParams, 1);
      return {
        ...normalizeFindingsPayload({ findings: [], total: 0 }),
        pageInfo: buildPageInfo(page, pageSize, 0),
        accessMode: 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    }
    case 'storylines': {
      const page = parsePage(searchParams, 1);
      const pageSize = parsePageSize(searchParams, 8, 100);
      return {
        ...normalizeStorylinesPayload({ storylines: [], total: 0 }),
        pageInfo: buildPageInfo(page, pageSize, 0),
        accessMode: 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    }
    case 'actions': {
      const pageSize = parsePageSize(searchParams, 10, 100);
      const page = searchParams.get('offset')
        ? Math.floor(parsePositiveInt(searchParams.get('offset'), 0, 10_000) / pageSize) + 1
        : parsePage(searchParams, 1);
      return {
        ...normalizeActionsPayload({ actions: [], total: 0 }),
        pageInfo: buildPageInfo(page, pageSize, 0),
        accessMode: context.status === 'authenticated' ? 'full' : 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    }
    case 'graph':
      return {
        nodes: [],
        edges: [],
        stats: summarizeGraph([], []),
        focusNodeId: null,
        generatedAt,
        accessMode: 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    case 'system-health':
      return {
        ...normalizeSystemHealthPayload({
        systemStatus: null,
        integrity: null,
        graphIntegrity: null,
        }),
        accessMode: context.status === 'authenticated' ? 'full' : 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    case 'feed':
      return {
        generatedAt,
        total: 0,
        counts: {
          finding: 0,
          storyline: 0,
          prediction: 0,
          insight: 0,
          early_warning: 0,
        },
        items: [],
      };
    case 'calibration':
      return {
        schema: 'https://vitalcv.com/calibration/v1',
        stats: [],
        summary: {
          totalOutcomes: 0,
          resolvedTodayCount: 0,
          overallTruePositiveRate: 0,
          overallFalsePositiveRate: 0,
          worstPerformingInvestigators: [],
          bestPerformingInvestigators: [],
          generatedAt,
        },
        generatedAt,
      };
    case 'outcomes':
      return {
        schema: 'https://vitalcv.com/outcome-history/v1',
        outcomes: [],
        total: 0,
        generatedAt,
      };
    case 'investigation-workbench':
      return {
        anchor: {
          npi: searchParams.get('npi') ?? undefined,
          findingId: searchParams.get('findingId') ?? undefined,
          storylineId: searchParams.get('storylineId') ?? undefined,
        },
        provider: null,
        finding: null,
        storyline: null,
        relatedFindings: [],
        navigation: null,
        generatedAt,
        uiHints: {
          copilotPrompt: 'Summarize risk posture for this provider',
          copilotSummary: null,
          highlightNodeIds: [],
        },
        accessMode: 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
    default:
      return {
        generatedAt,
        accessMode: context.status === 'authenticated' ? 'full' : 'public_snapshot',
        reason: context.status === 'authenticated' ? 'warming_up' : context.status,
      };
  }
}

function publicSnapshotPath(kind: PublicSnapshotKind): string {
  switch (kind) {
    case 'providers':
      return '/api/intelligence/public/providers';
    case 'findings':
      return '/api/intelligence/public/findings';
    case 'storylines':
      return '/api/intelligence/public/storylines';
    case 'graph':
      return '/api/intelligence/public/graph';
    case 'investigation-workbench':
      return '/api/intelligence/public/investigation-workbench';
    default:
      return '/api/intelligence/public/providers';
  }
}

export function resolveAccessReason(
  context: IntelligenceAuthContext,
  mode: IntelligenceAccessMode,
  payload?: unknown,
): IntelligenceAccessReason {
  const asObject = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const ready = typeof asObject?.snapshotReady === 'boolean' ? asObject.snapshotReady : null;

  if (ready === false) {
    return 'warming_up';
  }

  if (mode === 'full') {
    return 'ok';
  }

  if (context.status === 'missing_session') {
    return 'missing_session';
  }

  if (context.status === 'missing_org') {
    return 'missing_org';
  }

  return 'ok';
}

export function attachAccessMetadata<T>(
  payload: T,
  input: {
    accessMode: IntelligenceAccessMode;
    reason: IntelligenceAccessReason;
  },
): T & AccessMetadataShape {
  if (!payload || typeof payload !== 'object') {
    return payload as T & AccessMetadataShape;
  }

  return {
    ...(payload as Record<string, unknown>),
    accessMode: input.accessMode,
    reason: input.reason,
  } as T & AccessMetadataShape;
}

export function coerceRouteErrorPayload(
  payload: unknown,
  fallback: {
    error: string;
    error_description: string;
    message?: string;
  },
) {
  if (payload && typeof payload === 'object') {
    const record = payload as RouteErrorPayload;
    if (
      typeof record.error === 'string'
      || typeof record.error_description === 'string'
      || typeof record.message === 'string'
    ) {
      return payload;
    }
  }

  return fallback;
}

export async function fetchPublicSnapshotJson<T>(
  kind: PublicSnapshotKind,
  searchParams: URLSearchParams | undefined,
  context: IntelligenceAuthContext,
  timeoutMs = 12_000,
) {
  return fetchBackendJson<T>(
    publicSnapshotPath(kind),
    searchParams,
    timeoutMs,
    { context },
  );
}

export function requireAuthenticatedOrgContext(
  request: Pick<NextRequest, 'method' | 'nextUrl' | 'url'>,
  context: IntelligenceAuthContext,
) {
  if (context.status === 'authenticated') {
    return null;
  }

  const requestPath = request.nextUrl?.pathname ?? new URL(request.url).pathname;
  logIntelligenceFallbackUsage(requestPath, context, 'write_block');
  return {
    status: authFailureStatus(context),
    payload: buildAuthFailurePayload(context),
  };
}

export function buildForwardHeadersFromContext(
  context: IntelligenceAuthContext,
  init?: HeadersInit,
) {
  const headers = new Headers(init);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (context.userId) {
    headers.set('x-clerk-user-id', context.userId);
  }

  if (context.email) {
    headers.set('x-clerk-user-email', context.email);
  }

  if (context.role) {
    headers.set('x-clerk-user-role', context.role);
    headers.set('x-user-role', context.role);
  }

  if (context.orgId) {
    headers.set('x-org-id', context.orgId);
  }

  return headers;
}

export async function buildForwardHeaders(
  init?: HeadersInit,
  options: BuildForwardHeadersOptions = {},
) {
  const context = options.context ?? await resolveIntelligenceAuthContext();
  return buildForwardHeadersFromContext(context, init);
}

export async function fetchBackendJson<T>(
  path: string,
  searchParams?: URLSearchParams,
  timeoutMs = 12_000,
  options: FetchBackendJsonOptions = {},
) {
  const headers = await buildForwardHeaders(options.headers, {
    context: options.context,
  });
  const url = `${backendBase()}${path}${searchParams && searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  const payload = decorateAuthFailurePayload(await response.json().catch(() => ({})), response.status);
  return {
    ok: response.ok,
    status: response.status,
    payload: payload as T,
  };
}

export function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}
