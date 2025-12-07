/**
 * B209B-STRAT-008: SupervisorAgent → OrgStrategy integration
 *
 * Supervisor uses org-level insights to schedule:
 * - Preventive PSV
 * - Early renewals
 * - Privilege expansions
 * - Hiring triggers
 */

import { createLogger } from '@chai-vc/logging-core';
import type { PlannedTask } from '../planner/supervisorPlanner.js';
import type { SupervisorSignals } from '../signals/signalCollector.js';
import { SupervisorTaskType } from '@prisma/client';
import type { StrategicAction, StrategicInsight } from '../../orgStrategy/models/OrgStrategicState.js';
import { orgStrategicModel } from '../../orgStrategy/model/strategicModel.js';
import { orgStrategicReasoner } from '../../orgStrategy/reasoner.js';

const logger = createLogger({ service: 'supervisor-orgStrategy-integration' });

export interface OrgStrategyTaskEnhancement {
  task: PlannedTask;
  strategicPriority: number; // 0.0 to 1.0, based on strategic analysis
  strategicContext: {
    actionId?: string;
    insightId?: string;
    rationale: string;
    expectedImpact?: {
      kpi: string;
      expectedChange: number;
      timeframe: string;
    };
  };
  recommendedPriority: number; // Adjusted priority based on strategic analysis
}

/**
 * Generate supervisor tasks from org-level strategic insights
 */
export async function generateTasksFromOrgStrategy(
  orgId: string,
  signals: SupervisorSignals
): Promise<PlannedTask[]> {
  const tasks: PlannedTask[] = [];

  try {
    // Get org strategic state (from stored metadata or rebuild)
    const strategicState = await getOrgStrategicState(orgId);

    if (!strategicState) {
      logger.warn('No strategic state found for org', { orgId });
      return tasks;
    }

    // Generate strategic actions
    const actionsResult = await orgStrategicModel.generateActions({
      state: strategicState,
      forecast: strategicState.forecast,
      mobility: strategicState.mobility,
      risk: strategicState.risk,
      competency: strategicState.competency,
      safety: strategicState.safety,
    });

    // Convert strategic actions to supervisor tasks
    for (const action of actionsResult.actions) {
      const taskType = mapActionToTaskType(action.type);

      if (!taskType) {
        logger.debug('No task type mapping for action', {
          actionType: action.type,
          actionId: action.id,
        });
        continue;
      }

      const priority = mapPriorityToNumeric(action.priority);

      const task: PlannedTask = {
        taskType,
        priority,
        triggeredBy: 'ORG_STRATEGY',
        metadata: {
          actionId: action.id,
          actionType: action.type,
          actionDescription: action.description,
          actionRationale: action.rationale,
          expectedImpact: action.expectedImpact,
          targetOrgId: action.targetOrgId,
          targetDepartmentId: action.targetDepartmentId,
          targetClinicianIds: action.targetClinicianIds,
          estimatedCost: action.estimatedCost,
          estimatedEffort: action.estimatedEffort,
        },
      };

      tasks.push(task);
    }

    // Generate tasks from strategic insights (for high-severity insights)
    const insightsResult = await orgStrategicReasoner.generateInsights({
      state: strategicState,
      forecast: strategicState.forecast,
      mobility: strategicState.mobility,
      risk: strategicState.risk,
      competency: strategicState.competency,
      safety: strategicState.safety,
      payerAlignment: strategicState.payerAlignment,
      privilegeCoverage: strategicState.privilegeCoverage,
    });

    // Convert critical/high insights to tasks
    for (const insight of insightsResult.insights) {
      if (insight.severity === 'CRITICAL' || insight.severity === 'HIGH') {
        const taskType = mapInsightToTaskType(insight.type);

        if (taskType) {
          const priority = mapPriorityToNumeric(insight.severity);

          tasks.push({
            taskType,
            priority: priority + 10, // Boost priority for critical insights
            triggeredBy: 'ORG_STRATEGY_INSIGHT',
            metadata: {
              insightId: insight.id,
              insightType: insight.type,
              insightTitle: insight.title,
              insightDescription: insight.description,
              affectedEntities: insight.affectedEntities,
              timeframe: insight.timeframe,
              recommendedActions: insight.recommendedActions,
            },
          });
        }
      }
    }

    logger.info('Generated supervisor tasks from org strategy', {
      orgId,
      tasksGenerated: tasks.length,
      actionsProcessed: actionsResult.actions.length,
      insightsProcessed: insightsResult.insights.length,
    });
  } catch (error) {
    logger.error('Error generating tasks from org strategy', {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return tasks;
}

/**
 * Enhance existing supervisor tasks with org-level strategic context
 */
export async function enhanceTasksWithOrgStrategy(
  tasks: PlannedTask[],
  orgId: string,
  signals: SupervisorSignals
): Promise<OrgStrategyTaskEnhancement[]> {
  const enhancements: OrgStrategyTaskEnhancement[] = [];

  try {
    // Get org strategic state
    const strategicState = await getOrgStrategicState(orgId);

    if (!strategicState) {
      // Fallback: return tasks without enhancement
      return tasks.map(task => ({
        task,
        strategicPriority: 0,
        strategicContext: {
          rationale: 'No strategic state available',
        },
        recommendedPriority: task.priority,
      }));
    }

    // Get strategic actions and insights
    const [actionsResult, insightsResult] = await Promise.all([
      orgStrategicModel.generateActions({
        state: strategicState,
        forecast: strategicState.forecast,
        mobility: strategicState.mobility,
        risk: strategicState.risk,
        competency: strategicState.competency,
        safety: strategicState.safety,
      }),
      orgStrategicReasoner.generateInsights({
        state: strategicState,
        forecast: strategicState.forecast,
        mobility: strategicState.mobility,
        risk: strategicState.risk,
        competency: strategicState.competency,
        safety: strategicState.safety,
      }),
    ]);

    // Create lookup maps
    const actionsByType = new Map<string, StrategicAction[]>();
    for (const action of actionsResult.actions) {
      const mappedType = mapActionToTaskType(action.type);
      if (mappedType && mappedType === action.type) {
        if (!actionsByType.has(action.type)) {
          actionsByType.set(action.type, []);
        }
        actionsByType.get(action.type)!.push(action);
      }
    }

    // Enhance each task
    for (const task of tasks) {
      const enhancement = await enhanceSingleTask(
        task,
        strategicState,
        actionsResult.actions,
        insightsResult.insights,
        signals
      );
      enhancements.push(enhancement);
    }
  } catch (error) {
    logger.error('Error enhancing tasks with org strategy', {
      orgId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback: return tasks without enhancement
    return tasks.map(task => ({
      task,
      strategicPriority: 0,
      strategicContext: {
        rationale: 'Error enhancing tasks',
      },
      recommendedPriority: task.priority,
    }));
  }

  return enhancements;
}

/**
 * Enhance a single task with org strategy context
 */
async function enhanceSingleTask(
  task: PlannedTask,
  strategicState: any, // OrgStrategicState
  actions: StrategicAction[],
  insights: StrategicInsight[],
  signals: SupervisorSignals
): Promise<OrgStrategyTaskEnhancement> {
  // Find matching strategic action
  const matchingAction = actions.find(action => {
    const mappedType = mapActionToTaskType(action.type);
    return mappedType === task.taskType;
  });

  // Find matching strategic insight
  const matchingInsight = insights.find(insight => {
    const mappedType = mapInsightToTaskType(insight.type);
    return mappedType === task.taskType;
  });

  // Calculate strategic priority
  let strategicPriority = 0;
  let rationale = 'No strategic context available';
  let expectedImpact: StrategicAction['expectedImpact'] | undefined;

  if (matchingAction) {
    strategicPriority = mapPriorityToNumeric(matchingAction.priority) / 100; // Normalize to 0-1
    rationale = matchingAction.rationale;
    expectedImpact = matchingAction.expectedImpact;
  } else if (matchingInsight) {
    strategicPriority = mapPriorityToNumeric(matchingInsight.severity) / 100;
    rationale = matchingInsight.description;
  } else {
    // Partial match based on task type
    strategicPriority = calculatePartialMatchPriority(task, strategicState, signals);
    rationale = `Task type ${task.taskType} may address org-level strategic needs`;
  }

  // Adjust priority based on strategic analysis
  const strategicBoost = strategicPriority * 20; // Scale to priority points
  const recommendedPriority = Math.min(200, task.priority + strategicBoost);

  return {
    task,
    strategicPriority,
    strategicContext: {
      actionId: matchingAction?.id,
      insightId: matchingInsight?.id,
      rationale,
      expectedImpact,
    },
    recommendedPriority: Math.round(recommendedPriority),
  };
}

/**
 * Calculate partial match priority for tasks without direct strategic match
 */
function calculatePartialMatchPriority(
  task: PlannedTask,
  strategicState: any,
  signals: SupervisorSignals
): number {
  let priority = 0;

  // Boost priority if task addresses critical org needs
  if (task.taskType === SupervisorTaskType.RUN_PSV) {
    // PSV is valuable if there's high risk or declining safety
    if (strategicState.risk?.criticalRiskClinicians > 0) {
      priority += 0.3;
    }
    if (strategicState.safety?.safetyTrend === 'DECLINING') {
      priority += 0.2;
    }
  }

  if (task.taskType === SupervisorTaskType.RUN_SAFETY_SWEEP) {
    if (strategicState.safety?.criticalSafetySignals > 0) {
      priority += 0.4;
    }
  }

  if (task.taskType === SupervisorTaskType.RUN_DRIFT_SWEEP) {
    if (strategicState.risk?.highRiskClinicians > 5) {
      priority += 0.2;
    }
  }

  return Math.min(1, priority);
}

/**
 * Map strategic action type to supervisor task type
 */
function mapActionToTaskType(
  actionType: StrategicAction['type']
): PlannedTask['taskType'] | null {
  const mapping: Record<StrategicAction['type'], PlannedTask['taskType']> = {
    PREVENTIVE_PSV: SupervisorTaskType.RUN_PSV,
    EARLY_RENEWAL: SupervisorTaskType.RUN_DRIFT_SWEEP, // Closest match
    PRIVILEGE_EXPANSION: SupervisorTaskType.RUN_PRIVILEGE_ISSUE,
    HIRING_TRIGGER: SupervisorTaskType.RUN_MOBILITY, // Closest match
    PAYER_CONTRACT_NEGOTIATION: SupervisorTaskType.RUN_MOBILITY, // Closest match
    DEPARTMENT_INTERVENTION: SupervisorTaskType.RUN_PSV, // Closest match
    SAFETY_REVIEW: SupervisorTaskType.RUN_SAFETY_SWEEP,
    COMPETENCY_TRAINING: SupervisorTaskType.RUN_PSV, // Closest match
  };

  return mapping[actionType] || null;
}

/**
 * Map strategic insight type to supervisor task type
 */
function mapInsightToTaskType(
  insightType: StrategicInsight['type']
): PlannedTask['taskType'] | null {
  const mapping: Record<StrategicInsight['type'], PlannedTask['taskType'] | null> = {
    RENEWAL_CLIFF: SupervisorTaskType.RUN_DRIFT_SWEEP,
    PAYER_MISALIGNMENT: SupervisorTaskType.RUN_MOBILITY,
    PRIVILEGE_GAP: SupervisorTaskType.RUN_PRIVILEGE_ISSUE,
    RISK_CLUSTER: SupervisorTaskType.RUN_PSV,
    SAFETY_TREND: SupervisorTaskType.RUN_SAFETY_SWEEP,
    COMPETENCY_GAP: SupervisorTaskType.RUN_PSV,
  };

  return mapping[insightType] || null;
}

/**
 * Map priority string to numeric priority
 */
function mapPriorityToNumeric(
  priority: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'
): number {
  const mapping: Record<'LOW' | 'MED' | 'HIGH' | 'CRITICAL', number> = {
    LOW: 25,
    MED: 50,
    HIGH: 75,
    CRITICAL: 100,
  };

  return mapping[priority] || 25;
}

/**
 * Reorder tasks based on strategic priority
 */
export function reorderTasksByStrategicPriority(
  enhancements: OrgStrategyTaskEnhancement[]
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
      strategicAnalysis: {
        strategicPriority: enhancement.strategicPriority,
        strategicContext: enhancement.strategicContext,
      },
    },
  }));
}

/**
 * Get org strategic state (from stored metadata or rebuild)
 *
 * This is a simplified version - in production, this would:
 * - Check for cached/stored strategic state
 * - Rebuild if needed using OrgStrategicOrchestrator
 */
async function getOrgStrategicState(orgId: string): Promise<any | null> {
  try {
    // Try to get from org metadata
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { metadata: true },
    });

    if (org?.metadata && typeof org.metadata === 'object') {
      const metadata = org.metadata as Record<string, unknown>;
      const strategicState = metadata.orgStrategicState;

      if (strategicState) {
        return strategicState;
      }
    }

    // If not found, could trigger orchestrator to rebuild
    // For now, return null (caller should handle)
    return null;
  } catch (error) {
    logger.warn('Failed to get org strategic state', { orgId, error });
    return null;
  }
}
