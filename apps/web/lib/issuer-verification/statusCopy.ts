import type {
  ReceiptCandidateReviewState,
  VerificationRequestStatus,
} from './types';

/**
 * Clinician-safe copy for each VerificationRequestStatus.
 *
 * Truth contract:
 *   - No status renders as the bare word "Verified".
 *   - reviewRequired flags the statuses that must be attributed and
 *     reviewed before any downstream surface treats them as proof.
 */
export interface StatusCopy {
  label: string;
  description: string;
  /** True when the response cannot be relied on without committee/policy review. */
  reviewRequired: boolean;
}

export const STATUS_COPY: Record<VerificationRequestStatus, StatusCopy> = {
  draft: {
    label: 'Draft',
    description: 'Verification request is being prepared.',
    reviewRequired: false,
  },
  consent_required: {
    label: 'Consent needed',
    description: 'Consent needed before VitalCV can request this verification.',
    reviewRequired: false,
  },
  ready_to_send: {
    label: 'Ready to send',
    description: 'Consent is in place. Request is queued for the issuer.',
    reviewRequired: false,
  },
  sent: {
    label: 'Sent',
    description: 'Request sent to issuer.',
    reviewRequired: false,
  },
  viewed_by_issuer: {
    label: 'Viewed by issuer',
    description: 'Issuer viewed the request.',
    reviewRequired: false,
  },
  requires_release: {
    label: 'Release required',
    description: 'Issuer requires an additional release before responding.',
    reviewRequired: false,
  },
  confirmed: {
    label: 'Issuer confirmed (review required)',
    description:
      'Issuer confirmed this claim; review receipt details before relying on it.',
    reviewRequired: true,
  },
  partially_confirmed: {
    label: 'Partially confirmed',
    description: 'Issuer confirmed part of the claim.',
    reviewRequired: true,
  },
  corrected: {
    label: 'Corrected by issuer',
    description: 'Issuer returned corrected details.',
    reviewRequired: true,
  },
  unable_to_verify: {
    label: 'Unable to verify',
    description: 'Issuer could not verify this claim.',
    reviewRequired: true,
  },
  wrong_office: {
    label: 'Wrong office',
    description: 'Request needs to be routed to another office.',
    reviewRequired: false,
  },
  legally_only: {
    label: 'Dates / identity only',
    description: 'Dates/identity only; committee review may be required.',
    reviewRequired: true,
  },
  expired: {
    label: 'Expired',
    description: 'Request expired without a response.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Request was canceled before completion.',
    reviewRequired: false,
  },
};

export function statusCopy(status: VerificationRequestStatus): StatusCopy {
  return STATUS_COPY[status];
}

/**
 * Clinician-/reviewer-safe copy for each ReceiptCandidateReviewState.
 *
 * No copy here may say a candidate is "verified" without policy
 * qualification. The preferred phrasing is "ready for policy review",
 * "receipt candidate", "requires review", or
 * "does not finalize verification".
 */
export const REVIEW_STATE_COPY: Record<ReceiptCandidateReviewState, StatusCopy> = {
  review_required: {
    label: 'Requires review',
    description:
      'Receipt candidate created. This requires review and does not finalize verification.',
    reviewRequired: true,
  },
  ready_for_policy_review: {
    label: 'Ready for policy review',
    description:
      'Receipt candidate is ready for policy review. This does not finalize verification on its own.',
    reviewRequired: true,
  },
  conflict_review_required: {
    label: 'Conflict review required',
    description:
      'Issuer returned a corrected version; conflict review is required before any proof is derived.',
    reviewRequired: true,
  },
  release_required: {
    label: 'Release required',
    description:
      'A release form is required before the issuer will respond. Receipt candidate is paused.',
    reviewRequired: false,
  },
  reroute_required: {
    label: 'Reroute required',
    description:
      'Request must be rerouted to another office. Receipt candidate does not finalize verification.',
    reviewRequired: false,
  },
  unable_to_verify: {
    label: 'Unable to verify',
    description:
      'Issuer could not verify this claim from their records; this is not a confirmation.',
    reviewRequired: true,
  },
  expired: {
    label: 'Expired',
    description: 'Receipt candidate expired without policy review.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Receipt candidate was canceled before policy review.',
    reviewRequired: false,
  },
};

export function reviewStateCopy(state: ReceiptCandidateReviewState): StatusCopy {
  return REVIEW_STATE_COPY[state];
}
