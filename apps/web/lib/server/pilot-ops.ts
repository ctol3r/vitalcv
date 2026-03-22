import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { getBackendBase } from '@/lib/api';
import type {
  PilotOpsSummary,
  PilotQueueSource,
  PilotSeverity,
  PilotSurfaceControl,
  PilotSurfaceMode,
} from '@/lib/pilot-ops/types';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim() ?? '';

function readRole(session: Awaited<ReturnType<typeof auth>>): string | null {
  const claims = session.sessionClaims as Record<string, unknown> | undefined;
  const vitalcv = claims?.vitalcv;
  const vitalcvRole = (
    vitalcv
    && typeof vitalcv === 'object'
    && 'role' in vitalcv
    && typeof vitalcv.role === 'string'
  )
    ? vitalcv.role
    : null;

  if (typeof claims?.role === 'string' && claims.role.length > 0) {
    return claims.role;
  }

  if (typeof claims?.org_role === 'string' && claims.org_role.length > 0) {
    return claims.org_role;
  }

  return vitalcvRole;
}

function withMonitoringSecret(headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  if (MONITORING_SECRET) {
    next.set('x-monitoring-secret', MONITORING_SECRET);
  }
  return next;
}

function readEmail(session: Awaited<ReturnType<typeof auth>>): string | null {
  const email = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
}

export function getMonitoringSecret(): string | null {
  return MONITORING_SECRET || null;
}

export async function requireAdminPilotSession(): Promise<
  | { ok: true; session: Awaited<ReturnType<typeof auth>> }
  | { ok: false; status: number; error: string }
> {
  const session = await auth();

  if (!session.userId) {
    return { ok: false, status: 401, error: 'Authentication required.' };
  }

  if (readRole(session) !== 'ADMIN') {
    return { ok: false, status: 403, error: 'Admin access required.' };
  }

  if (!MONITORING_SECRET) {
    return { ok: false, status: 503, error: 'MONITORING_SECRET is not configured.' };
  }

  return { ok: true, session };
}

export async function fetchPilotOpsSummary(
  lookbackHours?: number,
): Promise<PilotOpsSummary | null> {
  if (!MONITORING_SECRET) {
    return null;
  }

  try {
    const url = new URL('/api/internal/pilot-ops', getBackendBase());
    if (typeof lookbackHours === 'number' && Number.isFinite(lookbackHours) && lookbackHours > 0) {
      url.searchParams.set('lookbackHours', String(lookbackHours));
    }

    const response = await fetch(url, {
      headers: withMonitoringSecret(),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PilotOpsSummary;
  } catch {
    return null;
  }
}

export async function fetchPilotSurfaceControls(
  lookbackHours?: number,
): Promise<PilotSurfaceControl[] | null> {
  if (!MONITORING_SECRET) {
    return null;
  }

  try {
    const url = new URL('/api/internal/pilot-ops/surfaces', getBackendBase());
    if (typeof lookbackHours === 'number' && Number.isFinite(lookbackHours) && lookbackHours > 0) {
      url.searchParams.set('lookbackHours', String(lookbackHours));
    }

    const response = await fetch(url, {
      headers: withMonitoringSecret(),
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as { controls?: PilotSurfaceControl[] } | null;
    return payload?.controls ?? null;
  } catch {
    return null;
  }
}

export async function getPilotSurfaceControl(
  surfaceId: string,
): Promise<PilotSurfaceControl | null> {
  const controls = await fetchPilotSurfaceControls();
  return controls?.find((control) => control.surfaceId === surfaceId) ?? null;
}

export async function recordPilotServerEvent(input: {
  eventType:
    | 'auth_failure'
    | 'route_failure'
    | 'support_triggered'
    | 'feedback_submitted'
    | 'sign_in'
    | 'onboarding_started'
    | 'onboarding_completed'
    | 'readiness_viewed'
    | 'blocker_opened'
    | 'blocker_resolved'
    | 'opportunity_viewed'
    | 'apply_started'
    | 'apply_submitted'
    | 'application_detail_viewed'
    | 'application_status_viewed'
    | 'alert_viewed'
    | 'wallet_viewed'
    | 'return_session';
  route: string;
  session?: Awaited<ReturnType<typeof auth>> | null;
  severity?: PilotSeverity | null;
  message?: string | null;
  entity?: {
    kind?: string | null;
    id?: string | null;
    label?: string | null;
    objectType?: string | null;
  } | null;
  details?: Record<string, unknown> | null;
  queueItem?: {
    source: Extract<PilotQueueSource, 'feedback' | 'support' | 'auth' | 'route_failure' | 'system_failure'>;
    title: string;
    message: string;
    severity?: PilotSeverity | null;
    blocking?: boolean;
  } | null;
}): Promise<void> {
  try {
    const session = input.session ?? await auth();
    const headers = buildMarketplaceHeaders(session, {
      'Content-Type': 'application/json',
    });
    const role = readRole(session);
    const email = readEmail(session);

    if (role) {
      headers.set('x-clerk-user-role', role);
    }
    if (session.orgId) {
      headers.set('x-org-id', session.orgId);
    }
    if (email) {
      headers.set('x-clerk-user-email', email);
    }

    await fetch(`${getBackendBase()}/api/pilot-ops/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        eventType: input.eventType,
        route: input.route,
        severity: input.severity ?? null,
        message: input.message ?? null,
        entity: input.entity ?? null,
        details: input.details ?? null,
        queueItem: input.queueItem ?? null,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    // Launch-day telemetry must remain best-effort.
  }
}

export async function updatePilotSurfaceControl(input: {
  surfaceId: string;
  mode: PilotSurfaceMode;
  reason?: string | null;
}): Promise<Response> {
  const admin = await requireAdminPilotSession();
  if (!admin.ok) {
    return new Response(JSON.stringify({ error: admin.error }), {
      status: admin.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = buildMarketplaceHeaders(admin.session, {
    'Content-Type': 'application/json',
  });
  headers.set('x-clerk-user-role', readRole(admin.session) ?? 'ADMIN');
  headers.set('x-monitoring-secret', MONITORING_SECRET);

  if (admin.session.orgId) {
    headers.set('x-org-id', admin.session.orgId);
  }

  return fetch(`${getBackendBase()}/api/internal/pilot-ops/surfaces/${encodeURIComponent(input.surfaceId)}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      mode: input.mode,
      reason: input.reason ?? null,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
}

export async function forwardPilotOpsRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const admin = await requireAdminPilotSession();
  if (!admin.ok) {
    return new Response(JSON.stringify({ error: admin.error }), {
      status: admin.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = buildMarketplaceHeaders(admin.session, init?.headers);
  headers.set('x-monitoring-secret', MONITORING_SECRET);
  headers.set('x-clerk-user-role', readRole(admin.session) ?? 'ADMIN');

  if (admin.session.orgId) {
    headers.set('x-org-id', admin.session.orgId);
  }

  return fetch(`${getBackendBase()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
}
