/**
 * WhatIfSimulator
 *
 * Simulates remediation scenarios and predicts risk state changes.
 * Examples:
 * - "What if license is renewed?" → predicts trust restoration, risk decrease
 * - "What if OPPE improves?" → predicts risk normalization, safety release
 */

import type {
  CausalEventType,
  CausalNode,
  CausalEdge,
  WhatIfResult,
} from './types.js';
import { getCausalGraphStore } from './models/causalGraphStore.js';

export interface WhatIfScenario {
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

export interface WhatIfSimulationOptions {
  maxDepth?: number; // How far to propagate effects (default: 3)
  timeHorizon?: number; // Milliseconds to look ahead (default: 90 days)
  includeIndirectEffects?: boolean; // Include indirect causal chains (default: true)
}

/**
 * Simulate a what-if scenario
 */
export async function simulateWhatIf(
  scenario: WhatIfScenario,
  options: WhatIfSimulationOptions = {}
): Promise<WhatIfResult> {
  const {
    maxDepth = 3,
    timeHorizon = 90 * 24 * 60 * 60 * 1000, // 90 days
    includeIndirectEffects = true,
  } = options;

  const store = getCausalGraphStore();
  const graph = store.getGraph();

  // Apply the intervention to the graph
  const interventionNode = createInterventionNode(scenario.intervention);

  // Simulate forward propagation of effects
  const predictedChanges = propagateEffects(
    interventionNode,
    store,
    maxDepth,
    timeHorizon,
    includeIndirectEffects
  );

  // Calculate overall risk change
  const riskScoreDelta = calculateRiskScoreDelta(
    scenario.currentState?.riskScore || 0,
    predictedChanges
  );

  const overallRiskChange = determineOverallRiskChange(riskScoreDelta, predictedChanges);

  return {
    scenario: scenario.description,
    intervention: scenario.intervention,
    predictedChanges,
    overallRiskChange,
    riskScoreDelta,
  };
}

/**
 * Create a node representing the intervention
 */
function createInterventionNode(intervention: WhatIfScenario['intervention']): CausalNode {
  return {
    id: `intervention-${Date.now()}`,
    eventType: intervention.eventType,
    entityId: intervention.entityId,
    entityType: intervention.entityType,
    timestamp: new Date(),
    severity: 'MED',
    metadata: {
      isIntervention: true,
      action: intervention.action,
      value: intervention.value,
    },
  };
}

/**
 * Propagate effects forward through the causal graph
 */
function propagateEffects(
  interventionNode: CausalNode,
  store: ReturnType<typeof getCausalGraphStore>,
  maxDepth: number,
  timeHorizon: number,
  includeIndirectEffects: boolean
): WhatIfResult['predictedChanges'] {
  const changes: WhatIfResult['predictedChanges'] = [];
  const visited = new Set<string>();
  const queue: Array<{
    node: CausalNode;
    depth: number;
    cumulativeDelay: number;
    cumulativeConfidence: number;
  }> = [];

  queue.push({
    node: interventionNode,
    depth: 0,
    cumulativeDelay: 0,
    cumulativeConfidence: 1.0,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nodeKey = `${current.node.eventType}:${current.node.id}`;

    if (visited.has(nodeKey)) continue;
    if (current.depth > maxDepth) continue;
    if (current.cumulativeDelay > timeHorizon) continue;

    visited.add(nodeKey);

    // Get outgoing edges (effects of this event)
    const outgoingEdges = store.getEdgesFrom(current.node.eventType);

    for (const edge of outgoingEdges) {
      const newDelay = current.cumulativeDelay + edge.delay;
      const newConfidence = current.cumulativeConfidence * edge.confidence;

      if (newDelay > timeHorizon) continue;
      if (newConfidence < 0.1) continue; // Skip very low confidence paths

      // Determine the type of change based on the target event type
      const change = determineChangeType(edge.targetEventType, interventionNode.eventType);

      // Check if we already have a change for this event type
      const existingChangeIndex = changes.findIndex(
        (c) => c.eventType === edge.targetEventType
      );

      if (existingChangeIndex >= 0) {
        // Update with higher confidence if this path is stronger
        const existing = changes[existingChangeIndex];
        if (newConfidence > existing.confidence) {
          changes[existingChangeIndex] = {
            eventType: edge.targetEventType,
            change,
            confidence: newConfidence,
            estimatedDelay: newDelay,
          };
        }
      } else {
        changes.push({
          eventType: edge.targetEventType,
          change,
          confidence: newConfidence,
          estimatedDelay: newDelay,
        });
      }

      // Continue propagation if enabled
      if (includeIndirectEffects && current.depth < maxDepth) {
        const targetNodes = store.getNodesByEventType(edge.targetEventType);
        // Create a synthetic node for propagation
        const syntheticNode: CausalNode = {
          id: `synthetic-${edge.targetEventType}-${Date.now()}`,
          eventType: edge.targetEventType,
          timestamp: new Date(Date.now() + newDelay),
          severity: 'MED',
          metadata: {
            isSynthetic: true,
            propagatedFrom: current.node.eventType,
          },
        };

        queue.push({
          node: syntheticNode,
          depth: current.depth + 1,
          cumulativeDelay: newDelay,
          cumulativeConfidence: newConfidence,
        });
      }
    }
  }

  return changes.sort((a, b) => a.estimatedDelay - b.estimatedDelay);
}

/**
 * Determine the type of change based on event types
 */
function determineChangeType(
  targetEventType: CausalEventType,
  sourceEventType: CausalEventType
): 'INCREASE' | 'DECREASE' | 'NORMALIZE' | 'TRIGGER' | 'PREVENT' {
  // Positive remediation events
  const positiveEvents: CausalEventType[] = [
    'LICENSE_RENEWED',
    'INCREASED_PECOS_TRUST',
    'ENROLLMENT_APPROVED',
    'RISK_DECREASE',
    'RISK_NORMALIZED',
    'SAFETY_RELEASE',
    'OPPE_IMPROVED',
    'COMPLIANCE_RESTORED',
    'PAYER_APPROVAL',
  ];

  // Negative events
  const negativeEvents: CausalEventType[] = [
    'LICENSE_DRIFT',
    'LICENSE_EXPIRED',
    'DECREASED_PECOS_TRUST',
    'ENROLLMENT_CONFLICT',
    'ENROLLMENT_DENIED',
    'RISK_SPIKE',
    'SAFETY_HOLD',
    'SAFETY_ALERT',
    'OPPE_LOW',
    'FPPE_FAILURE',
    'QUALITY_DECLINE',
    'COMPLIANCE_VIOLATION',
    'PAYER_DENIAL',
  ];

  if (positiveEvents.includes(targetEventType)) {
    if (negativeEvents.includes(sourceEventType)) {
      return 'PREVENT'; // Positive event prevents negative event
    }
    return 'TRIGGER'; // Positive event is triggered
  }

  if (negativeEvents.includes(targetEventType)) {
    if (positiveEvents.includes(sourceEventType)) {
      return 'PREVENT'; // Positive event prevents negative event
    }
    return 'TRIGGER'; // Negative event is triggered
  }

  // Default based on common patterns
  if (targetEventType.includes('DECREASE') || targetEventType.includes('NORMALIZED')) {
    return 'DECREASE';
  }
  if (targetEventType.includes('INCREASE') || targetEventType.includes('SPIKE')) {
    return 'INCREASE';
  }

  return 'TRIGGER';
}

/**
 * Calculate risk score delta based on predicted changes
 */
function calculateRiskScoreDelta(
  currentRiskScore: number,
  predictedChanges: WhatIfResult['predictedChanges']
): number {
  let delta = 0;

  for (const change of predictedChanges) {
    const impact = change.confidence * 10; // Scale confidence to risk points

    switch (change.change) {
      case 'INCREASE':
      case 'TRIGGER':
        if (change.eventType.includes('RISK') || change.eventType.includes('SAFETY')) {
          delta += impact;
        }
        break;
      case 'DECREASE':
      case 'NORMALIZE':
      case 'PREVENT':
        if (change.eventType.includes('RISK') || change.eventType.includes('SAFETY')) {
          delta -= impact;
        }
        break;
    }
  }

  return delta;
}

/**
 * Determine overall risk change direction
 */
function determineOverallRiskChange(
  riskScoreDelta: number,
  predictedChanges: WhatIfResult['predictedChanges']
): 'INCREASE' | 'DECREASE' | 'NEUTRAL' {
  if (riskScoreDelta > 5) return 'INCREASE';
  if (riskScoreDelta < -5) return 'DECREASE';
  return 'NEUTRAL';
}

/**
 * Simulate multiple what-if scenarios
 */
export async function simulateMultipleScenarios(
  scenarios: WhatIfScenario[],
  options?: WhatIfSimulationOptions
): Promise<WhatIfResult[]> {
  return Promise.all(
    scenarios.map((scenario) => simulateWhatIf(scenario, options))
  );
}

/**
 * Compare what-if scenarios
 */
export function compareWhatIfResults(
  results: WhatIfResult[]
): {
  bestScenario: WhatIfResult | null;
  worstScenario: WhatIfResult | null;
  recommendations: string[];
} {
  if (results.length === 0) {
    return {
      bestScenario: null,
      worstScenario: null,
      recommendations: [],
    };
  }

  // Sort by risk score delta (lower is better)
  const sorted = [...results].sort((a, b) => a.riskScoreDelta - b.riskScoreDelta);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const recommendations: string[] = [];

  if (best.overallRiskChange === 'DECREASE') {
    recommendations.push(
      `Recommended: ${best.scenario} - This intervention is predicted to reduce risk by ${Math.abs(best.riskScoreDelta).toFixed(1)} points.`
    );
  }

  if (worst.overallRiskChange === 'INCREASE') {
    recommendations.push(
      `Avoid: ${worst.scenario} - This intervention may increase risk by ${worst.riskScoreDelta.toFixed(1)} points.`
    );
  }

  // Analyze predicted changes
  for (const result of results) {
    const positiveChanges = result.predictedChanges.filter(
      (c) => c.change === 'DECREASE' || c.change === 'NORMALIZE' || c.change === 'PREVENT'
    );
    if (positiveChanges.length > 0) {
      recommendations.push(
        `${result.scenario} is expected to produce ${positiveChanges.length} positive outcome(s).`
      );
    }
  }

  return {
    bestScenario: best,
    worstScenario: worst,
    recommendations,
  };
}

