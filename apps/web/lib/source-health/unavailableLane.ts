import {
  type SourceHealthState,
  type SourceId,
  assertNever,
} from './sourceHealthTypes';

export interface UnavailableLane {
  sourceId: SourceId;
  state: Exclude<SourceHealthState, 'LIVE'>;
  userFacingMessage: string;
  retryPolicy: {
    suggestedRetryAfterMs: number;
    canRetryNow: boolean;
  };
  lastSeenAt: string | null;
}

/**
 * Banned phrases that must NEVER appear in any user-facing copy emitted by
 * this module. Enforced by `unavailableLane.bannedPhrases.test.ts`.
 *
 * These claims are either marketing puffery or compliance assertions we are
 * not entitled to make from operational state alone.
 */
export const BANNED_USER_FACING_PHRASES: readonly string[] = [
  'real-time',
  'real time',
  'live verification',
  'guaranteed',
  'always available',
  'verified',
  'certified',
  'instant',
  'tamper-proof',
  'hipaa compliant',
  'soc2 certified',
  'ncqa verified',
] as const;

const SOURCE_DISPLAY_NAME: Record<SourceId, string> = {
  NPPES: 'NPPES (CMS provider registry)',
  OIG_LEIE: 'OIG exclusion list',
  PECOS: 'PECOS enrollment lookup',
  STATE_BOARD: 'state licensing board lookup',
};

// Deterministic copy table per (sourceId, state). Honest, neutral language.
// Do NOT use words like "verified", "guaranteed", "real-time", etc. (see test).
function copyFor(
  sourceId: SourceId,
  state: Exclude<SourceHealthState, 'LIVE'>,
): string {
  const source = SOURCE_DISPLAY_NAME[sourceId];
  switch (state) {
    case 'DEGRADED':
      return `The ${source} lookup is responding more slowly than expected. We will keep trying; readiness signals from this source may lag.`;
    case 'UNAVAILABLE':
      return `The ${source} lookup did not respond. We cannot refresh signals from this source right now.`;
    case 'RATE_LIMITED':
      return `The ${source} lookup is throttling requests. We will back off and try again shortly.`;
    case 'UNKNOWN':
      return `We do not have a recent operational reading for the ${source}. Treat any cached signal from this source as a snapshot rather than a fresh reading.`;
    default:
      return assertNever(state);
  }
}

function retryPolicyFor(
  state: Exclude<SourceHealthState, 'LIVE'>,
): UnavailableLane['retryPolicy'] {
  switch (state) {
    case 'DEGRADED':
      return { suggestedRetryAfterMs: 30_000, canRetryNow: true };
    case 'UNAVAILABLE':
      return { suggestedRetryAfterMs: 60_000, canRetryNow: true };
    case 'RATE_LIMITED':
      return { suggestedRetryAfterMs: 120_000, canRetryNow: false };
    case 'UNKNOWN':
      return { suggestedRetryAfterMs: 30_000, canRetryNow: true };
    default:
      return assertNever(state);
  }
}

/**
 * Build an UnavailableLane record. The `reason` parameter is captured in the
 * snapshot but NOT echoed to the user — we render only deterministic copy
 * from the table above to keep banned phrases out of user-facing surfaces.
 */
export function unavailableLane(input: {
  sourceId: SourceId;
  state: Exclude<SourceHealthState, 'LIVE'>;
  reason: string;
  lastSeenAt: string | null;
}): UnavailableLane {
  const { sourceId, state, lastSeenAt } = input;
  return {
    sourceId,
    state,
    userFacingMessage: copyFor(sourceId, state),
    retryPolicy: retryPolicyFor(state),
    lastSeenAt,
  };
}
