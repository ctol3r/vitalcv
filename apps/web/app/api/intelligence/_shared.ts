import { getApiBase } from '@/lib/api';
import {
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
 *
 * Policy:
 * - userId present (authenticated, with or without org) → ALLOW
 * - no session (demo / unauthenticated) → ALLOW (backend serves public read)
 * - org is NEVER required for intelligence read routes
 *
 * Write/mutation operations must use requireAuthenticatedOrgContext() instead.
 */
export function canReadIntelligence(context: IntelligenceAuthContext): boolean {
  // userId present → authenticated read (org not required)
  if (context.userId) {
    return true;
  }
  // No session → allow for demo/public read; backend will serve what it can
  return true;
}

export interface IntelligenceAuthContext {
  status: IntelligenceAuthStatus;
  userId: string | null;
  email: string | null;
  role: string | null;
  orgId: string | null;
  authToken: string | null;
}

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
  authToken: string | null,
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

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
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

async function resolveSessionAuthToken(
  session: Awaited<ReturnType<typeof auth>>,
): Promise<string | null> {
  const sessionWithToken = session as Awaited<ReturnType<typeof auth>> & {
    getToken?: () => Promise<string | null> | string | null;
  };

  if (typeof sessionWithToken.getToken !== 'function') {
    return null;
  }

  try {
    const token = await sessionWithToken.getToken();
    return typeof token === 'string' && token.trim().length > 0 ? token : null;
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
      error: 'employer_context_required',
      message: 'Employer context required',
      error_description: 'Employer context required',
      workspaceSwitchHref: typeof record.workspaceSwitchHref === 'string'
        ? record.workspaceSwitchHref
        : WORKSPACE_SWITCH_HREF,
    } as T;
  }

  if (record.error === 'authentication_required' || record.error === 'unauthorized') {
    return {
      ...record,
      error: 'sign_in_required',
      message: 'Sign in required to continue',
      error_description: 'Sign in required to continue',
      signInHref: typeof record.signInHref === 'string'
        ? record.signInHref
        : SIGN_IN_HREF,
    } as T;
  }

  return payload;
}

export async function resolveIntelligenceAuthContext(): Promise<IntelligenceAuthContext> {
  let session: Awaited<ReturnType<typeof auth>>;
  try {
    session = await auth();
  } catch {
    // Clerk context unavailable (middleware bypassed or Clerk misconfigured)
    return {
      status: 'missing_session',
      userId: null,
      email: null,
      role: null,
      orgId: null,
      authToken: null,
    };
  }
  const userId = session.userId ?? null;
  const email = parseSessionEmail(session);
  const role = parseSessionRole(session);
  const authToken = userId ? await resolveSessionAuthToken(session) : null;
  const orgId = userId
    ? (parseSessionOrgId(session) ?? await resolveActiveWorkspaceOrgId(session, authToken))
    : null;

  if (!userId) {
    return {
      status: 'missing_session',
      userId: null,
      email,
      role,
      orgId: null,
      authToken: null,
    };
  }

  if (!orgId) {
    return {
      status: 'missing_org',
      userId,
      email,
      role,
      orgId: null,
      authToken,
    };
  }

  return {
    status: 'authenticated',
    userId,
    email,
    role,
    orgId,
    authToken,
  };
}

export function buildAuthFailurePayload(context: IntelligenceAuthContext) {
  if (context.status === 'missing_session') {
    return {
      error: 'sign_in_required',
      message: 'Sign in required to continue',
      error_description: 'Sign in required to continue',
      signInHref: SIGN_IN_HREF,
    };
  }

  return {
    error: 'employer_context_required',
    message: 'Employer context required',
    error_description: 'Employer context required',
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

  if (context.authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${context.authToken}`);
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
