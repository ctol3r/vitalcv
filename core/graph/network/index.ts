import type { GraphEdge, GraphNode, GraphProjection } from '../types';
import { clamp01, createDeterministicId, normalizeTimestamp, roundTo } from '../utils';

export const NETWORK_RELATIONSHIP_TYPES = [
  'co_author',
  'co_investigator',
  'co_PI',
  'co_practice_group',
  'shared_industry_relationship',
] as const;

export type NetworkRelationshipType = (typeof NETWORK_RELATIONSHIP_TYPES)[number];

export interface NetworkEntity {
  entityId: string;
  label: string;
  entityType: string;
  metadata: Record<string, unknown>;
}

export interface NetworkEdgeRecord {
  edgeId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: NetworkRelationshipType;
  weight: number;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

export interface NetworkGraph {
  graphId: string;
  version: string;
  createdAt: string;
  entities: NetworkEntity[];
  edges: NetworkEdgeRecord[];
}

export function createNetworkEntity(input: {
  entityId: string;
  label: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}): NetworkEntity {
  return {
    entityId: input.entityId.trim(),
    label: input.label.trim(),
    entityType: input.entityType?.trim() ?? 'provider',
    metadata: input.metadata ?? {},
  };
}

export function createNetworkEdge(input: {
  edgeId?: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: NetworkRelationshipType;
  weight?: number;
  confidence?: number;
  firstSeen: string;
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}): NetworkEdgeRecord {
  if (!NETWORK_RELATIONSHIP_TYPES.includes(input.relationshipType)) {
    throw new Error(`Unsupported network relationship type: ${input.relationshipType}`);
  }

  const firstSeen = normalizeTimestamp(input.firstSeen);
  const lastSeen = normalizeTimestamp(input.lastSeen ?? input.firstSeen);
  const seed = {
    sourceEntityId: input.sourceEntityId.trim(),
    targetEntityId: input.targetEntityId.trim(),
    relationshipType: input.relationshipType,
    firstSeen,
    lastSeen,
  };

  return {
    edgeId: input.edgeId?.trim() ?? createDeterministicId('netrel', seed),
    sourceEntityId: seed.sourceEntityId,
    targetEntityId: seed.targetEntityId,
    relationshipType: seed.relationshipType,
    weight: roundTo(Math.max(0.01, input.weight ?? 1)),
    confidence: roundTo(clamp01(input.confidence ?? 1)),
    firstSeen,
    lastSeen,
    metadata: input.metadata ?? {},
  };
}

export function createNetworkGraph(input: {
  graphId?: string;
  version?: string;
  createdAt?: string;
  entities?: NetworkEntity[];
  edges: NetworkEdgeRecord[];
}): NetworkGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  const explicitEntities = input.entities ?? [];
  const entityById = new Map(explicitEntities.map((entity) => [entity.entityId, entity]));
  const edges = [...input.edges].sort((left, right) => left.edgeId.localeCompare(right.edgeId));

  for (const edge of edges) {
    if (!entityById.has(edge.sourceEntityId)) {
      entityById.set(edge.sourceEntityId, createNetworkEntity({
        entityId: edge.sourceEntityId,
        label: edge.sourceEntityId,
      }));
    }
    if (!entityById.has(edge.targetEntityId)) {
      entityById.set(edge.targetEntityId, createNetworkEntity({
        entityId: edge.targetEntityId,
        label: edge.targetEntityId,
      }));
    }
  }

  return {
    graphId: input.graphId ?? createDeterministicId('network', {
      edges: edges.map((edge) => ({
        edgeId: edge.edgeId,
        sourceEntityId: edge.sourceEntityId,
        targetEntityId: edge.targetEntityId,
        relationshipType: edge.relationshipType,
      })),
    }),
    version: input.version ?? 'c56.2',
    createdAt,
    entities: [...entityById.values()].sort((left, right) => left.entityId.localeCompare(right.entityId)),
    edges,
  };
}

export function toNetworkProjection(graph: NetworkGraph): GraphProjection {
  const nodes: GraphNode[] = graph.entities.map((entity) => ({
    id: entity.entityId,
    kind: entity.entityType,
    label: entity.label,
    layer: 'network',
    confidence: 1,
    metadata: {
      entityType: entity.entityType,
      ...entity.metadata,
    },
  }));

  const edges: GraphEdge[] = graph.edges.map((edge) => ({
    id: edge.edgeId,
    source: edge.sourceEntityId,
    target: edge.targetEntityId,
    relation: edge.relationshipType,
    directed: false,
    weight: edge.weight,
    confidence: edge.confidence,
    layer: 'network',
    timestamp: edge.lastSeen,
    metadata: {
      firstSeen: edge.firstSeen,
      lastSeen: edge.lastSeen,
      ...edge.metadata,
    },
  }));

  return { nodes, edges };
}
