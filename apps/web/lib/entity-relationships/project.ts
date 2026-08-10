/**
 * Bidirectional relationship projection (G4).
 *
 * Splits a real evidence-graph projection (@vitalcv/domain-evidence
 * projectEvidenceToGraph — the same one /api/organizations already uses) into
 * the two directions the directive requires for any node:
 *
 *   outgoing  — what this node connects TO   (edges where from === node)
 *   backlinks — what connects to this node   (edges where to   === node)
 *
 * Each relationship carries a human-readable, direction-aware label and the
 * other node (with its evidence state), so the drawer shows "California license
 * — Access required", not a bare id. The same canonical edge powers both views;
 * there is no separate manual backlink store. Nothing here invents an edge — a
 * node with no relationships simply returns empty lists.
 */

import type { GraphProjection, GraphRelationshipType } from '@vitalcv/domain-evidence';

export type RelationshipDirection = 'outgoing' | 'backlink';

export interface RelatedNodeView {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  /** Evidence/coverage state where the node has one (checked/gated/stale/…). */
  readonly state?: string;
}

export interface RelationshipView {
  readonly id: string;
  readonly direction: RelationshipDirection;
  readonly type: GraphRelationshipType;
  /** Direction-aware human phrasing, e.g. "Trained at" vs "Trained". */
  readonly label: string;
  readonly node: RelatedNodeView;
  /** Backing evidence id, when the edge is evidence-derived. */
  readonly evidenceId: string | null;
}

export interface EntityRelationships {
  readonly focusId: string;
  readonly outgoing: readonly RelationshipView[];
  readonly backlinks: readonly RelationshipView[];
}

/** Direction-aware phrasing for each relationship type. */
const LABELS: Record<GraphRelationshipType, { out: string; in: string }> = {
  HAS_IDENTITY: { out: 'Has identity', in: 'Identity of' },
  HOLDS_LICENSE: { out: 'Holds license', in: 'Licensed to' },
  HOLDS_CERTIFICATION: { out: 'Holds certification', in: 'Certifies' },
  HOLDS_REGISTRATION: { out: 'Holds registration', in: 'Registers' },
  SCREENED_FOR_EXCLUSION: { out: 'Screened for exclusion', in: 'Exclusion screen of' },
  ENROLLED_IN: { out: 'Enrolled in', in: 'Enrolls' },
  PRIVILEGED_AT: { out: 'Privileged at', in: 'Privileges' },
  REVIEWED_BY: { out: 'Reviewed by', in: 'Reviewed' },
  RECOGNIZED_BY: { out: 'Recognized by', in: 'Recognized' },
  ACCEPTED_BY: { out: 'Accepted by', in: 'Accepted' },
  STARTED_AT: { out: 'Started at', in: 'Start of' },
  EMPLOYED_BY: { out: 'Employed by', in: 'Employs' },
  AUTHORED: { out: 'Authored', in: 'Authored by' },
  TRAINED_AT: { out: 'Trained at', in: 'Trained' },
  VERIFIED_BY: { out: 'Verified by', in: 'Verifies' },
  CERTIFIED_BY: { out: 'Certified by', in: 'Certified' },
};

function labelFor(type: GraphRelationshipType, direction: RelationshipDirection): string {
  const pair = LABELS[type];
  return direction === 'outgoing' ? pair.out : pair.in;
}

/**
 * Project the relationships of one focus node. If focusId is omitted, the
 * subject node is used (the clinician — the natural home of the evidence graph).
 */
export function projectEntityRelationships(
  graph: GraphProjection,
  focusId?: string,
): EntityRelationships {
  const focus = focusId ?? graph.nodes.find((n) => n.type === 'subject')?.id ?? graph.subjectKey;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));

  const view = (relOtherId: string, rel: GraphProjection['relationships'][number], direction: RelationshipDirection): RelationshipView => {
    const other = byId.get(relOtherId);
    return {
      id: rel.id,
      direction,
      type: rel.type,
      label: labelFor(rel.type, direction),
      node: {
        id: relOtherId,
        type: other?.type ?? 'unknown',
        label: other?.label ?? relOtherId,
        state: other?.status ?? undefined,
      },
      evidenceId: rel.evidenceId,
    };
  };

  const outgoing: RelationshipView[] = [];
  const backlinks: RelationshipView[] = [];
  for (const rel of graph.relationships) {
    if (rel.from === focus) outgoing.push(view(rel.to, rel, 'outgoing'));
    if (rel.to === focus) backlinks.push(view(rel.from, rel, 'backlink'));
  }

  return { focusId: focus, outgoing, backlinks };
}
