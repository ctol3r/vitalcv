export type GraphNodeType =
  | 'clinician'
  | 'license'
  | 'compact'
  | 'state'
  | 'org'
  | 'payer'
  | 'privilege'
  | 'timeline_event';

export type GraphEdgeType =
  | 'holds_license'
  | 'licensed_in'
  | 'member_of_compact'
  | 'compact_extends_to'
  | 'granted_privilege'
  | 'affiliated_with'
  | 'operates_in'
  | 'enrolled_with'
  | 'covers_state'
  | 'chronology';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  status?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  weight?: number;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export type GraphIssueType = 'cycle' | 'conflict' | 'missing_edge';
export type GraphIssueSeverity = 'info' | 'warning' | 'critical';

export interface GraphIssue {
  id: string;
  type: GraphIssueType;
  severity: GraphIssueSeverity;
  message: string;
  nodes?: string[];
  edges?: string[];
}

export interface CredentialGraphMetadata {
  clinicianId: string;
  clinicianNodeId: string;
  clinicianName?: string | null;
  clinicianDid?: string | null;
  npi?: string;
  specialty?: string;
  homeState?: string;
  compactTypes?: string[];
  generatedAt: string;
}

export interface CredentialGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings: string[];
  issues: GraphIssue[];
  metadata: CredentialGraphMetadata;
}

export interface TraversalOptions {
  startNodeId: string;
  allowInactiveEdges?: boolean;
  edgeFilter?: (edge: GraphEdge) => boolean;
  nodeFilter?: (node: GraphNode) => boolean;
}

export interface TraversalResult {
  visited: Set<string>;
  order: string[];
}

export function buildAdjacency(
  graph: CredentialGraph,
  options: { allowInactiveEdges?: boolean } = {},
): Map<string, GraphEdge[]> {
  const adjacency = new Map<string, GraphEdge[]>();
  const { allowInactiveEdges = false } = options;

  for (const edge of graph.edges) {
    if (!allowInactiveEdges && edge.active === false) {
      continue;
    }
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source)!.push(edge);
  }

  return adjacency;
}

export function traverseGraph(graph: CredentialGraph, options: TraversalOptions): TraversalResult {
  const adjacency = buildAdjacency(graph, { allowInactiveEdges: options.allowInactiveEdges });
  const visited = new Set<string>();
  const order: string[] = [];
  const queue: string[] = [options.startNodeId];

  while (queue.length) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    const node = graph.nodes.find((entry) => entry.id === nodeId);
    if (!node) continue;
    if (options.nodeFilter && !options.nodeFilter(node)) {
      continue;
    }
    visited.add(nodeId);
    order.push(nodeId);

    const edges = adjacency.get(nodeId) ?? [];
    for (const edge of edges) {
      if (options.edgeFilter && !options.edgeFilter(edge)) {
        continue;
      }
      queue.push(edge.target);
    }
  }

  return { visited, order };
}

