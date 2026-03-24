'use client';

export type PilotReporterKind = 'feedback' | 'issue' | 'support';
export type PilotReporterType = 'nps' | 'bug' | 'feature';
export type PilotSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PilotMetricEventType =
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
  | 'return_session'
  | 'feedback_submitted'
  | 'support_triggered'
  | 'auth_failure'
  | 'route_failure'
  // UX-8: UX friction telemetry events
  | 'npi_submitted'
  | 'source_check_started'
  | 'readiness_revealed'
  | 'accordion_expanded'
  | 'evidence_viewer_opened'
  | 'share_cta_clicked'
  | 'employer_action_clicked'
  | 'page_load_timing'
  | 'dead_end_reached'
  | 'nav_item_clicked';

export interface PilotEntityContext {
  kind?: string | null;
  id?: string | null;
  label?: string | null;
  objectType?: string | null;
}

export interface PilotReporterOpenOptions {
  kind?: PilotReporterKind;
  type?: PilotReporterType;
  title?: string | null;
  messagePrefill?: string | null;
  severity?: PilotSeverity | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
}

export interface TrackPilotEventOptions {
  eventType: PilotMetricEventType;
  route?: string | null;
  role?: string | null;
  message?: string | null;
  severity?: PilotSeverity | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
  queueItem?: {
    source: 'feedback' | 'support' | 'auth' | 'route_failure' | 'system_failure';
    title: string;
    message: string;
    severity?: PilotSeverity | null;
    blocking?: boolean;
  } | null;
  dedupeKey?: string | null;
  oncePerSession?: boolean;
}

export interface SubmitPilotFeedbackOptions {
  kind: PilotReporterKind;
  type: PilotReporterType;
  route?: string | null;
  message?: string | null;
  email?: string | null;
  score?: number | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
}

const REPORTER_OPEN_EVENT = 'vital:pilot-reporter:open';

function trim(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function routeWithQuery(pathname: string, search: string): string {
  return search.length > 0 ? `${pathname}${search}` : pathname;
}

function sessionKey(prefix: string, suffix: string): string {
  return `vitalcv:${prefix}:${suffix}`;
}

export function openPilotReporter(options: PilotReporterOpenOptions = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent<PilotReporterOpenOptions>(REPORTER_OPEN_EVENT, {
    detail: options,
  }));
}

export function pilotReporterOpenEventName(): string {
  return REPORTER_OPEN_EVENT;
}

export function inferPilotRole(pathname: string): string {
  if (pathname.startsWith('/holder') || pathname.startsWith('/onboarding') || pathname.startsWith('/passport')) {
    return 'CLINICIAN';
  }
  if (pathname.startsWith('/verifier') || pathname.startsWith('/employers')) {
    return 'VERIFIER';
  }
  if (pathname.startsWith('/issuer')) {
    return 'ISSUER';
  }
  if (pathname.startsWith('/internal')) {
    return 'ADMIN';
  }
  if (pathname.startsWith('/intelligence') || pathname.startsWith('/findings') || pathname.startsWith('/providers') || pathname.startsWith('/storylines') || pathname.startsWith('/actions') || pathname.startsWith('/investigations') || pathname.startsWith('/graph')) {
    return 'AUTHENTICATED';
  }
  return 'GUEST';
}

export function inferPilotEntity(
  pathname: string,
  searchParams?: Pick<URLSearchParams, 'get'> | null,
): PilotEntityContext | null {
  const segments = pathname.split('/').filter(Boolean);
  const segment = segments[1] ?? null;

  if (segments[0] === 'opportunities' && segment) {
    return { kind: 'opportunity', id: segment, label: segment, objectType: 'opportunity' };
  }

  if (segments[0] === 'passport' && segment) {
    return { kind: 'passport', id: segment, label: segment, objectType: 'passport' };
  }

  if (segments[0] === 'holder' && segments[1] === 'applications') {
    const applicationId = trim(searchParams?.get('applicationId'));
    return applicationId
      ? { kind: 'application', id: applicationId, label: applicationId, objectType: 'application' }
      : { kind: 'application_list', objectType: 'application' };
  }

  if (segments[0] === 'employers' && segment) {
    return { kind: 'employer', id: segment, label: segment, objectType: 'employer' };
  }

  if (segments[0] === 'intelligence') {
    const provider = trim(searchParams?.get('npi'));
    const findingId = trim(searchParams?.get('findingId'));
    const storylineId = trim(searchParams?.get('storylineId'));
    if (findingId) {
      return { kind: 'finding', id: findingId, label: findingId, objectType: 'finding' };
    }
    if (storylineId) {
      return { kind: 'storyline', id: storylineId, label: storylineId, objectType: 'storyline' };
    }
    if (provider) {
      return { kind: 'provider', id: provider, label: provider, objectType: 'provider' };
    }
    const view = trim(searchParams?.get('view'));
    return view ? { kind: 'intelligence_view', id: view, label: view, objectType: 'view' } : null;
  }

  return null;
}

export function currentPilotContext(): {
  route: string;
  role: string;
  entity: PilotEntityContext | null;
} {
  if (typeof window === 'undefined') {
    return {
      route: '/',
      role: 'GUEST',
      entity: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    route: routeWithQuery(window.location.pathname, window.location.search),
    role: inferPilotRole(window.location.pathname),
    entity: inferPilotEntity(window.location.pathname, params),
  };
}

async function postJson(path: string, body: Record<string, unknown>): Promise<void> {
  await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    keepalive: true,
  });
}

export async function trackPilotEvent(options: TrackPilotEventOptions): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const context = currentPilotContext();
  const route = trim(options.route) ?? context.route;
  const role = trim(options.role) ?? context.role;
  const entity = options.entity ?? context.entity;
  const dedupeKey = trim(options.dedupeKey) ?? `${options.eventType}:${route}`;

  if (options.oncePerSession !== false && typeof window.sessionStorage !== 'undefined') {
    const existing = window.sessionStorage.getItem(sessionKey('pilot-event', dedupeKey));
    if (existing === '1') {
      return;
    }
    window.sessionStorage.setItem(sessionKey('pilot-event', dedupeKey), '1');
  }

  try {
    await postJson('/api/pilot-ops/events', {
      eventType: options.eventType,
      route,
      role,
      message: trim(options.message),
      severity: options.severity ?? null,
      entity,
      details: options.details ?? null,
      queueItem: options.queueItem ?? null,
    });
  } catch {
    // Pilot telemetry should never block the primary user action.
  }
}

export async function submitPilotFeedback(options: SubmitPilotFeedbackOptions): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const context = currentPilotContext();

  try {
    await postJson('/api/pilot-ops/feedback', {
      kind: options.kind,
      type: options.type,
      route: trim(options.route) ?? context.route,
      message: trim(options.message),
      email: trim(options.email),
      score: typeof options.score === 'number' ? options.score : null,
      entity: options.entity ?? context.entity,
      details: options.details ?? null,
    });
  } catch {
    // Best-effort reporting only.
  }
}
