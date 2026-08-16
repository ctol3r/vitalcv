/**
 * Minimum Friction — Disclosure Admission Gate (MF-WAVE-01).
 *
 * The deterministic share-rule from
 * docs/minimum-friction/MINIMUM_FRICTION_USER_JOURNEY.md §4 as pure
 * predicates: preflight computes the minimum evidence set for a resolved
 * recipient + purpose, but reveals nothing; a share requires an explicit,
 * recipient-and-purpose-exact authorization.
 *
 * Invariants (map onto the benchmark zero-invariants):
 * - A preview NEVER emits — `DisclosurePreview.shared` is the literal `false`.
 * - Consent is per-recipient, per-purpose. A consent granted for one recipient
 *   or purpose never authorizes another (CROSS_RECIPIENT_CONSENT_REUSE = 0).
 * - A requirement with no supporting evidence stays UNKNOWN — it is never
 *   defaulted to SATISFIED (UNKNOWN_TO_SATISFIED = 0). Not found is a
 *   finding, not missing evidence.
 * - SATISFIED never means accepted. Requirement satisfaction here records only
 *   that fixture evidence met a fixture dependency edge; it does not record,
 *   imply, or accelerate an employer decision.
 *
 * The `satisfies` dependency edge is FIXTURED — supplied as input data, never
 * computed here. The real compiled dependency index is owned by the PTC
 * compiler (a later wave); this module only consumes dependency facts.
 *
 * PURE TRANSFORMS ONLY. No fetch, no DB, no clock, no randomness, no emission.
 */

// ---------------------------------------------------------------------------
// Fixtured dependency facts
// ---------------------------------------------------------------------------

/**
 * A fixtured `satisfies` edge: the exact evidence set that satisfies one
 * requirement. Stand-in for the compiled dependency index (NEW-PTC); this
 * module never asserts satisfaction beyond what an edge states.
 */
export interface SatisfiesEdge {
  readonly requirementId: string;
  readonly evidenceIds: readonly string[];
}

export type RequirementSatisfaction = 'SATISFIED' | 'UNKNOWN';

/**
 * Derives requirement satisfaction from fixtured edges. A requirement is
 * SATISFIED only when an edge names at least one supporting evidence object;
 * anything else stays UNKNOWN. Unknown is a finding — never an invitation to
 * default.
 */
export function deriveRequirementSatisfaction(
  requirementIds: readonly string[],
  edges: readonly SatisfiesEdge[],
): Record<string, RequirementSatisfaction> {
  const byRequirement = new Map(edges.map((e) => [e.requirementId, e]));
  const out: Record<string, RequirementSatisfaction> = {};
  for (const requirementId of requirementIds) {
    const edge = byRequirement.get(requirementId);
    out[requirementId] =
      edge !== undefined && edge.evidenceIds.length > 0 ? 'SATISFIED' : 'UNKNOWN';
  }
  return out;
}

/**
 * UNKNOWN_TO_SATISFIED counter: requirements marked SATISFIED that no edge
 * actually supports. Demo-0 asserts this is exactly 0 — a satisfaction map is
 * only as honest as the evidence behind it.
 */
export function countUnknownToSatisfied(
  satisfaction: Readonly<Record<string, RequirementSatisfaction>>,
  edges: readonly SatisfiesEdge[],
): number {
  const supported = new Set(
    edges.filter((e) => e.evidenceIds.length > 0).map((e) => e.requirementId),
  );
  return Object.entries(satisfaction).filter(
    ([requirementId, state]) => state === 'SATISFIED' && !supported.has(requirementId),
  ).length;
}

// ---------------------------------------------------------------------------
// Minimum evidence set + preview (computed, never emitted)
// ---------------------------------------------------------------------------

export interface MinimumEvidenceSet {
  /** Sorted, deduplicated evidence ids — requirement-relevant only. */
  readonly evidenceIds: readonly string[];
  /** Requirements no edge supports. They stay unknown; nothing is invented. */
  readonly unsatisfiedRequirementIds: readonly string[];
}

/**
 * The minimum evidence set for a requirement list: exactly the union of the
 * fixtured edge sets for those requirements — nothing more. Evidence that no
 * requested requirement names is never included, however available it is.
 */
export function computeMinimumEvidenceSet(
  requirementIds: readonly string[],
  edges: readonly SatisfiesEdge[],
): MinimumEvidenceSet {
  const byRequirement = new Map(edges.map((e) => [e.requirementId, e]));
  const evidenceIds = new Set<string>();
  const unsatisfied: string[] = [];
  for (const requirementId of requirementIds) {
    const edge = byRequirement.get(requirementId);
    if (edge === undefined || edge.evidenceIds.length === 0) {
      unsatisfied.push(requirementId);
      continue;
    }
    for (const evidenceId of edge.evidenceIds) evidenceIds.add(evidenceId);
  }
  return {
    evidenceIds: [...evidenceIds].sort(),
    unsatisfiedRequirementIds: [...unsatisfied].sort(),
  };
}

/** A disclosure request: recipient + purpose + the requirements it must cover. */
export interface DisclosureRequest {
  readonly recipientKey: string;
  readonly purpose: string;
  readonly requirementIds: readonly string[];
}

/** A computed preview. `shared` is the literal `false`: previews never emit. */
export interface DisclosurePreview {
  readonly recipientKey: string;
  readonly purpose: string;
  readonly evidenceIds: readonly string[];
  readonly unsatisfiedRequirementIds: readonly string[];
  readonly shared: false;
}

/**
 * Computes what WOULD be disclosed for this recipient + purpose. Emits
 * nothing, authorizes nothing, requires no consent — because it reveals
 * nothing. The clinician sees the exact set before any authorize step.
 */
export function previewDisclosure(
  request: DisclosureRequest,
  edges: readonly SatisfiesEdge[],
): DisclosurePreview {
  const minimum = computeMinimumEvidenceSet(request.requirementIds, edges);
  return {
    recipientKey: request.recipientKey,
    purpose: request.purpose,
    evidenceIds: minimum.evidenceIds,
    unsatisfiedRequirementIds: minimum.unsatisfiedRequirementIds,
    shared: false,
  };
}

// ---------------------------------------------------------------------------
// The share gate
// ---------------------------------------------------------------------------

/** An explicit authorization by the record owner, bound to recipient + purpose. */
export interface ConsentRecord {
  readonly consentId: string;
  readonly recipientKey: string;
  readonly purpose: string;
  /** True only after the explicit authorize step actually happened. */
  readonly granted: boolean;
}

export type DisclosureRefusalReason =
  | 'no_consent'
  | 'consent_not_granted'
  | 'recipient_mismatch'
  | 'purpose_mismatch';

export type DisclosureAdmissionDecision =
  | {
      readonly authorized: true;
      readonly recipientKey: string;
      readonly purpose: string;
      readonly evidenceIds: readonly string[];
    }
  | {
      readonly authorized: false;
      readonly reason: DisclosureRefusalReason;
    };

/**
 * The deterministic share-rule. Fails closed: no consent, an ungranted
 * consent, a consent for a different recipient, or a consent for a different
 * purpose each refuse the disclosure. A recipient mismatch is exactly the
 * CROSS_RECIPIENT_CONSENT_REUSE hazard — consent is never reused across
 * recipients.
 */
export function admitDisclosure(
  request: DisclosureRequest,
  consent: ConsentRecord | null,
  edges: readonly SatisfiesEdge[],
): DisclosureAdmissionDecision {
  if (consent === null) return { authorized: false, reason: 'no_consent' };
  if (!consent.granted) return { authorized: false, reason: 'consent_not_granted' };
  if (consent.recipientKey !== request.recipientKey) {
    return { authorized: false, reason: 'recipient_mismatch' };
  }
  if (consent.purpose !== request.purpose) {
    return { authorized: false, reason: 'purpose_mismatch' };
  }
  const minimum = computeMinimumEvidenceSet(request.requirementIds, edges);
  return {
    authorized: true,
    recipientKey: request.recipientKey,
    purpose: request.purpose,
    evidenceIds: minimum.evidenceIds,
  };
}

// ---------------------------------------------------------------------------
// Disclosure ledger + zero-invariant counters
// ---------------------------------------------------------------------------

/**
 * One emission that actually happened (Demo-0's ledger stays empty on the
 * preview path — computing is not emitting).
 */
export interface DisclosureLedgerEntry {
  readonly recipientKey: string;
  readonly evidenceIds: readonly string[];
  /** The gate decision the emission ran under, or null when it bypassed the gate. */
  readonly decision: DisclosureAdmissionDecision | null;
  /** The recipient named on the consent the emission relied on, if any. */
  readonly consentRecipientKey: string | null;
}

/**
 * UNAUTHORIZED_DISCLOSURE counter: emissions with no authorizing decision, or
 * whose decision did not authorize, or that disclosed to a different recipient
 * than the decision authorized.
 */
export function countUnauthorizedDisclosures(
  ledger: readonly DisclosureLedgerEntry[],
): number {
  return ledger.filter((entry) => {
    if (entry.decision === null || !entry.decision.authorized) return true;
    return entry.decision.recipientKey !== entry.recipientKey;
  }).length;
}

/**
 * CROSS_RECIPIENT_CONSENT_REUSE counter: emissions that relied on a consent
 * naming a different recipient than the one disclosed to.
 */
export function countCrossRecipientConsentReuse(
  ledger: readonly DisclosureLedgerEntry[],
): number {
  return ledger.filter(
    (entry) =>
      entry.consentRecipientKey !== null &&
      entry.consentRecipientKey !== entry.recipientKey,
  ).length;
}
