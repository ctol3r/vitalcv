/**
 * artifactContinuity.ts — W2-PR44A
 *
 * Continuity invariants: structural rules that MUST hold across the artifact
 * lifecycle. Violations indicate that lineage has been broken and replay
 * cannot be trusted.
 *
 * Each invariant is named so violations are addressable in operator triage.
 */

import type { ContinuityInvariantReport, LifecycleGraph, LifecycleNode } from './types';

export const INVARIANTS = {
  ARCHIVED_ARTIFACT_HAS_ARCHIVE_EVENT: 'archived_artifact_has_archive_event',
  ARCHIVED_ARTIFACT_HAS_NO_NEW_EVENTS: 'archived_artifact_has_no_new_events_after_archival',
  SUPERSEDED_PREDECESSOR_LINKS_FORWARD: 'superseded_predecessor_links_forward',
  SUPERSEDED_SUCCESSOR_LINKS_BACK: 'superseded_successor_links_back',
  RENEWED_HAS_AT_LEAST_ONE_LINEAGE_EDGE: 'renewed_artifact_has_at_least_one_lineage_edge',
  EVENT_CHRONOLOGY_NON_REGRESSING: 'event_chronology_non_regressing',
  REVOKED_NOT_REINSTATED_AFTER_ARCHIVAL: 'revoked_not_reinstated_after_archival',
} as const;

export function checkArtifactContinuity(
  node: LifecycleNode,
  graph: LifecycleGraph,
): ContinuityInvariantReport {
  const checked: string[] = [];
  const violated: string[] = [];

  // 1. Archived artifacts must have an archive event
  checked.push(INVARIANTS.ARCHIVED_ARTIFACT_HAS_ARCHIVE_EVENT);
  if (node.state === 'archived') {
    const hasArchiveEvent = node.events.some(e => e.eventType === 'archived');
    if (!hasArchiveEvent) violated.push(INVARIANTS.ARCHIVED_ARTIFACT_HAS_ARCHIVE_EVENT);
  }

  // 2. Archived artifacts must not accumulate new events after archival
  checked.push(INVARIANTS.ARCHIVED_ARTIFACT_HAS_NO_NEW_EVENTS);
  if (node.archivedAt) {
    const archivedAtMs = new Date(node.archivedAt).getTime();
    const tail = node.events.filter(
      e => new Date(e.occurredAt).getTime() > archivedAtMs && e.eventType !== 'archived',
    );
    if (tail.length > 0) violated.push(INVARIANTS.ARCHIVED_ARTIFACT_HAS_NO_NEW_EVENTS);
  }

  // 3. Renewed/superseded predecessor must link forward to a successor
  checked.push(INVARIANTS.SUPERSEDED_PREDECESSOR_LINKS_FORWARD);
  const hadOutboundEvent = node.events.some(
    e => (e.eventType === 'renewed' || e.eventType === 'superseded') && e.successorArtifactId !== null,
  );
  if (hadOutboundEvent && node.successorIds.length === 0) {
    violated.push(INVARIANTS.SUPERSEDED_PREDECESSOR_LINKS_FORWARD);
  }

  // 4. Renewed/superseded successor must link back to a predecessor
  checked.push(INVARIANTS.SUPERSEDED_SUCCESSOR_LINKS_BACK);
  const hadInboundEvent = node.events.some(
    e => (e.eventType === 'renewed' || e.eventType === 'superseded') && e.predecessorArtifactId !== null,
  );
  if (hadInboundEvent && node.predecessorIds.length === 0) {
    violated.push(INVARIANTS.SUPERSEDED_SUCCESSOR_LINKS_BACK);
  }

  // 5. If this artifact participated in any renewal event at all, it must
  //    appear in at least one lineage edge.
  checked.push(INVARIANTS.RENEWED_HAS_AT_LEAST_ONE_LINEAGE_EDGE);
  const renewalEvents = node.events.filter(e => e.eventType === 'renewed');
  if (renewalEvents.length > 0) {
    const inEdges = node.predecessorIds.length + node.successorIds.length;
    if (inEdges === 0) violated.push(INVARIANTS.RENEWED_HAS_AT_LEAST_ONE_LINEAGE_EDGE);
  }

  // 6. Event chronology must not regress (occurredAt monotonic non-decreasing
  //    after sort). The graph builder sorts on insert; if we observe a
  //    regression here it means an external mutator reordered the array.
  checked.push(INVARIANTS.EVENT_CHRONOLOGY_NON_REGRESSING);
  for (let i = 1; i < node.events.length; i++) {
    const prev = node.events[i - 1];
    const curr = node.events[i];
    if (new Date(curr.occurredAt).getTime() < new Date(prev.occurredAt).getTime()) {
      violated.push(INVARIANTS.EVENT_CHRONOLOGY_NON_REGRESSING);
      break;
    }
  }

  // 7. Once archived, an artifact must not be reinstated.
  checked.push(INVARIANTS.REVOKED_NOT_REINSTATED_AFTER_ARCHIVAL);
  if (node.archivedAt) {
    const archivedAtMs = new Date(node.archivedAt).getTime();
    const reinstatedAfter = node.events.find(
      e => e.eventType === 'reinstated' && new Date(e.occurredAt).getTime() > archivedAtMs,
    );
    if (reinstatedAfter) violated.push(INVARIANTS.REVOKED_NOT_REINSTATED_AFTER_ARCHIVAL);
  }

  // Reference graph param to avoid an unused warning while keeping the door
  // open for cross-node invariants in this same function later.
  void graph;

  return {
    artifactId: node.artifactId,
    invariantsChecked: checked,
    invariantsViolated: violated,
    continuityPreserved: violated.length === 0,
  };
}

export function checkAllContinuity(graph: LifecycleGraph): ContinuityInvariantReport[] {
  const reports: ContinuityInvariantReport[] = [];
  const artifactIds = Array.from(graph.nodes.keys()).sort();
  for (const id of artifactIds) {
    const node = graph.nodes.get(id);
    if (!node) continue;
    reports.push(checkArtifactContinuity(node, graph));
  }
  return reports;
}
