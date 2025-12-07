/**
 * Causal → SupervisorAgent Integration
 *
 * SupervisorAgent uses causal graph to:
 * - Decide task ordering based on root causes
 * - Prioritize tasks that address root causes
 * - Escalate based on causal chain severity
 */

import { createLogger } from '@chai-vc/logging-core';
import type { PlannedTask } from '../planner/supervisorPlanner.js';
import type { SupervisorSignals } from '../signals/signalCollector.js';
import { getCausalGraphStore } from '../../causalGraph/models/causalGraphStore.js';
import { detectRootCauses, getRootCauses } from '../../causalGraph/rootCauseDetector.js';
import { explainPathsToTarget } from '../../causalGraph/pathExplainer.js';
import type { CausalEventType } from '../../causalGraph/types.js';
import { SupervisorTaskPriority } from '../policies/priorityRules.js';

const logger = createLogger({ service: 'supervisor-causal-integration' });

export interface CausalTaskEnhancement {
  task: PlannedTask;
  rootCausePriority: number; // 0.0 to 1.0, based on causal analysis
  causalContext: {
    rootCauses: Array<{
      eventType: CausalEventType;
      confidence: number;
    }>;
    pathExplanations: string[];
  };
  recommendedPriority: number; // Adjusted priority based on causal analysis
}

/**
 * Enhance supervisor tasks with causal graph insights
 */
export async function enhanceTasksWithCausalAnalysis(
  tasks: PlannedTask[],
  signals: SupervisorSignals
): Promise<CausalTaskEnhancement[]> {
  const store = getCausalGraphStore();
  await store.initialize();

  const enhancements: CausalTaskEnhancement[] = [];

  for (const task of tasks) {
    try {
      const enhancement = await enhanceSingleTask(task, signals);
      enhancements.push(enhancement);
    } catch (error) {
      logger.warn('Error enhancing task with causal analysis', {
        taskType: task.taskType,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback: use original task without enhancement
      enhancements.push({
        task,
        rootCausePriority: 0,
        causalContext: {
          rootCauses: [],
          pathExplanations: [],
        },
        recommendedPriority: task.priority,
      });
    }
  }

  return enhancements;
}

/**
 * Enhance a single task with causal analysis
 */
async function enhanceSingleTask(
  task: PlannedTask,
  signals: SupervisorSignals
): Promise<CausalTaskEnhancement> {
  // Map task type to causal event types
  const targetEventTypes = mapTaskToEventTypes(task.taskType);

  if (targetEventTypes.length === 0) {
    // No causal mapping for this task type
    return {
      task,
      rootCausePriority: 0,
      causalContext: {
        rootCauses: [],
        pathExplanations: [],
      },
      recommendedPriority: task.priority,
    };
  }

  // Analyze root causes for target events
  const allRootCauses: Array<{
    eventType: CausalEventType;
    confidence: number;
  }> = [];
  const allPathExplanations: string[] = [];

  for (const eventType of targetEventTypes) {
    try {
      const rootCauses = await getRootCauses(eventType, {
        maxDepth: 5,
        minConfidence: 0.3,
        maxPathsPerRoot: 5,
      });

      for (const rootCause of rootCauses) {
        allRootCauses.push({
          eventType: rootCause.eventType,
          confidence: rootCause.confidence,
        });
      }

      const pathExplanations = await explainPathsToTarget(eventType, {
        maxPaths: 3,
        minConfidence: 0.3,
      });

      for (const explanation of pathExplanations) {
        allPathExplanations.push(explanation.explanation);
      }
    } catch (error) {
      logger.warn('Error analyzing root causes', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Calculate root cause priority
  const rootCausePriority = calculateRootCausePriority(allRootCauses, signals);

  // Adjust task priority based on causal analysis
  const recommendedPriority = adjustPriorityBasedOnCausalAnalysis(
    task.priority,
    rootCausePriority,
    allRootCauses
  );

  return {
    task,
    rootCausePriority,
    causalContext: {
      rootCauses: allRootCauses,
      pathExplanations: allPathExplanations,
    },
    recommendedPriority,
  };
}

/**
 * Map supervisor task type to causal event types
 */
function mapTaskToEventTypes(taskType: string): CausalEventType[] {
  const mapping: Record<string, CausalEventType[]> = {
    RUN_SAFETY_SWEEP: ['SAFETY_HOLD' as CausalEventType, 'SAFETY_ALERT' as CausalEventType],
    RUN_DRIFT_SWEEP: ['LICENSE_DRIFT' as CausalEventType, 'ENROLLMENT_CONFLICT' as CausalEventType],
    RUN_COMPLIANCE: ['COMPLIANCE_VIOLATION' as CausalEventType],
    RUN_PSV: ['RISK_SPIKE' as CausalEventType, 'QUALITY_DECLINE' as CausalEventType],
    RUN_FUSION: ['RISK_SPIKE' as CausalEventType],
    RUN_EHR_SYNC: [], // No direct causal mapping
    RUN_MOBILITY: ['ENROLLMENT_CONFLICT' as CausalEventType],
  };

  return mapping[taskType] || [];
}

/**
 * Calculate root cause priority based on root causes and signals
 */
function calculateRootCausePriority(
  rootCauses: Array<{ eventType: CausalEventType; confidence: number }>,
  signals: SupervisorSignals
): number {
  if (rootCauses.length === 0) return 0;

  // Base priority on confidence scores
  const avgConfidence =
    rootCauses.reduce((sum, rc) => sum + rc.confidence, 0) / rootCauses.length;

  // Boost priority if root causes match current signals
  let signalMatchBoost = 0;
  for (const rootCause of rootCauses) {
    if (rootCause.eventType === 'LICENSE_DRIFT' && signals.drift.openCount > 0) {
      signalMatchBoost += 0.2;
    }
    if (rootCause.eventType === 'SAFETY_HOLD' && signals.safety.activeCount > 0) {
      signalMatchBoost += 0.2;
    }
    if (rootCause.eventType === 'RISK_SPIKE' && signals.safety.highCount > 0) {
      signalMatchBoost += 0.2;
    }
  }

  return Math.min(1.0, avgConfidence + signalMatchBoost);
}

/**
 * Adjust task priority based on causal analysis
 */
function adjustPriorityBasedOnCausalAnalysis(
  originalPriority: number,
  rootCausePriority: number,
  rootCauses: Array<{ eventType: CausalEventType; confidence: number }>
): number {
  if (rootCauses.length === 0) {
    return originalPriority;
  }

  // Boost priority if we have high-confidence root causes
  const boost = rootCausePriority * 20; // Scale to priority points
  const adjusted = originalPriority + boost;

  // Cap at maximum priority
  const maxPriority = SupervisorTaskPriority.CRITICAL_SAFETY;
  return Math.min(maxPriority, adjusted);
}

/**
 * Reorder tasks based on causal analysis
 */
export function reorderTasksByCausalPriority(
  enhancements: CausalTaskEnhancement[]
): PlannedTask[] {
  // Sort by recommended priority (highest first)
  const sorted = [...enhancements].sort(
    (a, b) => b.recommendedPriority - a.recommendedPriority
  );

  return sorted.map((enhancement) => ({
    ...enhancement.task,
    priority: enhancement.recommendedPriority,
    metadata: {
      ...enhancement.task.metadata,
      causalAnalysis: {
        rootCausePriority: enhancement.rootCausePriority,
        rootCauses: enhancement.causalContext.rootCauses,
        pathExplanations: enhancement.causalContext.pathExplanations,
      },
    },
  }));
}

/**
 * Determine escalation based on causal chain
 */
export async function determineEscalationFromCausalChain(
  targetEvent: CausalEventType,
  entityId?: string
): Promise<{
  shouldEscalate: boolean;
  escalationReason: string;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
}> {
  try {
    const rootCauseResult = await detectRootCauses(targetEvent, {
      maxDepth: 5,
      minConfidence: 0.5,
      maxPathsPerRoot: 5,
    });

    if (rootCauseResult.rootCauses.length === 0) {
      return {
        shouldEscalate: false,
        escalationReason: 'No root causes identified',
        severity: 'LOW',
      };
    }

    const topRootCause = rootCauseResult.rootCauses[0];
    const pathExplanations = await explainPathsToTarget(targetEvent, {
      maxPaths: 1,
      minConfidence: 0.5,
    });

    // Escalate if:
    // 1. High confidence root cause (>0.8)
    // 2. Multiple paths to the same root cause
    // 3. Root cause is a critical event type
    const shouldEscalate =
      topRootCause.confidence > 0.8 ||
      topRootCause.paths.length > 3 ||
      isCriticalEventType(topRootCause.eventType);

    const severity = determineSeverityFromRootCause(topRootCause);

    const escalationReason = shouldEscalate
      ? `High-confidence root cause identified: ${topRootCause.eventType} (${(topRootCause.confidence * 100).toFixed(0)}% confidence, ${topRootCause.paths.length} paths)`
      : 'Root cause analysis complete, no escalation needed';

    return {
      shouldEscalate,
      escalationReason,
      severity,
    };
  } catch (error) {
    logger.error('Error determining escalation from causal chain', {
      targetEvent,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      shouldEscalate: false,
      escalationReason: 'Error analyzing causal chain',
      severity: 'LOW',
    };
  }
}

/**
 * Check if an event type is critical
 */
function isCriticalEventType(eventType: CausalEventType): boolean {
  const criticalTypes: CausalEventType[] = [
    'SAFETY_HOLD',
    'RISK_SPIKE',
    'LICENSE_EXPIRED',
    'COMPLIANCE_VIOLATION',
  ];
  return criticalTypes.includes(eventType);
}

/**
 * Determine severity from root cause
 */
function determineSeverityFromRootCause(rootCause: {
  eventType: CausalEventType;
  confidence: number;
  paths: Array<unknown>;
}): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' {
  if (isCriticalEventType(rootCause.eventType)) {
    return 'CRITICAL';
  }

  if (rootCause.confidence > 0.8) {
    return 'HIGH';
  }

  if (rootCause.confidence > 0.5) {
    return 'MED';
  }

  return 'LOW';
}

/**
 * Get causal recommendations for task execution
 */
export async function getCausalRecommendations(
  task: PlannedTask,
  signals: SupervisorSignals
): Promise<{
  recommendations: string[];
  rootCausesToAddress: CausalEventType[];
}> {
  const targetEventTypes = mapTaskToEventTypes(task.taskType);
  const recommendations: string[] = [];
  const rootCausesToAddress: CausalEventType[] = [];

  for (const eventType of targetEventTypes) {
    try {
      const rootCauses = await getRootCauses(eventType, {
        maxDepth: 5,
        minConfidence: 0.3,
        maxPathsPerRoot: 3,
      });

      for (const rootCause of rootCauses.slice(0, 3)) {
        // Top 3 root causes
        rootCausesToAddress.push(rootCause.eventType);
        recommendations.push(
          `Address root cause: ${rootCause.eventType} (${(rootCause.confidence * 100).toFixed(0)}% confidence)`
        );
      }
    } catch (error) {
      logger.warn('Error getting causal recommendations', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    recommendations,
    rootCausesToAddress,
  };
}

