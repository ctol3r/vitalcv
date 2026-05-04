import type {
  PolicyReviewDecisionStatus,
  ReceiptCandidateReviewState,
  VerificationRequestStatus,
} from './types';
import type { IssuerAuditWriteStatus } from './auditPersistence';
import type { IssuerRequestLifecycleStatus } from './requestLifecycle';
import type { PSVReceiptReuseStatus } from './psvReceiptReuse';

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

// ── Audit persistence copy ─────────────────────────────────────────────────

/**
 * Display key for the audit persistence copy table. Maps `'failed'` to
 * `'audit_write_failed'` so review surfaces can use a more explicit label
 * without changing the canonical `IssuerAuditWriteStatus` union.
 */
export type IssuerAuditPersistenceCopyKey =
  | Exclude<IssuerAuditWriteStatus, 'failed'>
  | 'audit_write_failed'
  | 'replay_safe';

export const ISSUER_AUDIT_PERSISTENCE_COPY: Record<IssuerAuditPersistenceCopyKey, StatusCopy> = {
  pending_not_written: {
    label: 'Pending',
    description: 'Audit record has not been written yet.',
    reviewRequired: false,
  },
  demo_not_persisted: {
    label: 'Demo (not persisted)',
    description: 'Demo mode — no real audit row was written to the database.',
    reviewRequired: false,
  },
  simulated: {
    label: 'Simulated',
    description: 'Audit write was simulated; no real record was created.',
    reviewRequired: false,
  },
  persisted: {
    label: 'Persisted',
    description: 'Audit record was written and acknowledged by the database.',
    reviewRequired: false,
  },
  audit_write_failed: {
    label: 'Write failed',
    description: 'Audit write failed. The event may not be retrievable.',
    reviewRequired: true,
  },
  unavailable: {
    label: 'Unavailable',
    description: 'Audit persistence is not available in this environment.',
    reviewRequired: false,
  },
  replay_safe: {
    label: 'Replay-safe',
    description:
      'Replay-safe means the event MAY appear in a timeline replay for context. It does not mean legal proof.',
    reviewRequired: false,
  },
};

export function getIssuerAuditPersistenceCopy(status: IssuerAuditPersistenceCopyKey): StatusCopy {
  return ISSUER_AUDIT_PERSISTENCE_COPY[status];
}

// ── Request lifecycle copy ─────────────────────────────────────────────────

export const ISSUER_REQUEST_LIFECYCLE_COPY: Record<IssuerRequestLifecycleStatus, StatusCopy> = {
  draft: {
    label: 'Draft',
    description: 'Request is being prepared and has not been sent.',
    reviewRequired: false,
  },
  consent_required: {
    label: 'Consent required',
    description: 'Consent must be granted before the request can proceed.',
    reviewRequired: false,
  },
  consent_recorded: {
    label: 'Consent recorded',
    description: 'Consent has been recorded. Request is ready to send.',
    reviewRequired: false,
  },
  ready_to_send: {
    label: 'Ready to send',
    description: 'All prerequisites met. The request can be dispatched to the issuer.',
    reviewRequired: false,
  },
  manual_link_generated: {
    label: 'Link generated',
    description: 'A manual send link has been generated for the requester.',
    reviewRequired: false,
  },
  copied_by_requester: {
    label: 'Copied by requester',
    description: 'Requester copied the manual link.',
    reviewRequired: false,
  },
  sent_by_requester: {
    label: 'Sent',
    description: 'Requester attests the link was sent to the issuer.',
    reviewRequired: false,
  },
  viewed_by_issuer: {
    label: 'Viewed by issuer',
    description: 'An observation event indicates the issuer viewed the request.',
    reviewRequired: false,
  },
  response_received: {
    label: 'Response received',
    description:
      'Issuer response has been received. Awaiting policy review. Receiving a response does not finalize verification.',
    reviewRequired: true,
  },
  receipt_candidate_created: {
    label: 'Receipt candidate created',
    description:
      'A receipt candidate was created from the issuer response. Requires review. Receipt candidate review and policy review are still required.',
    reviewRequired: true,
  },
  policy_review_pending: {
    label: 'Policy review pending',
    description: 'Receipt candidate is awaiting policy review.',
    reviewRequired: true,
  },
  psv_receipt_promoted: {
    label: 'PSV receipt issued',
    description:
      'Receipt candidate passed policy review and a PSV receipt was issued. The receipt is scoped evidence — not global credential truth.',
    reviewRequired: false,
  },
  closed: {
    label: 'Closed',
    description: 'Request closed after completion.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Request was canceled before completion.',
    reviewRequired: false,
  },
  expired: {
    label: 'Expired',
    description: 'Request expired without a complete issuer response.',
    reviewRequired: false,
  },
};

export function getIssuerLifecycleStatusCopy(status: IssuerRequestLifecycleStatus): StatusCopy {
  return ISSUER_REQUEST_LIFECYCLE_COPY[status];
}

// ── Policy review decision copy ────────────────────────────────────────────

export const POLICY_REVIEW_COPY: Record<PolicyReviewDecisionStatus, StatusCopy> = {
  pending_review: {
    label: 'Pending review',
    description: 'Policy review has not yet been performed on this candidate.',
    reviewRequired: true,
  },
  accepted_as_psv_candidate: {
    label: 'Accepted as PSV candidate',
    description:
      'Candidate accepted for PSV receipt promotion. Not a global credential — scoped review required.',
    reviewRequired: true,
  },
  rejected: {
    label: 'Rejected',
    description: 'Candidate was rejected at policy review.',
    reviewRequired: false,
  },
  request_more_info: {
    label: 'More info requested',
    description: 'Policy reviewer requested additional information before deciding.',
    reviewRequired: true,
  },
  requires_release: {
    label: 'Release required',
    description: 'A release form is required before the candidate can advance.',
    reviewRequired: false,
  },
  reroute_required: {
    label: 'Reroute required',
    description: 'Request must be rerouted to another office.',
    reviewRequired: false,
  },
  conflict_review_required: {
    label: 'Conflict review required',
    description: 'A corrected or conflicting response requires conflict review.',
    reviewRequired: true,
  },
  expired: {
    label: 'Expired',
    description: 'Policy review window expired before a decision was made.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Policy review was canceled before completion.',
    reviewRequired: false,
  },
};

export function policyReviewCopy(status: PolicyReviewDecisionStatus): StatusCopy {
  return POLICY_REVIEW_COPY[status];
}

// ── PSV receipt promotion copy ─────────────────────────────────────────────

export type PSVReceiptCopyKey = 'psv_receipt_promoted' | 'promotion_blocked';

export const PSV_RECEIPT_COPY: Record<PSVReceiptCopyKey, StatusCopy> = {
  psv_receipt_promoted: {
    label: 'PSV receipt issued',
    description:
      'PSV receipt promoted from an accepted policy review. Scoped evidence — not global credential truth.',
    reviewRequired: false,
  },
  promotion_blocked: {
    label: 'Promotion blocked',
    description:
      'PSV receipt could not be issued. The policy review decision did not pass all promotion gates.',
    reviewRequired: true,
  },
};

export function psvReceiptCopy(key: PSVReceiptCopyKey): StatusCopy {
  return PSV_RECEIPT_COPY[key];
}

// ── PSV receipt reuse copy ─────────────────────────────────────────────────

export const PSV_RECEIPT_REUSE_COPY: Record<PSVReceiptReuseStatus, StatusCopy> = {
  reusable: {
    label: 'Reusable',
    description:
      'Receipt is within its freshness window and may be reused as scoped evidence. Reusable means may-be-considered; this is not automatic verifier acceptance and does not imply current source truth.',
    reviewRequired: false,
  },
  not_reusable: {
    label: 'Not reusable',
    description: 'Receipt cannot be reused. See failure reason for details.',
    reviewRequired: true,
  },
  needs_refresh: {
    label: 'Needs refresh',
    description: 'Receipt is approaching staleness; a refresh should be initiated.',
    reviewRequired: false,
  },
  expired: {
    label: 'Expired',
    description: 'Receipt has passed its freshness window and cannot be reused.',
    reviewRequired: false,
  },
  revoked: {
    label: 'Revoked',
    description: 'Receipt was explicitly revoked and cannot be reused.',
    reviewRequired: true,
  },
  superseded: {
    label: 'Superseded',
    description: 'A newer receipt supersedes this one; reuse is blocked.',
    reviewRequired: false,
  },
  scope_mismatch: {
    label: 'Scope mismatch',
    description: 'The reuse request scope does not match the original receipt scope.',
    reviewRequired: true,
  },
  limitation_blocks_reuse: {
    label: 'Limitation blocks reuse',
    description: 'A limitation on the receipt prevents reuse for this context.',
    reviewRequired: true,
  },
  policy_review_required: {
    label: 'Policy review required',
    description: 'Reuse requires policy review before it may proceed.',
    reviewRequired: true,
  },
  source_recheck_required: {
    label: 'Source recheck required',
    description: 'Source must be rechecked before the receipt can be reused.',
    reviewRequired: true,
  },
};

export function psvReceiptReuseCopy(status: PSVReceiptReuseStatus): StatusCopy {
  return PSV_RECEIPT_REUSE_COPY[status];
}
