/**
 * FOUNDATION-SWEEP-7 — verifier reuse decision foundation.
 *
 * Reuse is modeled as an internal assessment aid only. Cross-tenant reuse and
 * automatic reuse are not implemented by this module.
 */

export type ReuseDecisionBasis =
  | 'prior_psv_receipt'
  | 'prior_assessment'
  | 'self_attested_only';

export interface ReuseDecision {
  basis: ReuseDecisionBasis;
  assessedAt: string;
  issuingOrgId: string;
  expiresAt: string;
  note: string;
}

export interface ReuseDecisionFoundation {
  provisionLive: false;
  crossTenantReuseImplemented: false;
  automaticReuseEnabled: false;
  basisOptions: ReuseDecisionBasis[];
  disclaimers: string[];
}

export function buildReuseDecisionFoundation(): ReuseDecisionFoundation {
  return {
    provisionLive: false,
    crossTenantReuseImplemented: false,
    automaticReuseEnabled: false,
    basisOptions: [
      'prior_psv_receipt',
      'prior_assessment',
      'self_attested_only',
    ],
    disclaimers: [
      'Reuse decisions are foundation records only; cross-tenant reuse is not implemented.',
      'Automatic reuse is not enabled and source material still requires employer assessment.',
    ],
  };
}

export function explainReuseBasis(basis: ReuseDecisionBasis): string {
  switch (basis) {
    case 'prior_psv_receipt':
      return 'Based on a prior PSV receipt and previously assessed source material within the issuing organization context.';
    case 'prior_assessment':
      return 'Based on a previously assessed internal review record from the issuing organization context.';
    case 'self_attested_only':
      return 'Based only on self-attested input; no source-backed reuse basis is present.';
  }
}

export function getReuseWarning(basis: ReuseDecisionBasis): string | null {
  if (basis !== 'self_attested_only') return null;
  return 'Self-attested input needs source review before it can support an internal start assessment.';
}
