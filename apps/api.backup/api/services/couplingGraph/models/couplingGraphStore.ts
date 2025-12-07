/**
 * Coupling Graph Store
 *
 * In-memory store for coupling graph with persistence hooks.
 */

import type {
  CouplingGraph,
  CouplingNode,
  CouplingEdge,
} from '../types.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * In-memory coupling graph store
 */
class CouplingGraphStore {
  private graph: CouplingGraph = {
    nodes: new Map(),
    edges: new Map(),
    adjacencyList: new Map(),
    reverseAdjacencyList: new Map(),
  };

  /**
   * Initialize graph from database
   */
  async initialize(): Promise<void> {
    // Load nodes and edges from database
    await this.loadFromDatabase();
  }

  /**
   * Load graph from database
   */
  private async loadFromDatabase(): Promise<void> {
    // Load privilege nodes as coupling nodes
    try {
      const privileges = await prisma.privilegeNode.findMany({
        take: 1000,
      });

      for (const privilege of privileges) {
        const node: CouplingNode = {
          id: `privilege-${privilege.id}`,
          type: 'privilege',
          name: privilege.name,
          metadata: {
            category: privilege.category,
            specialty: privilege.specialty,
            privilegeCode: privilege.privilegeCode,
          },
        };
        this.addNode(node);
      }

      // Load privilege dependencies as coupling edges
      const dependencies = await prisma.privilegeDependency.findMany({
        take: 1000,
        include: {
          parentPrivilege: true,
          childPrivilege: true,
        },
      });

      for (const dep of dependencies) {
        const edge: CouplingEdge = {
          id: `edge-${dep.id}`,
          sourceNodeId: `privilege-${dep.parentPrivilegeId}`,
          targetNodeId: `privilege-${dep.childPrivilegeId}`,
          impactWeight: this.mapDependencyTypeToWeight(dep.type),
          relationshipType: this.mapDependencyTypeToRelationship(dep.type),
          metadata: {
            dependencyType: dep.type,
          },
        };
        this.addEdge(edge);
      }
    } catch (error) {
      console.warn('Error loading coupling graph from database', error);
    }
  }

  /**
   * Map dependency type to impact weight
   */
  private mapDependencyTypeToWeight(type: string): number {
    const mapping: Record<string, number> = {
      REQUIRES: 0.9,
      ENHANCES: 0.6,
      CONFLICTS_WITH: 0.8,
      MUTUALLY_EXCLUSIVE: 0.95,
    };
    return mapping[type] || 0.5;
  }

  /**
   * Map dependency type to relationship type
   */
  private mapDependencyTypeToRelationship(type: string): CouplingEdge['relationshipType'] {
    const mapping: Record<string, CouplingEdge['relationshipType']> = {
      REQUIRES: 'REQUIRES',
      ENHANCES: 'AFFECTS',
      CONFLICTS_WITH: 'BLOCKS',
      MUTUALLY_EXCLUSIVE: 'BLOCKS',
    };
    return mapping[type] || 'AFFECTS';
  }

  /**
   * Add a node to the graph
   */
  addNode(node: CouplingNode): void {
    this.graph.nodes.set(node.id, node);
    if (!this.graph.adjacencyList.has(node.id)) {
      this.graph.adjacencyList.set(node.id, []);
    }
    if (!this.graph.reverseAdjacencyList.has(node.id)) {
      this.graph.reverseAdjacencyList.set(node.id, []);
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: CouplingEdge): void {
    this.graph.edges.set(edge.id, edge);

    // Update adjacency lists
    const sourceAdj = this.graph.adjacencyList.get(edge.sourceNodeId) || [];
    if (!sourceAdj.includes(edge.id)) {
      sourceAdj.push(edge.id);
      this.graph.adjacencyList.set(edge.sourceNodeId, sourceAdj);
    }

    const targetRevAdj = this.graph.reverseAdjacencyList.get(edge.targetNodeId) || [];
    if (!targetRevAdj.includes(edge.id)) {
      targetRevAdj.push(edge.id);
      this.graph.reverseAdjacencyList.set(edge.targetNodeId, targetRevAdj);
    }
  }

  /**
   * Get the graph
   */
  getGraph(): CouplingGraph {
    return this.graph;
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): CouplingNode | undefined {
    return this.graph.nodes.get(nodeId);
  }

  /**
   * Get edge by ID
   */
  getEdge(edgeId: string): CouplingEdge | undefined {
    return this.graph.edges.get(edgeId);
  }

  /**
   * Get outgoing edges for a node
   */
  getOutgoingEdges(nodeId: string): CouplingEdge[] {
    const edgeIds = this.graph.adjacencyList.get(nodeId) || [];
    return edgeIds
      .map((id) => this.graph.edges.get(id))
      .filter((e): e is CouplingEdge => e !== undefined);
  }

  /**
   * Get incoming edges for a node
   */
  getIncomingEdges(nodeId: string): CouplingEdge[] {
    const edgeIds = this.graph.reverseAdjacencyList.get(nodeId) || [];
    return edgeIds
      .map((id) => this.graph.edges.get(id))
      .filter((e): e is CouplingEdge => e !== undefined);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): CouplingNode[] {
    return Array.from(this.graph.nodes.values());
  }

  /**
   * Get all edges
   */
  getAllEdges(): CouplingEdge[] {
    return Array.from(this.graph.edges.values());
  }
}

let storeInstance: CouplingGraphStore | null = null;

/**
 * Get the singleton coupling graph store
 */
export function getCouplingGraphStore(): CouplingGraphStore {
  if (!storeInstance) {
    storeInstance = new CouplingGraphStore();
  }
  return storeInstance;
}

