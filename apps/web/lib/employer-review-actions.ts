export type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review';
export type EmployerReviewPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type EmployerReviewPersistenceMode = 'durable_record' | 'audit_only';
export type EmployerReviewPersistenceTarget =
  | 'employer_acceptance'
  | 'review_queue_item'
  | 'audit_event';

export interface EmployerReviewActionDetails {
  staleSources: string[];
  missingDomains: string[];
  reason: string | null;
  priority: EmployerReviewPriority | null;
}

/** Immutable trust state at moment of employer decision — core of audit trail */
export interface DecisionTrustSnapshot {
  snapshotHash: string;
  capturedAt: string;
  npi: string;
  readinessStatus: string;
  readinessScore: number;
  readinessLevel: string;
  trustBand: string;
  trustBandLabel: string;
  trustScore: number;
  trustScoreConfidence: number;
  exclusionStatus: string;
  exclusionCheckedAt: string | null;
  pecosEnrollmentStatus: string;
  verifiedCredentialCount: number;
  staleCredentialCount: number;
  reviewRequiredCount: number;
  blockerCount: number;
  topBlockers: string[];
  missingDomains: string[];
  gatedDomains: string[];
  lastCheckedAt: string | null;
}

export interface EmployerReviewActionState {
  action: EmployerReviewActionIntent;
  entityId: string;
  clinicianNpi: string;
  auditEventId: string;
  timestamp: string;
  persistence: {
    mode: EmployerReviewPersistenceMode;
    target: EmployerReviewPersistenceTarget;
    acceptanceId: string | null;
    reviewItemId: string | null;
    reviewItemCreated: boolean;
  };
  summary: {
    title: string;
    description: string;
  };
  details: EmployerReviewActionDetails;
  /** Immutable trust state at decision — present in all actions from this wave forward */
  trustSnapshot: DecisionTrustSnapshot;
}

export interface EmployerReviewActionResponse {
  ok: true;
  state: EmployerReviewActionState;
}

export interface EmployerReviewStatusResponse {
  ok: true;
  state: EmployerReviewActionState | null;
}

export function employerReviewLoadingLabel(intent: EmployerReviewActionIntent): string {
  switch (intent) {
    case 'accept':
      return 'Recording acceptance...';
    case 'refresh':
      return 'Recording refresh request...';
    case 'review':
      return 'Recording review routing...';
    default:
      return 'Recording employer action...';
  }
}

export function formatEmployerReviewPersistedLabel(state: EmployerReviewActionState): string {
  switch (state.action) {
    case 'accept':
      return 'Most recent persisted action: employer acceptance';
    case 'refresh':
      return 'Most recent persisted action: refresh request';
    case 'review':
      return state.persistence.reviewItemCreated
        ? 'Most recent persisted action: routed to review queue'
        : 'Most recent persisted action: review routing';
    default:
      return 'Most recent persisted action';
  }
}

export function formatEmployerReviewPersistedDetail(state: EmployerReviewActionState): string {
  return `${state.summary.description} Audit event ${state.auditEventId} was recorded ${new Date(state.timestamp).toLocaleString()}.`;
}
