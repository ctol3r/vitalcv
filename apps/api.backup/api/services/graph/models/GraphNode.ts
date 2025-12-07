export const GRAPH_NODE_TYPES = [
  'CLINICIAN',
  'LICENSE',
  'BOARD',
  'DEA',
  'PECOS',
  'MEDICAID',
  'PAYER',
  'PRIVILEGE',
  'ORG',
  'STATE',
  'COMPACT',
  'VC',
  'EVENT',
] as const;

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];
export type GraphMetadata = Record<string, unknown>;

export interface GraphNode {
  nodeId: string;
  nodeType: GraphNodeType;
  metadata: GraphMetadata;
  createdAt: Date;
}

export interface GraphNodeInit {
  nodeId: string;
  nodeType: GraphNodeType;
  metadata?: GraphMetadata;
  createdAt?: Date;
}

export function createGraphNode(init: GraphNodeInit): GraphNode {
  if (!init.nodeId?.trim()) {
    throw new Error('GraphNode.nodeId is required');
  }

  return {
    nodeId: init.nodeId,
    nodeType: init.nodeType,
    metadata: normalizeMetadata(init.metadata),
    createdAt: init.createdAt ?? new Date(),
  };
}

export function normalizeMetadata(metadata?: GraphMetadata): GraphMetadata {
  if (!metadata) {
    return {};
  }

  if (typeof metadata !== 'object') {
    return { value: metadata };
  }

  return { ...metadata };
}

export function mergeMetadata(base: GraphMetadata, updates?: GraphMetadata): GraphMetadata {
  if (!updates || Object.keys(updates).length === 0) {
    return base;
  }

  return {
    ...base,
    ...updates,
  };
}

