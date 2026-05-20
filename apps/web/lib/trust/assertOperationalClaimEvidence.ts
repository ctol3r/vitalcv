/**
 * Evidence-bound operational-claim helper.
 *
 * Lightweight, deterministic guard for surfaces that render
 * operational claims. The helper does NOT introduce runtime
 * enforcement complexity — it is a tiny pure function that callers
 * pass a claim through to surface a single object the UI can render
 * AND a CI test can assert on.
 *
 * Design intent:
 * - A claim is a (subject, capability, status) triple.
 * - For statuses `implemented` and `operator_assisted`, the caller
 *   MUST supply an `evidence` reference: a code path, a route, or a
 *   well-known endpoint that exercises the capability.
 * - For statuses `institution_owned`, `pilot_target`, `planned`, and
 *   `unsupported`, evidence is optional but recommended.
 * - The helper returns a typed `OperationalClaim` with a normalised
 *   `displayStatus` label and a `hasEvidence` flag. It does not throw
 *   in production — it tags the claim and lets the surface render.
 *
 * Tests can grep for `OperationalClaim` objects across the rendered
 * UI bundle and assert that every `implemented` / `operator_assisted`
 * claim carries an evidence reference.
 */

import {
  OPERATIONAL_STATUS_DESCRIPTORS,
  type OperationalStatus,
} from './operational-status';

export interface OperationalClaimInput {
  /** What the claim is about (e.g. "DEA registration resolution"). */
  capability: string;
  /** Canonical operational status. */
  status: OperationalStatus;
  /**
   * Implementation evidence reference. Required for
   * `implemented` / `operator_assisted`; recommended otherwise.
   *
   * Examples:
   *   "apps/web/app/api/resolve-npi/route.ts"
   *   "GET /.well-known/did.json"
   *   "packages/core/src/services/ledger/HashChainService.ts"
   */
  evidence?: string;
  /** Optional plain-English summary rendered alongside the chip. */
  caption?: string;
}

export interface OperationalClaim {
  readonly capability: string;
  readonly status: OperationalStatus;
  readonly evidence: string | null;
  readonly hasEvidence: boolean;
  readonly displayStatus: string;
  readonly caption: string | null;
  /**
   * True when the claim carries the required evidence per the
   * canonical operational-status doctrine. Surfaces in this state
   * MUST surface a "missing evidence" affordance in dev builds
   * (handled by `auditEvidenceCoverage`).
   */
  readonly evidenceRequired: boolean;
}

const STATUSES_REQUIRING_EVIDENCE: ReadonlySet<OperationalStatus> = new Set([
  'implemented',
  'operator_assisted',
]);

export function assertOperationalClaimEvidence(
  input: OperationalClaimInput,
): OperationalClaim {
  const required = STATUSES_REQUIRING_EVIDENCE.has(input.status);
  const evidence = input.evidence?.trim() || null;
  const displayStatus = OPERATIONAL_STATUS_DESCRIPTORS[input.status].status;
  return {
    capability: input.capability,
    status: input.status,
    evidence,
    hasEvidence: evidence !== null,
    displayStatus,
    caption: input.caption ?? null,
    evidenceRequired: required,
  };
}

/**
 * Audits a batch of claims and returns the ones that fail the
 * evidence contract (status requires evidence; none was supplied).
 *
 * Intended for CI tests that read a fixture / registry of claims
 * and assert that the failing-claim list is empty.
 */
export function auditEvidenceCoverage(
  claims: readonly OperationalClaim[],
): readonly OperationalClaim[] {
  return claims.filter((c) => c.evidenceRequired && !c.hasEvidence);
}

/**
 * Convenience builder for a typed registry of claims. Surfaces that
 * want to enumerate their operational claims for the truth-audit can
 * call this once per claim and ship the resulting array.
 */
export function defineOperationalClaim(
  input: OperationalClaimInput,
): OperationalClaim {
  return assertOperationalClaimEvidence(input);
}
