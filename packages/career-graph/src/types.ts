/**
 * Provider Career Graph — canonical typed contract (G1).
 *
 * This package is a *description* of truth the system already holds. It owns no
 * storage and no second source of truth: every node and edge here is projected
 * from canonical PostgreSQL records, or it is declared a gap in `gaps.ts` and
 * does not appear in the graph at all.
 *
 * Not to be confused with `core/graph` (re-exported by the unused
 * `@vitalcv/graph-core` facade), which is an intelligence/analytics graph —
 * pageRank, betweenness, community detection over provider intelligence. That
 * is a different concern and is deliberately left alone.
 */

/**
 * The target ontology. Every entity the product treats as an addressable
 * page-node has a name here, including entities that nothing persists yet —
 * those are registered in `NODE_GAPS` so the absence stays visible instead of
 * being quietly forgotten.
 */
export type CareerGraphNodeType =
  | 'clinician'
  | 'wallet'
  | 'identity'
  | 'npi'
  | 'evidence_claim'
  | 'source_receipt'
  | 'credential'
  | 'license'
  | 'specialty'
  | 'preference'
  | 'organization'
  | 'facility'
  | 'opportunity'
  | 'requirement'
  | 'recommendation'
  | 'application'
  | 'application_packet'
  | 'consent_receipt'
  | 'clarification'
  | 'decision'
  | 'decision_capsule'
  | 'recognition'
  | 'start_attestation'
  | 'source'
  | 'methodology';

export type CareerGraphEdgeType =
  | 'owns'
  | 'has_identity'
  | 'holds'
  | 'backed_by'
  | 'observed_by'
  | 'supersedes'
  | 'revokes'
  | 'states_preference'
  | 'offered_by'
  | 'located_at'
  | 'requires'
  | 'satisfies'
  | 'partially_satisfies'
  | 'matched_to'
  | 'explained_by'
  | 'interested_in'
  | 'passed_on'
  | 'applied_to'
  | 'targets_version'
  | 'presented_in'
  | 'consented_to'
  | 'reviewed_by'
  | 'requested_clarification'
  | 'decided_by'
  | 'accepted_as_head_start'
  | 'produced_recognition'
  | 'recognized_by'
  | 'started_at';

/**
 * Where a projected node/edge came from. The graph must always be able to
 * answer "which record says so" — this is that answer, not decoration.
 */
export interface GraphProvenance {
  /** Canonical Prisma model the record was read from, e.g. 'ClaimRecord'. */
  readonly model: string;
  /** Primary key of that row. */
  readonly recordId: string;
  /**
   * True when the relationship is enforced by a database foreign key. False
   * means it is a by-convention string join that can dangle — the UI must not
   * present a `false` edge with the same confidence as a `true` one.
   */
  readonly foreignKeyBacked: boolean;
}

export interface CareerGraphNode {
  readonly id: string;
  readonly type: CareerGraphNodeType;
  readonly label: string;
  /**
   * Evidence/lifecycle state where the underlying record has one (e.g. a claim's
   * checked / gated / stale / unknown, or revoked). Never invent a state: absent
   * means the record does not carry one.
   */
  readonly state?: string;
  readonly observedAt?: string;
  readonly provenance: GraphProvenance;
}

export interface CareerGraphEdge {
  readonly id: string;
  readonly type: CareerGraphEdgeType;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly sourceVersion?: string;
  readonly targetVersion?: string;
  readonly state?: string;
  readonly observedAt?: string;
  readonly createdAt: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly revokedAt?: string;
  readonly methodologyVersion?: string;
  readonly provenance: GraphProvenance;
}

export interface CareerSubgraphResponse {
  readonly focus: CareerGraphNode;
  readonly nodes: readonly CareerGraphNode[];
  readonly edges: readonly CareerGraphEdge[];
  readonly truncated: boolean;
  readonly nextExpansion?: string;
  readonly methodologyVersion: string;
}
