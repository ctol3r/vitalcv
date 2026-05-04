import type {
  PSVReceipt,
  PSVReceiptLimitation,
  PSVReceiptScope,
  VerificationClaimType,
} from './types';

/**
 * ISSUER-5 — PSV Receipt Reuse + Revocation Boundary.
 *
 * Truth contract:
 *   - A reusable receipt is "may be considered as scoped evidence".
 *     It does NOT mean an employer or verifier has automatically
 *     accepted the receipt, and it does NOT imply current source
 *     truth at the moment of reuse.
 *   - A reuse decision NEVER upgrades the receipt's truth tier.
 *     globalCredentialTruth remains the literal false; the receipt
 *     keeps its own scope, limitations, and freshness.
 *   - Revocation and supersession are MODELED at the receipt level
 *     via input state — VitalCV does NOT actively poll sources for
 *     revocation, and the reuse helper does NOT call source APIs.
 *   - Expired, revoked, or superseded receipts cannot be reused.
 *   - A scope mismatch (different claim type or different source
 *     organization) blocks reuse — the verifier needs a different
 *     receipt or a fresh source check.
 *   - Limitation notes can block reuse for purposes the limitation
 *     does not cover (e.g., legally_only receipts cannot back a
 *     clinical-scope reuse request).
 *   - Source basis and attributed responder are required on the
 *     receipt; missing either blocks reuse.
 *   - Audit metadata defaults to eventState='pending_not_written'.
 *
 * This module is a pure transform — no fetches, no DB writes, no
 * audit-event writes, no live monitoring of any kind.
 */

export type PSVReceiptReuseStatus =
  | 'reusable'
  | 'not_reusable'
  | 'needs_refresh'
  | 'expired'
  | 'revoked'
  | 'superseded'
  | 'scope_mismatch'
  | 'limitation_blocks_reuse'
  | 'policy_review_required'
  | 'source_recheck_required'
  | 'blocked_cross_tenant';

export type PSVReceiptReuseFailureReason =
  | 'receipt_expired'
  | 'receipt_revoked'
  | 'receipt_superseded'
  | 'missing_freshness_window'
  | 'freshness_window_exceeded'
  | 'scope_mismatch'
  | 'limitation_blocks_reuse'
  | 'source_basis_missing'
  | 'responder_attribution_missing'
  | 'policy_review_required'
  | 'audit_metadata_missing'
  | 'unsupported_receipt_type'
  | 'cross_tenant_no_consent';

export type PSVReceiptFreshnessState = 'fresh' | 'needs_refresh' | 'expired';

/**
 * Derived freshness reading. `nowIso` is caller-controlled so the
 * helper stays a pure function and tests stay deterministic.
 */
export interface PSVReceiptFreshnessWindow {
  ttlDays: number;
  issuedAt: string;
  staleAfter: string;
  nowIso: string;
  state: PSVReceiptFreshnessState;
  /** Days remaining (negative when past staleAfter). */
  daysRemaining: number;
}

/**
 * Modeled revocation state. VitalCV records revocation when it
 * learns of one; this helper does not poll a source. Default state
 * is 'not_revoked' — the receipt is treated as still authoritative
 * for its scope until a revocation is recorded.
 */
export interface PSVReceiptRevocationState {
  state: 'not_revoked' | 'revoked';
  revokedAt?: string;
  revokedBy?: string;
  reason?: string;
  /** Free-text note; not a fake monitoring claim. */
  source: 'manual_entry' | 'demo' | 'system';
}

/**
 * Modeled supersession: when a fresher receipt has been issued for
 * the same source/claim, the older receipt is "superseded" by
 * supersedingReceiptId. Like revocation, this is recorded, not
 * polled.
 */
export interface PSVReceiptSupersession {
  state: 'not_superseded' | 'superseded';
  supersedingReceiptId?: string;
  supersededAt?: string;
  source: 'manual_entry' | 'demo' | 'system';
}

/**
 * The reason the verifier is asking to reuse the receipt and the
 * scope they want to use it for. The helper compares this against
 * the receipt's own scope to decide reusability.
 */
export interface PSVReceiptReuseScope {
  claimType: VerificationClaimType;
  sourceOrganizationName: string;
  /** Plain-language description of the reuse purpose. */
  purpose: string;
}

export interface PSVReceiptReuseRequest {
  receipt: PSVReceipt;
  reuseScope: PSVReceiptReuseScope;
  /** Caller-controlled clock so the helper remains a pure function. */
  nowIso: string;
  revocation?: PSVReceiptRevocationState;
  supersession?: PSVReceiptSupersession;
  /**
   * Soft-refresh threshold: if the receipt has fewer than this many
   * days remaining, the helper returns `needs_refresh` rather than
   * `reusable`. Caller-controlled.
   */
  refreshSoftThresholdDays?: number;
  /**
   * Cross-tenant guard. When both are supplied and they differ, reuse
   * is blocked unless `crossTenantConsentReceiptId` is also present.
   * Omitting either field skips the tenant check (single-tenant path).
   */
  requestingTenantId?: string;
  issuingTenantId?: string;
  /** Explicit consent receipt that authorises cross-tenant reuse. */
  crossTenantConsentReceiptId?: string;
}

/**
 * Audit metadata for a reuse decision. Like ISSUER-4's PSVReceipt
 * audit metadata, eventState defaults to 'pending_not_written' so
 * demo surfaces cannot claim a real write.
 */
export interface PSVReceiptReuseAuditMetadata {
  recordedAt: string;
  recordedBy: 'demo' | 'review_surface' | 'system';
  eventState: 'pending_not_written' | 'queued_demo_only' | 'written';
  notes?: string;
}

export interface PSVReceiptReuseDecision {
  decisionId: string;
  receiptId: string;
  status: PSVReceiptReuseStatus;
  /** Literal — reuse never upgrades truth tier. */
  globalCredentialTruth: false;
  /** True iff status === 'reusable'; false in every other state. */
  reusable: boolean;
  /** Set on every refusal so callers can route to the right next action. */
  failureReason?: PSVReceiptReuseFailureReason;
  /** Human-readable explanation; safe for review surfaces. */
  explanation: string;
  /** Carried-through view of the receipt's freshness at decision time. */
  freshness: PSVReceiptFreshnessWindow;
  /** Carried-through view of revocation/supersession state at decision time. */
  revocation: PSVReceiptRevocationState;
  supersession: PSVReceiptSupersession;
  decidedAt: string;
  auditMetadata: PSVReceiptReuseAuditMetadata;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the freshness window state for a receipt against a given
 * clock and an optional soft-refresh threshold. Pure function.
 */
export function getPsvReceiptFreshnessState(
  receipt: PSVReceipt,
  nowIso: string,
  refreshSoftThresholdDays = 0,
): PSVReceiptFreshnessWindow {
  const now = Date.parse(nowIso);
  const issued = Date.parse(receipt.freshness.issuedAt);
  const stale = Date.parse(receipt.freshness.staleAfter);
  if (Number.isNaN(now) || Number.isNaN(issued) || Number.isNaN(stale)) {
    throw new Error(
      `getPsvReceiptFreshnessState: invalid timestamp (now=${nowIso}, issued=${receipt.freshness.issuedAt}, stale=${receipt.freshness.staleAfter})`,
    );
  }
  const daysRemaining = Math.floor((stale - now) / ONE_DAY_MS);
  let state: PSVReceiptFreshnessState;
  if (now > stale) {
    state = 'expired';
  } else if (
    refreshSoftThresholdDays > 0 &&
    daysRemaining <= refreshSoftThresholdDays
  ) {
    state = 'needs_refresh';
  } else {
    state = 'fresh';
  }
  return {
    ttlDays: receipt.freshness.ttlDays,
    issuedAt: receipt.freshness.issuedAt,
    staleAfter: receipt.freshness.staleAfter,
    nowIso,
    state,
    daysRemaining,
  };
}

const FAILURE_EXPLANATIONS: Record<PSVReceiptReuseFailureReason, string> = {
  cross_tenant_no_consent:
    'Reuse is blocked: the requesting tenant differs from the issuing tenant and no cross-tenant consent receipt is present. An explicit consent receipt is required before cross-tenant reuse is permitted.',
  receipt_expired:
    'The PSV receipt is past its freshness window. Reuse is blocked; a source recheck or refresh is required.',
  receipt_revoked:
    'A revocation has been recorded against this PSV receipt. Reuse is blocked.',
  receipt_superseded:
    'A more recent PSV receipt supersedes this one. Reuse is blocked; use the superseding receipt or request a refresh.',
  missing_freshness_window:
    'The PSV receipt does not carry a freshness window. Reuse is blocked until freshness is recorded.',
  freshness_window_exceeded:
    'The PSV receipt is within record but past its TTL window. Reuse is blocked.',
  scope_mismatch:
    'The requested reuse scope does not match the receipt scope (different claim type or source organization). A different receipt or a fresh source check is required.',
  limitation_blocks_reuse:
    'A limitation on the PSV receipt blocks the requested reuse purpose (for example, legally_only receipts do not back clinical-scope reuse).',
  source_basis_missing:
    'The PSV receipt is missing a source basis. Reuse is blocked until the source basis is recorded.',
  responder_attribution_missing:
    'The PSV receipt is missing attributed responder information. Reuse is blocked.',
  policy_review_required:
    'Reuse for this purpose requires policy review acceptance before the receipt can be considered scoped evidence.',
  audit_metadata_missing:
    'The PSV receipt is missing audit metadata. Reuse is blocked until provenance is recorded.',
  unsupported_receipt_type:
    'The artifact passed is not a recognized PSV receipt; reuse is not supported for this type.',
};

const STATUS_BY_FAILURE: Record<PSVReceiptReuseFailureReason, PSVReceiptReuseStatus> = {
  cross_tenant_no_consent: 'blocked_cross_tenant',
  receipt_expired: 'expired',
  receipt_revoked: 'revoked',
  receipt_superseded: 'superseded',
  missing_freshness_window: 'not_reusable',
  freshness_window_exceeded: 'expired',
  scope_mismatch: 'scope_mismatch',
  limitation_blocks_reuse: 'limitation_blocks_reuse',
  source_basis_missing: 'not_reusable',
  responder_attribution_missing: 'not_reusable',
  policy_review_required: 'policy_review_required',
  audit_metadata_missing: 'not_reusable',
  unsupported_receipt_type: 'not_reusable',
};

/**
 * Heuristic: limitations that block clinical-scope reuse. Used when
 * the requested purpose mentions clinical / privileging / scope-of-
 * practice and the receipt carries a limitation that bounds the
 * receipt to non-clinical confirmation (e.g., legally_only).
 */
const NON_CLINICAL_LIMITATION_KINDS: ReadonlyArray<PSVReceiptLimitation['kind']> = [
  'legally_only',
];

function purposeAsksForClinicalScope(purpose: string): boolean {
  const p = purpose.toLowerCase();
  return (
    p.includes('clinical') ||
    p.includes('privileg') ||
    p.includes('scope of practice')
  );
}

function limitationsBlockReuse(
  limitations: readonly PSVReceiptLimitation[],
  reuseScope: PSVReceiptReuseScope,
): boolean {
  if (!limitations.length) return false;
  if (!purposeAsksForClinicalScope(reuseScope.purpose)) return false;
  return limitations.some((l) => NON_CLINICAL_LIMITATION_KINDS.includes(l.kind));
}

function scopesMatch(
  receiptScope: PSVReceiptScope,
  reuseScope: PSVReceiptReuseScope,
): boolean {
  return (
    receiptScope.claimType === reuseScope.claimType &&
    receiptScope.sourceOrganizationName.trim().toLowerCase() ===
      reuseScope.sourceOrganizationName.trim().toLowerCase()
  );
}

/**
 * Pure predicate: returns the failure reason that would block
 * reuse, or `undefined` when reuse is permitted.
 */
export function getPsvReceiptReuseFailureReason(
  request: PSVReceiptReuseRequest,
  freshness: PSVReceiptFreshnessWindow,
): PSVReceiptReuseFailureReason | undefined {
  const { receipt, reuseScope } = request;

  if (receipt.proofTier !== 'psv_receipt' || receipt.decisionGrade !== true) {
    return 'unsupported_receipt_type';
  }
  if (!receipt.sourceBasis) return 'source_basis_missing';
  if (!receipt.attributedResponder) return 'responder_attribution_missing';
  if (!receipt.auditMetadata) return 'audit_metadata_missing';
  if (!receipt.freshness || !receipt.freshness.staleAfter) {
    return 'missing_freshness_window';
  }

  const revocation = request.revocation ?? { state: 'not_revoked', source: 'demo' };
  const supersession =
    request.supersession ?? { state: 'not_superseded', source: 'demo' };

  if (revocation.state === 'revoked') return 'receipt_revoked';
  if (supersession.state === 'superseded') return 'receipt_superseded';
  if (freshness.state === 'expired') return 'receipt_expired';

  if (
    request.requestingTenantId &&
    request.issuingTenantId &&
    request.requestingTenantId !== request.issuingTenantId &&
    !request.crossTenantConsentReceiptId
  ) {
    return 'cross_tenant_no_consent';
  }

  if (!scopesMatch(receipt.scope, reuseScope)) return 'scope_mismatch';

  if (limitationsBlockReuse(receipt.limitations, reuseScope)) {
    return 'limitation_blocks_reuse';
  }

  return undefined;
}

function structuralFailureReason(
  receipt: PSVReceipt,
): PSVReceiptReuseFailureReason | undefined {
  if (receipt.proofTier !== 'psv_receipt' || receipt.decisionGrade !== true) {
    return 'unsupported_receipt_type';
  }
  if (!receipt.sourceBasis) return 'source_basis_missing';
  if (!receipt.attributedResponder) return 'responder_attribution_missing';
  if (!receipt.auditMetadata) return 'audit_metadata_missing';
  if (!receipt.freshness || !receipt.freshness.staleAfter) {
    return 'missing_freshness_window';
  }
  return undefined;
}

/**
 * Pure predicate: true iff reuse is permitted at the moment described
 * by the request.
 */
export function canReusePsvReceipt(
  request: PSVReceiptReuseRequest,
): boolean {
  const structural = structuralFailureReason(request.receipt);
  if (structural) return false;
  const freshness = getPsvReceiptFreshnessState(
    request.receipt,
    request.nowIso,
    request.refreshSoftThresholdDays ?? 0,
  );
  return getPsvReceiptReuseFailureReason(request, freshness) === undefined;
}

/**
 * Returns the most-permissive status the receipt can take given the
 * computed freshness reading. When the receipt is reusable in
 * principle, soft-refresh threshold may downgrade to needs_refresh.
 */
function statusForReusable(
  freshness: PSVReceiptFreshnessWindow,
): PSVReceiptReuseStatus {
  if (freshness.state === 'needs_refresh') return 'needs_refresh';
  if (freshness.state === 'expired') return 'expired';
  return 'reusable';
}

interface DecisionOptions {
  decisionId: string;
  decidedAt: string;
  recordedBy?: PSVReceiptReuseAuditMetadata['recordedBy'];
  notes?: string;
}

/**
 * Build a reuse decision. Always returns a decision — the
 * `reusable` flag plus `failureReason` describe the outcome.
 */
export function buildPsvReceiptReuseDecision(
  request: PSVReceiptReuseRequest,
  options: DecisionOptions,
): PSVReceiptReuseDecision {
  // Run structural gates first so we can build a decision even when
  // freshness/source-basis/responder/audit data is missing (without
  // calling getPsvReceiptFreshnessState, which would throw on a
  // missing freshness window).
  const structural = structuralFailureReason(request.receipt);
  const fallbackFreshness: PSVReceiptFreshnessWindow = {
    ttlDays: 0,
    issuedAt: '(unavailable)',
    staleAfter: '(unavailable)',
    nowIso: request.nowIso,
    state: 'expired',
    daysRemaining: 0,
  };
  const freshness: PSVReceiptFreshnessWindow = structural
    ? fallbackFreshness
    : getPsvReceiptFreshnessState(
        request.receipt,
        request.nowIso,
        request.refreshSoftThresholdDays ?? 0,
      );
  const failure =
    structural ?? getPsvReceiptReuseFailureReason(request, freshness);
  const revocation =
    request.revocation ?? { state: 'not_revoked', source: 'demo' };
  const supersession =
    request.supersession ?? { state: 'not_superseded', source: 'demo' };

  const auditMetadata: PSVReceiptReuseAuditMetadata = {
    recordedAt: options.decidedAt,
    recordedBy: options.recordedBy ?? 'review_surface',
    eventState: 'pending_not_written',
    notes:
      options.notes ??
      'Demo audit metadata; the reuse review surface does not write a real audit-event row.',
  };

  if (failure) {
    return {
      decisionId: options.decisionId,
      receiptId: request.receipt.psvReceiptId,
      status: STATUS_BY_FAILURE[failure],
      globalCredentialTruth: false,
      reusable: false,
      failureReason: failure,
      explanation: FAILURE_EXPLANATIONS[failure],
      freshness,
      revocation,
      supersession,
      decidedAt: options.decidedAt,
      auditMetadata,
    };
  }

  const status = statusForReusable(freshness);
  const explanation =
    status === 'reusable'
      ? 'Reuse is permitted as scoped evidence. This is not automatic verifier acceptance and does not imply current source truth.'
      : status === 'needs_refresh'
      ? 'Reuse is permitted but the receipt is approaching its freshness window. Consider requesting a refresh before relying on it.'
      : 'Reuse status determined; see freshness/revocation/supersession state for details.';

  return {
    decisionId: options.decisionId,
    receiptId: request.receipt.psvReceiptId,
    status,
    globalCredentialTruth: false,
    reusable: status === 'reusable',
    explanation,
    freshness,
    revocation,
    supersession,
    decidedAt: options.decidedAt,
    auditMetadata,
  };
}

/**
 * Convenience: convert a decision into a short reviewer-readable
 * summary. Pure function over a decision; safe for UI render.
 */
export function explainPsvReceiptReuseDecision(
  decision: PSVReceiptReuseDecision,
): string {
  const base = decision.explanation;
  const freshnessHint =
    decision.freshness.state === 'fresh'
      ? `Freshness: ${decision.freshness.daysRemaining} days remaining.`
      : decision.freshness.state === 'needs_refresh'
      ? `Freshness: ${decision.freshness.daysRemaining} days remaining (within refresh threshold).`
      : 'Freshness: expired.';
  return `${base} ${freshnessHint}`;
}

/**
 * Record a manual revocation against a receipt. Returns a new
 * revocation state object — does NOT mutate the receipt and does
 * NOT call any source. VitalCV does not actively monitor revocation;
 * a revocation is only known once it is recorded here.
 */
export function markPsvReceiptRevoked(input: {
  revokedAt: string;
  revokedBy: string;
  reason: string;
  source?: PSVReceiptRevocationState['source'];
}): PSVReceiptRevocationState {
  return {
    state: 'revoked',
    revokedAt: input.revokedAt,
    revokedBy: input.revokedBy,
    reason: input.reason,
    source: input.source ?? 'manual_entry',
  };
}

/**
 * Record that a receipt has been superseded by another (newer)
 * receipt for the same source/claim. Returns a new supersession
 * state — does NOT mutate the receipt and does NOT poll any source.
 */
export function markPsvReceiptSuperseded(input: {
  supersedingReceiptId: string;
  supersededAt: string;
  source?: PSVReceiptSupersession['source'];
}): PSVReceiptSupersession {
  return {
    state: 'superseded',
    supersedingReceiptId: input.supersedingReceiptId,
    supersededAt: input.supersededAt,
    source: input.source ?? 'manual_entry',
  };
}

// Cross-tenant reuse guard — standalone predicate used when the full
// buildPsvReceiptReuseDecision pipeline is not needed.
export type CrossTenantReuseResult =
  | { blocked: false }
  | { blocked: true; reason: 'cross_tenant_no_consent' };

export function checkCrossTenantReuseBlock(
  requestingTenantId: string,
  issuingTenantId: string,
  crossTenantConsentReceiptId?: string,
): CrossTenantReuseResult {
  if (requestingTenantId === issuingTenantId) return { blocked: false };
  if (crossTenantConsentReceiptId) return { blocked: false };
  return { blocked: true, reason: 'cross_tenant_no_consent' };
}
