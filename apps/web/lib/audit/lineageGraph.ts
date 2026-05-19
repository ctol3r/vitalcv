/**
 * Bi-directional lineage-graph resolver (WAVE C72).
 *
 * Pure function over a list of audit events. Given a focal event,
 * returns:
 *   - the focal event
 *   - upstream parents (DAG ancestors, traversed via parentEventIds)
 *   - downstream children (events that name this event as a parent)
 *   - siblings (events sharing the same runId OR the same lineageKey,
 *     excluding ancestors/descendants)
 *
 * Returns a typed `LineageGraph` payload suitable for the
 * `/api/audit/[eventId]/graph` route response.
 */

import type { DemoAuditEvent } from './demoEvents';

export interface LineageGraphNode {
  /** Pane-id-safe identifier. */
  readonly id: string;
  readonly kind: DemoAuditEvent['kind'];
  readonly runId: string;
  readonly lineageKey: string;
  readonly subjectId: string;
  readonly summary: string;
  readonly occurredAt: string;
}

export interface LineageGraphEdge {
  /** Source event id (parent / ancestor). */
  readonly from: string;
  /** Target event id (child / descendant). */
  readonly to: string;
  readonly relation: 'parent' | 'child' | 'shared_run' | 'shared_lineage_key';
}

export interface LineageGraph {
  /** The focal event the caller asked about. */
  readonly focal: LineageGraphNode;
  /** Upstream ancestors in BFS order from the focal. */
  readonly upstream: readonly LineageGraphNode[];
  /** Downstream descendants in BFS order from the focal. */
  readonly downstream: readonly LineageGraphNode[];
  /**
   * Sibling events that share the focal's `runId` OR `lineageKey`
   * but are not ancestors or descendants. Each carries a `relation`.
   */
  readonly siblings: ReadonlyArray<{
    readonly node: LineageGraphNode;
    readonly relation: 'shared_run' | 'shared_lineage_key';
  }>;
  /** All edges that connect the focal + upstream + downstream. */
  readonly edges: readonly LineageGraphEdge[];
  /** Counts for the UI to render summary chips. */
  readonly summary: {
    readonly upstreamCount: number;
    readonly downstreamCount: number;
    readonly sharedRunCount: number;
    readonly sharedLineageKeyCount: number;
  };
}

function toNode(e: DemoAuditEvent): LineageGraphNode {
  return {
    id: e.id,
    kind: e.kind,
    runId: e.runId,
    lineageKey: e.lineageKey,
    subjectId: e.subjectId,
    summary: e.summary,
    occurredAt: e.occurredAt,
  };
}

export function resolveLineageGraph(
  focalEventId: string,
  allEvents: readonly DemoAuditEvent[],
): LineageGraph | null {
  const byId = new Map(allEvents.map((e) => [e.id, e]));
  const focal = byId.get(focalEventId);
  if (!focal) return null;

  // ── Upstream (BFS via parentEventIds) ─────────────────────────────────
  const upstream: DemoAuditEvent[] = [];
  const upstreamSeen = new Set<string>([focal.id]);
  const upstreamQueue: string[] = [...focal.parentEventIds];
  while (upstreamQueue.length > 0) {
    const id = upstreamQueue.shift()!;
    if (upstreamSeen.has(id)) continue;
    upstreamSeen.add(id);
    const parent = byId.get(id);
    if (!parent) continue;
    upstream.push(parent);
    for (const pid of parent.parentEventIds) {
      if (!upstreamSeen.has(pid)) upstreamQueue.push(pid);
    }
  }

  // ── Downstream (BFS over events that name focal in parentEventIds) ─────
  const downstream: DemoAuditEvent[] = [];
  const downstreamSeen = new Set<string>([focal.id]);
  const downstreamQueue: string[] = [focal.id];
  while (downstreamQueue.length > 0) {
    const id = downstreamQueue.shift()!;
    for (const e of allEvents) {
      if (downstreamSeen.has(e.id)) continue;
      if (e.parentEventIds.includes(id)) {
        downstreamSeen.add(e.id);
        downstream.push(e);
        downstreamQueue.push(e.id);
      }
    }
  }

  // ── Siblings (shared runId or lineageKey, not ancestors/descendants) ───
  const ancestorIds = new Set(upstream.map((e) => e.id));
  const descendantIds = new Set(downstream.map((e) => e.id));
  const siblings: { node: LineageGraphNode; relation: 'shared_run' | 'shared_lineage_key' }[] = [];
  for (const e of allEvents) {
    if (e.id === focal.id) continue;
    if (ancestorIds.has(e.id) || descendantIds.has(e.id)) continue;
    if (e.runId === focal.runId) {
      siblings.push({ node: toNode(e), relation: 'shared_run' });
    } else if (e.lineageKey === focal.lineageKey) {
      siblings.push({ node: toNode(e), relation: 'shared_lineage_key' });
    }
  }

  // ── Edges ──────────────────────────────────────────────────────────────
  const edges: LineageGraphEdge[] = [];
  const collected = new Set<string>();
  const addParentEdges = (e: DemoAuditEvent) => {
    for (const pid of e.parentEventIds) {
      const key = `${pid}→${e.id}`;
      if (collected.has(key)) continue;
      collected.add(key);
      edges.push({ from: pid, to: e.id, relation: 'parent' });
    }
  };
  addParentEdges(focal);
  for (const u of upstream) addParentEdges(u);
  for (const d of downstream) addParentEdges(d);

  // Sibling edges
  for (const s of siblings) {
    edges.push({
      from: focal.id,
      to: s.node.id,
      relation: s.relation,
    });
  }

  const sharedRunCount = siblings.filter((s) => s.relation === 'shared_run').length;
  const sharedLineageKeyCount = siblings.filter(
    (s) => s.relation === 'shared_lineage_key',
  ).length;

  return {
    focal: toNode(focal),
    upstream: upstream.map(toNode),
    downstream: downstream.map(toNode),
    siblings,
    edges,
    summary: {
      upstreamCount: upstream.length,
      downstreamCount: downstream.length,
      sharedRunCount,
      sharedLineageKeyCount,
    },
  };
}
