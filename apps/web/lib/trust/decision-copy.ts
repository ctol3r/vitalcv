import type {
  DecisionPostureStatus,
  ReadinessStatus,
} from '@/lib/trust/passport-contract';
import { resolveBlockerOwnership } from '@/lib/trust/action-owner';

export type EmployerActionCopyKey = 'accept' | 'refresh' | 'review' | 'pause' | 'reject';
export type PublicDecisionStatus =
  | 'PROCEED'
  | 'PROCEED_WITH_CAUTION'
  | 'DO_NOT_PROCEED'
  | 'INSUFFICIENT_DATA';
export type ActionTimestampStyle = 'short' | 'full' | 'date';
type DecisionUiStatus = ReadinessStatus | DecisionPostureStatus;
export type ProofTier = 'draft' | 'partial' | 'decision_grade';

export const DECISION_RATIONALE_HEADING = 'Why this result';
export const DECISION_NEXT_STEP_HEADING = 'What to do next';
export const DECISION_LIMITATION_HEADING = 'Still needs verification';

/**
 * Owner-attributed decision next-step. When a specific top blocker is
 * known, returns the owner-prefixed line from the actor-ownership
 * contract so the reviewer sees whose move it is before clicking.
 * Falls back to the generic per-status copy when no blocker is named.
 */
export function getOwnerAttributedNextStep(
  status: DecisionUiStatus,
  topBlocker: string | null,
): string {
  if (topBlocker) {
    const ownership = resolveBlockerOwnership(topBlocker);
    // Use owner prefix + short action label so the reviewer reads a
    // complete "whose move + what to do" line in one phrase.
    return `${ownership.ownerPrefix} — ${ownership.actionLabel.toLowerCase()}.`;
  }
  return getDecisionNextStep(status);
}

export function withFallbackCopy(
  value: string | null | undefined,
  fallback: string,
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export function getProofTierLabel(tier: ProofTier): string {
  switch (tier) {
    case 'draft':
      return 'Draft snapshot';
    case 'partial':
      return 'Partial proof pack';
    case 'decision_grade':
    default:
      return 'Decision-grade proof pack';
  }
}

export function getEmployerActionLabel(
  action: EmployerActionCopyKey,
  options?: { proofTier?: ProofTier },
): string {
  switch (action) {
    case 'accept':
      return options?.proofTier && options.proofTier !== 'decision_grade'
        ? 'Accept partial head start'
        : 'Accept as head start';
    case 'refresh':
      return 'Request updated data';
    case 'review':
      return 'Flag for review';
    case 'pause':
      return 'Pause candidate';
    case 'reject':
      return 'Do not proceed';
    default:
      return 'Save choice';
  }
}

export function getDecisionHeadline(
  status: DecisionUiStatus,
  options?: { proofTier?: ProofTier },
): string {
  switch (status) {
    case 'READY':
      return 'Decision-grade checks are attached for the covered lanes.';
    case 'REVIEWABLE':
    case 'PARTIAL':
      return options?.proofTier === 'draft'
        ? 'Checked proof is not attached yet.'
        : 'Covered lanes are checked, but this review remains partial.';
    case 'BLOCKED':
    default:
      return 'A blocker is attached to this review.';
  }
}

export function getDecisionNextStep(
  status: DecisionUiStatus,
  options?: { proofTier?: ProofTier },
): string {
  switch (status) {
    case 'READY':
      return 'Accept as head start for the covered lanes, or continue review if your local policy requires more checks.';
    case 'REVIEWABLE':
    case 'PARTIAL':
      return options?.proofTier === 'draft'
        ? 'Request updated data or wait for checked proof before you rely on this review.'
        : 'Use this only as a partial head start after you review the remaining gaps.';
    case 'BLOCKED':
    default:
      return 'Resolve the blocker owner shown below or route this profile for manual review.';
  }
}

export function getPublicDecisionHeadline(status: PublicDecisionStatus): string {
  switch (status) {
    case 'PROCEED':
      return 'Decision-grade checks are attached for the covered lanes.';
    case 'PROCEED_WITH_CAUTION':
      return 'This snapshot is partial. More verification is still needed before you rely on it.';
    case 'DO_NOT_PROCEED':
      return 'A blocker is attached to this snapshot.';
    case 'INSUFFICIENT_DATA':
    default:
      return 'Checked proof is not attached yet.';
  }
}

export function getPublicDecisionNextStep(status: PublicDecisionStatus): string {
  switch (status) {
    case 'PROCEED':
      return 'Move this profile into employer review and confirm the scope before you rely on it.';
    case 'PROCEED_WITH_CAUTION':
      return 'Continue review with the partial proof pack and resolve the remaining gaps before relying on it.';
    case 'DO_NOT_PROCEED':
      return 'Do not proceed until the blocker owner resolves the attached issue.';
    case 'INSUFFICIENT_DATA':
    default:
      return 'Request updated data before relying on this result.';
  }
}

export function getNoBlockersMessage(
  scope: 'general' | 'review' | 'live_run' | 'mobile' = 'general',
): string {
  switch (scope) {
    case 'review':
      return 'No blockers are attached to this review.';
    case 'live_run':
      return 'No blockers were found in this check.';
    case 'mobile':
      return 'Nothing is blocking your next step right now.';
    case 'general':
    default:
      return 'No blockers are shown right now.';
  }
}

export function getReviewSummaryMessage(blockerCount: number): string {
  if (blockerCount <= 0) {
    return getNoBlockersMessage('review');
  }

  return `${blockerCount} blocker${blockerCount === 1 ? '' : 's'} still need review or updated data before you rely on this result.`;
}

export function getRecentActionEmptyMessage(): string {
  return 'No employer decisions are recorded yet.';
}

export function getLimitationEmptyMessage(): string {
  return 'No blockers or gaps are attached to this profile right now.';
}

export function formatRecentActionLabel(action: string): string {
  switch (action) {
    case 'accept':
    case 'accepted':
      return 'Accepted as head start';
    case 'request_data':
    case 'refresh':
    case 'refresh_requested':
      return 'Requested updated data';
    case 'flag':
    case 'flagged':
    case 'review':
      return 'Flagged for review';
    case 'pause':
    case 'paused':
      return 'Candidate paused';
    case 'reject':
      return 'Do not proceed';
    default:
      return action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (value) => value.toUpperCase());
  }
}

export function formatActionTimestamp(
  value: string | null | undefined,
  style: ActionTimestampStyle = 'short',
): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const options: Record<ActionTimestampStyle, Intl.DateTimeFormatOptions> = {
    short: {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    full: {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    date: {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  };

  return new Intl.DateTimeFormat('en-US', options[style]).format(date);
}

export function getCoverageSectionExplanation(sourceCount: number): string {
  if (sourceCount <= 0) {
    return 'No checked records explain this profile yet. New checks will appear here as they attach.';
  }

  return `${sourceCount} checked record${sourceCount === 1 ? '' : 's'} currently explain this profile. Anything not shown here is still unavailable, stale, or waiting on review.`;
}

export function getTrustBandExplanation(readinessScore: number): string {
  if (readinessScore >= 80) {
    return 'This score reflects strong current source coverage, but the source details below still explain what supports it.';
  }

  if (readinessScore >= 60) {
    return 'This score reflects partial source coverage. Review the source details below before relying on it.';
  }

  return 'This score reflects limited source coverage. Use the source details below to see what is still missing.';
}

export function getReuseSignalExplanation(counts: {
  acceptedCount: number;
  requestDataCount: number;
  flaggedCount: number;
}): string {
  const total = counts.acceptedCount + counts.requestDataCount + counts.flaggedCount;
  if (total <= 0) {
    return 'Employer decisions will appear here after someone reviews this profile.';
  }

  return 'These counts show how other employers responded to this verification snapshot. They do not replace your own review.';
}

export function getRecentActionExplanation(): string {
  return 'Recent decisions show what another employer chose and when they chose it.';
}

export function getRecentActionReasonFallback(): string {
  return 'No explanation was recorded with this decision.';
}

export function getArtifactExplanation(claimCount: number, monitoring: boolean): string {
  if (claimCount <= 0) {
    return 'This source is attached, but it is not yet contributing checked claims to the profile.';
  }

  if (monitoring) {
    return 'This artifact is contributing checked claims and is still being monitored for change.';
  }

  return 'This artifact is contributing checked claims, but active monitoring is not attached right now.';
}

export function getIssuerProvenanceExplanation(monitored: boolean, statusCount: number): string {
  if (monitored) {
    return `This source currently supports the profile and remains under monitoring across ${statusCount} recorded update${statusCount === 1 ? '' : 's'}.`;
  }

  return `This source currently supports the profile with ${statusCount} recorded update${statusCount === 1 ? '' : 's'}, but monitoring is not active.`;
}

export function getMonitoringCoverageExplanation(counts: {
  monitoredArtifactCount: number;
  totalArtifactCount: number;
  activeAlertCount: number;
}): string {
  if (counts.totalArtifactCount <= 0) {
    return 'Monitoring begins after the first checked artifact attaches to the profile.';
  }

  if (counts.activeAlertCount > 0) {
    return 'Monitoring is active and has detected changes that still need review.';
  }

  if (counts.monitoredArtifactCount >= counts.totalArtifactCount) {
    return 'All visible artifacts are under monitoring, so this profile can surface new changes quickly.';
  }

  return 'Some visible artifacts are under monitoring, while others still rely on their last completed check.';
}

export function getReadinessSnapshotExplanation(input: {
  evaluated: boolean;
  isEligible: boolean | null;
  traceCount: number;
}): string {
  if (!input.evaluated) {
    return 'This readiness snapshot has not been fully evaluated yet.';
  }

  if (input.isEligible) {
    return `This readiness path completed ${input.traceCount} verification step${input.traceCount === 1 ? '' : 's'} without finding a blocker here.`;
  }

  return 'This readiness snapshot found missing requirements that still need evidence or review.';
}
