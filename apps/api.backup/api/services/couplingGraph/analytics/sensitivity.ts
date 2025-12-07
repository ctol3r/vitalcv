/**
 * B210B-COUP-008: SystemSensitivityAnalyzer
 *
 * Computes ∂(system_performance)/∂(credential_variable) for each node → identifies fragile areas.
 */

import type {
  SensitivityResult,
  SystemPerformance,
  CouplingNode,
} from '../types.js';
import { getCouplingGraphStore } from '../models/couplingGraphStore.js';
import { propagateImpact } from '../propagationEngine.js';
import { createLogger } from '@chai-vc/logging-core';

const logger = createLogger({ service: 'sensitivity-analyzer' });

export interface SensitivityAnalysisOptions {
  perturbationSize?: number; // Small change to apply (default: 0.01)
  variables?: string[]; // Credential variables to analyze (default: all)
  minSensitivityThreshold?: number; // Minimum sensitivity to report (default: 0.001)
}

const DEFAULT_OPTIONS: Required<SensitivityAnalysisOptions> = {
  perturbationSize: 0.01,
  variables: [],
  minSensitivityThreshold: 0.001,
};

/**
 * Analyze system sensitivity to credential variable changes
 */
export async function analyzeSensitivity(
  basePerformance: SystemPerformance,
  options: SensitivityAnalysisOptions = {}
): Promise<SensitivityResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const store = getCouplingGraphStore();
  await store.initialize();

  logger.info('Starting sensitivity analysis', {
    nodeCount: store.getAllNodes().length,
    variables: opts.variables.length || 'all',
  });

  const results: SensitivityResult[] = [];
  const nodes = store.getAllNodes();

  // If no specific variables provided, analyze all nodes
  const nodesToAnalyze = opts.variables.length > 0
    ? nodes.filter((n) => opts.variables.includes(n.id))
    : nodes;

  for (const node of nodesToAnalyze) {
    try {
      const sensitivity = await computeNodeSensitivity(node, basePerformance, opts.perturbationSize);

      if (Math.abs(sensitivity.sensitivity) >= opts.minSensitivityThreshold) {
        results.push(sensitivity);
      }
    } catch (error) {
      logger.warn('Error computing sensitivity for node', {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Sort by absolute sensitivity (most sensitive first)
  results.sort((a, b) => Math.abs(b.sensitivity) - Math.abs(a.sensitivity));

  logger.info('Sensitivity analysis completed', {
    nodesAnalyzed: nodesToAnalyze.length,
    resultsCount: results.length,
    topSensitivity: results[0]?.sensitivity,
  });

  return results;
}

/**
 * Compute sensitivity for a single node
 */
async function computeNodeSensitivity(
  node: CouplingNode,
  basePerformance: SystemPerformance,
  perturbationSize: number
): Promise<SensitivityResult> {
  // Simulate perturbation: reduce credential variable by perturbationSize
  const perturbedImpact = perturbationSize;

  // Propagate impact from this node
  const rippleScores = await propagateImpact(
    {
      nodeId: node.id,
      eventType: 'CREDENTIAL_VARIABLE_CHANGE',
      initialImpact: perturbedImpact,
    },
    {
      maxDepth: 5,
      minImpactThreshold: 0.001,
    }
  );

  // Compute new system performance
  const perturbedPerformance = computeSystemPerformanceFromRipples(rippleScores, basePerformance);

  // Compute sensitivity: ∂(system_performance)/∂(credential_variable)
  const performanceDelta = perturbedPerformance.overallScore - basePerformance.overallScore;
  const sensitivity = performanceDelta / perturbationSize;

  // Compute fragility score (0-1): higher sensitivity = more fragile
  const fragilityScore = Math.min(1.0, Math.abs(sensitivity) * 10);

  // Find affected departments
  const affectedDepartments = new Set<string>();
  for (const [nodeId] of rippleScores.entries()) {
    const affectedNode = getCouplingGraphStore().getNode(nodeId);
    if (affectedNode?.departmentId) {
      affectedDepartments.add(affectedNode.departmentId);
    }
  }

  // Generate recommendations
  const recommendations = generateRecommendations(sensitivity, fragilityScore, node);

  return {
    nodeId: node.id,
    nodeName: node.name,
    variableName: `credential_${node.id}`,
    sensitivity,
    fragilityScore,
    affectedDepartments: Array.from(affectedDepartments),
    recommendations,
  };
}

/**
 * Compute system performance from ripple scores
 */
function computeSystemPerformanceFromRipples(
  rippleScores: Map<string, import('../types.js').RippleScore>,
  basePerformance: SystemPerformance
): SystemPerformance {
  // Aggregate ripple scores into performance metrics
  const totalRipple = Array.from(rippleScores.values()).reduce(
    (sum, r) => sum + r.score,
    0
  );
  const avgRipple = rippleScores.size > 0 ? totalRipple / rippleScores.size : 0;

  // Impact on overall score (negative impact)
  const impactFactor = 1.0 - Math.min(1.0, avgRipple * 0.5);
  const newOverallScore = basePerformance.overallScore * impactFactor;

  // Impact on department scores
  const newDepartmentScores = new Map<string, number>();
  for (const [deptId, score] of basePerformance.departmentScores.entries()) {
    newDepartmentScores.set(deptId, score * impactFactor);
  }

  // Impact on other metrics (proportional)
  const credentialReadiness = basePerformance.credentialReadiness * impactFactor;
  const enrollmentStability = basePerformance.enrollmentStability * impactFactor;
  const workforceCapacity = basePerformance.workforceCapacity * impactFactor;
  const safetyIndex = basePerformance.safetyIndex * impactFactor;

  return {
    overallScore: newOverallScore,
    departmentScores: newDepartmentScores,
    credentialReadiness,
    enrollmentStability,
    workforceCapacity,
    safetyIndex,
  };
}

/**
 * Generate recommendations based on sensitivity analysis
 */
function generateRecommendations(
  sensitivity: number,
  fragilityScore: number,
  node: CouplingNode
): string[] {
  const recommendations: string[] = [];

  if (fragilityScore > 0.7) {
    recommendations.push(`High fragility detected: ${node.name} is highly sensitive to changes`);
    recommendations.push('Consider adding redundancy or backup systems');
  }

  if (Math.abs(sensitivity) > 0.5) {
    recommendations.push(`Strong coupling: Changes to ${node.name} significantly impact system performance`);
    recommendations.push('Monitor this component closely and implement early warning systems');
  }

  if (sensitivity < 0) {
    recommendations.push(`Negative sensitivity: Reducing ${node.name} decreases system performance`);
    recommendations.push('Ensure this component is well-maintained and monitored');
  }

  if (fragilityScore > 0.5 && node.type === 'credential') {
    recommendations.push('Consider credential redundancy or alternative pathways');
  }

  return recommendations;
}

/**
 * Get top N most fragile areas
 */
export function getTopFragileAreas(
  results: SensitivityResult[],
  topN: number = 10
): SensitivityResult[] {
  return results
    .sort((a, b) => b.fragilityScore - a.fragilityScore)
    .slice(0, topN);
}

/**
 * Get areas with highest sensitivity
 */
export function getHighestSensitivity(
  results: SensitivityResult[],
  topN: number = 10
): SensitivityResult[] {
  return results
    .sort((a, b) => Math.abs(b.sensitivity) - Math.abs(a.sensitivity))
    .slice(0, topN);
}

