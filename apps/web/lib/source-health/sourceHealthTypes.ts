/**
 * SourceHealth — operational state of an upstream credentialing source.
 *
 * IMPORTANT: this module reports source *operational* state only. It does NOT
 * make verification, certification, or compliance claims about provider data.
 * See `README.md` and the banned-phrase contract in `unavailableLane.ts`.
 */

export type SourceHealthState =
  | 'LIVE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'UNKNOWN'
  | 'RATE_LIMITED';

export type SourceId = 'NPPES' | 'OIG_LEIE' | 'PECOS' | 'STATE_BOARD';

export interface SourceHealthSnapshot {
  sourceId: SourceId;
  state: SourceHealthState;
  reason: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastLatencyMs: number | null;
  observedAt: string;
}

export const ALL_SOURCE_IDS: readonly SourceId[] = [
  'NPPES',
  'OIG_LEIE',
  'PECOS',
  'STATE_BOARD',
] as const;

export const ALL_SOURCE_HEALTH_STATES: readonly SourceHealthState[] = [
  'LIVE',
  'DEGRADED',
  'UNAVAILABLE',
  'UNKNOWN',
  'RATE_LIMITED',
] as const;

/**
 * Truth invariant: evidence may only be upgraded when the source is LIVE.
 * Any other state — including UNKNOWN — must NOT promote evidence.
 */
export function canEvidenceBeUpgraded(state: SourceHealthState): boolean {
  switch (state) {
    case 'LIVE':
      return true;
    case 'DEGRADED':
    case 'UNAVAILABLE':
    case 'UNKNOWN':
    case 'RATE_LIMITED':
      return false;
    default:
      return assertNever(state);
  }
}

/**
 * Truth invariant: only LIVE is healthy. DEGRADED is *not* healthy.
 */
export function isHealthy(state: SourceHealthState): boolean {
  switch (state) {
    case 'LIVE':
      return true;
    case 'DEGRADED':
    case 'UNAVAILABLE':
    case 'UNKNOWN':
    case 'RATE_LIMITED':
      return false;
    default:
      return assertNever(state);
  }
}

/**
 * Exhaustiveness helper. If the union grows and a switch forgets a case, this
 * will fail to compile.
 */
export function assertNever(value: never): never {
  throw new Error(
    `Unhandled SourceHealth value: ${JSON.stringify(value)}`,
  );
}
