/**
 * ENTERPRISE-VANGUARD-6A — retention policy foundation.
 *
 * Truth invariants:
 *   1. This module documents retention policy shape only.
 *   2. No cron, database delete, or storage lifecycle integration is wired.
 *   3. Explanations must describe planned handling, not production deletion.
 */

export type RetentionEntityType =
  | 'audit_event'
  | 'application_snapshot'
  | 'source_check_result'
  | 'session_token'
  | 'clinician_profile';

export interface RetentionPolicy {
  entityType: RetentionEntityType;
  retentionDays: number;
  autoDeleteNote: string;
  requiresManualReview: boolean;
}

export interface RetentionFoundation {
  retentionEnforced: false;
  autoDeleteLive: false;
  retentionCronLive: false;
  policies: ReadonlyArray<RetentionPolicy>;
}

export const DEFAULT_RETENTION_POLICIES: ReadonlyArray<RetentionPolicy> = [
  {
    entityType: 'audit_event',
    retentionDays: 2555,
    autoDeleteNote: 'Planned seven-year audit retention model; deletion requires compliance review.',
    requiresManualReview: true,
  },
  {
    entityType: 'application_snapshot',
    retentionDays: 2555,
    autoDeleteNote: 'Planned seven-year application snapshot retention model for replayable decisions.',
    requiresManualReview: true,
  },
  {
    entityType: 'source_check_result',
    retentionDays: 365,
    autoDeleteNote: 'Planned one-year retention model for source-check outputs before archival review.',
    requiresManualReview: true,
  },
  {
    entityType: 'session_token',
    retentionDays: 30,
    autoDeleteNote: 'Planned short retention model for token metadata; secret material should not be retained here.',
    requiresManualReview: false,
  },
  {
    entityType: 'clinician_profile',
    retentionDays: 2555,
    autoDeleteNote: 'Planned seven-year profile retention model while credentialing decisions may need replay.',
    requiresManualReview: true,
  },
] as const;

export function buildRetentionFoundation(): RetentionFoundation {
  return {
    retentionEnforced: false,
    autoDeleteLive: false,
    retentionCronLive: false,
    policies: DEFAULT_RETENTION_POLICIES,
  };
}

export function getPolicyForEntity(entityType: RetentionEntityType): RetentionPolicy | undefined {
  return DEFAULT_RETENTION_POLICIES.find((policy) => policy.entityType === entityType);
}

export function explainRetentionPolicy(policy: RetentionPolicy): string {
  const manualReview = policy.requiresManualReview
    ? 'manual review is planned before deletion or archival'
    : 'manual review is not planned for routine expiry';

  return `${policy.entityType} has a planned ${policy.retentionDays}-day retention window; ${manualReview}. This foundation documents policy shape and is not enforced.`;
}
