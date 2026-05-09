/**
 * Credential Lifecycle types — W2-PR44A
 *
 * Authoritative shapes for the artifact lifecycle graph: events, nodes,
 * lineage indices, replay frames, and integrity reports.
 *
 * Design constraints (do not weaken):
 *   - Events are append-only. Once recorded, an event MUST NOT be mutated;
 *     corrections are issued as new events that reference the prior eventId.
 *   - Lineage edges are one-directional: predecessor -> successor. A node
 *     can have multiple predecessors (consolidation) and multiple successors
 *     (split), but the edges themselves are deterministic.
 *   - Renewal preserves ambiguity: a renewal MAY be a continuation of the
 *     prior artifact, OR a fresh issue, OR both. The lifecycle MUST record
 *     both interpretations; collapsing to a single answer is not permitted
 *     at this layer.
 */

import { CredentialLifecycleState } from '../../utils/lifecycleState';

export type LifecycleEventType =
  | 'issued'
  | 'activated'
  | 'expired'
  | 'renewed'
  | 'superseded'
  | 'revoked'
  | 'suspended'
  | 'reinstated'
  | 'archived';

export interface LifecycleEvent {
  eventId: string;
  artifactId: string;
  eventType: LifecycleEventType;
  occurredAt: string; // ISO-8601, when the lifecycle change took effect in the world
  recordedAt: string; // ISO-8601, when this system observed it
  cause: string | null; // free-text explanation, may be null
  predecessorArtifactId: string | null; // for renewed/superseded
  successorArtifactId: string | null; // for renewed/superseded (forward pointer)
  correctsEventId: string | null; // append-only correction pointer
  metadata: Record<string, unknown>;
  eventHash: string; // sha256 over canonical event payload — tamper signal
}

export interface LifecycleNode {
  artifactId: string;
  artifactType: string;
  organizationId: string | null;
  state: CredentialLifecycleState | 'archived';
  issuedAt: string | null;
  expiresAt: string | null;
  archivedAt: string | null;
  events: LifecycleEvent[]; // chronological
  predecessorIds: string[]; // upstream artifacts this one continues from
  successorIds: string[]; // downstream artifacts that continue this one
}

/**
 * RenewalInterpretation encodes the irreducible ambiguity of a renewal event:
 * the same on-the-wire renewal can be a strict continuation, a fresh issue
 * with reused identity, or both. We never collapse this — downstream
 * consumers must inspect both branches.
 */
export interface RenewalInterpretation {
  renewalEventId: string;
  asContinuation: {
    plausible: boolean;
    confidence: number; // 0..1
    rationale: string;
  };
  asFreshIssue: {
    plausible: boolean;
    confidence: number; // 0..1
    rationale: string;
  };
  ambiguityPreserved: true; // literal — required invariant
}

export interface SupersessionLink {
  fromArtifactId: string; // predecessor
  toArtifactId: string; // successor
  linkType: 'renewal' | 'replacement' | 'correction' | 'consolidation' | 'split';
  establishedAt: string; // ISO-8601
  establishedByEventId: string;
  deterministicKey: string; // stable hash for replay
}

export interface LifecycleGraph {
  organizationId: string | null;
  builtAt: string; // ISO-8601
  nodes: Map<string, LifecycleNode>;
  supersessionEdges: SupersessionLink[];
  // Indices, derived deterministically from nodes/edges
  predecessorsByArtifact: Map<string, string[]>;
  successorsByArtifact: Map<string, string[]>;
}

export interface ExpirationDriftReport {
  artifactId: string;
  forecastedExpiresAt: string | null;
  observedExpiresAt: string | null;
  driftDays: number | null; // positive = observed later than forecast
  driftDirection: 'earlier' | 'on_time' | 'later' | 'unknown';
  operatorVisible: true; // literal — drift must always surface to operators
}

export interface ContinuityInvariantReport {
  artifactId: string;
  invariantsChecked: string[];
  invariantsViolated: string[]; // empty array = clean
  continuityPreserved: boolean;
}

export interface LifecycleIntegrityReport {
  organizationId: string | null;
  generatedAt: string;
  artifactCount: number;
  eventCount: number;
  supersessionEdgeCount: number;
  invariantsViolated: Array<{
    artifactId: string;
    invariant: string;
    detail: string;
  }>;
  hashMismatches: Array<{
    artifactId: string;
    eventId: string;
    storedHash: string;
    recomputedHash: string;
  }>;
  ambiguousRenewalsFlattened: string[]; // event IDs where ambiguity was incorrectly collapsed
  archivalLineageBroken: string[]; // artifact IDs whose archival lineage cannot be reconstructed
  passed: boolean;
}

export interface LifecycleReplayFrame {
  artifactId: string;
  asOf: string; // ISO-8601
  state: CredentialLifecycleState | 'archived';
  effectiveExpiresAt: string | null;
  predecessorIds: string[];
  successorIds: string[];
  eventsObservedAtFrame: string[]; // eventIds in order
  hash: string; // canonical hash of the frame
}
