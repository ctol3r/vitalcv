/**
 * Causal Graph Store
 *
 * In-memory store for causal graph with persistence hooks.
 * In production, this would be backed by a database or graph database.
 */

import type {
  CausalGraph,
  CausalNode,
  CausalEdge,
  CausalEventType,
} from '../types.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * In-memory causal graph store
 */
class CausalGraphStore {
  private graph: CausalGraph = {
    nodes: new Map(),
    edges: new Map(),
    adjacencyList: new Map(),
    reverseAdjacencyList: new Map(),
  };

  /**
   * Initialize graph from database or seed data
   */
  async initialize(): Promise<void> {
    // Load edges from database (if persisted)
    // For now, we'll use seed data
    this.initializeSeedEdges();
  }

  /**
   * Initialize seed causal relationships
   */
  private initializeSeedEdges(): void {
    // LICENSE_DRIFT → DECREASED_PECOS_TRUST
    this.addEdge({
      id: 'edge-1',
      sourceEventType: 'LICENSE_DRIFT' as CausalEventType,
      targetEventType: 'DECREASED_PECOS_TRUST' as CausalEventType,
      confidence: 0.85,
      strength: 0.8,
      delay: 7 * 24 * 60 * 60 * 1000, // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // DECREASED_PECOS_TRUST → ENROLLMENT_CONFLICT
    this.addEdge({
      id: 'edge-2',
      sourceEventType: 'DECREASED_PECOS_TRUST' as CausalEventType,
      targetEventType: 'ENROLLMENT_CONFLICT' as CausalEventType,
      confidence: 0.75,
      strength: 0.7,
      delay: 14 * 24 * 60 * 60 * 1000, // 14 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // ENROLLMENT_CONFLICT → RISK_SPIKE
    this.addEdge({
      id: 'edge-3',
      sourceEventType: 'ENROLLMENT_CONFLICT' as CausalEventType,
      targetEventType: 'RISK_SPIKE' as CausalEventType,
      confidence: 0.9,
      strength: 0.85,
      delay: 3 * 24 * 60 * 60 * 1000, // 3 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // RISK_SPIKE → SAFETY_HOLD
    this.addEdge({
      id: 'edge-4',
      sourceEventType: 'RISK_SPIKE' as CausalEventType,
      targetEventType: 'SAFETY_HOLD' as CausalEventType,
      confidence: 0.95,
      strength: 0.9,
      delay: 1 * 24 * 60 * 60 * 1000, // 1 day
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // OPPE_LOW → RISK_SPIKE
    this.addEdge({
      id: 'edge-5',
      sourceEventType: 'OPPE_LOW' as CausalEventType,
      targetEventType: 'RISK_SPIKE' as CausalEventType,
      confidence: 0.7,
      strength: 0.65,
      delay: 30 * 24 * 60 * 60 * 1000, // 30 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // LICENSE_EXPIRED → LICENSE_DRIFT
    this.addEdge({
      id: 'edge-6',
      sourceEventType: 'LICENSE_EXPIRED' as CausalEventType,
      targetEventType: 'LICENSE_DRIFT' as CausalEventType,
      confidence: 0.95,
      strength: 0.9,
      delay: 0, // Immediate
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // LICENSE_RENEWED → INCREASED_PECOS_TRUST
    this.addEdge({
      id: 'edge-7',
      sourceEventType: 'LICENSE_RENEWED' as CausalEventType,
      targetEventType: 'INCREASED_PECOS_TRUST' as CausalEventType,
      confidence: 0.8,
      strength: 0.75,
      delay: 7 * 24 * 60 * 60 * 1000, // 7 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // OPPE_IMPROVED → RISK_DECREASE
    this.addEdge({
      id: 'edge-8',
      sourceEventType: 'OPPE_IMPROVED' as CausalEventType,
      targetEventType: 'RISK_DECREASE' as CausalEventType,
      confidence: 0.75,
      strength: 0.7,
      delay: 30 * 24 * 60 * 60 * 1000, // 30 days
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: CausalEdge): void {
    this.graph.edges.set(edge.id, edge);

    // Update adjacency lists
    const source = edge.sourceEventType;
    const target = edge.targetEventType;

    if (!this.graph.adjacencyList.has(source)) {
      this.graph.adjacencyList.set(source, []);
    }
    if (!this.graph.reverseAdjacencyList.has(target)) {
      this.graph.reverseAdjacencyList.set(target, []);
    }

    this.graph.adjacencyList.get(source)!.push(target);
    this.graph.reverseAdjacencyList.get(target)!.push(source);
  }

  /**
   * Add a node to the graph
   */
  addNode(node: CausalNode): void {
    this.graph.nodes.set(node.id, node);
  }

  /**
   * Get all nodes of a specific event type
   */
  getNodesByEventType(eventType: CausalEventType): CausalNode[] {
    return Array.from(this.graph.nodes.values()).filter(
      (node) => node.eventType === eventType
    );
  }

  /**
   * Get all edges from a source event type
   */
  getEdgesFrom(sourceEventType: CausalEventType): CausalEdge[] {
    return Array.from(this.graph.edges.values()).filter(
      (edge) => edge.sourceEventType === sourceEventType
    );
  }

  /**
   * Get all edges to a target event type
   */
  getEdgesTo(targetEventType: CausalEventType): CausalEdge[] {
    return Array.from(this.graph.edges.values()).filter(
      (edge) => edge.targetEventType === targetEventType
    );
  }

  /**
   * Get the full graph
   */
  getGraph(): CausalGraph {
    return this.graph;
  }

  /**
   * Get successors of an event type (events that can be caused by this event)
   */
  getSuccessors(eventType: CausalEventType): CausalEventType[] {
    return this.graph.adjacencyList.get(eventType) || [];
  }

  /**
   * Get predecessors of an event type (events that can cause this event)
   */
  getPredecessors(eventType: CausalEventType): CausalEventType[] {
    return this.graph.reverseAdjacencyList.get(eventType) || [];
  }
}

// Singleton instance
let storeInstance: CausalGraphStore | null = null;

export function getCausalGraphStore(): CausalGraphStore {
  if (!storeInstance) {
    storeInstance = new CausalGraphStore();
    storeInstance.initialize();
  }
  return storeInstance;
}

