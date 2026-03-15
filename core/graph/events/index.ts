import type { GraphEdge, GraphNode, GraphProjection } from '../types';
import { clamp01, createDeterministicId, normalizeTimestamp, roundTo } from '../utils';

export const PROVIDER_EVENT_TYPES = [
  'publication',
  'trial_registration',
  'payment_change',
  'grant_award',
  'licensure_action',
  'address_change',
] as const;

export type ProviderEventType = (typeof PROVIDER_EVENT_TYPES)[number];

export interface ProviderEvent {
  eventId: string;
  entityId: string;
  eventType: ProviderEventType;
  source: string;
  timestamp: string;
  confidence: number;
  rawEvidence: unknown;
  metadata: Record<string, unknown>;
}

export interface EventEntity {
  entityId: string;
  label: string;
  entityType: string;
  metadata: Record<string, unknown>;
}

export interface EventGraphEdge {
  edgeId: string;
  sourceId: string;
  targetId: string;
  relationType: 'describes_entity' | 'chronological_precedes';
  directed: boolean;
  weight: number;
  confidence: number;
  timestamp?: string;
  metadata: Record<string, unknown>;
}

export interface EventGraph {
  graphId: string;
  version: string;
  createdAt: string;
  entities: EventEntity[];
  events: ProviderEvent[];
  edges: EventGraphEdge[];
}

export function createProviderEvent(input: {
  eventId: string;
  entityId: string;
  eventType: ProviderEventType;
  source: string;
  timestamp: string;
  confidence?: number;
  rawEvidence: unknown;
  metadata?: Record<string, unknown>;
}): ProviderEvent {
  if (!PROVIDER_EVENT_TYPES.includes(input.eventType)) {
    throw new Error(`Unsupported provider event type: ${input.eventType}`);
  }

  return {
    eventId: input.eventId.trim(),
    entityId: input.entityId.trim(),
    eventType: input.eventType,
    source: input.source.trim(),
    timestamp: normalizeTimestamp(input.timestamp),
    confidence: roundTo(clamp01(input.confidence ?? 1)),
    rawEvidence: input.rawEvidence,
    metadata: input.metadata ?? {},
  };
}

export function createEventGraph(input: {
  graphId?: string;
  version?: string;
  createdAt?: string;
  entities?: EventEntity[];
  events: ProviderEvent[];
}): EventGraph {
  const createdAt = input.createdAt ? normalizeTimestamp(input.createdAt) : new Date().toISOString();
  const explicitEntities = input.entities ?? [];
  const entityById = new Map(explicitEntities.map((entity) => [entity.entityId, entity]));
  const sortedEvents = [...input.events].sort((left, right) => (
    Date.parse(left.timestamp) - Date.parse(right.timestamp)
      || left.entityId.localeCompare(right.entityId)
      || left.eventId.localeCompare(right.eventId)
  ));

  for (const event of sortedEvents) {
    if (!entityById.has(event.entityId)) {
      entityById.set(event.entityId, {
        entityId: event.entityId,
        label: event.entityId,
        entityType: 'provider',
        metadata: {},
      });
    }
  }

  const edges: EventGraphEdge[] = [];
  const priorEventByEntity = new Map<string, ProviderEvent>();

  for (const event of sortedEvents) {
    edges.push({
      edgeId: createDeterministicId('evrel', { relation: 'describes_entity', entityId: event.entityId, eventId: event.eventId }),
      sourceId: event.entityId,
      targetId: event.eventId,
      relationType: 'describes_entity',
      directed: true,
      weight: roundTo(Math.max(0.1, event.confidence)),
      confidence: event.confidence,
      timestamp: event.timestamp,
      metadata: {
        source: event.source,
      },
    });

    const prior = priorEventByEntity.get(event.entityId);
    if (prior) {
      edges.push({
        edgeId: createDeterministicId('evrel', { relation: 'chronological_precedes', sourceId: prior.eventId, targetId: event.eventId }),
        sourceId: prior.eventId,
        targetId: event.eventId,
        relationType: 'chronological_precedes',
        directed: true,
        weight: roundTo(Math.max(0.1, (prior.confidence + event.confidence) / 2)),
        confidence: roundTo((prior.confidence + event.confidence) / 2),
        timestamp: event.timestamp,
        metadata: {
          entityId: event.entityId,
        },
      });
    }

    priorEventByEntity.set(event.entityId, event);
  }

  return {
    graphId: input.graphId ?? createDeterministicId('events', {
      events: sortedEvents.map((event) => ({ eventId: event.eventId, entityId: event.entityId, eventType: event.eventType })),
    }),
    version: input.version ?? 'c56.1',
    createdAt,
    entities: [...entityById.values()].sort((left, right) => left.entityId.localeCompare(right.entityId)),
    events: sortedEvents,
    edges: edges.sort((left, right) => left.edgeId.localeCompare(right.edgeId)),
  };
}

export function toEventProjection(graph: EventGraph): GraphProjection {
  const entityNodes: GraphNode[] = graph.entities.map((entity) => ({
    id: entity.entityId,
    kind: entity.entityType,
    label: entity.label,
    layer: 'events',
    confidence: 1,
    metadata: {
      entityType: entity.entityType,
      ...entity.metadata,
    },
  }));

  const eventNodes: GraphNode[] = graph.events.map((event) => ({
    id: event.eventId,
    kind: event.eventType,
    label: `${event.eventType}:${event.entityId}`,
    layer: 'events',
    confidence: event.confidence,
    timestamp: event.timestamp,
    metadata: {
      entityId: event.entityId,
      source: event.source,
      rawEvidence: event.rawEvidence,
      ...event.metadata,
    },
  }));

  const edges: GraphEdge[] = graph.edges.map((edge) => ({
    id: edge.edgeId,
    source: edge.sourceId,
    target: edge.targetId,
    relation: edge.relationType,
    directed: edge.directed,
    weight: edge.weight,
    confidence: edge.confidence,
    layer: 'events',
    timestamp: edge.timestamp,
    metadata: edge.metadata,
  }));

  return {
    nodes: [...entityNodes, ...eventNodes],
    edges,
  };
}
