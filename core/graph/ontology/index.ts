import type { GraphEdge, GraphNode, GraphProjection } from '../types';
import { clamp01, createDeterministicId, normalizeTimestamp, roundTo } from '../utils';

export const ONTOLOGY_ENTITY_TYPES = [
  'provider',
  'institution',
  'practice_group',
  'credential',
  'specialty',
  'board_certification',
] as const;

export type OntologyEntityType = (typeof ONTOLOGY_ENTITY_TYPES)[number];

export interface OntologyEntity {
  entityId: string;
  entityType: OntologyEntityType;
  label: string;
  confidence: number;
  source?: string | null;
  metadata: Record<string, unknown>;
}

export interface OntologyRelation {
  relationId: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  directed: boolean;
  weight: number;
  confidence: number;
  source?: string | null;
  observedAt?: string;
  metadata: Record<string, unknown>;
}

export interface OntologyGraph {
  graphId: string;
  version: string;
  createdAt: string;
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}

export function createOntologyEntity(input: {
  entityId: string;
  entityType: OntologyEntityType;
  label: string;
  confidence?: number;
  source?: string | null;
  metadata?: Record<string, unknown>;
}): OntologyEntity {
  if (!ONTOLOGY_ENTITY_TYPES.includes(input.entityType)) {
    throw new Error(`Unsupported ontology entity type: ${input.entityType}`);
  }

  return {
    entityId: input.entityId.trim(),
    entityType: input.entityType,
    label: input.label.trim(),
    confidence: roundTo(clamp01(input.confidence ?? 1)),
    source: input.source?.trim() ?? null,
    metadata: input.metadata ?? {},
  };
}

export function createOntologyRelation(input: {
  relationId?: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  directed?: boolean;
  weight?: number;
  confidence?: number;
  source?: string | null;
  observedAt?: string;
  metadata?: Record<string, unknown>;
}): OntologyRelation {
  const relationPayload = {
    sourceEntityId: input.sourceEntityId.trim(),
    targetEntityId: input.targetEntityId.trim(),
    relationType: input.relationType.trim(),
    directed: input.directed ?? true,
    source: input.source?.trim() ?? null,
  };

  return {
    relationId: input.relationId?.trim() ?? createDeterministicId('ontrel', relationPayload),
    sourceEntityId: relationPayload.sourceEntityId,
    targetEntityId: relationPayload.targetEntityId,
    relationType: relationPayload.relationType,
    directed: relationPayload.directed,
    weight: roundTo(Math.max(0.01, input.weight ?? 1)),
    confidence: roundTo(clamp01(input.confidence ?? 1)),
    source: relationPayload.source,
    observedAt: input.observedAt ? normalizeTimestamp(input.observedAt) : undefined,
    metadata: input.metadata ?? {},
  };
}

export function createOntologyGraph(input: {
  graphId?: string;
  version?: string;
  createdAt?: string;
  entities: OntologyEntity[];
  relations: OntologyRelation[];
}): OntologyGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  const entities = [...input.entities]
    .sort((left, right) => left.entityId.localeCompare(right.entityId));
  const relations = [...input.relations]
    .sort((left, right) => left.relationId.localeCompare(right.relationId));

  return {
    graphId: input.graphId ?? createDeterministicId('ontology', {
      entities: entities.map((entity) => ({ entityId: entity.entityId, entityType: entity.entityType })),
      relations: relations.map((relation) => ({
        relationId: relation.relationId,
        sourceEntityId: relation.sourceEntityId,
        targetEntityId: relation.targetEntityId,
        relationType: relation.relationType,
      })),
    }),
    version: input.version ?? 'c56.1',
    createdAt,
    entities,
    relations,
  };
}

export function toOntologyProjection(graph: OntologyGraph): GraphProjection {
  const nodes: GraphNode[] = graph.entities.map((entity) => ({
    id: entity.entityId,
    kind: entity.entityType,
    label: entity.label,
    layer: 'ontology',
    confidence: entity.confidence,
    metadata: {
      entityType: entity.entityType,
      source: entity.source ?? null,
      ...entity.metadata,
    },
  }));

  const edges: GraphEdge[] = graph.relations.map((relation) => ({
    id: relation.relationId,
    source: relation.sourceEntityId,
    target: relation.targetEntityId,
    relation: relation.relationType,
    directed: relation.directed,
    weight: relation.weight,
    confidence: relation.confidence,
    layer: 'ontology',
    timestamp: relation.observedAt,
    metadata: {
      source: relation.source ?? null,
      ...relation.metadata,
    },
  }));

  return { nodes, edges };
}
