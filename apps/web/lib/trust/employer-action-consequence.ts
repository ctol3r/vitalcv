/**
 * Consequence contract for employer review actions.
 *
 * Every action button on the employer review surface must answer four
 * questions before the click:
 *   1. What does this action do?
 *   2. What evidence state does it assume?
 *   3. What audit event gets written?
 *   4. What remains unresolved after the action fires?
 *   5. Who owns the next move?
 *
 * Doctrine (Launch Gate E1-E5 + review ownership wave):
 *   - No action button without explicit consequence copy.
 *   - "Accept as head start" must clearly distinguish what is being
 *     accepted vs what is NOT being accepted.
 *   - Every action must write an audit event before returning success
 *     (per employer decision persistence gate).
 *   - Partial proof pack never upgrades silently when an action fires.
 */

import { ACTION_OWNER, type ActionOwner } from './action-owner';
import type { EmployerActionCopyKey, ProofTier as ProofTierShortKey } from './decision-copy';

export interface EmployerActionConsequence {
  /** Which action this describes (mirrors EmployerActionCopyKey). */
  action: EmployerActionCopyKey;
  /** One-line description of what the action does (present tense, concrete). */
  does: string;
  /** What evidence state the action assumes — the implicit precondition. */
  assumes: string;
  /** The audit event that lands before the action returns 2xx. */
  auditEvent: string;
  /** What remains unresolved after the action fires. Null when nothing. */
  remainsAfter: string | null;
  /** Who owns the next move after this action fires. */
  ownerAfter: ActionOwner;
  /**
   * Extra "not being accepted" line for the accept action. For other
   * actions this is null. Rule: accept must never imply the employer
   * has absorbed risk they have not actually absorbed.
   */
  acceptNotIncluded: string | null;
}

export function resolveEmployerActionConsequence(
  action: EmployerActionCopyKey,
): EmployerActionConsequence {
  switch (action) {
    case 'accept':
      return {
        action,
        does:
          'When decision-grade proof is attached, records a head-start acceptance on this verification snapshot, writes a decision event and audit record, and returns the packet to the employer dashboard.',
        assumes:
          'Decision-grade proof has been rendered for the covered lanes. If the packet is still partial, the uncovered lanes remain outside the acceptance and this action stays blocked.',
        auditEvent: 'EmployerDecisionEvent(type=ACCEPT) + AuditEvent',
        remainsAfter:
          'Final credentialing workflow still happens at the employer. VitalCV provides the pre-screen, not the full privileging decision.',
        ownerAfter: ACTION_OWNER.EMPLOYER,
        acceptNotIncluded:
          'Head-start does NOT include NPDB, DEA registration, ABMS board certification, unresolved partial lanes, or full CAQH credentialing. These remain the employer\u2019s credentialing office to complete.',
      };

    case 'refresh':
      return {
        action,
        does:
          'Re-queries the upstream sources for fresh data, reruns the ingest, and surfaces any new findings in the review packet.',
        assumes:
          'Nothing — refresh is safe at any evidence state. Useful when a lane is stale or the clinician has taken recent action.',
        auditEvent: 'EmployerDecisionEvent(type=REFRESH_REQUESTED) + AuditEvent',
        remainsAfter:
          'Refreshed data arrives asynchronously. You will see the new state when the next ingest completes.',
        ownerAfter: ACTION_OWNER.VITALCV,
        acceptNotIncluded: null,
      };

    case 'review':
      return {
        action,
        does:
          'Routes the packet to manual review with a reviewer-assigned follow-up. The clinician is notified that their packet is under review.',
        assumes:
          'A finding or gap exists that a human reviewer needs to interpret — a lane returned review_required, or the evidence tier does not match the employer\u2019s risk posture.',
        auditEvent: 'EmployerDecisionEvent(type=ROUTE_TO_REVIEW) + AuditEvent',
        remainsAfter:
          'A reviewer will contact the clinician and update the packet. No head-start is recorded until review resolves.',
        ownerAfter: ACTION_OWNER.REVIEWER,
        acceptNotIncluded: null,
      };

    case 'pause':
      return {
        action,
        does:
          'Pauses the candidate in the employer pipeline without closing the record. No decision event is written; the packet remains visible.',
        assumes:
          'Nothing — pause is a non-decision. It preserves the packet while the employer gathers out-of-band context.',
        auditEvent: 'EmployerDecisionEvent(type=PAUSE) + AuditEvent',
        remainsAfter: 'The candidate is not advancing. Resume by taking any other action.',
        ownerAfter: ACTION_OWNER.EMPLOYER,
        acceptNotIncluded: null,
      };

    case 'reject':
      return {
        action,
        does:
          'Records a final "do not proceed" decision on this snapshot. The packet is closed for head-start acceptance in this employer context.',
        assumes:
          'The employer has concluded that the clinician cannot be advanced on this snapshot. Typically follows a review or a disqualifying finding.',
        auditEvent: 'EmployerDecisionEvent(type=REJECT) + AuditEvent',
        remainsAfter:
          'The clinician remains eligible for other employer contexts. This action is scoped to the current employer.',
        ownerAfter: ACTION_OWNER.EMPLOYER,
        acceptNotIncluded: null,
      };

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/**
 * Proof tier parity with the /passport continuation states.
 * Mirrors `resolvePassportContinuation` input/output shape so review
 * and passport surfaces agree on when a packet is draft / partial /
 * decision-grade. Never upgrades a packet silently.
 *
 * Two proof-tier vocabularies exist in the codebase by design:
 *   - `ProofTier` (this module, long form) — narrative tier carried
 *     by the review banner (`resolveProofTier → ProofTierMeta`). Used
 *     for user-facing labels and acceptance gating.
 *   - `ProofTierShortKey` (decision-copy.ts) — short key used by
 *     `getEmployerActionLabel(action, { proofTier })` to pick between
 *     "Accept as head start" and "Accept partial head start".
 *
 * `proofTierToShortKey()` is the canonical bridge. Callers must route
 * through it rather than hardcoding the mapping inline.
 */
export type ProofTier = 'draft_snapshot' | 'partial_proof_pack' | 'decision_grade_proof_pack';

export function proofTierToShortKey(tier: ProofTier): ProofTierShortKey {
  switch (tier) {
    case 'draft_snapshot':
      return 'draft';
    case 'partial_proof_pack':
      return 'partial';
    case 'decision_grade_proof_pack':
      return 'decision_grade';
    default: {
      const _exhaustive: never = tier;
      return _exhaustive;
    }
  }
}

export interface ProofTierMeta {
  tier: ProofTier;
  /** Short label rendered on the review tier chip. */
  label: string;
  /** One-line description of what this tier guarantees. */
  description: string;
  /** Whether head-start acceptance is allowed at this tier. */
  acceptAllowed: boolean;
  /** Human reason the employer cannot accept, null if acceptance is allowed. */
  acceptBlockedReason: string | null;
}

export function resolveProofTier(input: {
  hasAnchor: boolean;
  allRequiredLanesResolved: boolean;
  hasUnresolvedBlockers: boolean;
  anyLanePending: boolean;
  anyLaneReviewRequired: boolean;
  anyLaneAccessRequired: boolean;
  anyLaneUnavailable: boolean;
  anyLaneStale: boolean;
  anyLaneNoRecord: boolean;
  hasOpenDriftAlerts?: boolean;
}): ProofTierMeta {
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
    hasOpenDriftAlerts = false,
  } = input;

  if (!hasAnchor) {
    return {
      tier: 'draft_snapshot',
      label: 'Draft snapshot',
      description:
        'No passport anchor has been written. Nothing on this surface is decision-grade.',
      acceptAllowed: false,
      acceptBlockedReason:
        'Draft snapshot — no passport anchor exists. Head-start cannot be accepted.',
    };
  }

  const decisionGrade =
    allRequiredLanesResolved
    && !hasUnresolvedBlockers
    && !anyLanePending
    && !anyLaneReviewRequired
    && !anyLaneAccessRequired
    && !anyLaneUnavailable
    && !anyLaneStale
    && !anyLaneNoRecord
    && !hasOpenDriftAlerts;

  if (decisionGrade) {
    return {
      tier: 'decision_grade_proof_pack',
      label: 'Decision-grade proof pack',
      description:
        'All required lanes returned a clean result. Head-start acceptance is allowed for the covered lanes.',
      acceptAllowed: true,
      acceptBlockedReason: null,
    };
  }

  // Everything else is partial. Compose the most specific reason the
  // employer cannot accept head-start right now.
  const reason = hasOpenDriftAlerts
    ? 'Drift alerts are open. Resolve them before accepting.'
    : anyLaneUnavailable
      ? 'One or more sources could not be reached. Head-start requires decision-grade evidence.'
      : anyLaneReviewRequired
        ? 'One or more lanes need reviewer attention before head-start acceptance.'
      : anyLaneAccessRequired
        ? 'An access-required lane is not yet covered. Your institution covers that lane for now.'
      : anyLaneStale
        ? 'One or more lanes may be stale. Refresh before accepting as head-start.'
      : anyLaneNoRecord
        ? 'One or more records are missing. Request missing info before accepting.'
      : anyLanePending
        ? 'Verification is still running. Wait for lanes to resolve.'
      : 'Unresolved blockers remain. Resolve them before accepting.';

  return {
    tier: 'partial_proof_pack',
    label: 'Partial proof pack',
    description:
      'Some lanes are resolved; others are still pending, stale, access-required, or in review. This packet is not decision-grade yet.',
    acceptAllowed: false,
    acceptBlockedReason: `Partial head-start only — ${reason}`,
  };
}
