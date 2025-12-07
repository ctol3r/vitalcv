import { GraphEdge } from './models/GraphEdge.js';
import { GraphMetadata, GraphNode, GraphNodeType } from './models/GraphNode.js';

export interface GraphData {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

export type GraphEdgeKey = `${string}->${GraphRelationSymbol}`;
type GraphRelationSymbol = `${string}:${string}`;

export function createEmptyGraph(): GraphData {
  return {
    nodes: new Map(),
    edges: [],
  };
}

export function cloneGraphData(graph: GraphData): GraphData {
  return {
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
  };
}

export function upsertNode(
  map: Map<string, GraphNode>,
  nodeId: string,
  nodeType: GraphNodeType,
  metadata: GraphMetadata,
  createdAt = new Date()
): GraphNode {
  const existing = map.get(nodeId);
  if (existing) {
    const mergedMetadata = { ...existing.metadata, ...metadata };
    const updated: GraphNode = {
      ...existing,
      metadata: mergedMetadata,
    };
    map.set(nodeId, updated);
    return updated;
  }

  const node: GraphNode = {
    nodeId,
    nodeType,
    metadata,
    createdAt,
  };
  map.set(nodeId, node);
  return node;
}

