import type { ReadinessStatus } from '@/lib/trust/passport-contract';
import type { VdsTrustStatus } from '@/lib/trust/status-language';

export type LivePathAuthState = 'loading' | 'anon' | 'authenticated' | 'employer';
export type LivePathSourceMode = 'live' | 'demo' | 'fallback';
export type LivePathEmployerActionIntent = 'accept' | 'refresh' | 'review';

export interface LivePathShareResponse {
  eventId: string;
  timestamp: string;
  status: string;
}

export interface LivePathShareResponseShape {
  shareEventId?: string;
  eventId?: string;
  timestamp?: string;
  status?: string;
}

export const LIVE_PATH_NPI_RE = /^\d{10}$/;

export const LIVE_PATH_PREVIEW_NOTICE = {
  backendUnavailable: 'Preview unavailable — using your NPI only',
  partialCoverage: 'Preview unavailable — using your NPI only',
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
    case 'DECISION_GRADE':
      return 'checked';
    case 'CHECKING':
      return 'pending';
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
  };
}

export function resolveLivePathErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}
