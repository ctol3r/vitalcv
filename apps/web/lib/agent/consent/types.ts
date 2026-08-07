/**
 * Agent consent domain — A1.
 *
 * Consent is an explicit, recorded, revocable event — never a boolean flag,
 * never assumed, never inferred from context (mirrors the startState
 * doctrine: an explicit authorized event, never inferred). The ledger is
 * append-only grant/revoke events; current state is a fold over the latest
 * event per (subject, scope).
 *
 * A `ConsentProof` is the ONLY object the tool registry accepts for Level 3
 * execution. It is minted exclusively by the consent store's `verifyConsent`,
 * which re-reads the ledger AT EXECUTION TIME — a proof is evidence that the
 * ledger said yes moments ago, not a transferable capability. Proofs are
 * never accepted from clients.
 */

export const CONSENT_EVENT_KINDS = ['granted', 'revoked'] as const;
export type ConsentEventKind = (typeof CONSENT_EVENT_KINDS)[number];

export interface AgentConsentState {
  scope: string;
  /** Fold of the latest ledger event for this (subject, scope). */
  granted: boolean;
  /** Ledger row id of the governing event. */
  eventRef: string;
  at: string;
}

export interface ConsentProof {
  /** Ledger row id of the governing GRANT event. */
  consentId: string;
  subjectRef: string;
  scope: string;
  grantedAt: string;
  /** When the executor re-read the ledger to mint this proof. */
  verifiedAt: string;
}

export function isConsentProofShape(value: unknown): value is ConsentProof {
  if (typeof value !== 'object' || value === null) return false;
  const proof = value as Record<string, unknown>;
  return (
    typeof proof.consentId === 'string' &&
    typeof proof.subjectRef === 'string' &&
    typeof proof.scope === 'string' &&
    typeof proof.grantedAt === 'string' &&
    typeof proof.verifiedAt === 'string'
  );
}
