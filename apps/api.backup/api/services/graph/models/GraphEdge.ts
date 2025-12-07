import { GraphMetadata, GraphNodeType } from './GraphNode.js';

export const GRAPH_RELATION_TYPES = [
  'HAS_LICENSE',
  'VERIFIED_BY',
  'ISSUED_BY',
  'BELONGS_TO',
  'ELIGIBLE_IN',
  'DEPENDS_ON',
  'IN_CONFLICT_WITH',
] as const;

export type GraphRelationType = (typeof GRAPH_RELATION_TYPES)[number];

export interface GraphEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: GraphRelationType;
  weight: number;
  metadata: GraphMetadata;
}

export interface GraphEdgeInit {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: GraphRelationType;
  weight?: number;
  metadata?: GraphMetadata;
}

export function createGraphEdge(init: GraphEdgeInit): GraphEdge {
  if (!init.sourceNodeId?.trim() || !init.targetNodeId?.trim()) {
    throw new Error('GraphEdge requires both sourceNodeId and targetNodeId');
  }

  const weight = init.weight ?? 1;
  if (weight <= 0) {
    throw new Error('GraphEdge weight must be positive');
  }

  return {
    sourceNodeId: init.sourceNodeId,
    targetNodeId: init.targetNodeId,
    relationType: init.relationType,
    weight,
    metadata: init.metadata ?? {},
  };
}

export interface EdgeContext {
  sourceType: GraphNodeType;
  targetType: GraphNodeType;
}

