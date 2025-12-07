/**
 * B214B-TYPE-007: CausalGraph DomainModuleContract
 *
 * Defines the capability signatures for the causalGraph domain module.
 * These contracts define the public API for root cause analysis, ripple effect simulation,
 * and causal path computation.
 */

import type { CausalEventType, RootCause, WhatIfResult, CausalPath } from './types.js';

/**
 * Options for root cause analysis
 */
export interface AnalyzeRootCauseOptions {
  maxDepth?: number; // Maximum depth to backtrack (default: 5)
  minConfidence?: number; // Minimum confidence threshold (default: 0.3)
  maxPathsPerRoot?: number; // Maximum paths to consider per root cause (default: 10)
}

/**
 * Result of root cause analysis
 */
export interface AnalyzeRootCauseResult {
  targetEvent: CausalEventType;
  rootCauses: RootCause[];
  totalPathsExplored: number;
  detectionTime: number;
}

/**
 * Options for ripple effect simulation
 */
export interface SimulateRippleOptions {
  maxDepth?: number; // How far to propagate effects (default: 3)
  timeHorizon?: number; // Milliseconds to look ahead (default: 90 days)
  includeIndirectEffects?: boolean; // Include indirect causal chains (default: true)
}

/**
 * Scenario for ripple simulation
 */
export interface RippleScenario {
  description: string;
  intervention: {
    eventType: CausalEventType;
    action: 'REMOVE' | 'ADD' | 'MODIFY';
    value?: unknown;
    entityId?: string;
    entityType?: string;
  };
  currentState?: {
    eventTypes: CausalEventType[];
    riskScore?: number;
  };
}

/**
 * Options for causal path computation
 */
export interface ComputeCausalPathOptions {
  includeMetadata?: boolean;
  maxPaths?: number;
  minConfidence?: number;
}

/**
 * Result of causal path computation
 */
export interface CausalPathResult {
  path: CausalPath;
  explanation: string;
  humanReadableSteps: string[];
  confidence: number;
  estimatedTimeToEffect: number; // milliseconds
}

/**
 * DomainModuleContract for causalGraph module
 *
 * Defines the capability signatures that the causalGraph module must implement:
 * - analyzeRootCause(): Find root causes for a target event
 * - simulateRipple(): Simulate ripple effects of an intervention
 * - computeCausalPath(): Compute and explain causal paths between events
 */
export interface CausalGraphDomainModuleContract {
  /**
   * Analyze root causes for a target event
   *
   * @param targetEventType - The event type to analyze root causes for
   * @param options - Analysis options (depth, confidence, etc.)
   * @returns Root cause analysis result with identified causes and paths
   */
  analyzeRootCause(
    targetEventType: CausalEventType,
    options?: AnalyzeRootCauseOptions
  ): Promise<AnalyzeRootCauseResult>;

  /**
   * Simulate ripple effects of an intervention
   *
   * Simulates how an intervention (e.g., "license renewal", "OPPE improvement")
   * propagates through the causal graph to predict downstream effects.
   *
   * @param scenario - The intervention scenario to simulate
   * @param options - Simulation options (depth, time horizon, etc.)
   * @returns What-if simulation result with predicted changes
   */
  simulateRipple(scenario: RippleScenario, options?: SimulateRippleOptions): Promise<WhatIfResult>;

  /**
   * Compute and explain causal path between events
   *
   * Finds and explains the causal path from a source event to a target event,
   * providing human-readable explanations of how events lead to other events.
   *
   * @param fromEventType - Source event type
   * @param toEventType - Target event type
   * @param options - Path computation options
   * @returns Array of causal path results with explanations
   */
  computeCausalPath(
    fromEventType: CausalEventType,
    toEventType: CausalEventType,
    options?: ComputeCausalPathOptions
  ): Promise<CausalPathResult[]>;
}

