export type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review' | 'reject';
export type EmployerReviewPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type EmployerReviewPersistenceMode = 'durable_record' | 'audit_only';
export type EmployerReviewPersistenceTarget =
  | 'employer_acceptance'
  | 'review_queue_item'
  | 'audit_event';
export type EmployerAcceptanceScope = 'pilot' | 'full' | 'partial';

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

export interface EmployerReviewAcceptanceRecord {
  acceptedByOrgId: string | null;
  acceptedAt: string;
  acceptanceScope: EmployerAcceptanceScope;
  acceptanceReason: string | null;
}

export interface EmployerAcceptanceHistoryEntry extends EmployerReviewAcceptanceRecord {
  acceptanceId: string | null;
  orgLabel: string;
  isAnonymized: boolean;
}

export interface EmployerAcceptanceHistoryResponse {
  ok: true;
  summary: {
    acceptedOrganizationCount: number;
    hasPriorAcceptances: boolean;
    headline: string;
    trustCopy: string | null;
  };
  history: EmployerAcceptanceHistoryEntry[];
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
  trustSnapshot?: DecisionTrustSnapshot;
  /** Portable acceptance payload — present for accept actions. */
  acceptance?: EmployerReviewAcceptanceRecord;
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
    case 'reject':
      return 'Recording rejection...';
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
    case 'reject':
      return 'Most recent persisted action: employer rejection';
    default:
      return 'Most recent persisted action';
  }
}

function formatPersistenceConfirmation(state: EmployerReviewActionState): string | null {
  if (state.persistence.target === 'employer_acceptance' && state.persistence.acceptanceId) {
    return `Acceptance record ${state.persistence.acceptanceId} was stored.`;
  }

  if (state.persistence.target === 'review_queue_item' && state.persistence.reviewItemCreated) {
    return state.persistence.reviewItemId
      ? `Review queue item ${state.persistence.reviewItemId} was created.`
      : 'A durable review queue item was created.';
  }

  if (state.persistence.mode === 'audit_only') {
    return 'This environment persisted the audit trail only.';
  }

  return null;
}

export function formatEmployerReviewPersistedDetail(state: EmployerReviewActionState): string {
  const details = [
    state.summary.description,
    formatPersistenceConfirmation(state),
    `Audit event ${state.auditEventId} was recorded ${new Date(state.timestamp).toLocaleString()}.`,
    state.trustSnapshot ? `Trust snapshot ${state.trustSnapshot.snapshotHash.slice(0, 12)}... was captured with the decision.` : null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return details.join(' ');
}
