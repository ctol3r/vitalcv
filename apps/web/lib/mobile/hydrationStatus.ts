/**
 * Dashboard hydration status — W4-PR216A.
 *
 * Records which backend calls succeeded vs failed when assembling the
 * clinician dashboard. Without this, `loadClinicianMobileData` silently
 * coerced upstream errors into "no data" — a fake-certainty source
 * because `refreshedAt` reads "fresh" even when every upstream call
 * returned null.
 *
 * Truth contract:
 *   - Every dashboard channel is tagged 'ok' | 'absent' | 'failed' |
 *     'skipped-unauthenticated'.
 *   - Channel statuses are derived from real fetch outcomes, never
 *     hardcoded.
 *   - When every authenticated channel fails, the aggregate verdict is
 *     'failed' — UIs SHOULD render an ambiguity banner rather than
 *     pretending the dashboard hydrated.
 */

export type ChannelStatus =
  | 'ok'
  | 'absent'
  | 'failed'
  | 'skipped-unauthenticated';

export type DashboardChannelId =
  | 'workspace'
  | 'applications'
  | 'opportunities'
  | 'profileCompleteness'
  | 'proof'
  | 'trustState'
  | 'trustHistory'
  | 'matcha';

export interface ChannelStatusEntry {
  readonly channel: DashboardChannelId;
  readonly status: ChannelStatus;
}

export interface DashboardHydrationStatus {
  readonly channels: readonly ChannelStatusEntry[];
  /**
   * Aggregate verdict over the channels:
   *   - 'ok'        : at least one ok, no failed
   *   - 'degraded'  : at least one ok AND at least one failed
   *   - 'failed'    : zero ok, at least one failed
   *   - 'empty'     : all channels skipped (unauthenticated) or absent
   */
  readonly aggregate: 'ok' | 'degraded' | 'failed' | 'empty';
  /**
   * True iff at least one channel returned real data. Used by the
   * server-side timestamp gate so refreshedAt only carries meaning
   * when something was actually refreshed.
   */
  readonly anyChannelOk: boolean;
}

/**
 * Classifies a fetch outcome into a channel status. The caller passes
 * `signedIn` so we can distinguish authentication-skipped channels
 * from legitimate empties.
 */
export function classifyFetchOutcome(
  signedIn: boolean,
  raw: unknown,
  fetchAttempted: boolean,
): ChannelStatus {
  if (!signedIn && !fetchAttempted) return 'skipped-unauthenticated';
  if (!fetchAttempted) return 'skipped-unauthenticated';
  if (raw === null || raw === undefined) {
    // Upstream returned null — either because the response was !ok or
    // because the fetch threw. The current implementation collapses
    // these into a single null; we treat that as 'failed' rather than
    // 'absent' because 'absent' would imply the upstream confirmed
    // there is nothing — which we cannot prove.
    return 'failed';
  }
  return 'ok';
}

/**
 * Derives the aggregate verdict from the channel statuses.
 */
export function deriveHydrationAggregate(
  channels: readonly ChannelStatusEntry[],
): DashboardHydrationStatus['aggregate'] {
  let okCount = 0;
  let failedCount = 0;
  let allSkippedOrAbsent = true;
  for (const c of channels) {
    if (c.status === 'ok') {
      okCount += 1;
      allSkippedOrAbsent = false;
    }
    if (c.status === 'failed') {
      failedCount += 1;
      allSkippedOrAbsent = false;
    }
  }
  if (allSkippedOrAbsent) return 'empty';
  if (failedCount === 0) return 'ok';
  if (okCount === 0) return 'failed';
  return 'degraded';
}

export function buildHydrationStatus(
  channels: readonly ChannelStatusEntry[],
): DashboardHydrationStatus {
  const aggregate = deriveHydrationAggregate(channels);
  return Object.freeze({
    channels: Object.freeze(channels.slice()),
    aggregate,
    anyChannelOk: aggregate === 'ok' || aggregate === 'degraded',
  });
}
