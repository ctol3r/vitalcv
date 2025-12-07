/**
 * RootCauseDetector
 *
 * Given a target event, backtracks through the causal graph to find
 * root causes with confidence scores.
 *
 * Algorithm:
 * 1. Start from target event
 * 2. Backtrack through reverse edges (predecessors)
 * 3. Calculate confidence scores along paths
 * 4. Rank root causes by total impact
 */

import type {
  CausalEventType,
  CausalNode,
  CausalEdge,
  CausalPath,
  RootCause,
} from './types.js';
import { getCausalGraphStore } from './models/causalGraphStore.js';

export interface RootCauseDetectionOptions {
  maxDepth?: number; // Maximum depth to backtrack (default: 5)
  minConfidence?: number; // Minimum confidence threshold (default: 0.3)
  maxPathsPerRoot?: number; // Maximum paths to consider per root cause (default: 10)
}

export interface RootCauseDetectionResult {
  targetEvent: CausalEventType;
  rootCauses: RootCause[];
  totalPathsExplored: number;
  detectionTime: number;
}

/**
 * Detect root causes for a target event
 */
export async function detectRootCauses(
  targetEventType: CausalEventType,
  options: RootCauseDetectionOptions = {}
): Promise<RootCauseDetectionResult> {
  const startTime = Date.now();
  const {
    maxDepth = 5,
    minConfidence = 0.3,
    maxPathsPerRoot = 10,
  } = options;

  const store = getCausalGraphStore();
  const graph = store.getGraph();

  // Find all nodes of the target event type
  const targetNodes = store.getNodesByEventType(targetEventType);

  if (targetNodes.length === 0) {
    // No instances of this event type, but we can still analyze the graph structure
    return {
      targetEvent: targetEventType,
      rootCauses: [],
      totalPathsExplored: 0,
      detectionTime: Date.now() - startTime,
    };
  }

  // For each target node, find root causes
  const rootCauseMap = new Map<string, RootCause>();
  let totalPathsExplored = 0;

  for (const targetNode of targetNodes) {
    const paths = backtrackToRoots(
      targetNode,
      graph,
      maxDepth,
      minConfidence,
      maxPathsPerRoot
    );

    totalPathsExplored += paths.length;

    // Group paths by root cause
    for (const path of paths) {
      if (path.nodes.length === 0) continue;

      const rootNode = path.nodes[0];
      const rootKey = `${rootNode.eventType}:${rootNode.id}`;

      if (!rootCauseMap.has(rootKey)) {
        rootCauseMap.set(rootKey, {
          eventType: rootNode.eventType,
          nodeId: rootNode.id,
          confidence: 0,
          paths: [],
          totalImpact: 0,
          metadata: {
            rootNodeTimestamp: rootNode.timestamp,
            rootNodeSeverity: rootNode.severity,
          },
        });
      }

      const rootCause = rootCauseMap.get(rootKey)!;
      rootCause.paths.push(path);
      rootCause.totalImpact += path.totalConfidence;
    }
  }

  // Calculate confidence scores and sort
  const rootCauses = Array.from(rootCauseMap.values())
    .map((rc) => ({
      ...rc,
      confidence: Math.min(1.0, rc.totalImpact / Math.max(1, rc.paths.length)),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    targetEvent: targetEventType,
    rootCauses,
    totalPathsExplored,
    detectionTime: Date.now() - startTime,
  };
}

/**
 * Backtrack from a target node to find all root causes
 */
function backtrackToRoots(
  targetNode: CausalNode,
  graph: any,
  maxDepth: number,
  minConfidence: number,
  maxPathsPerRoot: number
): CausalPath[] {
  const store = getCausalGraphStore();
  const paths: CausalPath[] = [];
  const visited = new Set<string>();

  function dfs(
    currentNode: CausalNode,
    currentPath: CausalNode[],
    currentEdges: CausalEdge[],
    currentConfidence: number,
    depth: number
  ): void {
    if (depth > maxDepth) return;
    if (currentConfidence < minConfidence) return;

    const pathKey = currentPath.map((n) => n.id).join('->');
    if (visited.has(pathKey)) return;
    visited.add(pathKey);

    // Check if this is a root cause (no incoming edges)
    const predecessors = store.getPredecessors(currentNode.eventType);
    const incomingEdges = store.getEdgesTo(currentNode.eventType);

    if (predecessors.length === 0 || incomingEdges.length === 0) {
      // This is a root cause
      paths.push({
        nodes: [...currentPath, currentNode],
        edges: currentEdges,
        totalConfidence: currentConfidence,
        pathLength: currentPath.length + 1,
        estimatedDelay: currentEdges.reduce((sum, e) => sum + e.delay, 0),
      });
      return;
    }

    // Continue backtracking through predecessors
    for (const edge of incomingEdges) {
      const predecessorEventType = edge.sourceEventType;
      const predecessorNodes = store.getNodesByEventType(predecessorEventType);

      // Consider nodes that occurred before the current node
      const validPredecessors = predecessorNodes.filter(
        (n) => n.timestamp <= currentNode.timestamp && !n.resolved
      );

      for (const predecessorNode of validPredecessors) {
        const newConfidence = currentConfidence * edge.confidence;
        const newPath = [...currentPath, currentNode];
        const newEdges = [...currentEdges, edge];

        dfs(
          predecessorNode,
          newPath,
          newEdges,
          newConfidence,
          depth + 1
        );
      }
    }
  }

  // Start backtracking from target node
  dfs(targetNode, [], [], 1.0, 0);

  // Limit paths per root cause
  const pathsByRoot = new Map<string, CausalPath[]>();
  for (const path of paths) {
    if (path.nodes.length === 0) continue;
    const rootNode = path.nodes[0];
    const rootKey = `${rootNode.eventType}:${rootNode.id}`;

    if (!pathsByRoot.has(rootKey)) {
      pathsByRoot.set(rootKey, []);
    }
    pathsByRoot.get(rootKey)!.push(path);
  }

  // Sort paths by confidence and take top N per root
  const limitedPaths: CausalPath[] = [];
  for (const [_, rootPaths] of pathsByRoot.entries()) {
    const sorted = rootPaths.sort((a, b) => b.totalConfidence - a.totalConfidence);
    limitedPaths.push(...sorted.slice(0, maxPathsPerRoot));
  }

  return limitedPaths;
}

/**
 * Get root causes for a specific target event type (simplified API)
 */
export async function getRootCauses(
  targetEventType: CausalEventType,
  options?: RootCauseDetectionOptions
): Promise<RootCause[]> {
  const result = await detectRootCauses(targetEventType, options);
  return result.rootCauses;
}

