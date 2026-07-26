/**
 * Operational projections + real-time activity (Wave 1400, C4/C5)
 * ──────────────────────────────────────────────────────────────────────────
 * Projects the derived task list into operational views: a worklist grouped by
 * assignee role and priority, and an activity feed over operational events. All
 * projections are pass-through over already-derived, fact-based tasks — they
 * never invent work or reorder by anything other than honest priority/time.
 */
import type { OperationalTask, TaskPriority, AssigneeRole } from './tasks';
import type { OperationalEvent } from './events';

const PRIORITY_RANK: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

export interface Worklist {
  subjectKey: string;
  total: number;
  byRole: Record<AssigneeRole, OperationalTask[]>;
  byPriority: Record<TaskPriority, number>;
  /** All tasks, priority-sorted (critical first), then by id for determinism. */
  ordered: OperationalTask[];
}

/** C4: group + order tasks for daily operations. */
export function projectWorklist(subjectKey: string, tasks: OperationalTask[]): Worklist {
  const byRole: Record<AssigneeRole, OperationalTask[]> = { credentialer: [], recruiter: [], clinician: [] };
  const byPriority: Record<TaskPriority, number> = { critical: 0, high: 0, normal: 0, low: 0 };

  for (const task of tasks) {
    byRole[task.assigneeRole].push(task);
    byPriority[task.priority] += 1;
  }

  const ordered = [...tasks].sort((a, b) => {
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    }
    return a.taskId.localeCompare(b.taskId);
  });

  return { subjectKey, total: tasks.length, byRole, byPriority, ordered };
}

export interface ActivityItem {
  at: string;
  type: string;
  subjectKey: string;
  summary: string;
  /** Operational, not authoritative audit. */
  authoritative: false;
}

/**
 * C5: a real-time activity feed from operational events, newest first. Carries
 * only summaries + subjectKey — never PHI or raw evidence.
 */
export function buildActivityFeed(events: OperationalEvent[]): ActivityItem[] {
  return [...events]
    .sort((a, b) => (a.occurredAt === b.occurredAt ? a.eventId.localeCompare(b.eventId) : a.occurredAt < b.occurredAt ? 1 : -1))
    .map((e) => ({ at: e.occurredAt, type: e.type, subjectKey: e.subjectKey, summary: e.summary, authoritative: false }));
}
