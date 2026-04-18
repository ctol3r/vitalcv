/**
 * Startability timeline contract.
 *
 * Every application snapshot's lifecycle lays down seven canonical
 * timestamps that together form the startability chain:
 *
 *   readinessAt             — clinician reached usable readiness posture
 *   applicationSubmittedAt  — clinician submitted the snapshot
 *   firstViewedAt           — first employer opened the review surface
 *   firstActionAt           — first employer action (any kind)
 *   reviewAdvancedAt        — employer advanced the application
 *   startReadyAt            — clinician entered start_ready state
 *   startedAt               — clinician started at the employer
 *
 * Rules:
 *   - Every timestamp is attributable to a specific audit-log entry or
 *     an explicit input. We never synthesize timestamps.
 *   - Missing timestamps degrade honestly to `null`. Derived metrics
 *     return `null` when any input in the delta is missing.
 *   - Partial data stays partial: a proof-pack built from a timeline
 *     with two missing timestamps must surface the gap, not paper over
 *     it with "computed from partial data" averages.
 *
 * This module is a READER of the application-snapshot audit log, not
 * a WRITER. Timestamps are extracted from events that the snapshot
 * module already captures at mutation time.
 */

import type {
  ApplicationAuditEntry,
  ApplicationSnapshot,
  ApplicationStatus,
} from '@/lib/apply/application-snapshot';

export interface StartabilityTimeline {
  applicationId: string;
  /** When the clinician reached usable readiness — passed in by the
   *  caller (readiness lives outside the application audit chain). */
  readinessAt: string | null;
  applicationSubmittedAt: string | null;
  firstViewedAt: string | null;
  firstActionAt: string | null;
  reviewAdvancedAt: string | null;
  startReadyAt: string | null;
  startedAt: string | null;
}

/**
 * Extract the startability timeline from an application snapshot.
 * Caller supplies `readinessAt` because readiness is computed on the
 * passport/ingest side, not inside the application audit log.
 *
 * Every timestamp resolves to either a concrete ISO-8601 string from
 * the audit log or `null` (not an empty string, not a placeholder).
 */
export function deriveStartabilityTimeline(
  snapshot: ApplicationSnapshot,
  options: { readinessAt?: string | null } = {},
): StartabilityTimeline {
  const log = snapshot.auditLog;

  const firstBy = (
    predicate: (entry: ApplicationAuditEntry) => boolean,
  ): string | null => {
    const match = log.find(predicate);
    return match ? match.at : null;
  };

  const firstStatusTransitionTo = (to: ApplicationStatus): string | null =>
    firstBy((e) => e.action === 'status_change' && e.to === to);

  const applicationSubmittedAt = firstBy((e) => e.action === 'submitted');

  // First view: either a status_change transitioning to "viewed", or
  // a standalone "viewed" action if ever emitted separately.
  const firstViewedAt =
    firstStatusTransitionTo('viewed')
    ?? firstBy((e) => e.action === 'viewed');

  // First employer action: the earliest request_refresh /
  // request_missing_info / route_to_review entry, OR the first
  // employer-sourced status_change, whichever comes first.
  const firstEmployerMutation = log.find(
    (e) =>
      (e.actor === 'employer' || e.actor === 'reviewer')
      && (
        e.action === 'request_refresh'
        || e.action === 'request_missing_info'
        || e.action === 'route_to_review'
        || e.action === 'status_change'
      ),
  );
  const firstActionAt = firstEmployerMutation ? firstEmployerMutation.at : null;

  const reviewAdvancedAt = firstStatusTransitionTo('advanced');
  const startReadyAt = firstStatusTransitionTo('start_ready');
  const startedAt = firstStatusTransitionTo('started');

  return {
    applicationId: snapshot.applicationId,
    readinessAt: options.readinessAt ?? null,
    applicationSubmittedAt,
    firstViewedAt,
    firstActionAt,
    reviewAdvancedAt,
    startReadyAt,
    startedAt,
  };
}

/**
 * Duration metrics derived from a single application's timeline.
 * Every metric is `null` when either endpoint is missing.
 *
 * Never fabricate: when readinessAt is unknown and applicationSubmittedAt
 * exists, `timeFromReadinessToSubmit` is `null`, not an optimistic "0".
 */
export interface StartabilityMetrics {
  applicationId: string;
  /** Minutes from clinician readiness to application submission. */
  minutesToSubmit: number | null;
  /** Minutes from application submission to first employer view. */
  minutesToFirstView: number | null;
  /** Minutes from application submission to first employer action. */
  minutesToFirstAction: number | null;
  /** Minutes from application submission to review advanced. */
  minutesToReviewAdvanced: number | null;
  /** Days from application submission to start_ready. */
  daysToStartReady: number | null;
  /** Days from application submission to started (the full loop). */
  daysToStarted: number | null;
  /** Whether this timeline has every timestamp (full chain). */
  chainComplete: boolean;
  /** Names of the missing timestamps, for honest partial rendering. */
  missingTimestamps: Array<keyof StartabilityTimeline>;
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end < start) return null;
  return Math.round((end - start) / 60000);
}

function daysBetween(a: string | null, b: string | null): number | null {
  const minutes = minutesBetween(a, b);
  if (minutes === null) return null;
  return Math.round(minutes / 1440 * 10) / 10; // one decimal
}

const TIMESTAMP_KEYS: Array<keyof StartabilityTimeline> = [
  'readinessAt',
  'applicationSubmittedAt',
  'firstViewedAt',
  'firstActionAt',
  'reviewAdvancedAt',
  'startReadyAt',
  'startedAt',
];

export function deriveStartabilityMetrics(
  timeline: StartabilityTimeline,
): StartabilityMetrics {
  const missingTimestamps = TIMESTAMP_KEYS.filter(
    (k) => k !== 'applicationId' && timeline[k] === null,
  );

  return {
    applicationId: timeline.applicationId,
    minutesToSubmit: minutesBetween(
      timeline.readinessAt,
      timeline.applicationSubmittedAt,
    ),
    minutesToFirstView: minutesBetween(
      timeline.applicationSubmittedAt,
      timeline.firstViewedAt,
    ),
    minutesToFirstAction: minutesBetween(
      timeline.applicationSubmittedAt,
      timeline.firstActionAt,
    ),
    minutesToReviewAdvanced: minutesBetween(
      timeline.applicationSubmittedAt,
      timeline.reviewAdvancedAt,
    ),
    daysToStartReady: daysBetween(
      timeline.applicationSubmittedAt,
      timeline.startReadyAt,
    ),
    daysToStarted: daysBetween(
      timeline.applicationSubmittedAt,
      timeline.startedAt,
    ),
    chainComplete: missingTimestamps.length === 0,
    missingTimestamps,
  };
}

/**
 * Blocker duration accounting. Sum of all `waiting_on_refresh` +
 * `waiting_on_manual_review` intervals across the application's
 * audit log. Returns null when the log has no waiting states OR
 * when a waiting state was entered but never resolved (honest: we
 * can't compute a duration for an open waiting state).
 */
export interface BlockerDurationTotals {
  applicationId: string;
  /** Total minutes spent in waiting_on_refresh across all occurrences. */
  minutesInRefreshWait: number | null;
  /** Total minutes spent in waiting_on_manual_review across all occurrences. */
  minutesInManualReviewWait: number | null;
  /** Count of refresh requests emitted during the application's life. */
  refreshRequestCount: number;
  /** Count of missing-info requests emitted. */
  missingInfoRequestCount: number;
  /** True when a waiting state is still open at the current status. */
  hasOpenWait: boolean;
}

export function deriveBlockerDurationTotals(
  snapshot: ApplicationSnapshot,
): BlockerDurationTotals {
  const log = snapshot.auditLog;

  let refreshRequestCount = 0;
  let missingInfoRequestCount = 0;

  let refreshWaitStart: string | null = null;
  let manualWaitStart: string | null = null;
  let totalRefreshMinutes = 0;
  let totalManualMinutes = 0;
  let anyRefreshComputed = false;
  let anyManualComputed = false;

  for (const entry of log) {
    if (entry.action === 'request_refresh') refreshRequestCount += 1;
    if (entry.action === 'request_missing_info') missingInfoRequestCount += 1;

    if (entry.to === 'waiting_on_refresh') {
      refreshWaitStart = entry.at;
    } else if (refreshWaitStart && entry.from === 'waiting_on_refresh') {
      const mins = minutesBetween(refreshWaitStart, entry.at);
      if (mins !== null) {
        totalRefreshMinutes += mins;
        anyRefreshComputed = true;
      }
      refreshWaitStart = null;
    }

    if (entry.to === 'waiting_on_manual_review') {
      manualWaitStart = entry.at;
    } else if (manualWaitStart && entry.from === 'waiting_on_manual_review') {
      const mins = minutesBetween(manualWaitStart, entry.at);
      if (mins !== null) {
        totalManualMinutes += mins;
        anyManualComputed = true;
      }
      manualWaitStart = null;
    }
  }

  const hasOpenWait =
    snapshot.status === 'waiting_on_refresh'
    || snapshot.status === 'waiting_on_manual_review';

  return {
    applicationId: snapshot.applicationId,
    minutesInRefreshWait: anyRefreshComputed ? totalRefreshMinutes : null,
    minutesInManualReviewWait: anyManualComputed ? totalManualMinutes : null,
    refreshRequestCount,
    missingInfoRequestCount,
    hasOpenWait,
  };
}
