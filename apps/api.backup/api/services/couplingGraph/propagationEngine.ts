/**
 * B210B-COUP-006: PropagationEngine
 *
 * Given source event (e.g., privilege hold in anesthesia) → propagate impact through graph
 * via impactWeights; outputs rippleScore map.
 */

import type {
  SourceEvent,
  RippleScore,
  RippleScoreMap,
  CouplingNode,
  CouplingEdge,
} from './types.js';
import { getCouplingGraphStore } from './models/couplingGraphStore.js';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'propagation-engine' });

export interface PropagationOptions {
  maxDepth?: number; // Maximum propagation depth (default: 5)
  minImpactThreshold?: number; // Minimum impact to continue propagation (default: 0.01)
  decayFactor?: number; // Impact decay per hop (default: 0.8)
  includeCycles?: boolean; // Whether to allow cycles (default: false)
}

const DEFAULT_OPTIONS: Required<PropagationOptions> = {
  maxDepth: 5,
  minImpactThreshold: 0.01,
  decayFactor: 0.8,
  includeCycles: false,
};

/**
 * Propagate impact from a source event through the coupling graph
 */
export async function propagateImpact(
  sourceEvent: SourceEvent,
  options: PropagationOptions = {}
): Promise<RippleScoreMap> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const store = getCouplingGraphStore();
  await store.initialize();

  const graph = store.getGraph();
  const rippleScores = new Map<string, RippleScore>();
  const visited = new Set<string>();

  logger.info('Starting impact propagation', {
    sourceNodeId: sourceEvent.nodeId,
    eventType: sourceEvent.eventType,
    initialImpact: sourceEvent.initialImpact,
  });

  // Initialize source node
  const sourceNode = graph.nodes.get(sourceEvent.nodeId);
  if (!sourceNode) {
    logger.warn('Source node not found', { nodeId: sourceEvent.nodeId });
    return rippleScores;
  }

  // Start propagation from source
  rippleScores.set(sourceEvent.nodeId, {
    nodeId: sourceEvent.nodeId,
    score: sourceEvent.initialImpact,
    propagationDepth: 0,
    paths: [
      {
        sourceNodeId: sourceEvent.nodeId,
        edgeIds: [],
        totalWeight: sourceEvent.initialImpact,
      },
    ],
  });

  // BFS propagation
  const queue: Array<{
    nodeId: string;
    currentImpact: number;
    depth: number;
    path: string[];
  }> = [
    {
      nodeId: sourceEvent.nodeId,
      currentImpact: sourceEvent.initialImpact,
      depth: 0,
      path: [sourceEvent.nodeId],
    },
  ];

  while (queue.length > 0) {
    const { nodeId, currentImpact, depth, path } = queue.shift()!;

    if (depth >= opts.maxDepth) continue;
    if (currentImpact < opts.minImpactThreshold) continue;

    // Get outgoing edges
    const outgoingEdges = store.getOutgoingEdges(nodeId);

    for (const edge of outgoingEdges) {
      const targetNodeId = edge.targetNodeId;

      // Skip if already visited in this path (unless cycles allowed)
      if (!opts.includeCycles && path.includes(targetNodeId)) {
        continue;
      }

      // Calculate propagated impact
      const edgeImpact = currentImpact * edge.impactWeight * Math.pow(opts.decayFactor, depth);

      if (edgeImpact < opts.minImpactThreshold) {
        continue;
      }

      // Update ripple score for target node
      const existingScore = rippleScores.get(targetNodeId);
      const newPath = {
        sourceNodeId: sourceEvent.nodeId,
        edgeIds: [...path.slice(1).map((n, i) => {
          // Find edge between path[i] and path[i+1]
          if (i === path.length - 2) {
            // Last edge in path
            return edge.id;
          }
          const source = path[i];
          const target = path[i + 1];
          const edges = store.getOutgoingEdges(source);
          return edges.find((e) => e.targetNodeId === target)?.id || '';
        }), edge.id].filter(Boolean),
        totalWeight: edgeImpact,
      };

      if (existingScore) {
        // Accumulate impact
        existingScore.score = Math.min(1.0, existingScore.score + edgeImpact);
        existingScore.paths.push(newPath);
        if (depth + 1 > existingScore.propagationDepth) {
          existingScore.propagationDepth = depth + 1;
        }
      } else {
        rippleScores.set(targetNodeId, {
          nodeId: targetNodeId,
          score: edgeImpact,
          propagationDepth: depth + 1,
          paths: [newPath],
        });
      }

      // Add to queue for further propagation
      queue.push({
        nodeId: targetNodeId,
        currentImpact: edgeImpact,
        depth: depth + 1,
        path: [...path, targetNodeId],
      });
    }
  }

  logger.info('Impact propagation completed', {
    sourceNodeId: sourceEvent.nodeId,
    affectedNodes: rippleScores.size,
    maxDepth: Math.max(...Array.from(rippleScores.values()).map((r) => r.propagationDepth)),
  });

  return rippleScores;
}

/**
 * Propagate impact from multiple source events
 */
export async function propagateMultipleImpacts(
  sourceEvents: SourceEvent[],
  options: PropagationOptions = {}
): Promise<RippleScoreMap> {
  const combinedScores = new Map<string, RippleScore>();

  for (const event of sourceEvents) {
    const scores = await propagateImpact(event, options);

    // Merge scores
    for (const [nodeId, score] of scores.entries()) {
      const existing = combinedScores.get(nodeId);
      if (existing) {
        existing.score = Math.min(1.0, existing.score + score.score);
        existing.paths.push(...score.paths);
        if (score.propagationDepth > existing.propagationDepth) {
          existing.propagationDepth = score.propagationDepth;
        }
      } else {
        combinedScores.set(nodeId, { ...score });
      }
    }
  }

  return combinedScores;
}

/**
 * Get top N nodes by ripple score
 */
export function getTopRippleNodes(
  rippleScores: RippleScoreMap,
  topN: number = 10
): Array<{ nodeId: string; score: RippleScore }> {
  return Array.from(rippleScores.entries())
    .map(([nodeId, score]) => ({ nodeId, score }))
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, topN);
}

