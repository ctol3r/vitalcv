import type {
  PolicyReviewDecisionStatus,
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

/**
 * Reviewer-safe copy for each PolicyReviewDecisionStatus.
 *
 * Truth contract:
 *   - No status renders as the bare word "Verified".
 *   - Accepted decisions speak of "PSV receipt candidate", not a final
 *     PSV receipt or final credentialing proof.
 *   - Rejected, request_more_info, and cancel statuses make explicit
 *     that nothing has been verified by this decision.
 */
export const POLICY_REVIEW_COPY: Record<PolicyReviewDecisionStatus, StatusCopy> = {
  pending_review: {
    label: 'Pending policy review',
    description:
      'Receipt candidate is awaiting policy review. This is not final credentialing proof.',
    reviewRequired: true,
  },
  accepted_as_psv_candidate: {
    label: 'Accepted as PSV receipt candidate',
    description:
      'Policy review accepted the candidate; the result is a PSV receipt candidate. This does not finalize verification on its own.',
    reviewRequired: true,
  },
  rejected: {
    label: 'Rejected',
    description:
      'Policy review rejected the candidate. The original issuer response and evidence metadata are preserved.',
    reviewRequired: false,
  },
  request_more_info: {
    label: 'Request more information',
    description:
      'Reviewer asked the issuer for additional detail. This does not finalize verification.',
    reviewRequired: true,
  },
  requires_release: {
    label: 'Requires release',
    description:
      'A release form is required before the candidate can be reviewed for acceptance. Decision is paused.',
    reviewRequired: true,
  },
  reroute_required: {
    label: 'Reroute required',
    description:
      'Request must be rerouted to another office before any acceptance. This decision does not verify the claim.',
    reviewRequired: true,
  },
  conflict_review_required: {
    label: 'Conflict review required',
    description:
      'A corrected response or other conflict must be resolved by conflict review before the candidate can be accepted.',
    reviewRequired: true,
  },
  expired: {
    label: 'Expired',
    description: 'Policy review window expired without a decision.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Policy review was canceled before a decision was reached.',
    reviewRequired: false,
  },
};

export function policyReviewCopy(
  status: PolicyReviewDecisionStatus,
): StatusCopy {
  return POLICY_REVIEW_COPY[status];
}

/**
 * Reviewer-safe copy for PSV receipt promotion lifecycle states.
 *
 * Truth contract:
 *   - No status renders as the bare word "Verified".
 *   - PSV receipt language is always scoped or evidence-bound.
 *   - "Promoted" never implies global credential truth.
 *   - Blocked states explain which gate refused.
 */
export type PsvReceiptCopyKey =
  | 'psv_receipt_candidate'
  | 'psv_receipt_promoted'
  | 'promotion_blocked'
  | 'promotion_requires_limitation'
  | 'promotion_requires_policy_acceptance'
  | 'promotion_requires_source_basis';

export const PSV_RECEIPT_COPY: Record<PsvReceiptCopyKey, StatusCopy> = {
  psv_receipt_candidate: {
    label: 'PSV receipt candidate',
    description:
      'Candidate accepted under policy review. Scoped evidence; not final credentialing proof on its own.',
    reviewRequired: true,
  },
  psv_receipt_promoted: {
    label: 'PSV receipt promoted',
    description:
      'Receipt promoted under policy review. Scope, limitations, and freshness remain controlling. This is scoped evidence, not global credential truth.',
    reviewRequired: false,
  },
  promotion_blocked: {
    label: 'Promotion blocked',
    description:
      'Promotion was refused. The original candidate and evidence metadata are preserved.',
    reviewRequired: true,
  },
  promotion_requires_limitation: {
    label: 'Promotion requires limitation',
    description:
      'The originating issuer response was legally_only; promotion requires an explicit limitation note before a PSV receipt can be issued.',
    reviewRequired: true,
  },
  promotion_requires_policy_acceptance: {
    label: 'Promotion requires policy acceptance',
    description:
      'Promotion is blocked until policy review accepts the candidate. Reject, request_more_info, reroute, and pending decisions cannot promote.',
    reviewRequired: true,
  },
  promotion_requires_source_basis: {
    label: 'Promotion requires source basis',
    description:
      'Promotion requires a source basis to be carried by the candidate; the contracted-agent / source distinction must be preserved on the receipt.',
    reviewRequired: true,
  },
};

export function psvReceiptCopy(key: PsvReceiptCopyKey): StatusCopy {
  return PSV_RECEIPT_COPY[key];
}

/**
 * Reviewer-safe copy for PSV receipt reuse lifecycle states.
 *
 * Truth contract:
 *   - "Reusable" never means automatic verifier acceptance.
 *   - No copy implies live monitoring or current source truth.
 *   - Revocation/supersession copy reflects modeled state, not
 *     active polling.
 *   - No bare "Verified" label.
 */
export type PsvReceiptReuseCopyKey =
  | 'reusable'
  | 'not_reusable'
  | 'needs_refresh'
  | 'expired'
  | 'revoked'
  | 'superseded'
  | 'scope_mismatch'
  | 'limitation_blocks_reuse'
  | 'source_recheck_required'
  | 'policy_review_required';

export const PSV_RECEIPT_REUSE_COPY: Record<PsvReceiptReuseCopyKey, StatusCopy> = {
  reusable: {
    label: 'Reusable as scoped evidence',
    description:
      'May be reused as scoped evidence within the receipt scope, limitations, and freshness window. This is not automatic verifier acceptance and does not imply current source truth.',
    reviewRequired: false,
  },
  not_reusable: {
    label: 'Not reusable',
    description:
      'Reuse is blocked by a structural gap on the receipt (missing source basis, attribution, or audit metadata).',
    reviewRequired: true,
  },
  needs_refresh: {
    label: 'Needs refresh',
    description:
      'Receipt is reusable but approaching its freshness window. Consider requesting a refresh before relying on it.',
    reviewRequired: true,
  },
  expired: {
    label: 'Expired',
    description:
      'Receipt is past its freshness window. Reuse is blocked; a source recheck or refresh is required.',
    reviewRequired: false,
  },
  revoked: {
    label: 'Revoked',
    description:
      'A revocation has been recorded for this receipt. Reuse is blocked. VitalCV records revocation when it is reported; it does not actively poll the source.',
    reviewRequired: false,
  },
  superseded: {
    label: 'Superseded',
    description:
      'A more recent receipt has been recorded for the same source and claim. Reuse the superseding receipt or request a refresh.',
    reviewRequired: false,
  },
  scope_mismatch: {
    label: 'Scope mismatch',
    description:
      'Requested reuse scope does not match the receipt scope. A different receipt or a fresh source check is required.',
    reviewRequired: true,
  },
  limitation_blocks_reuse: {
    label: 'Limitation blocks reuse',
    description:
      'A limitation on the receipt blocks the requested reuse purpose. Use a receipt without that limitation, or request a fresh source check.',
    reviewRequired: true,
  },
  source_recheck_required: {
    label: 'Source recheck required',
    description:
      'Reuse for this purpose requires a fresh source check before the receipt can be reconsidered as scoped evidence.',
    reviewRequired: true,
  },
  policy_review_required: {
    label: 'Policy review required',
    description:
      'Reuse for this purpose requires policy review acceptance before the receipt can be considered scoped evidence.',
    reviewRequired: true,
  },
};

export function psvReceiptReuseCopy(key: PsvReceiptReuseCopyKey): StatusCopy {
  return PSV_RECEIPT_REUSE_COPY[key];
}

/**
 * Reviewer-safe copy for issuer request lifecycle statuses.
 *
 * Truth contract:
 *   - No copy renders as the bare word "Verified".
 *   - Copy never makes the issuer-affirmation overclaim outside the
 *     response-status copy that legitimately covers it (that copy
 *     lives in REVIEW_STATE_COPY).
 *   - Copy never claims a real audit-event row was written.
 *   - "Sent" and "viewed" copy is unambiguous about who attested it.
 */
export type IssuerRequestLifecycleCopyKey =
  | 'draft'
  | 'consent_required'
  | 'consent_recorded'
  | 'ready_to_send'
  | 'manual_link_generated'
  | 'copied_by_requester'
  | 'sent_by_requester'
  | 'viewed_by_issuer'
  | 'response_received'
  | 'receipt_candidate_created'
  | 'policy_review_pending'
  | 'psv_receipt_promoted'
  | 'closed'
  | 'canceled'
  | 'expired';

export const ISSUER_REQUEST_LIFECYCLE_COPY: Record<
  IssuerRequestLifecycleCopyKey,
  StatusCopy
> = {
  draft: {
    label: 'Draft',
    description:
      'Verification request is being prepared. No issuer contact has been made.',
    reviewRequired: false,
  },
  consent_required: {
    label: 'Consent required',
    description:
      'Holder consent must be recorded before a manual send link can be generated.',
    reviewRequired: false,
  },
  consent_recorded: {
    label: 'Consent recorded',
    description:
      'Holder consent has been recorded for this verification scope.',
    reviewRequired: false,
  },
  ready_to_send: {
    label: 'Ready to send',
    description:
      'Consent is in place. The requester may now generate a manual send link.',
    reviewRequired: false,
  },
  manual_link_generated: {
    label: 'Manual link generated',
    description:
      'A manual send link has been generated. Generation is not delivery; the requester must copy and send the link manually.',
    reviewRequired: false,
  },
  copied_by_requester: {
    label: 'Copied by requester',
    description:
      'The requester has attested to copying the manual link. Copying is not delivery.',
    reviewRequired: false,
  },
  sent_by_requester: {
    label: 'Sent by requester',
    description:
      'The requester has attested to sending the link manually. Send attestation does not mean the issuer has viewed the request.',
    reviewRequired: false,
  },
  viewed_by_issuer: {
    label: 'Viewed by issuer',
    description:
      'The verification surface observed the issuer opening the request. View observation does not mean the claim is finalized.',
    reviewRequired: false,
  },
  response_received: {
    label: 'Response received',
    description:
      'A response has been received from the issuer. Receipt does not finalize verification — see receipt candidate review.',
    reviewRequired: true,
  },
  receipt_candidate_created: {
    label: 'Receipt candidate created',
    description:
      'A receipt candidate has been built from the response. Candidate review and policy review are still required.',
    reviewRequired: true,
  },
  policy_review_pending: {
    label: 'Policy review pending',
    description:
      'The candidate is awaiting policy review. This is not acceptance; reject and request-more-info are valid outcomes.',
    reviewRequired: true,
  },
  psv_receipt_promoted: {
    label: 'PSV receipt promoted',
    description:
      'A scoped PSV receipt has been promoted under policy review. Scope, limitations, and freshness remain controlling; this is not global credential truth.',
    reviewRequired: false,
  },
  closed: {
    label: 'Closed',
    description: 'Request has been closed; no further lifecycle events expected.',
    reviewRequired: false,
  },
  canceled: {
    label: 'Canceled',
    description: 'Request was canceled before completion.',
    reviewRequired: false,
  },
  expired: {
    label: 'Expired',
    description: 'Request expired without completion.',
    reviewRequired: false,
  },
};

export function getIssuerLifecycleStatusCopy(
  key: IssuerRequestLifecycleCopyKey,
): StatusCopy {
  return ISSUER_REQUEST_LIFECYCLE_COPY[key];
}

/**
 * Reviewer-safe copy for issuer audit persistence boundary states.
 *
 * Truth contract:
 *   - No copy claims a row was persisted unless the status itself
 *     is `persisted`.
 *   - "Replay-safe" copy never implies legal proof.
 *   - "Pending" and "demo" copy must read as distinct from
 *     "persisted".
 */
export type IssuerAuditPersistenceCopyKey =
  | 'pending_not_written'
  | 'demo_not_persisted'
  | 'persisted'
  | 'audit_write_failed'
  | 'replay_safe'
  | 'not_legal_proof';

export const ISSUER_AUDIT_PERSISTENCE_COPY: Record<
  IssuerAuditPersistenceCopyKey,
  StatusCopy
> = {
  pending_not_written: {
    label: 'Pending (not written)',
    description:
      'Default state. No writer has attempted to persist this record. Timeline replay shows recorded workflow context. It does not prove clinical truth by itself.',
    reviewRequired: false,
  },
  demo_not_persisted: {
    label: 'Demo (not persisted)',
    description:
      'A demo or no-op writer was used. No audit row was persisted; the record is replay context only and is distinct from a persisted audit record.',
    reviewRequired: false,
  },
  persisted: {
    label: 'Persisted',
    description:
      'A real repository or external writer confirmed a persisted audit row. Persistence proves action history; it does not, on its own, prove clinical truth.',
    reviewRequired: false,
  },
  audit_write_failed: {
    label: 'Audit write failed',
    description:
      'A real writer attempted to persist and failed. The record is not part of any audit trail until a retry succeeds.',
    reviewRequired: true,
  },
  replay_safe: {
    label: 'Replay-safe',
    description:
      'May be included in timeline replay for context. Replay-safe does not mean legal proof and does not change any claim truth tier.',
    reviewRequired: false,
  },
  not_legal_proof: {
    label: 'Not legal proof',
    description:
      'Audit boundary metadata describes action history, not clinical truth. It is not legal proof on its own.',
    reviewRequired: false,
  },
};

export function getIssuerAuditPersistenceCopy(
  key: IssuerAuditPersistenceCopyKey,
): StatusCopy {
  return ISSUER_AUDIT_PERSISTENCE_COPY[key];
}
