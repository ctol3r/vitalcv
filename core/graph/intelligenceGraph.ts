import type { EventGraph } from './events';
import { toEventProjection } from './events';
import type { IdentityGraph } from './identity';
import { toIdentityProjection } from './identity';
import type { NetworkGraph } from './network';
import { toNetworkProjection } from './network';
import type { GraphEdge, GraphNode, GraphProjection } from './types';
import {
  clamp01,
  createDeterministicId,
  daysBetween,
  normalizeTimestamp,
  roundTo,
} from './utils';

export interface IntelligenceGraph {
  graphId: string;
  createdAt: string;
  identity: IdentityGraph;
  events: EventGraph;
  network: NetworkGraph;
}

export interface IntelligenceGraphProjectionOptions {
  mode?: 'identity' | 'events' | 'network' | 'intelligence';
  now?: string;
  eventHalfLifeDays?: number;
}

export function createIntelligenceGraph(input: {
  graphId?: string;
  createdAt?: string;
  identity: IdentityGraph;
  events: EventGraph;
  network: NetworkGraph;
}): IntelligenceGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  return {
    graphId: input.graphId ?? createDeterministicId('intgraph', {
      identityId: input.identity.graphId,
      eventId: input.events.graphId,
      networkId: input.network.graphId,
      createdAt,
    }),
    createdAt,
    identity: input.identity,
    events: input.events,
    network: input.network,
  };
}

function mergeNode(existing: GraphNode | undefined, candidate: GraphNode): GraphNode {
  if (!existing) {
    return candidate;
  }

  const mergedLayers = [
    ...(Array.isArray(existing.metadata.mergedLayers) ? existing.metadata.mergedLayers as string[] : [existing.layer]),
    candidate.layer,
  ];

  return {
    ...existing,
    label: existing.layer === 'ontology' ? existing.label : candidate.label,
    kind: existing.layer === 'ontology' ? existing.kind : candidate.kind,
    layer: 'intelligence',
    confidence: roundTo(Math.max(existing.confidence, candidate.confidence)),
    timestamp: existing.timestamp ?? candidate.timestamp,
    metadata: {
      ...candidate.metadata,
      ...existing.metadata,
      mergedLayers: [...new Set(mergedLayers)].sort(),
    },
  };
}

function applyEventDecay(edge: GraphEdge, now: string, halfLifeDays: number): GraphEdge {
  if (edge.layer !== 'events' || !edge.timestamp) {
    return edge;
  }

  const ageDays = daysBetween(edge.timestamp, now);
  const decay = halfLifeDays <= 0 ? 1 : Math.pow(0.5, ageDays / halfLifeDays);
  const decayedWeight = roundTo(Math.max(0.01, edge.weight * decay));
  const decayedConfidence = roundTo(clamp01(edge.confidence * decay));

  return {
    ...edge,
    weight: decayedWeight,
    confidence: decayedConfidence,
    layer: 'intelligence',
    metadata: {
      ...edge.metadata,
      recencyDecay: roundTo(decay),
      ageDays: roundTo(ageDays),
    },
  };
}

function liftLayer(edge: GraphEdge): GraphEdge {
  return {
    ...edge,
    layer: 'intelligence',
  };
}

export function projectIntelligenceGraph(
  graph: IntelligenceGraph,
  options: IntelligenceGraphProjectionOptions = {},
): GraphProjection {
  const mode = options.mode ?? 'intelligence';
  if (mode === 'identity') {
    return toIdentityProjection(graph.identity);
  }

  if (mode === 'events') {
    return toEventProjection(graph.events);
  }

  if (mode === 'network') {
    return toNetworkProjection(graph.network);
  }

  const now = normalizeTimestamp(options.now ?? graph.createdAt);
  const halfLifeDays = options.eventHalfLifeDays ?? 30;
  const identityProjection = toIdentityProjection(graph.identity);
  const eventProjection = toEventProjection(graph.events);
  const networkProjection = toNetworkProjection(graph.network);
  const nodeById = new Map<string, GraphNode>();

  for (const node of identityProjection.nodes) {
    nodeById.set(node.id, { ...node, layer: 'intelligence' });
  }

  for (const node of [...eventProjection.nodes, ...networkProjection.nodes]) {
    nodeById.set(node.id, mergeNode(nodeById.get(node.id), node));
  }

  const edgeById = new Map<string, GraphEdge>();
  for (const edge of identityProjection.edges) {
    edgeById.set(edge.id, liftLayer(edge));
  }
  for (const edge of networkProjection.edges) {
    edgeById.set(edge.id, liftLayer(edge));
  }
  for (const edge of eventProjection.edges) {
    edgeById.set(edge.id, applyEventDecay(edge, now, halfLifeDays));
  }

  return {
    nodes: [...nodeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edgeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}
