/**
 * Causal Graph Service
 *
 * Barrel export for causal graph functionality:
 * - CausalNode, CausalEdge: Core graph models
 * - buildGraph: Build causal graphs from events
 * - rootCauseDetector: Find root causes for target events
 * - whatIfSimulator: Simulate remediation scenarios
 */

// Core types and models
export type { CausalNode, CreateCausalNodeInput } from './models/CausalNode.js';
export type { CausalEdge, CreateCausalEdgeInput } from './models/CausalEdge.js';
export * from './types.js';

// Graph building
export { buildCausalGraph as buildGraph, CausalGraphBuilder } from './buildGraph.js';
export type { GraphBuildResult, EventSource } from './buildGraph.js';

// Root cause detection
export { detectRootCauses, getRootCauses } from './rootCauseDetector.js';
export * from './rootCauseDetector.js';

// What-if simulation
export {
  simulateWhatIf,
  simulateMultipleScenarios,
  compareWhatIfResults,
} from './whatIfSimulator.js';
export * from './whatIfSimulator.js';

// Path explanation
export { explainPath, explainPathsToTarget, generateNarrativeExplanation } from './pathExplainer.js';
export * from './pathExplainer.js';

// Graph store
export { getCausalGraphStore, CausalGraphStore } from './models/causalGraphStore.js';
export * from './models/causalGraphStore.js';
