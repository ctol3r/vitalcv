/**
 * lifecycleGraph.ts — W2-PR44A
 *
 * Builds a deterministic lifecycle graph from an append-only event log.
 *
 * Determinism contract:
 *   - Sort events by (occurredAt asc, recordedAt asc, eventId asc) before
 *     folding. Same input → identical graph.
 *   - Indices (predecessorsByArtifact, successorsByArtifact) are rebuilt from
 *     scratch each call; never mutated in place.
 *
 * No DB writes here. Pure transform: event log → graph.
 */

import { createHash } from 'crypto';
import { CredentialLifecycleState } from '../../utils/lifecycleState';
import type {
  LifecycleEvent,
  LifecycleEventType,
  LifecycleGraph,
  LifecycleNode,
  SupersessionLink,
} from './types';

const STATE_BY_EVENT: Readonly<Record<LifecycleEventType, CredentialLifecycleState | 'archived' | null>> = {
  issued: CredentialLifecycleState.ISSUED,
  activated: CredentialLifecycleState.ACTIVE,
  expired: CredentialLifecycleState.EXPIRED,
  renewed: null, // renewal does not by itself change the predecessor's state
  superseded: null, // supersession is recorded as an edge; predecessor remains in prior state
  revoked: CredentialLifecycleState.REVOKED,
  suspended: CredentialLifecycleState.SUSPENDED,
  reinstated: CredentialLifecycleState.ACTIVE,
  archived: 'archived',
};

export function canonicalizeEvent(event: Omit<LifecycleEvent, 'eventHash'>): string {
  // Stable JSON: keys sorted, no whitespace.
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(event).sort()) {
    ordered[key] = (event as Record<string, unknown>)[key];
  }
  return JSON.stringify(ordered);
}

export function computeEventHash(event: Omit<LifecycleEvent, 'eventHash'>): string {
  return createHash('sha256').update(canonicalizeEvent(event)).digest('hex');
}

export function sealEvent(event: Omit<LifecycleEvent, 'eventHash'>): LifecycleEvent {
  return { ...event, eventHash: computeEventHash(event) };
}

export function sortEvents(events: ReadonlyArray<LifecycleEvent>): LifecycleEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? -1 : 1;
    if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1;
    return 0;
  });
}

export interface GraphInput {
  organizationId: string | null;
  artifactSeeds: ReadonlyArray<{
    artifactId: string;
    artifactType: string;
    organizationId: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
  }>;
  events: ReadonlyArray<LifecycleEvent>;
}

export function buildLifecycleGraph(input: GraphInput, builtAt: Date = new Date()): LifecycleGraph {
  const nodes = new Map<string, LifecycleNode>();

  for (const seed of input.artifactSeeds) {
    nodes.set(seed.artifactId, {
      artifactId: seed.artifactId,
      artifactType: seed.artifactType,
      organizationId: seed.organizationId,
      state: CredentialLifecycleState.ISSUED,
      issuedAt: seed.issuedAt,
      expiresAt: seed.expiresAt,
      archivedAt: null,
      events: [],
      predecessorIds: [],
      successorIds: [],
    });
  }

  const ordered = sortEvents(input.events);
  const supersessionEdges: SupersessionLink[] = [];

  for (const event of ordered) {
    const node = nodes.get(event.artifactId);
    if (!node) continue; // event for an unknown artifact — surfaced separately by integrity gate

    node.events.push(event);

    const nextState = STATE_BY_EVENT[event.eventType];
    if (nextState !== null) {
      node.state = nextState;
    }
    if (event.eventType === 'archived') {
      node.archivedAt = event.occurredAt;
    }

    if ((event.eventType === 'renewed' || event.eventType === 'superseded') && event.successorArtifactId) {
      const link: SupersessionLink = {
        fromArtifactId: event.artifactId,
        toArtifactId: event.successorArtifactId,
        linkType: event.eventType === 'renewed' ? 'renewal' : 'replacement',
        establishedAt: event.occurredAt,
        establishedByEventId: event.eventId,
        deterministicKey: createHash('sha256')
          .update(`${event.artifactId}|${event.successorArtifactId}|${event.occurredAt}|${event.eventType}`)
          .digest('hex'),
      };
      supersessionEdges.push(link);
    }

    if ((event.eventType === 'renewed' || event.eventType === 'superseded') && event.predecessorArtifactId) {
      // Successor side: an event recorded on the new artifact that points
      // back to its predecessor. We still emit the edge.
      const link: SupersessionLink = {
        fromArtifactId: event.predecessorArtifactId,
        toArtifactId: event.artifactId,
        linkType: event.eventType === 'renewed' ? 'renewal' : 'replacement',
        establishedAt: event.occurredAt,
        establishedByEventId: event.eventId,
        deterministicKey: createHash('sha256')
          .update(`${event.predecessorArtifactId}|${event.artifactId}|${event.occurredAt}|${event.eventType}`)
          .digest('hex'),
      };
      supersessionEdges.push(link);
    }
  }

  // Deduplicate edges by deterministicKey (stable: first occurrence wins)
  const seenKeys = new Set<string>();
  const dedupedEdges: SupersessionLink[] = [];
  for (const edge of supersessionEdges) {
    if (seenKeys.has(edge.deterministicKey)) continue;
    seenKeys.add(edge.deterministicKey);
    dedupedEdges.push(edge);
  }

  // Build indices
  const predecessorsByArtifact = new Map<string, string[]>();
  const successorsByArtifact = new Map<string, string[]>();
  for (const edge of dedupedEdges) {
    const succList = successorsByArtifact.get(edge.fromArtifactId) ?? [];
    if (!succList.includes(edge.toArtifactId)) succList.push(edge.toArtifactId);
    successorsByArtifact.set(edge.fromArtifactId, succList);

    const predList = predecessorsByArtifact.get(edge.toArtifactId) ?? [];
    if (!predList.includes(edge.fromArtifactId)) predList.push(edge.fromArtifactId);
    predecessorsByArtifact.set(edge.toArtifactId, predList);
  }

  // Mirror indices into nodes for ergonomic traversal
  for (const node of nodes.values()) {
    node.predecessorIds = [...(predecessorsByArtifact.get(node.artifactId) ?? [])].sort();
    node.successorIds = [...(successorsByArtifact.get(node.artifactId) ?? [])].sort();
  }

  return {
    organizationId: input.organizationId,
    builtAt: builtAt.toISOString(),
    nodes,
    supersessionEdges: dedupedEdges.sort((a, b) =>
      a.deterministicKey < b.deterministicKey ? -1 : a.deterministicKey > b.deterministicKey ? 1 : 0,
    ),
    predecessorsByArtifact,
    successorsByArtifact,
  };
}

export function fingerprintGraph(graph: LifecycleGraph): string {
  // Stable hash of the structural shape — useful for replay equality
  const nodeIds = Array.from(graph.nodes.keys()).sort();
  const payload = {
    organizationId: graph.organizationId,
    nodeIds,
    edges: graph.supersessionEdges.map(e => e.deterministicKey).sort(),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
