/**
 * Receipt candidate signing orchestration.
 *
 * Wraps the pure `buildReceiptCandidateFromIssuerResponse` transform and
 * conditionally mints an ES256 JWT for confirmed responses. The builder
 * remains a pure transform; this module is the async boundary.
 *
 * Rule: only `confirmed` responses receive a signed JWT. All other statuses
 * produce an unsigned candidate because they require further review before
 * proof can be derived.
 */

import { buildReceiptCandidateFromIssuerResponse } from '@/lib/issuer-verification/receiptCandidate';
import { signIssuerReceipt } from './receiptIssuer';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  ReceiptCandidate,
} from '@/lib/issuer-verification/types';

interface BuildAndSignOptions {
  receiptCandidateId: string;
  claimId: string;
  /** NPI or system provider identifier for the JWT `sub` claim. */
  providerId: string;
  /** Human-readable source name (organization / clearinghouse). */
  source: string;
  /**
   * Deterministic hash of the raw response payload for audit
   * non-repudiation. Callers should use SHA-256 of the serialized
   * issuer response before passing it here.
   */
  rawHash: string;
  auditChannel?: 'issuer_response_form' | 'partner_response' | 'manual_entry';
  recordedBy?: 'demo' | 'review_surface' | 'system';
}

/**
 * Build a ReceiptCandidate and — if the response is 'confirmed' —
 * attach a signed ES256 JWT to `candidate.signedReceiptJwt`.
 *
 * Non-confirmed responses return an unsigned candidate; calling code
 * must not treat the absence of `signedReceiptJwt` as an error.
 */
export async function buildAndSignReceiptCandidate(
  request: IssuerVerificationRequest,
  response: IssuerResponse,
  options: BuildAndSignOptions,
): Promise<ReceiptCandidate> {
  const candidate = buildReceiptCandidateFromIssuerResponse(request, response, {
    receiptCandidateId: options.receiptCandidateId,
    claimId: options.claimId,
    auditChannel: options.auditChannel,
    recordedBy: options.recordedBy,
  });

  if (response.status !== 'confirmed') {
    return candidate;
  }

  const { jwt } = await signIssuerReceipt(response, {
    providerId: options.providerId,
    claimId: options.claimId,
    source: options.source,
    rawHash: options.rawHash,
  });

  return { ...candidate, signedReceiptJwt: jwt };
}
