/**
 * Recovery-path contract for source lanes.
 *
 * Every source-row state (pending, unavailable, access_required, stale,
 * no_record, review_required, checked) gets an explicit next behavior.
 *
 * Doctrine:
 *   - pending: explain what is still running; no user action unless
 *     retry/cancel is real.
 *   - unavailable: say the source failed; show retry or continue-partial;
 *     never disguise as motion.
 *   - access_required: explain who controls access and what is blocked.
 *   - stale: explain what is old; show refresh path; state whether
 *     current evidence is still usable.
 *   - no_record: explain what it means in plain language; show next
 *     route (upload, claim identity, contact support).
 *   - review_required: name the reviewer, what triggered review, what
 *     to expect next.
 *
 * This module is source-agnostic: the `lane` identifier carries
 * presentation, the `state` carries the recovery contract.
 */

import {
  ACTION_OWNER,
  resolveStateBoardOwnership,
  type ActionOwner,
  type ActionType,
} from './action-owner';

export type SourceLaneState =
  | 'pending'
  | 'checked'
  | 'review_required'
  | 'unavailable'
  | 'access_required'
  | 'stale'
  | 'no_record';

export type SourceLane = 'nppes' | 'oig' | 'pecos' | 'state_board';

export interface RecoveryPath {
  state: SourceLaneState;
  /** Short plain-language lane name rendered in the source row. */
  laneLabel: string;
  /**
   * Badge-style label for the lane state. Not a verdict — a truthful
   * description of what happened. Never relabels failure as progress.
   */
  statusLabel: string;
  /** Canonical owner for the recovery step, when one is needed. */
  owner: ActionOwner;
  /**
   * One or two sentences answering "what happened and what it means"
   * in the user's language. Never leaks internal error messages.
   */
  explanation: string;
  /** The user-facing next step. Null when no action is currently possible. */
  nextStep: string | null;
  /** Button label for `nextStep`. Null when no CTA is rendered. */
  ctaLabel: string | null;
  /** Nature of the recovery action. */
  actionType: ActionType;
  /**
   * Whether the passport can honestly continue without resolving this
   * lane. A permanent exclusion cannot continue; a stale PECOS record can.
   */
  canContinuePartial: boolean;
}

const LANE_LABEL: Record<SourceLane, string> = {
  nppes: 'NPI registry',
  oig: 'Federal exclusions',
  pecos: 'Medicare enrollment',
  state_board: 'State board verification',
};

export function getLaneLabel(lane: SourceLane): string {
  return LANE_LABEL[lane];
}

/**
 * Canonical recovery contract per (lane, state). Exhaustive for the
 * states the ingest stream can produce today. Out-of-band combinations
 * fall through to a truthful "we do not know yet" contract instead of
 * silently collapsing into `checked`.
 */
export function resolveRecoveryPath(
  lane: SourceLane,
  state: SourceLaneState,
): RecoveryPath {
  const laneLabel = LANE_LABEL[lane];

  switch (state) {
    case 'pending':
      return {
        state,
        laneLabel,
        statusLabel: 'Not yet verified',
        owner: ACTION_OWNER.VITALCV,
        explanation: `${laneLabel} is not yet verified in this run.`,
        nextStep: null,
        ctaLabel: null,
        actionType: 'none',
        canContinuePartial: true,
      };

    case 'checked':
      return {
        state,
        laneLabel,
        statusLabel: lane === 'pecos' ? 'Enrolled' : 'Checked',
        owner: ACTION_OWNER.VITALCV,
        explanation: `${laneLabel} returned a clean result.`,
        nextStep: null,
        ctaLabel: null,
        actionType: 'none',
        canContinuePartial: true,
      };

    case 'unavailable':
      return {
        state,
        laneLabel,
        statusLabel: 'Source unavailable — retry',
        owner: ACTION_OWNER.VITALCV,
        explanation: `${laneLabel} could not be reached this time. This is not a verdict on your record — VitalCV will retry.`,
        nextStep: 'Retry this check',
        ctaLabel: 'Retry check',
        actionType: 'retry',
        canContinuePartial: true,
      };

    case 'access_required':
      if (lane === 'state_board') {
        const ownership = resolveStateBoardOwnership();
        return {
          state,
          laneLabel,
          statusLabel: ownership.plainLabel,
          owner: ownership.owner,
          explanation: `${ownership.rationale} ${ownership.ownerPrefix}.`,
          nextStep: null,
          ctaLabel: null,
          actionType: 'none',
          canContinuePartial: true,
        };
      }
      return {
        state,
        laneLabel,
        statusLabel: 'Access required',
        owner: ACTION_OWNER.INSTITUTION,
        explanation: `${laneLabel} requires institutional access that is not yet wired. The employer covers this lane for now.`,
        nextStep: null,
        ctaLabel: null,
        actionType: 'none',
        canContinuePartial: true,
      };

    case 'stale': {
      const staleExplanation =
        lane === 'pecos'
          ? `${laneLabel} refreshes quarterly, so the record may be up to 90 days old. The current evidence is still usable for a provisional passport.`
          : `${laneLabel} returned a cached result. The current evidence is still usable, but a refresh is recommended.`;
      return {
        state,
        laneLabel,
        statusLabel: 'May be stale',
        owner: ACTION_OWNER.SOURCE,
        explanation: staleExplanation,
        nextStep: 'Refresh directly from the source',
        ctaLabel: 'Refresh now',
        actionType: 'external',
        canContinuePartial: true,
      };
    }

    case 'no_record':
      if (lane === 'nppes') {
        return {
          state,
          laneLabel,
          statusLabel: 'No NPPES record',
          owner: ACTION_OWNER.USER,
          explanation:
            'NPPES did not return a record for this NPI. The number may be mistyped, or the registration may not yet be public.',
          nextStep: 'Double-check the NPI and try again',
          ctaLabel: 'Try a different NPI',
          actionType: 'retry',
          canContinuePartial: false,
        };
      }
      return {
        state,
        laneLabel,
        statusLabel: 'No record found',
        owner: ACTION_OWNER.USER,
        explanation: `${laneLabel} has no record attached to this NPI yet.`,
        nextStep: 'Upload supporting evidence',
        ctaLabel: 'Upload evidence',
        actionType: 'upload',
        canContinuePartial: true,
      };

    case 'review_required':
      return {
        state,
        laneLabel,
        statusLabel: 'Review required',
        owner: ACTION_OWNER.REVIEWER,
        explanation: `${laneLabel} returned a finding that needs a reviewer to examine before this lane can be relied on.`,
        nextStep: 'A reviewer will contact you',
        ctaLabel: null,
        actionType: 'wait',
        canContinuePartial: false,
      };

    default: {
      // Exhaustiveness guard — every SourceLaneState must be handled.
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/**
 * Passport continuation state. Expresses honestly whether the current
 * ingest produced a provisional snapshot, a partial passport, or a
 * full decision-grade proof pack.
 */
export type PassportContinuationState =
  | 'draft_snapshot'
  | 'partial_passport'
  | 'decision_grade';

export interface PassportContinuationCopy {
  state: PassportContinuationState;
  /** Headline shown at the top of the CTA surface. */
  headline: string;
  /** One-line description of what the user is about to continue into. */
  description: string;
  /** CTA verb — never "Your passport is ready" unless decision-grade. */
  ctaLabel: string;
  /** Warning line rendered when not decision-grade. Null when decision-grade. */
  provisionalNotice: string | null;
}

export function resolvePassportContinuation(input: {
  hasAnchor: boolean;
  allRequiredLanesResolved: boolean;
  hasUnresolvedBlockers: boolean;
  anyLanePending: boolean;
  anyLaneReviewRequired: boolean;
  anyLaneAccessRequired: boolean;
  anyLaneUnavailable: boolean;
  anyLaneStale: boolean;
  anyLaneNoRecord: boolean;
}): PassportContinuationCopy {
  const {
    hasAnchor,
    allRequiredLanesResolved,
    hasUnresolvedBlockers,
    anyLanePending,
    anyLaneReviewRequired,
    anyLaneAccessRequired,
    anyLaneUnavailable,
    anyLaneStale,
    anyLaneNoRecord,
  } = input;

  if (!hasAnchor) {
    return {
      state: 'draft_snapshot',
      headline: 'Draft snapshot',
      description:
        'Identity has not resolved to a passport anchor yet. You can still see what VitalCV found so far.',
      ctaLabel: 'Continue with draft snapshot',
      provisionalNotice:
        'No passport anchor has been written. Nothing on this draft is decision-grade.',
    };
  }

  if (
    allRequiredLanesResolved
    && !hasUnresolvedBlockers
    && !anyLanePending
    && !anyLaneReviewRequired
    && !anyLaneAccessRequired
    && !anyLaneUnavailable
    && !anyLaneStale
    && !anyLaneNoRecord
  ) {
    return {
      state: 'decision_grade',
      headline: 'Decision-grade passport',
      description:
        'All required checks returned a clean result. This passport is decision-grade for the covered lanes.',
      ctaLabel: 'View full passport',
      provisionalNotice: null,
    };
  }

  const notice = anyLaneUnavailable
    ? 'One or more sources could not be reached this time. The covered lanes are still usable, but the passport is not decision-grade until they retry.'
    : anyLaneAccessRequired
      ? 'State board verification is not yet supported in this passport flow. Your employer or institution covers that lane for now.'
      : anyLaneReviewRequired
        ? 'One or more lanes need manual review before this passport can become decision-grade.'
      : anyLaneNoRecord
        ? 'One or more required records were not found yet. The covered lanes are still usable, but this passport is incomplete.'
      : anyLaneStale
        ? 'One or more covered lanes may be stale. The passport remains partial until fresher evidence lands.'
      : anyLanePending
        ? 'One or more lanes are not yet verified. The covered lanes are usable, but this passport is still incomplete.'
      : 'Some lanes are still resolving or need review. The covered lanes are usable, but the passport is not decision-grade yet.';

  return {
    state: 'partial_passport',
    headline: 'Partial passport',
    description:
      'The covered lanes are ready. Remaining lanes still need resolution before this passport is decision-grade.',
    ctaLabel: 'Continue with partial passport',
    provisionalNotice: notice,
  };
}
