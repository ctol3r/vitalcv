/**
 * Evidence -> Graph projector (Wave 221).
 *
 * Pure transform: EvidenceCollection -> GraphProjection. No side effects, no
 * persistence, no graph database. Trust is bounded by evidence status — a gated
 * or non-decision-grade object can never project a positive trustScore or a
 * decision-grade node (no trust inflation, no false decision-grade).
 *
 * See docs/wave220/C2-node-architecture-plan.md and C3-relationship-architecture.md.
 */

import type { EvidenceClass, EvidenceCollection, EvidenceLifecycle, EvidenceStatus } from '../types';
import { isDecisionGradeStatus } from '../collection';

// ── C2: Node model ───────────────────────────────────────────────────────────

export type GraphNodeType = 'subject' | 'evidence' | 'source';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** 0..1, derived monotonically from status. null for non-evidence nodes. */
  trustScore: number | null;
  /** sourceId backing this node (evidence nodes), else null. */
  evidenceSource: string | null;
  /** Coverage status for evidence nodes, else null. */
  status: EvidenceStatus | null;
  /** Present only for evidence nodes. */
  evidenceClass: EvidenceClass | null;
  /** Mirrors the evidence object; false for subject/source nodes. */
  decisionGrade: boolean;
  /** Temporal fields carried for trust history (evidence nodes only). */
  checkedAt: string | null;
  expiresAt: string | null;
  lifecycle: EvidenceLifecycle | null;
}

// ── C3: Relationship model ───────────────────────────────────────────────────

export const GRAPH_RELATIONSHIP_TYPES = [
  'HAS_IDENTITY',
  'HOLDS_LICENSE',
  'HOLDS_CERTIFICATION',
  'HOLDS_REGISTRATION',
  'SCREENED_FOR_EXCLUSION',
  'ENROLLED_IN',
  'PRIVILEGED_AT',
  'REVIEWED_BY',
  'RECOGNIZED_BY',
  'ACCEPTED_BY',
  'STARTED_AT',
  'EMPLOYED_BY',
  'AUTHORED',
  'TRAINED_AT',
  'VERIFIED_BY',
  'CERTIFIED_BY',
] as const;

export type GraphRelationshipType = (typeof GRAPH_RELATIONSHIP_TYPES)[number];

export interface GraphRelationship {
  id: string;
  from: string;
  to: string;
  type: GraphRelationshipType;
  /** Backing evidence object, when the edge is evidence-derived. */
  evidenceId: string | null;
}

export interface GraphProjection {
  subjectKey: string;
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  stats: { nodeCount: number; relationshipCount: number; decisionGradeNodeCount: number };
}

// ── Pure derivations ─────────────────────────────────────────────────────────

/**
 * Monotonic, non-inflating trust score. Only 'checked' is full trust; every
 * gated / non-decision-grade state is 0 (never contributes positive trust).
 */
export function statusTrustScore(status: EvidenceStatus): number {
  switch (status) {
    // Only decision-grade ('checked') evidence contributes positive trust.
    // Every non-decision-grade state — including stale/pending/reviewRequired —
    // is 0, so it can never raise a dimension or overall score (fail-closed).
    case 'checked':
      return 1;
    case 'stale':
    case 'pending':
    case 'reviewRequired':
    case 'gated':
    case 'accessRequired':
    case 'notDecisionGrade':
    case 'previewOnly':
    case 'unavailable':
      return 0;
    default:
      return 0;
  }
}

/** subject -> evidence relationship label, keyed on the evidence class. */
function subjectRelationshipFor(evidenceClass: EvidenceClass): GraphRelationshipType {
  switch (evidenceClass) {
    case 'identity':
      return 'HAS_IDENTITY';
    case 'licensure':
      return 'HOLDS_LICENSE';
    case 'board_cert':
      return 'HOLDS_CERTIFICATION';
    case 'registration':
      return 'HOLDS_REGISTRATION';
    case 'exclusion':
      return 'SCREENED_FOR_EXCLUSION';
    case 'enrollment':
      return 'ENROLLED_IN';
    case 'privilege':
      return 'PRIVILEGED_AT';
    case 'peer_review':
      return 'REVIEWED_BY';
    case 'recognition':
      return 'RECOGNIZED_BY';
    case 'acceptance':
      return 'ACCEPTED_BY';
    case 'start':
      return 'STARTED_AT';
    case 'employment':
      return 'EMPLOYED_BY';
    case 'research':
    case 'publication':
      return 'AUTHORED';
    case 'training':
      return 'TRAINED_AT';
    default:
      return 'HAS_IDENTITY';
  }
}

/** evidence -> source relationship label. */
function sourceRelationshipFor(evidenceClass: EvidenceClass): GraphRelationshipType {
  return evidenceClass === 'board_cert' ? 'CERTIFIED_BY' : 'VERIFIED_BY';
}

const subjectNodeId = (subjectKey: string) => `subject:${subjectKey}`;
const sourceNodeId = (sourceId: string) => `source:${sourceId}`;

/**
 * Project an EvidenceCollection into nodes + relationships. Nodes are deduped by
 * id (subject once; each source once) so no duplicate node is ever generated.
 * Every relationship references existing nodes (no orphans).
 */
export function projectEvidenceToGraph(collection: EvidenceCollection): GraphProjection {
  const nodes = new Map<string, GraphNode>();
  const relationships: GraphRelationship[] = [];

  // Subject anchor node.
  const subjectId = subjectNodeId(collection.subjectKey);
  nodes.set(subjectId, {
    id: subjectId,
    type: 'subject',
    label: collection.generatedFor.displayName || 'Clinician',
    trustScore: null,
    evidenceSource: null,
    status: null,
    evidenceClass: null,
    decisionGrade: false,
    checkedAt: null,
    expiresAt: null,
    lifecycle: null,
  });

  for (const obj of collection.objects) {
    // Evidence node (object ids are already unique per collection).
    const decisionGrade = isDecisionGradeStatus(obj.status);
    nodes.set(obj.evidenceId, {
      id: obj.evidenceId,
      type: 'evidence',
      label: obj.label,
      trustScore: statusTrustScore(obj.status),
      evidenceSource: obj.source.sourceId,
      status: obj.status,
      evidenceClass: obj.evidenceClass,
      decisionGrade,
      checkedAt: obj.checkedAt,
      expiresAt: obj.expiresAt,
      lifecycle: obj.lifecycle,
    });

    // Source node (deduped).
    const srcId = sourceNodeId(obj.source.sourceId);
    if (!nodes.has(srcId)) {
      nodes.set(srcId, {
        id: srcId,
        type: 'source',
        label: obj.source.sourceLabel || obj.source.sourceId,
        trustScore: null,
        evidenceSource: obj.source.sourceId,
        status: null,
        evidenceClass: null,
        decisionGrade: false,
        checkedAt: null,
        expiresAt: null,
        lifecycle: null,
      });
    }

    // subject -> evidence
    const subjRel = subjectRelationshipFor(obj.evidenceClass);
    relationships.push({
      id: `${subjRel}:${subjectId}->${obj.evidenceId}`,
      from: subjectId,
      to: obj.evidenceId,
      type: subjRel,
      evidenceId: obj.evidenceId,
    });

    // evidence -> source
    const srcRel = sourceRelationshipFor(obj.evidenceClass);
    relationships.push({
      id: `${srcRel}:${obj.evidenceId}->${srcId}`,
      from: obj.evidenceId,
      to: srcId,
      type: srcRel,
      evidenceId: obj.evidenceId,
    });
  }

  const nodeList = [...nodes.values()];
  return {
    subjectKey: collection.subjectKey,
    nodes: nodeList,
    relationships,
    stats: {
      nodeCount: nodeList.length,
      relationshipCount: relationships.length,
      decisionGradeNodeCount: nodeList.filter((n) => n.decisionGrade).length,
    },
  };
}
