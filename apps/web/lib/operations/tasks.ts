/**
 * Task orchestration + priority service (Wave 1400, C2/C3)
 * ──────────────────────────────────────────────────────────────────────────
 * Derives the daily operational worklist from the canonical Career Model. Every
 * task corresponds to a REAL fact: a piece of evidence that is not decision-grade,
 * a revoked/expired credential, or a readiness blocker. Operations never
 * fabricate work, never mutate evidence, and never confer decision-grade — a task
 * is a descriptor of work to be done, derived from the same honest signals the
 * rest of the platform uses.
 *
 * Pure: a projection over an already-composed model. No I/O, no trust math.
 */
import type { CareerModel, EvidenceObject } from '@vitalcv/domain-evidence';

export type OperationalTaskType =
  | 'review_revoked'
  | 'refresh_expired'
  | 'resolve_blocker'
  | 'verify_evidence';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type AssigneeRole = 'credentialer' | 'recruiter' | 'clinician';

export interface OperationalTask {
  taskId: string;
  type: OperationalTaskType;
  subjectKey: string;
  label: string;
  /** Honest, fact-based reason this task exists. */
  reason: string;
  priority: TaskPriority;
  assigneeRole: AssigneeRole;
  /** The evidence this task concerns, when applicable. */
  evidenceId: string | null;
}

/** Priority inputs — all real risk signals, never arbitrary. */
export interface PriorityFactors {
  /** A revoked credential or a mandatory readiness blocker — highest risk. */
  blocking: boolean;
  /** Evidence past its expiry / lifecycle expired. */
  expired: boolean;
  /** Backs a fixable mandatory gap. */
  fixableGap: boolean;
}

/**
 * C3: deterministic priority from real risk factors. Blocking risk is always
 * critical; expiry is high; a fixable mandatory gap is high; otherwise normal.
 */
export function calculateTaskPriority(factors: PriorityFactors): TaskPriority {
  if (factors.blocking) return 'critical';
  if (factors.expired) return 'high';
  if (factors.fixableGap) return 'high';
  return 'normal';
}

function isActionableEvidence(obj: EvidenceObject): boolean {
  // Active evidence that is not decision-grade is work to verify. Superseded
  // evidence is not actionable (it has been replaced).
  return obj.lifecycle === 'active' && !obj.decisionGrade;
}

/**
 * C2: derive the operational task list from the model. Each task is grounded in
 * a real fact carried by the model — no fabricated work.
 */
export function deriveTasks(model: CareerModel): OperationalTask[] {
  const tasks: OperationalTask[] = [];
  const subjectKey = model.identity.subjectKey;
  const fixableSet = new Set(model.readiness.fixableGaps);

  // 1. Revoked / expired evidence — highest-risk, fact-driven.
  for (const obj of model.evidence.objects) {
    if (obj.lifecycle === 'revoked') {
      tasks.push({
        taskId: `task:review_revoked:${obj.evidenceId}`,
        type: 'review_revoked',
        subjectKey,
        label: `Review revoked: ${obj.label}`,
        reason: `Evidence "${obj.label}" is revoked (fails closed).`,
        priority: calculateTaskPriority({ blocking: true, expired: false, fixableGap: false }),
        assigneeRole: 'credentialer',
        evidenceId: obj.evidenceId,
      });
    } else if (obj.lifecycle === 'expired') {
      tasks.push({
        taskId: `task:refresh_expired:${obj.evidenceId}`,
        type: 'refresh_expired',
        subjectKey,
        label: `Refresh expired: ${obj.label}`,
        reason: `Evidence "${obj.label}" has expired and needs a fresh source check.`,
        priority: calculateTaskPriority({ blocking: false, expired: true, fixableGap: false }),
        assigneeRole: 'clinician',
        evidenceId: obj.evidenceId,
      });
    }
  }

  // 2. Readiness blockers — mandatory, unremediable gaps.
  for (const blocker of model.readiness.blockers) {
    tasks.push({
      taskId: `task:resolve_blocker:${slug(blocker)}`,
      type: 'resolve_blocker',
      subjectKey,
      label: `Resolve blocker`,
      reason: blocker,
      priority: calculateTaskPriority({ blocking: true, expired: false, fixableGap: false }),
      assigneeRole: 'credentialer',
      evidenceId: null,
    });
  }

  // 3. Active, non-decision-grade evidence — work to verify. Higher priority when
  //    it backs a fixable mandatory gap.
  for (const obj of model.evidence.objects) {
    if (!isActionableEvidence(obj)) continue;
    const fixableGap = fixableSet.has(obj.evidenceId);
    tasks.push({
      taskId: `task:verify_evidence:${obj.evidenceId}`,
      type: 'verify_evidence',
      subjectKey,
      label: `Verify: ${obj.label}`,
      reason: `Evidence "${obj.label}" is ${obj.status} (not decision-grade); a source check is needed.`,
      priority: calculateTaskPriority({ blocking: false, expired: false, fixableGap }),
      assigneeRole: 'credentialer',
      evidenceId: obj.evidenceId,
    });
  }

  return tasks;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
}
