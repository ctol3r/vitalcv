/**
 * CausalPathExplainer
 *
 * Explains causal paths such as:
 * LICENSE_DRIFT → DECREASED_PECOS_TRUST → ENROLLMENT_CONFLICT → RISK_SPIKE → SAFETY_HOLD
 *
 * Provides human-readable explanations of how events lead to other events.
 */

import type {
  CausalEventType,
  CausalPath,
  CausalNode,
  CausalEdge,
} from './types.js';
import { getCausalGraphStore } from './models/causalGraphStore.js';
import { detectRootCauses } from './rootCauseDetector.js';

export interface PathExplanation {
  path: CausalPath;
  explanation: string;
  humanReadableSteps: string[];
  confidence: number;
  estimatedTimeToEffect: number; // milliseconds
}

export interface PathExplanationOptions {
  includeMetadata?: boolean;
  maxPaths?: number;
  minConfidence?: number;
}

/**
 * Explain a causal path from root cause to target event
 */
export async function explainPath(
  fromEventType: CausalEventType,
  toEventType: CausalEventType,
  options: PathExplanationOptions = {}
): Promise<PathExplanation[]> {
  const { maxPaths = 5, minConfidence = 0.3 } = options;

  const store = getCausalGraphStore();

  // Find paths from source to target using BFS
  const paths = findPathsBetween(
    fromEventType,
    toEventType,
    store,
    maxPaths,
    minConfidence
  );

  return paths.map((path) => explainSinglePath(path, store));
}

/**
 * Explain all paths leading to a target event
 */
export async function explainPathsToTarget(
  targetEventType: CausalEventType,
  options: PathExplanationOptions = {}
): Promise<PathExplanation[]> {
  const rootCauseResult = await detectRootCauses(targetEventType, {
    maxPathsPerRoot: options.maxPaths || 5,
    minConfidence: options.minConfidence || 0.3,
  });

  const allPaths: CausalPath[] = [];
  for (const rootCause of rootCauseResult.rootCauses) {
    allPaths.push(...rootCause.paths);
  }

  // Sort by confidence and take top N
  const sortedPaths = allPaths
    .sort((a, b) => b.totalConfidence - a.totalConfidence)
    .slice(0, options.maxPaths || 10);

  const store = getCausalGraphStore();
  return sortedPaths.map((path) => explainSinglePath(path, store));
}

/**
 * Find paths between two event types
 */
function findPathsBetween(
  fromEventType: CausalEventType,
  toEventType: CausalEventType,
  store: ReturnType<typeof getCausalGraphStore>,
  maxPaths: number,
  minConfidence: number
): CausalPath[] {
  const paths: CausalPath[] = [];
  const queue: Array<{
    node: CausalNode;
    path: CausalNode[];
    edges: CausalEdge[];
    confidence: number;
  }> = [];

  // Start with all nodes of the source event type
  const sourceNodes = store.getNodesByEventType(fromEventType);
  for (const node of sourceNodes) {
    queue.push({
      node,
      path: [node],
      edges: [],
      confidence: 1.0,
    });
  }

  const visited = new Set<string>();

  while (queue.length > 0 && paths.length < maxPaths) {
    const current = queue.shift()!;
    const pathKey = current.path.map((n) => n.id).join('->');

    if (visited.has(pathKey)) continue;
    visited.add(pathKey);

    // Check if we've reached the target
    if (current.node.eventType === toEventType) {
      paths.push({
        nodes: current.path,
        edges: current.edges,
        totalConfidence: current.confidence,
        pathLength: current.path.length,
        estimatedDelay: current.edges.reduce((sum, e) => sum + e.delay, 0),
      });
      continue;
    }

    // Explore successors
    const successors = store.getSuccessors(current.node.eventType);
    const outgoingEdges = store.getEdgesFrom(current.node.eventType);

    for (const edge of outgoingEdges) {
      if (edge.targetEventType !== toEventType && !successors.includes(edge.targetEventType)) {
        continue;
      }

      const newConfidence = current.confidence * edge.confidence;
      if (newConfidence < minConfidence) continue;

      const targetNodes = store.getNodesByEventType(edge.targetEventType);

      // Consider nodes that occurred after the current node
      const validTargets = targetNodes.filter(
        (n) => n.timestamp >= current.node.timestamp && !n.resolved
      );

      for (const targetNode of validTargets) {
        // Avoid cycles
        if (current.path.some((n) => n.id === targetNode.id)) continue;

        queue.push({
          node: targetNode,
          path: [...current.path, targetNode],
          edges: [...current.edges, edge],
          confidence: newConfidence,
        });
      }
    }
  }

  return paths.sort((a, b) => b.totalConfidence - a.totalConfidence);
}

/**
 * Explain a single causal path
 */
function explainSinglePath(
  path: CausalPath,
  store: ReturnType<typeof getCausalGraphStore>
): PathExplanation {
  const steps: string[] = [];
  let currentExplanation = '';

  for (let i = 0; i < path.nodes.length - 1; i++) {
    const currentNode = path.nodes[i];
    const nextNode = path.nodes[i + 1];
    const edge = path.edges[i];

    const step = formatStep(currentNode, nextNode, edge);
    steps.push(step);
  }

  // Build overall explanation
  if (path.nodes.length > 0) {
    const rootEvent = path.nodes[0];
    const targetEvent = path.nodes[path.nodes.length - 1];

    currentExplanation = `The event "${formatEventName(rootEvent.eventType)}" `;
    currentExplanation += `led to "${formatEventName(targetEvent.eventType)}" `;
    currentExplanation += `through ${path.pathLength - 1} intermediate step(s) `;
    currentExplanation += `with ${(path.totalConfidence * 100).toFixed(1)}% confidence.`;
  }

  return {
    path,
    explanation: currentExplanation,
    humanReadableSteps: steps,
    confidence: path.totalConfidence,
    estimatedTimeToEffect: path.estimatedDelay,
  };
}

/**
 * Format a single step in the causal chain
 */
function formatStep(
  from: CausalNode,
  to: CausalNode,
  edge: CausalEdge
): string {
  const fromName = formatEventName(from.eventType);
  const toName = formatEventName(to.eventType);
  const confidence = (edge.confidence * 100).toFixed(0);
  const delayDays = Math.round(edge.delay / (24 * 60 * 60 * 1000));

  return `${fromName} → ${toName} (${confidence}% confidence, ~${delayDays} days)`;
}

/**
 * Format event type name for human readability
 */
function formatEventName(eventType: CausalEventType): string {
  return eventType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generate a narrative explanation of a path
 * Example: "License drift occurred, which decreased PECOS trust after 7 days.
 *           This led to enrollment conflicts after 14 more days, which caused
 *           a risk spike after 3 days, ultimately resulting in a safety hold after 1 day."
 */
export function generateNarrativeExplanation(
  explanation: PathExplanation
): string {
  const parts: string[] = [];
  const steps = explanation.humanReadableSteps;

  if (steps.length === 0) {
    return explanation.explanation;
  }

  // Start with the root event
  const rootEvent = explanation.path.nodes[0];
  parts.push(`"${formatEventName(rootEvent.eventType)}" occurred`);

  // Add each step
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const edge = explanation.path.edges[i];
    const delayDays = Math.round(edge.delay / (24 * 60 * 60 * 1000));

    if (delayDays > 0) {
      parts.push(`which, after ${delayDays} day${delayDays > 1 ? 's' : ''},`);
    } else {
      parts.push('which immediately');
    }

    const targetEvent = explanation.path.nodes[i + 1];
    parts.push(`led to "${formatEventName(targetEvent.eventType)}"`);
  }

  parts.push(`with ${(explanation.confidence * 100).toFixed(1)}% overall confidence.`);

  return parts.join(' ');
}

