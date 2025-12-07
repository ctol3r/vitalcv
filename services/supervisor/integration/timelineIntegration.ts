/**
 * SupervisorTimelineIntegration
 *
 * Each supervisor decision produces TimelineEvent:
 * SUPERVISOR_TRIGGER → list of actions
 */

import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  PrismaClient,
} from '@prisma/client';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent.js';
import type { PlannedTask } from '../planner/supervisorPlanner.js';
import type { SupervisorSignals } from '../signals/signalCollector.js';

const prisma = new PrismaClient();

export interface SupervisorTriggerEvent {
  clinicianId?: string; // Optional - supervisor can trigger system-wide
  plannedTasks: PlannedTask[];
  signals: SupervisorSignals;
  metadata?: Record<string, unknown>;
}

/**
 * Record supervisor trigger event to timeline
 */
export async function recordSupervisorTrigger(
  event: SupervisorTriggerEvent
): Promise<void> {
  if (!event.clinicianId) {
    // System-wide supervisor trigger - log to a system timeline or skip
    // For now, we'll skip individual clinician timeline for system events
    return;
  }

  const taskSummaries = event.plannedTasks.map((task) => ({
    type: task.taskType,
    priority: task.priority,
    triggeredBy: task.triggeredBy,
  }));

  await logCredentialTimelineEvent({
    clinicianId: event.clinicianId,
    eventType: CredentialTimelineEventType.SUPERVISOR_TRIGGER,
    severity: determineSeverity(event.plannedTasks, event.signals),
    metadata: {
      tasks: taskSummaries,
      taskCount: event.plannedTasks.length,
      signals: {
        driftOpenCount: event.signals.drift.openCount,
        safetyActiveCount: event.signals.safety.activeCount,
        complianceFailures: event.signals.compliance.totalFailures,
      },
      ...event.metadata,
    },
  });
}

/**
 * Determine severity based on planned tasks and signals
 */
function determineSeverity(
  tasks: PlannedTask[],
  signals: SupervisorSignals
): TimelineEventSeverity {
  // CRITICAL if critical drift or safety signals
  if (
    signals.drift.criticalCount > 0 ||
    signals.safety.criticalCount > 0 ||
    signals.compliance.criticalFailures > 0
  ) {
    return TimelineEventSeverity.CRITICAL;
  }

  // WARNING if high-priority tasks or high signal counts
  if (
    signals.drift.highCount > 5 ||
    signals.safety.highCount > 5 ||
    signals.drift.openCount > 10 ||
    signals.safety.activeCount > 10
  ) {
    return TimelineEventSeverity.WARNING;
  }

  // NOTICE if any tasks planned
  if (tasks.length > 0) {
    return TimelineEventSeverity.NOTICE;
  }

  // INFO as default
  return TimelineEventSeverity.INFO;
}

/**
 * Record supervisor task completion to timeline
 */
export async function recordSupervisorTaskCompletion(
  clinicianId: string,
  taskType: string,
  success: boolean,
  result?: Record<string, unknown>
): Promise<void> {
  await logCredentialTimelineEvent({
    clinicianId,
    eventType: CredentialTimelineEventType.SUPERVISOR_TRIGGER,
    severity: success ? TimelineEventSeverity.INFO : TimelineEventSeverity.WARNING,
    metadata: {
      taskType,
      success,
      result,
    },
  });
}

