import type { ReadinessStatus } from '@/lib/trust/passport-contract';
import type { VdsTrustStatus } from '@/lib/trust/status-language';

export type LivePathAuthState = 'loading' | 'anon' | 'authenticated' | 'employer';
export type LivePathSourceMode = 'live' | 'demo' | 'fallback';
export type LivePathEmployerActionIntent = 'accept' | 'refresh' | 'review';

export interface LivePathShareResponse {
  eventId: string;
  timestamp: string;
  status: string;
  expiresAt: string | null;
}

export interface LivePathShareResponseShape {
  shareEventId?: string;
  eventId?: string;
  timestamp?: string;
  status?: string;
  expiresAt?: string | null;
}

export const LIVE_PATH_NPI_RE = /^\d{10}$/;

export const LIVE_PATH_PREVIEW_NOTICE = {
  backendUnavailable: 'Readiness check temporarily unavailable — showing preview data',
  partialCoverage: 'Coverage data is being refreshed — some sources may show preview data',
} as const;

export function resolveLivePathAuthState(input: {
  isLoaded: boolean;
  isSignedIn: boolean;
  isEmployer?: boolean;
}): LivePathAuthState {
  if (!input.isLoaded) {
    return 'loading';
  }

  if (!input.isSignedIn) {
    return 'anon';
  }

  return input.isEmployer ? 'employer' : 'authenticated';
}

export function resolveLivePathReadinessStatus(status: ReadinessStatus): VdsTrustStatus {
  switch (status) {
    case 'READY':
      return 'clear';
    case 'BLOCKED':
      return 'blocked';
    case 'PARTIAL':
      // PARTIAL = some checks done, some pending — NOT the same as "review required" (human review)
      return 'pending';
    default:
      return 'pending';
  }
}

export function resolveLivePathSourceMode(input: {
  isDemo: boolean;
  hasLiveState: boolean;
}): LivePathSourceMode {
  if (input.hasLiveState && !input.isDemo) {
    return 'live';
  }

  return input.isDemo ? 'demo' : 'fallback';
}

export function normalizeLivePathShareResponse(
  payload: LivePathShareResponseShape,
): LivePathShareResponse {
  return {
    eventId: payload.shareEventId ?? payload.eventId ?? 'Recorded',
    timestamp: payload.timestamp ?? new Date().toISOString(),
    status: payload.status ?? 'delivered',
    expiresAt: typeof payload.expiresAt === 'string' && payload.expiresAt.trim().length > 0
      ? payload.expiresAt
      : null,
  };
}

export function humanizePublicErrorMessage(
  message: string | null | undefined,
  fallback: string,
): string {
  const normalized = message?.trim();
  if (!normalized) {
    return fallback;
  }

  const lower = normalized.toLowerCase();

  if (lower.includes('sign in required')) {
    return 'Sign in required to continue.';
  }

  if (lower.includes('organization context') || lower.includes('employer context')) {
    return 'Open this from an employer review request so the audit trail stays attached.';
  }

  if (
    lower.includes('passport hydration')
    || lower.includes('passport not found')
    || lower.includes('no passport found')
    || lower.includes('passport is missing')
  ) {
    return 'This passport is not ready yet. Ask the clinician to run the readiness check again.';
  }

  if (
    lower.includes('review context is no longer available')
    || lower.includes('review link is no longer available')
  ) {
    return 'This employer review link is no longer active.';
  }

  if (lower.includes('vcventity') || lower.includes('workspace')) {
    return 'Create or switch into an employer workspace before continuing.';
  }

  if (
    lower.includes('backend')
    || lower.includes('fetch failed')
    || lower.includes('network')
    || lower.includes('timed out')
    || lower.includes('timeout')
    || lower.includes('upstream unavailable')
    || lower.includes('service unavailable')
    || lower.includes('backend unavailable')
    || lower.includes('temporarily unavailable')
  ) {
    return fallback;
  }

  if (/http\s*\d{3}/i.test(normalized) || /\(\d{3}\)/.test(normalized)) {
    return fallback;
  }

  return normalized;
}

export function resolveLivePathErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return humanizePublicErrorMessage(
    error instanceof Error ? error.message : null,
    fallback,
  );
}
