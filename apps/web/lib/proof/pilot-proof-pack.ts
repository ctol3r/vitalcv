/**
 * Pilot proof-pack export.
 *
 * Buyer-legible artifact aggregating application + review + action +
 * start-ready + started counts, with median time deltas and explicit
 * limitation lines when data is partial.
 *
 * Doctrine:
 *   - Counts come from real events only. No imputed rows.
 *   - Medians are computed only when at least one timeline in the set
 *     has the requested delta. If every application is missing a
 *     timestamp, the median is `null` and the `limitations` array
 *     names the gap.
 *   - `partialDataNotice` is always present when any application in
 *     the set is missing any timestamp. The proof pack stays visibly
 *     partial — never rendered as if it were decision-grade.
 *   - Proof tier context is surfaced at the pack level (decision-grade
 *     vs partial counts) so the buyer can tell at a glance how much
 *     of the pilot ran on decision-grade evidence.
 */

import type {
  ApplicationSnapshot,
  ApplicationStatus,
} from '@/lib/apply/application-snapshot';
import type { ProofTier } from '@/lib/trust/employer-action-consequence';
import {
  deriveBlockerDurationTotals,
  deriveStartabilityMetrics,
  deriveStartabilityTimeline,
  type BlockerDurationTotals,
  type StartabilityMetrics,
  type StartabilityTimeline,
} from './startability-timeline';

export interface PilotProofPackCounts {
  applicationsSubmitted: number;
  reviewsOpened: number;
  actionsTaken: number;
  advancedCount: number;
  startReadyCount: number;
  startedCount: number;
}

export interface PilotProofPackMedians {
  /** Median minutes from submit to first employer view. Null when no
   *  timeline in the set has both endpoints. */
  medianMinutesToFirstView: number | null;
  /** Median minutes from submit to first employer action. */
  medianMinutesToFirstAction: number | null;
  /** Median days from submit to start_ready. */
  medianDaysToStartReady: number | null;
  /** Median days from submit to started (full loop). */
  medianDaysToStarted: number | null;
}

export interface PilotProofPackTierContext {
  /** Count of applications submitted at decision-grade tier. */
  decisionGradeAtSubmit: number;
  /** Count of applications submitted at partial tier. */
  partialAtSubmit: number;
  /** Count of applications submitted at draft tier (no anchor). */
  draftAtSubmit: number;
}

export interface PilotProofPackBlockers {
  totalRefreshRequests: number;
  totalMissingInfoRequests: number;
  /** Applications currently in an open waiting state. */
  applicationsWithOpenWait: number;
  /** Median minutes spent in refresh waits across applications that
   *  have at least one closed refresh-wait interval. Null when no
   *  closed interval exists in the set. */
  medianMinutesInRefreshWait: number | null;
}

export interface PilotProofPack {
  generatedAt: string;
  /** Count of applications considered in this pack. */
  applicationCount: number;
  counts: PilotProofPackCounts;
  medians: PilotProofPackMedians;
  tierContext: PilotProofPackTierContext;
  blockers: PilotProofPackBlockers;
  /**
   * Honest-partial signal. Whenever any derived metric is null OR any
   * application is missing timeline data, `partialDataNotice` names
   * the gap so the buyer never reads the pack as decision-grade by
   * accident.
   */
  partialDataNotice: string | null;
  /**
   * Explicit limitation lines a buyer can read. One per missing
   * dimension. Empty when nothing is partial.
   */
  limitations: string[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
  }
  return sorted[mid];
}

function isSubmittedOrLater(status: ApplicationStatus): boolean {
  return status !== 'draft';
}

function countStatusAtOrPast(
  snapshots: ApplicationSnapshot[],
  target: ApplicationStatus,
): number {
  // Counts applications that ever reached (or passed) the target
  // status — reads from audit log, not just current status.
  return snapshots.filter((s) =>
    s.auditLog.some(
      (e) => e.to === target || e.action === target,
    ) || s.status === target,
  ).length;
}

export interface BuildPilotProofPackInput {
  applications: ApplicationSnapshot[];
  /** Optional readiness timestamps per application. When absent,
   *  `minutesToSubmit` metrics degrade to null. */
  readinessByApplication?: Record<string, string | null>;
  /** Timestamp for the generated pack. Defaults to now. */
  generatedAt?: string;
}

export interface PilotProofPackInternals {
  /** Per-application timelines and metrics used to build the pack.
   *  Exposed for the export UI to render per-application detail while
   *  the pack itself carries only the aggregated roll-up. */
  timelines: StartabilityTimeline[];
  metrics: StartabilityMetrics[];
  blockerTotals: BlockerDurationTotals[];
}

export function buildPilotProofPack(
  input: BuildPilotProofPackInput,
): { pack: PilotProofPack; internals: PilotProofPackInternals } {
  const applications = input.applications;
  const readinessMap = input.readinessByApplication ?? {};
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  const timelines = applications.map((snapshot) =>
    deriveStartabilityTimeline(snapshot, {
      readinessAt: readinessMap[snapshot.applicationId] ?? null,
    }),
  );
  const metrics = timelines.map(deriveStartabilityMetrics);
  const blockerTotals = applications.map(deriveBlockerDurationTotals);

  const applicationsSubmitted = applications.filter((s) =>
    isSubmittedOrLater(s.status) || s.auditLog.some((e) => e.action === 'submitted'),
  ).length;
  const reviewsOpened = timelines.filter((t) => t.firstViewedAt !== null).length;
  const actionsTaken = timelines.filter((t) => t.firstActionAt !== null).length;
  const advancedCount = countStatusAtOrPast(applications, 'advanced');
  const startReadyCount = countStatusAtOrPast(applications, 'start_ready');
  const startedCount = countStatusAtOrPast(applications, 'started');

  const counts: PilotProofPackCounts = {
    applicationsSubmitted,
    reviewsOpened,
    actionsTaken,
    advancedCount,
    startReadyCount,
    startedCount,
  };

  const medians: PilotProofPackMedians = {
    medianMinutesToFirstView: median(
      metrics
        .map((m) => m.minutesToFirstView)
        .filter((v): v is number => v !== null),
    ),
    medianMinutesToFirstAction: median(
      metrics
        .map((m) => m.minutesToFirstAction)
        .filter((v): v is number => v !== null),
    ),
    medianDaysToStartReady: median(
      metrics
        .map((m) => m.daysToStartReady)
        .filter((v): v is number => v !== null),
    ),
    medianDaysToStarted: median(
      metrics
        .map((m) => m.daysToStarted)
        .filter((v): v is number => v !== null),
    ),
  };

  const tierCounts: Record<ProofTier, number> = {
    draft_snapshot: 0,
    partial_proof_pack: 0,
    decision_grade_proof_pack: 0,
  };
  for (const app of applications) {
    if (isSubmittedOrLater(app.status)) {
      tierCounts[app.proofTier] += 1;
    }
  }
  const tierContext: PilotProofPackTierContext = {
    decisionGradeAtSubmit: tierCounts.decision_grade_proof_pack,
    partialAtSubmit: tierCounts.partial_proof_pack,
    draftAtSubmit: tierCounts.draft_snapshot,
  };

  const refreshWaitMinutes = blockerTotals
    .map((b) => b.minutesInRefreshWait)
    .filter((v): v is number => v !== null);
  const blockers: PilotProofPackBlockers = {
    totalRefreshRequests: blockerTotals.reduce(
      (sum, b) => sum + b.refreshRequestCount,
      0,
    ),
    totalMissingInfoRequests: blockerTotals.reduce(
      (sum, b) => sum + b.missingInfoRequestCount,
      0,
    ),
    applicationsWithOpenWait: blockerTotals.filter((b) => b.hasOpenWait).length,
    medianMinutesInRefreshWait: median(refreshWaitMinutes),
  };

  // Limitations — explicit, not inferred. Each null metric or partial
  // tier produces a reading line the buyer can see.
  const limitations: string[] = [];
  if (counts.applicationsSubmitted === 0) {
    limitations.push(
      'No applications have been submitted in the pilot window. All downstream counts and medians are unavailable.',
    );
  }
  if (counts.reviewsOpened < counts.applicationsSubmitted) {
    const pending = counts.applicationsSubmitted - counts.reviewsOpened;
    limitations.push(
      `${pending} submitted application${pending === 1 ? '' : 's'} have not been opened by an employer yet — first-view medians computed only from opened applications.`,
    );
  }
  if (medians.medianMinutesToFirstView === null && counts.applicationsSubmitted > 0) {
    limitations.push(
      'No application in this pilot has a recorded first-view timestamp. medianMinutesToFirstView is unavailable.',
    );
  }
  if (medians.medianDaysToStarted === null && counts.startedCount === 0) {
    limitations.push(
      'No application has reached started state yet. medianDaysToStarted is unavailable; the start-ready-to-started loop has not completed in this window.',
    );
  }
  if (tierContext.partialAtSubmit > 0 || tierContext.draftAtSubmit > 0) {
    const partialTotal = tierContext.partialAtSubmit + tierContext.draftAtSubmit;
    limitations.push(
      `${partialTotal} application${partialTotal === 1 ? '' : 's'} submitted at partial / draft proof tier. These are not decision-grade and remain visibly partial in this pack.`,
    );
  }
  if (blockers.applicationsWithOpenWait > 0) {
    limitations.push(
      `${blockers.applicationsWithOpenWait} application${blockers.applicationsWithOpenWait === 1 ? '' : 's'} are still in an open waiting state (refresh or manual review). Blocker duration totals will change once those waits close.`,
    );
  }

  const partialDataNotice =
    limitations.length > 0
      ? 'This proof pack contains partial data. See limitations for the specific gaps — medians and counts reflect only the evidence that was recorded.'
      : null;

  const pack: PilotProofPack = {
    generatedAt,
    applicationCount: applications.length,
    counts,
    medians,
    tierContext,
    blockers,
    partialDataNotice,
    limitations,
  };

  return {
    pack,
    internals: { timelines, metrics, blockerTotals },
  };
}

/**
 * Serialize a proof pack to a JSON string. Used by the export route.
 * Deterministic (stable key ordering) so buyer-delivered artifacts
 * are diffable between pack generations.
 */
export function serializePilotProofPack(pack: PilotProofPack): string {
  return JSON.stringify(pack, null, 2);
}
