/**
 * Provider Employment Graph Contracts
 *
 * MULTI-SOURCE EVIDENCE MODEL (not the canonical DID-signed path).
 *
 * This file models the "evidence graph" — a transparent, append-only
 * record of employment claims from multiple sources.
 *
 * This is DELIBERATELY SEPARATE from `employmentContracts.ts`, which
 * defines the cryptographically-signed Recognition → Acceptance → Start
 * canonical path required by NCQA CR1 / CMS CoP compliance. Do not merge
 * or cross-import these files — they model different concerns:
 *
 *   employmentContracts.ts  → compliance anchor (proven employment)
 *   providerEmploymentContracts.ts → evidence graph (everything we heard)
 *
 * Design principles (from project spec):
 * - Sources are enumerated. Adding one requires code change + tests.
 * - Confidence is a LABEL, never averaged. Composition is deterministic.
 * - Conflicts are NEVER hidden. `flagged` surfaces them to the UI.
 * - Multiple active employers are allowed (locum tenens reality).
 * - The graph is a PURE PROJECTION of raw claim rows — rebuildable.
 */

/**
 * Closed set of sources an employment claim can originate from.
 *
 * Rationale for the closed set: source precedence is compliance-adjacent
 * (verified_source outranks user_input which outranks resume_parse).
 * Allowing arbitrary strings here would silently degrade that precedence.
 */
export const EMPLOYMENT_CLAIM_SOURCES = [
  'resume_parse',
  'user_input',
  'verified_source',
] as const;

export type EmploymentClaimSource = (typeof EMPLOYMENT_CLAIM_SOURCES)[number];

/**
 * Confidence labels are ordinal, not numeric. We never average.
 * See composeConfidence() for the decision rules.
 */
export const EMPLOYMENT_CLAIM_CONFIDENCE_VALUES = [
  'low',
  'medium',
  'high',
] as const;

export type EmploymentClaimConfidence =
  (typeof EMPLOYMENT_CLAIM_CONFIDENCE_VALUES)[number];

/**
 * Agreement reflects whether grouped claims carry a consistent signal.
 *
 * - 'single'   → one distinct source, no internal contradiction
 * - 'agree'    → multiple distinct sources, consistent signal
 * - 'conflict' → any internal contradiction (dates, roles, active/ended)
 */
export type EmploymentClaimAgreement = 'single' | 'agree' | 'conflict';

/**
 * A single raw employment claim, as recorded from a source.
 *
 * Claims are append-only. Multiple claims for the same provider/employer
 * may coexist (one per source, one per ingest event). The graph dedupes
 * on read — the claim store remains the full evidence log.
 */
export interface EmploymentClaim {
  /** Stable identifier assigned at ingest */
  claimId: string;

  /** FK to Provider.id */
  providerId: string;

  /** Employer display name as seen by the source */
  employer: string;

  /** Optional stable employer ID when resolvable (e.g. organizational NPI) */
  employerId?: string;

  /** Role/title, if known */
  role?: string;

  /** ISO 8601 date (YYYY-MM-DD). Day-precision may be approximate. */
  startDate: string;

  /** ISO 8601 date, or null if still active */
  endDate: string | null;

  /** Where this claim came from */
  source: EmploymentClaimSource;

  /**
   * Confidence the SOURCE has in this specific claim.
   *
   * NOTE: Not used by composeConfidence() in v1. Reserved for per-claim
   * signal from downstream parsers (e.g. a resume parser reporting its
   * extraction confidence). composeConfidence() v1 uses source TYPE only.
   */
  sourceConfidence: EmploymentClaimConfidence;

  /** ISO 8601 timestamp when we recorded the claim */
  observedAt: string;

  /** Optional pointer to the raw artifact (resume file key, API response) */
  evidenceRef?: string;
}

/**
 * A node in the rendered employment graph.
 *
 * One node per (provider, canonical employer key) group. Carries ALL
 * underlying claims as provenance — the graph is transparent, not
 * inferred. The UI can render any node's full evidence chain.
 */
export interface EmploymentGraphNode {
  providerId: string;
  employer: string;
  employerId?: string;

  /** Earliest startDate across grouped claims */
  startDate: string;

  /**
   * Latest endDate across grouped claims, OR null if ANY claim is active.
   * Rationale: preferring "still active" preserves the more recent signal;
   * the conflict (if any) is still surfaced via `flagged`.
   */
  endDate: string | null;

  /** Mode role across grouped claims, or undefined if none present */
  role?: string;

  /** Composed confidence label (see composeConfidence) */
  composedConfidence: EmploymentClaimConfidence;

  /** Agreement label (see composeConfidence) */
  agreement: EmploymentClaimAgreement;

  /** All underlying claims — full provenance, never hidden */
  claims: ReadonlyArray<EmploymentClaim>;

  /** True iff agreement === 'conflict'. Conflicts are NEVER hidden. */
  flagged: boolean;
}

export interface EmploymentGraph {
  providerId: string;

  /** All employment nodes, sorted by startDate DESC */
  nodes: ReadonlyArray<EmploymentGraphNode>;

  /**
   * Subset of nodes where endDate === null. Multiple active employers
   * are allowed (locum tenens reality). Sorted by startDate DESC.
   */
  currentEmployers: ReadonlyArray<EmploymentGraphNode>;
}
