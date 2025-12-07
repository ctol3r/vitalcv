/**
 * B228A-LIN-003: DataProvenanceService
 *
 * Provides APIs to query lineage for a given record (forward/backward).
 * Generates provenance graphs. Supports federated queries across multiple chains/networks.
 */

import { PrismaClient } from '@prisma/client';
import { DataLineageService } from './models/DataLineage';
import { OperationType } from '@prisma/client';

const prisma = new PrismaClient();
const lineageService = new DataLineageService(prisma);

export interface ProvenanceNode {
  recordId: string;
  system: string;
  timestamp: Date;
  operationType: OperationType;
  metadata?: Record<string, unknown> | null;
}

export interface ProvenanceEdge {
  sourceId: string;
  targetId: string;
  transformationId?: string | null;
  timestamp: Date;
  operationType: OperationType;
}

export interface ProvenanceGraph {
  nodes: ProvenanceNode[];
  edges: ProvenanceEdge[];
}

export interface LineageQueryOptions {
  recordId: string;
  direction?: 'forward' | 'backward' | 'both';
  maxDepth?: number;
  includeMetadata?: boolean;
  chainId?: string;
  network?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * DataProvenanceService for querying and visualizing data lineage
 */
export class DataProvenanceService {
  constructor(private lineageService: DataLineageService) {}

  /**
   * Get lineage for a record (forward, backward, or both)
   */
  async getLineage(options: LineageQueryOptions): Promise<ProvenanceGraph> {
    const { recordId, direction = 'both', maxDepth = 10 } = options;

    const nodes = new Map<string, ProvenanceNode>();
    const edges: ProvenanceEdge[] = [];

    if (direction === 'forward' || direction === 'both') {
      await this.traverseForward(recordId, nodes, edges, maxDepth, options);
    }

    if (direction === 'backward' || direction === 'both') {
      await this.traverseBackward(recordId, nodes, edges, maxDepth, options);
    }

    // Add the root node if not already present
    if (!nodes.has(recordId)) {
      // Try to find the root node from lineage entries
      const backwardLineage = await this.lineageService.getBackwardLineage(recordId, 1);
      const forwardLineage = await this.lineageService.getForwardLineage(recordId, 1);

      if (backwardLineage.length > 0) {
        const entry = backwardLineage[0];
        nodes.set(recordId, {
          recordId,
          system: entry.sourceSystem,
          timestamp: entry.timestamp,
          operationType: entry.operationType,
          metadata: options.includeMetadata ? entry.metadata : undefined,
        });
      } else if (forwardLineage.length > 0) {
        const entry = forwardLineage[0];
        nodes.set(recordId, {
          recordId,
          system: entry.sourceSystem,
          timestamp: entry.timestamp,
          operationType: entry.operationType,
          metadata: options.includeMetadata ? entry.metadata : undefined,
        });
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }

  /**
   * Traverse forward lineage (what was created from this record)
   */
  private async traverseForward(
    recordId: string,
    nodes: Map<string, ProvenanceNode>,
    edges: ProvenanceEdge[],
    maxDepth: number,
    options: LineageQueryOptions,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    const lineage = await this.lineageService.getForwardLineage(recordId, 100);

    for (const entry of lineage) {
      // Filter by chain/network if specified
      if (options.chainId && entry.metadata && (entry.metadata as any).chainId !== options.chainId) {
        continue;
      }
      if (options.network && entry.metadata && (entry.metadata as any).network !== options.network) {
        continue;
      }

      // Filter by date range if specified
      if (options.startDate && entry.timestamp < options.startDate) {
        continue;
      }
      if (options.endDate && entry.timestamp > options.endDate) {
        continue;
      }

      // Add target node
      if (!nodes.has(entry.targetRecordId)) {
        nodes.set(entry.targetRecordId, {
          recordId: entry.targetRecordId,
          system: entry.sourceSystem,
          timestamp: entry.timestamp,
          operationType: entry.operationType,
          metadata: options.includeMetadata ? entry.metadata : undefined,
        });
      }

      // Add edge
      edges.push({
        sourceId: entry.sourceRecordId,
        targetId: entry.targetRecordId,
        transformationId: entry.transformationId,
        timestamp: entry.timestamp,
        operationType: entry.operationType,
      });

      // Recursively traverse
      await this.traverseForward(
        entry.targetRecordId,
        nodes,
        edges,
        maxDepth,
        options,
        currentDepth + 1
      );
    }
  }

  /**
   * Traverse backward lineage (what created this record)
   */
  private async traverseBackward(
    recordId: string,
    nodes: Map<string, ProvenanceNode>,
    edges: ProvenanceEdge[],
    maxDepth: number,
    options: LineageQueryOptions,
    currentDepth = 0
  ): Promise<void> {
    if (currentDepth >= maxDepth) {
      return;
    }

    const lineage = await this.lineageService.getBackwardLineage(recordId, 100);

    for (const entry of lineage) {
      // Filter by chain/network if specified
      if (options.chainId && entry.metadata && (entry.metadata as any).chainId !== options.chainId) {
        continue;
      }
      if (options.network && entry.metadata && (entry.metadata as any).network !== options.network) {
        continue;
      }

      // Filter by date range if specified
      if (options.startDate && entry.timestamp < options.startDate) {
        continue;
      }
      if (options.endDate && entry.timestamp > options.endDate) {
        continue;
      }

      // Add source node
      if (!nodes.has(entry.sourceRecordId)) {
        nodes.set(entry.sourceRecordId, {
          recordId: entry.sourceRecordId,
          system: entry.sourceSystem,
          timestamp: entry.timestamp,
          operationType: entry.operationType,
          metadata: options.includeMetadata ? entry.metadata : undefined,
        });
      }

      // Add edge
      edges.push({
        sourceId: entry.sourceRecordId,
        targetId: entry.targetRecordId,
        transformationId: entry.transformationId,
        timestamp: entry.timestamp,
        operationType: entry.operationType,
      });

      // Recursively traverse
      await this.traverseBackward(
        entry.sourceRecordId,
        nodes,
        edges,
        maxDepth,
        options,
        currentDepth + 1
      );
    }
  }

  /**
   * Get forward lineage (what was created from this record)
   */
  async getForwardLineage(recordId: string, options?: {
    maxDepth?: number;
    chainId?: string;
    network?: string;
  }): Promise<ProvenanceGraph> {
    return this.getLineage({
      recordId,
      direction: 'forward',
      maxDepth: options?.maxDepth,
      chainId: options?.chainId,
      network: options?.network,
    });
  }

  /**
   * Get backward lineage (what created this record)
   */
  async getBackwardLineage(recordId: string, options?: {
    maxDepth?: number;
    chainId?: string;
    network?: string;
  }): Promise<ProvenanceGraph> {
    return this.getLineage({
      recordId,
      direction: 'backward',
      maxDepth: options?.maxDepth,
      chainId: options?.chainId,
      network: options?.network,
    });
  }

  /**
   * Get full lineage (both forward and backward)
   */
  async getFullLineage(recordId: string, options?: {
    maxDepth?: number;
    chainId?: string;
    network?: string;
    includeMetadata?: boolean;
  }): Promise<ProvenanceGraph> {
    return this.getLineage({
      recordId,
      direction: 'both',
      maxDepth: options?.maxDepth,
      chainId: options?.chainId,
      network: options?.network,
      includeMetadata: options?.includeMetadata,
    });
  }

  /**
   * Federated query across multiple chains/networks
   */
  async federatedQuery(
    recordId: string,
    chains?: string[],
    networks?: string[]
  ): Promise<ProvenanceGraph> {
    const allNodes = new Map<string, ProvenanceNode>();
    const allEdges: ProvenanceEdge[] = [];

    if (chains && chains.length > 0) {
      for (const chainId of chains) {
        const graph = await this.getFullLineage(recordId, { chainId });
        graph.nodes.forEach((node) => allNodes.set(node.recordId, node));
        allEdges.push(...graph.edges);
      }
    } else if (networks && networks.length > 0) {
      for (const network of networks) {
        const graph = await this.getFullLineage(recordId, { network });
        graph.nodes.forEach((node) => allNodes.set(node.recordId, node));
        allEdges.push(...graph.edges);
      }
    } else {
      // Query all chains/networks
      const graph = await this.getFullLineage(recordId);
      graph.nodes.forEach((node) => allNodes.set(node.recordId, node));
      allEdges.push(...graph.edges);
    }

    return {
      nodes: Array.from(allNodes.values()),
      edges: allEdges,
    };
  }
}

// Export singleton instance
export const provenanceService = new DataProvenanceService(lineageService);

