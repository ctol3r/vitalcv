import type { JobQueueType } from '../../queue/models/JobQueue.js';

/**
 * Supervisor task priority levels.
 * Higher numbers = higher priority (executed first).
 */
export enum SupervisorTaskPriority {
  CRITICAL_SAFETY = 100,
  DRIFT = 80,
  COMPLIANCE_FAIL = 70,
  PRIVILEGE_ISSUE = 60,
  EHR_SYNC = 50,
  MOBILITY = 40,
  PSV = 30,
}

/**
 * Maps queue job types to their supervisor priority levels.
 * Priority ordering: CRITICAL safety → DRIFT → COMPLIANCE FAIL → PRIVILEGE_ISSUE → EHR_SYNC → MOBILITY → PSV
 */
export const JOB_TYPE_PRIORITY_MAP: Record<JobQueueType, SupervisorTaskPriority> = {
  SAFETY_SWEEP: SupervisorTaskPriority.CRITICAL_SAFETY,
  DRIFT_SWEEP: SupervisorTaskPriority.DRIFT,
  // Note: COMPLIANCE_FAIL is not a direct job type, but would be handled via other mechanisms
  PRIVILEGE_ISSUE: SupervisorTaskPriority.PRIVILEGE_ISSUE,
  EHR_SYNC: SupervisorTaskPriority.EHR_SYNC,
  MOBILITY_EVALUATE_ORG: SupervisorTaskPriority.MOBILITY,
  PSV_RUN: SupervisorTaskPriority.PSV,
  // Lower priority jobs
  SEND_EMAIL: SupervisorTaskPriority.PSV - 10,
  RUN_PILOT_SMOKE: SupervisorTaskPriority.PSV - 10,
  SYNC_METRICS: SupervisorTaskPriority.PSV - 10,
  CREDENTIAL_AGENT_TASK: SupervisorTaskPriority.PSV - 10,
  FHIR_SUBSCRIPTION_DELIVER: SupervisorTaskPriority.PSV - 10,
  FUSION_UPDATE: SupervisorTaskPriority.PSV - 10,
  NCI_PUBLISH_PROOFS: SupervisorTaskPriority.PSV - 10,
  SUPERVISOR_RUN: SupervisorTaskPriority.PSV - 20, // Supervisor runs are lowest priority
};

/**
 * Get priority for a job type.
 */
export function getJobPriority(jobType: JobQueueType): SupervisorTaskPriority {
  return JOB_TYPE_PRIORITY_MAP[jobType] ?? SupervisorTaskPriority.PSV;
}

/**
 * Compare two job types by priority (for sorting).
 * Returns negative if a < b, positive if a > b, zero if equal.
 */
export function compareJobPriority(
  a: JobQueueType,
  b: JobQueueType
): number {
  return getJobPriority(b) - getJobPriority(a); // Descending order (higher priority first)
}

/**
 * Sort an array of job types by priority (highest first).
 */
export function sortJobsByPriority(jobTypes: JobQueueType[]): JobQueueType[] {
  return [...jobTypes].sort(compareJobPriority);
}

