import { CanonicalPrimitiveError } from './errors';
import { parseRfc3339Utc, assertNonEmptyString } from './timestamps';

export type PsvReceiptSnapshot = Readonly<{
  receiptId: string;
  fetchedAt: string;
  ttlSeconds: number;
  revoked: boolean;
}>;

export type ValidReceiptSet = Readonly<{
  receiptIds: readonly string[];
  lastVerifiedAt: string;
}>;

function assertTtlSeconds(value: unknown, fieldName: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new CanonicalPrimitiveError(`${fieldName} must be a positive integer`, 'INVALID_FIELD', {
      fieldName,
      value,
    });
  }
}

export function validateReceiptSet(
  receipts: readonly PsvReceiptSnapshot[],
  asOf: string,
): ValidReceiptSet {
  const asOfTs = parseRfc3339Utc(asOf, 'asOf');

  if (!Array.isArray(receipts) || receipts.length === 0) {
    throw new CanonicalPrimitiveError(
      'At least one PSV receipt is required',
      'MISSING_PSV_RECEIPTS',
      {
        receiptCount: Array.isArray(receipts) ? receipts.length : null,
      },
    );
  }

  const uniqueIds = new Set<string>();
  let latestReceiptTs = 0;

  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== 'object') {
      throw new CanonicalPrimitiveError('Invalid PSV receipt payload', 'INVALID_FIELD');
    }

    assertNonEmptyString(receipt.receiptId, 'psvReceipt.receiptId');
    if (uniqueIds.has(receipt.receiptId)) {
      throw new CanonicalPrimitiveError('Duplicate PSV receipt ID', 'INVALID_FIELD', {
        receiptId: receipt.receiptId,
      });
    }
    uniqueIds.add(receipt.receiptId);

    const fetchedAtTs = parseRfc3339Utc(receipt.fetchedAt, 'psvReceipt.fetchedAt');
    assertTtlSeconds(receipt.ttlSeconds, 'psvReceipt.ttlSeconds');

    if (receipt.revoked === true) {
      throw new CanonicalPrimitiveError('PSV receipt is revoked', 'PSV_RECEIPT_REVOKED', {
        receiptId: receipt.receiptId,
      });
    }

    const expiresAtTs = fetchedAtTs + receipt.ttlSeconds * 1000;
    if (asOfTs > expiresAtTs) {
      throw new CanonicalPrimitiveError('PSV receipt is expired', 'PSV_RECEIPT_EXPIRED', {
        receiptId: receipt.receiptId,
        fetchedAt: receipt.fetchedAt,
        ttlSeconds: receipt.ttlSeconds,
      });
    }

    latestReceiptTs = Math.max(latestReceiptTs, fetchedAtTs);
  }

  const sortedIds = Object.freeze([...uniqueIds].sort());
  const lastVerifiedAt = new Date(latestReceiptTs).toISOString();

  return Object.freeze({
    receiptIds: sortedIds,
    lastVerifiedAt,
  });
}

// ─────────────────────────────────────────────────────────────────────
// BACKEND-1 — Domain PSV Receipt contract alignment.
//
// Additive types that align the domain-core PSV receipt model with
// the issuer trust-contract chain (ISSUER-2..9) so a future backend
// writer can be wired without contract drift.
//
// Truth contract:
//   - A DomainPsvReceipt is scoped evidence, not global credential
//     truth. There is intentionally NO globalCredentialTruth field.
//   - limitations / sourceBasis / responderAttribution / freshness /
//     scope are required on a `persisted` receipt. Missing any of
//     them surfaces a DomainPsvReceiptContractGap.
//   - writerConfirmation is required before a receipt may carry
//     status === 'persisted'. The mapper does NOT fabricate this.
//   - The legacy PsvReceiptSnapshot above is intentionally NOT a
//     full DomainPsvReceipt. It is the legacy shape the existing
//     backend repository currently stores; mapping to the issuer
//     trust contract requires explicit upstream input that the
//     legacy snapshot does not carry.
//   - This module is a pure transform — no fetches, no DB writes,
//     no I/O. Adding these types does NOT enable persistence.
// ─────────────────────────────────────────────────────────────────────

export type DomainPsvReceiptStatus =
  | 'pending_not_persisted'
  | 'candidate'
  | 'persisted'
  | 'failed_persistence'
  | 'unavailable';

export type DomainPsvReceiptLimitationKind =
  | 'legally_only'
  | 'partial_confirmation'
  | 'contracted_agent'
  | 'access_required'
  | 'jurisdictional_scope'
  | 'other';

export type DomainPsvReceiptLimitation = Readonly<{
  kind: DomainPsvReceiptLimitationKind;
  description: string;
}>;

export type DomainPsvReceiptScope = Readonly<{
  /** Plain-language: the claim type this receipt covers. */
  claimType: string;
  /** Plain-language: what the receipt covers. */
  covers: string;
  /** Plain-language: what the receipt does NOT cover. */
  doesNotCover: string;
  /** The source-of-record organization name. */
  sourceOrganizationName: string;
}>;

export type DomainPsvReceiptFreshness = Readonly<{
  ttlDays: number;
  issuedAt: string;
  staleAfter: string;
}>;

export type DomainPsvReceiptSourceBasis = Readonly<{
  /** Authoritative source-of-record the response speaks for. */
  sourceOrganizationName: string;
  isContractedAgent: boolean;
  /** Required when isContractedAgent is true. */
  agentName?: string;
  /** Required when isContractedAgent is true — the source the agent acts for. */
  agentActsFor?: string;
  basisNote?: string;
}>;

export type DomainPsvReceiptResponderAttribution = Readonly<{
  name: string;
  role?: string;
  attributedAt: string;
  attributionMethod:
    | 'self_attested'
    | 'directory_match'
    | 'partner_assertion'
    | 'unknown';
}>;

export type DomainPsvReceiptCandidateReference = Readonly<{
  /** Identifier of the upstream PSVReceiptCandidate, if any. */
  psvCandidateId?: string;
  /** Identifier of the originating ReceiptCandidate, if any. */
  receiptCandidateId?: string;
  /** Identifier of the IssuerVerificationRequest, if any. */
  requestId?: string;
  /** Identifier of the policy review decision that accepted the candidate, if any. */
  policyReviewDecisionId?: string;
}>;

/**
 * Confirmation issued by a real writer when a row was persisted.
 * Without this artifact, a DomainPsvReceipt MUST NOT carry
 * status === 'persisted'.
 */
export type DomainPsvReceiptWriterConfirmation = Readonly<{
  confirmedAt: string;
  confirmedBy: string;
  /** Writer kind — must be a real persistence path. */
  writerMode: 'repository' | 'external';
  /** Identifier the persistence layer assigned to the row. */
  persistedRowId: string;
}>;

/**
 * The aligned domain PSV receipt. A `persisted` receipt MUST carry
 * limitations, sourceBasis, responderAttribution, freshness, scope,
 * and writerConfirmation. Other statuses MAY omit fields — but the
 * mapper / validator will surface explicit `DomainPsvReceiptContractGap`
 * entries for what's missing.
 */
export type DomainPsvReceipt = Readonly<{
  receiptId: string;
  status: DomainPsvReceiptStatus;
  /** Required for any non-pending receipt. */
  scope?: DomainPsvReceiptScope;
  /** Required, possibly empty array, for any non-pending receipt. */
  limitations?: ReadonlyArray<DomainPsvReceiptLimitation>;
  /** Required for any non-pending receipt. */
  sourceBasis?: DomainPsvReceiptSourceBasis;
  /** Required for any non-pending receipt. */
  responderAttribution?: DomainPsvReceiptResponderAttribution;
  /** Required for any non-pending receipt. */
  freshness?: DomainPsvReceiptFreshness;
  /** Optional pointer back to the upstream candidate / request. */
  candidateReference?: DomainPsvReceiptCandidateReference;
  /** Required ONLY when status === 'persisted'. */
  writerConfirmation?: DomainPsvReceiptWriterConfirmation;
}>;

/**
 * A discrete contract gap surfaced by the mapper / validator.
 * Surfaced verbatim by the persistence-decision review surface.
 */
export type DomainPsvReceiptContractGapKind =
  | 'missing_limitations'
  | 'missing_source_basis'
  | 'missing_responder_attribution'
  | 'missing_freshness'
  | 'missing_scope'
  | 'missing_candidate_reference'
  | 'missing_writer_confirmation_for_persisted'
  | 'legacy_snapshot_only'
  | 'forbidden_global_credential_truth_field'
  | 'invalid_writer_mode';

export type DomainPsvReceiptContractGap = Readonly<{
  kind: DomainPsvReceiptContractGapKind;
  field: string;
  message: string;
}>;

