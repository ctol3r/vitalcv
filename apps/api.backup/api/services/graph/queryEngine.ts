import { GraphEdge, GraphRelationType } from './models/GraphEdge.js';
import { GraphNode, GraphNodeType } from './models/GraphNode.js';
import { GraphData } from './types.js';

type Direction = 'outbound' | 'inbound' | 'both';

export interface NeighborQueryOptions {
  direction?: Direction;
  relationTypes?: GraphRelationType[];
  nodeTypes?: GraphNodeType[];
}

export interface TraversalOptions extends NeighborQueryOptions {
  maxDepth?: number;
}

export interface PathResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class GraphQueryEngine {
  private readonly adjacency = new Map<string, GraphEdge[]>();
  private readonly inboundAdjacency = new Map<string, GraphEdge[]>();

  constructor(private readonly graph: GraphData) {
    graph.edges.forEach((edge) => {
      if (!this.adjacency.has(edge.sourceNodeId)) {
        this.adjacency.set(edge.sourceNodeId, []);
      }
      this.adjacency.get(edge.sourceNodeId)!.push(edge);

      if (!this.inboundAdjacency.has(edge.targetNodeId)) {
        this.inboundAdjacency.set(edge.targetNodeId, []);
      }
      this.inboundAdjacency.get(edge.targetNodeId)!.push(edge);
    });
  }

  getNeighbors(nodeId: string, options?: NeighborQueryOptions): GraphNode[] {
    this.assertNodeExists(nodeId);
    const direction = options?.direction ?? 'outbound';
    const relationFilter = options?.relationTypes ? new Set(options.relationTypes) : undefined;
    const nodeTypeFilter = options?.nodeTypes ? new Set(options.nodeTypes) : undefined;

    const edges = this.collectEdges(nodeId, direction);
    const neighborIds = new Set<string>();

    edges.forEach((edge) => {
      if (relationFilter && !relationFilter.has(edge.relationType)) {
        return;
      }

      const neighborId = this.resolveNeighborId(edge, nodeId);
      if (!neighborId) {
        return;
      }

      const neighborNode = this.graph.nodes.get(neighborId);
      if (!neighborNode) {
        return;
      }

      if (nodeTypeFilter && !nodeTypeFilter.has(neighborNode.nodeType)) {
        return;
      }

      neighborIds.add(neighborId);
    });

    return [...neighborIds].map((id) => this.graph.nodes.get(id)!);
  }

  bfs(startNodeId: string, options?: TraversalOptions): GraphNode[] {
    this.assertNodeExists(startNodeId);
    const relationFilter = options?.relationTypes ? new Set(options.relationTypes) : undefined;
    const nodeTypeFilter = options?.nodeTypes ? new Set(options.nodeTypes) : undefined;
    const direction = options?.direction ?? 'outbound';
    const maxDepth = options?.maxDepth ?? Infinity;

    const visited = new Set<string>([startNodeId]);
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: startNodeId, depth: 0 }];
    const results: GraphNode[] = [];

    while (queue.length) {
      const current = queue.shift()!;
      if (current.depth > 0) {
        const node = this.graph.nodes.get(current.nodeId)!;
        if (!nodeTypeFilter || nodeTypeFilter.has(node.nodeType)) {
          results.push(node);
        }
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      const edges = this.collectEdges(current.nodeId, direction);
      edges.forEach((edge) => {
        if (relationFilter && !relationFilter.has(edge.relationType)) {
          return;
        }

        const neighborId = this.resolveNeighborId(edge, current.nodeId);
        if (!neighborId || visited.has(neighborId)) {
          return;
        }

        visited.add(neighborId);
        queue.push({ nodeId: neighborId, depth: current.depth + 1 });
      });
    }

    return results;
  }

  dfs(startNodeId: string, options?: TraversalOptions): GraphNode[] {
    this.assertNodeExists(startNodeId);
    const relationFilter = options?.relationTypes ? new Set(options.relationTypes) : undefined;
    const nodeTypeFilter = options?.nodeTypes ? new Set(options.nodeTypes) : undefined;
    const direction = options?.direction ?? 'outbound';
    const maxDepth = options?.maxDepth ?? Infinity;

    const visited = new Set<string>();
    const results: GraphNode[] = [];

    const traverse = (nodeId: string, depth: number) => {
      visited.add(nodeId);

      if (depth > 0) {
        const node = this.graph.nodes.get(nodeId)!;
        if (!nodeTypeFilter || nodeTypeFilter.has(node.nodeType)) {
          results.push(node);
        }
      }

      if (depth >= maxDepth) {
        return;
      }

      const edges = this.collectEdges(nodeId, direction);
      edges.forEach((edge) => {
        if (relationFilter && !relationFilter.has(edge.relationType)) {
          return;
        }

        const neighborId = this.resolveNeighborId(edge, nodeId);
        if (!neighborId || visited.has(neighborId)) {
          return;
        }

        traverse(neighborId, depth + 1);
      });
    };

    traverse(startNodeId, 0);
    return results;
  }

  findPath(startNodeId: string, targetNodeId: string, options?: NeighborQueryOptions): PathResult | null {
    this.assertNodeExists(startNodeId);
    this.assertNodeExists(targetNodeId);

    const direction = options?.direction ?? 'outbound';
    const relationFilter = options?.relationTypes ? new Set(options.relationTypes) : undefined;

    const queue: string[] = [startNodeId];
    const parent = new Map<string, { nodeId: string; edge: GraphEdge }>();
    const visited = new Set<string>([startNodeId]);

    while (queue.length) {
      const currentId = queue.shift()!;
      if (currentId === targetNodeId) {
        return this.reconstructPath(targetNodeId, parent);
      }

      const edges = this.collectEdges(currentId, direction);
      edges.forEach((edge) => {
        if (relationFilter && !relationFilter.has(edge.relationType)) {
          return;
        }

        const neighborId = this.resolveNeighborId(edge, currentId);
        if (!neighborId || visited.has(neighborId)) {
          return;
        }

        visited.add(neighborId);
        parent.set(neighborId, { nodeId: currentId, edge });
        queue.push(neighborId);
      });
    }

    return null;
  }

  getPrivilegeSubgraph(privilegeNodeId: string): GraphData {
    const node = this.graph.nodes.get(privilegeNodeId);
    if (!node) {
      throw new Error(`Privilege node ${privilegeNodeId} not found`);
    }
    if (node.nodeType !== 'PRIVILEGE') {
      throw new Error(`Node ${privilegeNodeId} is not a privilege`);
    }

    const allowedRelations: GraphRelationType[] = ['DEPENDS_ON', 'BELONGS_TO', 'VERIFIED_BY', 'ISSUED_BY'];
    const nodeIds = this.collectSubgraph(privilegeNodeId, allowedRelations, 3);
    return this.buildSubgraph(nodeIds);
  }

  getCredentialSubgraph(nodeId: string): GraphData {
    const node = this.graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Credential node ${nodeId} not found`);
    }

    const allowedTypes: GraphNodeType[] = ['LICENSE', 'DEA', 'PECOS', 'MEDICAID', 'VC'];
    if (!allowedTypes.includes(node.nodeType)) {
      throw new Error(`Node ${nodeId} is not a credential-bearing node`);
    }

    const allowedRelations: GraphRelationType[] = ['HAS_LICENSE', 'VERIFIED_BY', 'ISSUED_BY', 'BELONGS_TO', 'DEPENDS_ON', 'ELIGIBLE_IN'];
    const nodeIds = this.collectSubgraph(nodeId, allowedRelations, 3);
    return this.buildSubgraph(nodeIds);
  }

  getEnrollmentSubgraph(payerNodeId: string): GraphData {
    const node = this.graph.nodes.get(payerNodeId);
    if (!node) {
      throw new Error(`Payer node ${payerNodeId} not found`);
    }
    if (node.nodeType !== 'PAYER') {
      throw new Error(`Node ${payerNodeId} is not a payer`);
    }

    const allowedRelations: GraphRelationType[] = ['DEPENDS_ON', 'BELONGS_TO', 'IN_CONFLICT_WITH'];
    const nodeIds = this.collectSubgraph(payerNodeId, allowedRelations, 3);
    return this.buildSubgraph(nodeIds);
  }

  private collectEdges(nodeId: string, direction: Direction): GraphEdge[] {
    if (direction === 'outbound') {
      return this.adjacency.get(nodeId) ?? [];
    }
    if (direction === 'inbound') {
      return this.inboundAdjacency.get(nodeId) ?? [];
    }
    return [...(this.adjacency.get(nodeId) ?? []), ...(this.inboundAdjacency.get(nodeId) ?? [])];
  }

  private resolveNeighborId(edge: GraphEdge, originId: string): string | undefined {
    if (edge.sourceNodeId === originId) {
      return edge.targetNodeId;
    }
    if (edge.targetNodeId === originId) {
      return edge.sourceNodeId;
    }
    return undefined;
  }

  private collectSubgraph(rootId: string, allowedRelations: GraphRelationType[], maxDepth: number): Set<string> {
    const relationFilter = new Set<GraphRelationType>(allowedRelations);
    const visited = new Set<string>([rootId]);
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: rootId, depth: 0 }];

    while (queue.length) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) {
        continue;
      }

      const edges = this.collectEdges(current.nodeId, 'both');
      edges.forEach((edge) => {
        if (!relationFilter.has(edge.relationType)) {
          return;
        }
        const neighborId = this.resolveNeighborId(edge, current.nodeId);
        if (!neighborId || visited.has(neighborId)) {
          return;
        }

        visited.add(neighborId);
        queue.push({ nodeId: neighborId, depth: current.depth + 1 });
      });
    }

    return visited;
  }

  private buildSubgraph(nodeIds: Set<string>): GraphData {
    const nodes = new Map<string, GraphNode>();
    nodeIds.forEach((id) => {
      const node = this.graph.nodes.get(id);
      if (node) {
        nodes.set(id, node);
      }
    });

    const edges = this.graph.edges.filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
    );

    return { nodes, edges };
  }

  private reconstructPath(targetNodeId: string, parent: Map<string, { nodeId: string; edge: GraphEdge }>): PathResult {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    let currentId: string | undefined = targetNodeId;
    while (currentId) {
      const node = this.graph.nodes.get(currentId);
      if (node) {
        nodes.push(node);
      }
      const relationship = parent.get(currentId);
      if (!relationship) {
        break;
      }
      edges.push(relationship.edge);
      currentId = relationship.nodeId;
    }

    nodes.reverse();
    edges.reverse();

    return { nodes, edges };
  }

  private assertNodeExists(nodeId: string): void {
    if (!this.graph.nodes.has(nodeId)) {
      throw new Error(`Node ${nodeId} not found in graph`);
    }
  }
}

