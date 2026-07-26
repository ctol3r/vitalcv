/**
 * Operational event stream (Wave 1400, C1)
 * ──────────────────────────────────────────────────────────────────────────
 * A deterministic operational event log over the derived tasks. These are
 * OPERATIONAL records — they describe workforce activity (a task was created,
 * an evidence item is expiring). They are NOT the authoritative issuer/PSV audit
 * trail: each record is explicitly `authoritative: false` and carries no PHI —
 * only a subjectKey, never a name or raw evidence value.
 *
 * Pure/deterministic: ids and timestamps are injected (no clock).
 */
import type { OperationalTask } from './tasks';

export type OperationalEventType = 'task.created' | 'blocker.detected' | 'evidence.expiring';

export interface OperationalEvent {
  eventId: string;
  type: OperationalEventType;
  subjectKey: string;
  occurredAt: string;
  /** Operational reference (task id) — never PHI. */
  ref: string;
  summary: string;
  /** Always false: this is an operational log, not the authoritative audit trail. */
  authoritative: false;
}

function eventTypeForTask(task: OperationalTask): OperationalEventType {
  if (task.type === 'resolve_blocker') return 'blocker.detected';
  if (task.type === 'refresh_expired') return 'evidence.expiring';
  return 'task.created';
}

/**
 * Record one operational event per task. `at` is injected for determinism; each
 * event id derives from the task id, so the log is stable for a given worklist.
 */
export function recordOperationalEvents(tasks: OperationalTask[], at: string): OperationalEvent[] {
  return tasks.map((task) => ({
    eventId: `evt:${task.taskId}`,
    type: eventTypeForTask(task),
    subjectKey: task.subjectKey,
    occurredAt: at,
    ref: task.taskId,
    summary: task.label,
    authoritative: false,
  }));
}
