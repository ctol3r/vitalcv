import type { GraphEdge, GraphNode, GraphProjection } from '../types';
import { clamp01, createDeterministicId, normalizeTimestamp, roundTo } from '../utils';

export const IDENTITY_ENTITY_TYPES = [
  'provider',
  'institution',
  'specialty',
  'credential',
  'training',
  'practice_group',
] as const;

export const IDENTITY_KEY_TYPES = [
  'NPI',
  'ORCID',
  'OPENALEX_ID',
  'PAC_ID',
  'ROR_ID',
] as const;

export type IdentityEntityType = (typeof IDENTITY_ENTITY_TYPES)[number];
export type IdentityKeyType = (typeof IDENTITY_KEY_TYPES)[number];

export interface IdentityEntity {
  entityId: string;
  entityType: IdentityEntityType;
  label: string;
  confidence: number;
  source?: string | null;
  keys: Partial<Record<IdentityKeyType, string>>;
  metadata: Record<string, unknown>;
}

export interface IdentityRelation {
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

export interface IdentityGraph {
  graphId: string;
  version: string;
  createdAt: string;
  entities: IdentityEntity[];
  relations: IdentityRelation[];
}

function normalizeKeys(
  keys: Partial<Record<IdentityKeyType, string>> | undefined,
): Partial<Record<IdentityKeyType, string>> {
  if (!keys) {
    return {};
  }

  const normalized: Partial<Record<IdentityKeyType, string>> = {};
  for (const keyType of IDENTITY_KEY_TYPES) {
    const value = keys[keyType];
    if (typeof value === 'string' && value.trim().length > 0) {
      normalized[keyType] = value.trim();
    }
  }

  return normalized;
}

export function createIdentityEntity(input: {
  entityId: string;
  entityType: IdentityEntityType;
  label: string;
  confidence?: number;
  source?: string | null;
  keys?: Partial<Record<IdentityKeyType, string>>;
  metadata?: Record<string, unknown>;
}): IdentityEntity {
  if (!IDENTITY_ENTITY_TYPES.includes(input.entityType)) {
    throw new Error(`Unsupported identity entity type: ${input.entityType}`);
  }

  return {
    entityId: input.entityId.trim(),
    entityType: input.entityType,
    label: input.label.trim(),
    confidence: roundTo(clamp01(input.confidence ?? 1)),
    source: input.source?.trim() ?? null,
    keys: normalizeKeys(input.keys),
    metadata: input.metadata ?? {},
  };
}

export function createIdentityRelation(input: {
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
}): IdentityRelation {
  const relationPayload = {
    sourceEntityId: input.sourceEntityId.trim(),
    targetEntityId: input.targetEntityId.trim(),
    relationType: input.relationType.trim(),
    directed: input.directed ?? true,
    source: input.source?.trim() ?? null,
  };

  return {
    relationId: input.relationId?.trim() ?? createDeterministicId('idrel', relationPayload),
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

export function createIdentityGraph(input: {
  graphId?: string;
  version?: string;
  createdAt?: string;
  entities: IdentityEntity[];
  relations: IdentityRelation[];
}): IdentityGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  const entities = [...input.entities].sort((left, right) => left.entityId.localeCompare(right.entityId));
  const relations = [...input.relations].sort((left, right) => left.relationId.localeCompare(right.relationId));

  return {
    graphId: input.graphId ?? createDeterministicId('identity', {
      entities: entities.map((entity) => ({
        entityId: entity.entityId,
        entityType: entity.entityType,
        keys: entity.keys,
      })),
      relations: relations.map((relation) => ({
        relationId: relation.relationId,
        sourceEntityId: relation.sourceEntityId,
        targetEntityId: relation.targetEntityId,
        relationType: relation.relationType,
      })),
    }),
    version: input.version ?? 'c56.2',
    createdAt,
    entities,
    relations,
  };
}

export function toIdentityProjection(graph: IdentityGraph): GraphProjection {
  const nodes: GraphNode[] = graph.entities.map((entity) => ({
    id: entity.entityId,
    kind: entity.entityType,
    label: entity.label,
    layer: 'ontology',
    confidence: entity.confidence,
    metadata: {
      entityType: entity.entityType,
      source: entity.source ?? null,
      keys: entity.keys,
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
