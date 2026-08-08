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

/**
 * A2.5 — two kinds of consent, with different lifetimes and different
 * powers.
 *
 * `point` is A1's behaviour and stays the default: approval for an action to
 * run NOW, with the clinician present. A proof may only be minted inside a
 * short freshness window, after which the grant lapses FOR EXECUTION and the
 * clinician is asked again. This closes a real A1 hole — an unexecuted grant
 * stayed executable forever.
 *
 * `standing` is the separately-worded "keep doing this for me". It is the
 * only thing that authorises a background run to act, and it is available
 * ONLY for non-disclosing scopes (doctrine D1: the agent may do work in the
 * background but may not disclose in the background).
 */
export const CONSENT_KINDS = ['point', 'standing'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

/**
 * How long an unexecuted point consent stays usable.
 *
 * 30 minutes rather than something tighter: point consent is never the only
 * control — the clinician is present, the executor regenerates the plan, and
 * a consent whose action no longer exists already fails before the window is
 * consulted. Against that modest residual sits consent fatigue, which
 * degrades the very signal the design depends on.
 */
export const POINT_CONSENT_WINDOW_MINUTES = 30;

/** Maximum and default lifetime of a standing grant. */
export const STANDING_CONSENT_MAX_DAYS = 90;

/**
 * Scopes that may ever be held as STANDING consent.
 *
 * Non-disclosing only, and enforced as an allowlist rather than a denylist:
 * a new scope is non-standing until someone deliberately adds it here, which
 * is the safe direction for a list whose failure mode is "the agent shared
 * something in the background".
 */
export const STANDING_ELIGIBLE_SCOPE_PREFIXES = ['background_refresh:'] as const;

export function isStandingEligibleScope(scope: string): boolean {
  return STANDING_ELIGIBLE_SCOPE_PREFIXES.some((prefix) => scope.startsWith(prefix));
}

export interface AgentConsentState {
  scope: string;
  /** State of the highest-`seq` ledger event for this (subject, scope). */
  granted: boolean;
  /**
   * Ledger row id of the governing event. This is the server-issued handle
   * a client passes back to revoke — clients never author scope strings.
   */
  eventRef: string;
  /** Serialized position of the governing event (see consent-store). */
  seq: number;
  at: string;
}

export interface ConsentProof {
  /** Ledger row id of the governing GRANT event. */
  consentId: string;
  subjectRef: string;
  scope: string;
  kind: ConsentKind;
  grantedAt: string;
  /** Present on standing proofs. */
  expiresAt?: string;
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
    (proof.kind === 'point' || proof.kind === 'standing') &&
    typeof proof.grantedAt === 'string' &&
    typeof proof.verifiedAt === 'string'
  );
}
