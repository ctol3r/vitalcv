/**
 * SupervisorPlanner (LLM-assisted, deterministic mode)
 *
 * Given current signals + policies → outputs ordered list of SupervisorTasks
 * - Deterministic mode for tests
 * - LLM-assisted mode for production planning
 */

import {
  SupervisorTaskType,
  SupervisorTaskStatus,
} from '@prisma/client';
import type { SupervisorSignals } from '../signals/signalCollector.js';
import type { PlannedTask } from './plannerTypes.js';
import {
  getTaskPriority,
  resolvePolicies,
  canExecuteTask,
  type PolicyContext,
} from '../policies/policyEngine.js';
import { createSupervisorTask } from '../models/SupervisorTask.js';

export interface PlannerOptions {
  deterministic?: boolean; // Use deterministic mode (default: true)
  llmModel?: string; // LLM model to use if not deterministic
  maxTasks?: number; // Maximum number of tasks to generate
  useCausalAnalysis?: boolean; // Enhance tasks with causal graph analysis (default: false)
}

/**
 * Plan tasks based on signals
 */
export async function planTasks(
  signals: SupervisorSignals,
  options: PlannerOptions = {}
): Promise<PlannedTask[]> {
  const { deterministic = true, maxTasks = 10, useCausalAnalysis = false } = options;

  let tasks: PlannedTask[];

  if (deterministic) {
    tasks = await planTasksDeterministic(signals, maxTasks);
  } else {
    tasks = await planTasksLLMAssisted(signals, options);
  }

  // Enhance with causal analysis if enabled
  if (useCausalAnalysis) {
    try {
      const { enhanceTasksWithCausalAnalysis, reorderTasksByCausalPriority } =
        await import('../integration/causalIntegration.js');
      const enhancements = await enhanceTasksWithCausalAnalysis(tasks, signals);
      tasks = reorderTasksByCausalPriority(enhancements);
    } catch (error) {
      // Log error but don't fail - fall back to original tasks
      console.warn('Error enhancing tasks with causal analysis:', error);
    }
  }

  return tasks;
}

/**
 * Deterministic planning mode (for tests)
 */
function planTasksDeterministic(
  signals: SupervisorSignals,
  maxTasks: number
): PlannedTask[] {
  const proposed: SupervisorTaskType[] = [];

  // DRIFT_SWEEP: Trigger if open drift events > 0
  if (signals.drift.openCount > 0) {
    proposed.push(SupervisorTaskType.RUN_DRIFT_SWEEP);
  }

  // SAFETY_SWEEP: Trigger if critical/high safety signals
  if (signals.safety.criticalCount > 0 || signals.safety.highCount > 5) {
    proposed.push(SupervisorTaskType.RUN_SAFETY_SWEEP);
  }

  // COMPLIANCE: Trigger if compliance failures
  if (signals.compliance.totalFailures > 0) {
    proposed.push(SupervisorTaskType.RUN_COMPLIANCE);
  }

  // PSV: Trigger if drift or safety signals exist
  if (signals.drift.openCount > 0 || signals.safety.activeCount > 0) {
    proposed.push(SupervisorTaskType.RUN_PSV);
  }

  // FUSION: Trigger if fusion deltas detected
  if (signals.fusionDeltas.length > 0) {
    proposed.push(SupervisorTaskType.RUN_FUSION);
  }

  // EHR_SYNC: Trigger if backlog too large
  if (
    signals.ehrSync.pendingSyncs > 10 ||
    signals.ehrSync.oldestPendingAge > 60 * 60 * 1000 // 1 hour
  ) {
    proposed.push(SupervisorTaskType.RUN_EHR_SYNC);
  }

  // MOBILITY: Trigger if drift detected
  if (signals.drift.openCount > 0) {
    proposed.push(SupervisorTaskType.RUN_MOBILITY);
  }

  // NCI_PUBLISH: Trigger periodically (not signal-based in deterministic mode)
  // Would be scheduled separately

  // PRIVILEGE_ISSUE: Trigger if new privilege grants pending
  // Would be triggered by privilege request events

  // Sort by priority and apply policies
  const sorted = [...proposed].sort(
    (a, b) => getTaskPriority(b) - getTaskPriority(a)
  );

  // Apply policies and limit to maxTasks
  return resolvePolicies(sorted.slice(0, maxTasks)).then((allowed) =>
    allowed.map((taskType) => ({
      taskType,
      priority: getTaskPriority(taskType),
      triggeredBy: buildTriggeredBy(taskType, signals),
      metadata: buildMetadata(taskType, signals),
    }))
  );
}

/**
 * LLM-assisted planning mode (for production)
 * TODO: Implement actual LLM integration
 */
async function planTasksLLMAssisted(
  signals: SupervisorSignals,
  options: PlannerOptions
): Promise<PlannedTask[]> {
  // For now, fall back to deterministic mode
  // In production, would:
  // 1. Format signals as context for LLM
  // 2. Send to LLM with prompt for task planning
  // 3. Parse LLM response into PlannedTask[]
  // 4. Validate against policies
  return planTasksDeterministic(signals, options.maxTasks ?? 10);
}

/**
 * Build "triggeredBy" description
 */
function buildTriggeredBy(
  taskType: SupervisorTaskType,
  signals: SupervisorSignals
): string {
  switch (taskType) {
    case SupervisorTaskType.RUN_DRIFT_SWEEP:
      return `drift_signals:${signals.drift.openCount}`;
    case SupervisorTaskType.RUN_SAFETY_SWEEP:
      return `safety_signals:${signals.safety.activeCount}`;
    case SupervisorTaskType.RUN_COMPLIANCE:
      return `compliance_failures:${signals.compliance.totalFailures}`;
    case SupervisorTaskType.RUN_PSV:
      return `drift:${signals.drift.openCount},safety:${signals.safety.activeCount}`;
    case SupervisorTaskType.RUN_FUSION:
      return `fusion_deltas:${signals.fusionDeltas.length}`;
    case SupervisorTaskType.RUN_EHR_SYNC:
      return `ehr_backlog:${signals.ehrSync.pendingSyncs}`;
    case SupervisorTaskType.RUN_MOBILITY:
      return `drift_signals:${signals.drift.openCount}`;
    default:
      return 'supervisor_planner';
  }
}

/**
 * Build task metadata
 */
function buildMetadata(
  taskType: SupervisorTaskType,
  signals: SupervisorSignals
): Record<string, unknown> {
  const base = {
    signalsSnapshot: {
      drift: signals.drift,
      safety: signals.safety,
      compliance: signals.compliance,
    },
  };

  switch (taskType) {
    case SupervisorTaskType.RUN_DRIFT_SWEEP:
      return {
        ...base,
        driftOpenCount: signals.drift.openCount,
        driftCriticalCount: signals.drift.criticalCount,
      };
    case SupervisorTaskType.RUN_SAFETY_SWEEP:
      return {
        ...base,
        safetyActiveCount: signals.safety.activeCount,
        safetyCriticalCount: signals.safety.criticalCount,
      };
    case SupervisorTaskType.RUN_EHR_SYNC:
      return {
        ...base,
        pendingSyncs: signals.ehrSync.pendingSyncs,
        oldestPendingAge: signals.ehrSync.oldestPendingAge,
      };
    default:
      return base;
  }
}

/**
 * Execute planned tasks (create SupervisorTask records)
 */
export async function executePlannedTasks(
  planned: PlannedTask[]
): Promise<string[]> {
  const taskIds: string[] = [];

  for (const task of planned) {
    const id = await createSupervisorTask({
      taskType: task.taskType,
      priority: task.priority,
      triggeredBy: task.triggeredBy,
      metadata: task.metadata,
    });
    taskIds.push(id);
  }

  return taskIds;
}

