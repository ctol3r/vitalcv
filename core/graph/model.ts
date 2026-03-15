import { toEventProjection, type EventGraph } from './events';
import { toOntologyProjection, type OntologyGraph } from './ontology';
import type { GraphEdge, GraphNode, GraphProjection } from './types';
import {
  clamp01,
  createDeterministicId,
  daysBetween,
  normalizeTimestamp,
  roundTo,
} from './utils';

export interface DualGraph {
  graphId: string;
  createdAt: string;
  ontology: OntologyGraph;
  events: EventGraph;
}

export interface DualGraphProjectionOptions {
  mode?: 'ontology' | 'events' | 'dual';
  now?: string;
  eventHalfLifeDays?: number;
}

export function createDualGraph(input: {
  graphId?: string;
  createdAt?: string;
  ontology: OntologyGraph;
  events: EventGraph;
}): DualGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  return {
    graphId: input.graphId ?? createDeterministicId('dualgraph', {
      ontologyId: input.ontology.graphId,
      eventId: input.events.graphId,
      createdAt,
    }),
    createdAt,
    ontology: input.ontology,
    events: input.events,
  };
}

function mergeNode(existing: GraphNode | undefined, candidate: GraphNode): GraphNode {
  if (!existing) {
    return candidate;
  }

  return {
    ...existing,
    label: existing.layer === 'ontology' ? existing.label : candidate.label,
    layer: 'dual',
    confidence: roundTo(Math.max(existing.confidence, candidate.confidence)),
    timestamp: existing.timestamp ?? candidate.timestamp,
    metadata: {
      ...candidate.metadata,
      ...existing.metadata,
      mergedLayers: [existing.layer, candidate.layer].sort(),
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
    layer: 'dual',
    metadata: {
      ...edge.metadata,
      recencyDecay: roundTo(decay),
      ageDays: roundTo(ageDays),
    },
  };
}

export function projectDualGraph(
  graph: DualGraph,
  options: DualGraphProjectionOptions = {},
): GraphProjection {
  const mode = options.mode ?? 'dual';
  if (mode === 'ontology') {
    return toOntologyProjection(graph.ontology);
  }

  if (mode === 'events') {
    return toEventProjection(graph.events);
  }

  const now = normalizeTimestamp(options.now ?? graph.createdAt);
  const halfLifeDays = options.eventHalfLifeDays ?? 30;
  const ontologyProjection = toOntologyProjection(graph.ontology);
  const eventProjection = toEventProjection(graph.events);
  const nodeById = new Map<string, GraphNode>();

  for (const node of ontologyProjection.nodes) {
    nodeById.set(node.id, { ...node, layer: 'dual' });
  }

  for (const node of eventProjection.nodes) {
    nodeById.set(node.id, mergeNode(nodeById.get(node.id), node));
  }

  const edgeById = new Map<string, GraphEdge>();
  for (const edge of ontologyProjection.edges) {
    edgeById.set(edge.id, {
      ...edge,
      layer: 'dual',
    });
  }

  for (const edge of eventProjection.edges) {
    const decayedEdge = applyEventDecay(edge, now, halfLifeDays);
    edgeById.set(decayedEdge.id, decayedEdge);
  }

  return {
    nodes: [...nodeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edgeById.values()].sort((left, right) => left.id.localeCompare(right.id)),
  };
}
