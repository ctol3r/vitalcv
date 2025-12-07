/**
 * B210B-COUP-007: RippleScenarioSimulator
 *
 * Simulates events like: DEA mass expiry, compact ineligibility, payer network failure, FPPE surge
 * → outputs department-by-department impact.
 */

import type {
  ScenarioEvent,
  DepartmentImpact,
  SourceEvent,
} from '../types.js';
import { propagateImpact, propagateMultipleImpacts } from '../propagationEngine.js';
import { getCouplingGraphStore } from '../models/couplingGraphStore.js';
import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'ripple-simulator' });

export interface SimulationOptions {
  maxDepth?: number;
  minImpactThreshold?: number;
  includeRecoveryTime?: boolean;
}

/**
 * Simulate a scenario event and compute department-by-department impact
 */
export async function simulateScenario(
  scenarioEvent: ScenarioEvent,
  options: SimulationOptions = {}
): Promise<DepartmentImpact[]> {
  logger.info('Simulating scenario', {
    type: scenarioEvent.type,
    affectedNodes: scenarioEvent.affectedNodeIds.length,
    severity: scenarioEvent.severity,
  });

  // Convert scenario event to source events
  const sourceEvents = await convertScenarioToSourceEvents(scenarioEvent);

  // Propagate impact
  const rippleScores = await propagateMultipleImpacts(sourceEvents, {
    maxDepth: options.maxDepth || 5,
    minImpactThreshold: options.minImpactThreshold || 0.01,
  });

  // Aggregate by department
  const departmentImpacts = await aggregateByDepartment(rippleScores, scenarioEvent, options);

  logger.info('Scenario simulation completed', {
    type: scenarioEvent.type,
    departmentsAffected: departmentImpacts.length,
    maxImpact: Math.max(...departmentImpacts.map((d) => d.impactScore)),
  });

  return departmentImpacts;
}

/**
 * Convert scenario event to source events
 */
async function convertScenarioToSourceEvents(
  scenarioEvent: ScenarioEvent
): Promise<SourceEvent[]> {
  const sourceEvents: SourceEvent[] = [];

  for (const nodeId of scenarioEvent.affectedNodeIds) {
    const initialImpact = getInitialImpactForScenario(scenarioEvent.type, scenarioEvent.severity);

    sourceEvents.push({
      nodeId,
      eventType: scenarioEvent.type,
      initialImpact,
      metadata: {
        scenarioType: scenarioEvent.type,
        severity: scenarioEvent.severity,
        ...scenarioEvent.metadata,
      },
    });
  }

  return sourceEvents;
}

/**
 * Get initial impact for scenario type
 */
function getInitialImpactForScenario(
  type: ScenarioEvent['type'],
  severity: number
): number {
  const baseImpacts: Record<ScenarioEvent['type'], number> = {
    DEA_MASS_EXPIRY: 0.9,
    COMPACT_INELIGIBILITY: 0.7,
    PAYER_NETWORK_FAILURE: 0.85,
    FPPE_SURGE: 0.75,
  };

  return baseImpacts[type] * severity;
}

/**
 * Aggregate ripple scores by department
 */
async function aggregateByDepartment(
  rippleScores: Map<string, import('../types.js').RippleScore>,
  scenarioEvent: ScenarioEvent,
  options: SimulationOptions
): Promise<DepartmentImpact[]> {
  const store = getCouplingGraphStore();
  const departmentMap = new Map<string, {
    departmentId: string;
    departmentName: string;
    nodes: Array<{ nodeId: string; score: number }>;
    criticalPath: Array<{ nodeId: string; nodeName: string; impactWeight: number }>;
  }>();

  // Group nodes by department
  for (const [nodeId, rippleScore] of rippleScores.entries()) {
    const node = store.getNode(nodeId);
    if (!node) continue;

    const deptId = node.departmentId || 'unknown';
    const deptName = await getDepartmentName(deptId);

    let deptData = departmentMap.get(deptId);
    if (!deptData) {
      deptData = {
        departmentId: deptId,
        departmentName: deptName,
        nodes: [],
        criticalPath: [],
      };
      departmentMap.set(deptId, deptData);
    }

    deptData.nodes.push({
      nodeId,
      score: rippleScore.score,
    });

    // Build critical path (top impact path)
    const topPath = rippleScore.paths.sort((a, b) => b.totalWeight - a.totalWeight)[0];
    if (topPath) {
      for (const edgeId of topPath.edgeIds) {
        const edge = store.getEdge(edgeId);
        if (edge) {
          const targetNode = store.getNode(edge.targetNodeId);
          if (targetNode && !deptData.criticalPath.find((p) => p.nodeId === edge.targetNodeId)) {
            deptData.criticalPath.push({
              nodeId: edge.targetNodeId,
              nodeName: targetNode.name,
              impactWeight: edge.impactWeight,
            });
          }
        }
      }
    }
  }

  // Convert to DepartmentImpact array
  const impacts: DepartmentImpact[] = [];

  for (const deptData of departmentMap.values()) {
    // Calculate department impact score (weighted average)
    const totalScore = deptData.nodes.reduce((sum, n) => sum + n.score, 0);
    const avgScore = deptData.nodes.length > 0 ? totalScore / deptData.nodes.length : 0;
    const impactScore = Math.min(1.0, avgScore);

    const impact: DepartmentImpact = {
      departmentId: deptData.departmentId,
      departmentName: deptData.departmentName,
      impactScore,
      affectedNodes: deptData.nodes.map((n) => n.nodeId),
      criticalPath: deptData.criticalPath,
    };

    if (options.includeRecoveryTime) {
      impact.estimatedRecoveryTime = estimateRecoveryTime(scenarioEvent.type, impactScore);
    }

    impacts.push(impact);
  }

  // Sort by impact score (highest first)
  return impacts.sort((a, b) => b.impactScore - a.impactScore);
}

/**
 * Get department name by ID
 */
async function getDepartmentName(departmentId: string): Promise<string> {
  if (departmentId === 'unknown') return 'Unknown Department';

  try {
    // Query department from database if available
    // For now, return a formatted ID
    return `Department ${departmentId}`;
  } catch (error) {
    logger.warn('Error fetching department name', { departmentId, error });
    return `Department ${departmentId}`;
  }
}

/**
 * Estimate recovery time based on scenario type and impact
 */
function estimateRecoveryTime(
  scenarioType: ScenarioEvent['type'],
  impactScore: number
): number {
  // Base recovery times in milliseconds
  const baseTimes: Record<ScenarioEvent['type'], number> = {
    DEA_MASS_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
    COMPACT_INELIGIBILITY: 60 * 24 * 60 * 60 * 1000, // 60 days
    PAYER_NETWORK_FAILURE: 45 * 24 * 60 * 60 * 1000, // 45 days
    FPPE_SURGE: 90 * 24 * 60 * 60 * 1000, // 90 days
  };

  const baseTime = baseTimes[scenarioType];
  // Scale by impact score (higher impact = longer recovery)
  return baseTime * (0.5 + impactScore * 0.5);
}

/**
 * Simulate multiple scenarios and compare
 */
export async function simulateMultipleScenarios(
  scenarios: ScenarioEvent[],
  options: SimulationOptions = {}
): Promise<Map<string, DepartmentImpact[]>> {
  const results = new Map<string, DepartmentImpact[]>();

  for (const scenario of scenarios) {
    const impacts = await simulateScenario(scenario, options);
    results.set(scenario.type, impacts);
  }

  return results;
}

