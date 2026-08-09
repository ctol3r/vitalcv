import type {
  CanonicalSourceCoverageSummary,
  CanonicalTruthDimensionId,
  CanonicalTruthStatus,
} from '@vitalcv/trust-state';

/**
 * Mirrors the backend contract in
 * `apps/api/backend/src/services/entity/employerReviewActions.ts`. There is no
 * employer decline/reject action: no route mounts one and no writer persists
 * one, so it must not appear here either — a phantom member let the review
 * surface render a "rejection recorded" success with nothing written behind it.
 */
export type EmployerReviewActionIntent = 'accept' | 'refresh' | 'review';
export type EmployerReviewPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type EmployerReviewPersistenceMode = 'durable_record' | 'audit_only';
export type EmployerReviewPersistenceTarget =
  | 'employer_acceptance'
  | 'review_queue_item'
  | 'outbox_event'
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
  truthStatuses: Record<CanonicalTruthDimensionId, CanonicalTruthStatus>;
  sourceCoverageSummary: CanonicalSourceCoverageSummary;
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
    outboxEventId?: string | null;
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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNullableString(value: unknown): value is string | null | undefined {
  return typeof value === 'string' || value === null || typeof value === 'undefined';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return typeof value === 'undefined' || value === null || isNumber(value);
}

function isEmployerReviewActionIntent(value: unknown): value is EmployerReviewActionIntent {
  return value === 'accept' || value === 'refresh' || value === 'review';
}

function isEmployerReviewPriority(value: unknown): value is EmployerReviewPriority {
  return value === 'LOW' || value === 'NORMAL' || value === 'HIGH';
}

function isEmployerReviewPersistenceMode(value: unknown): value is EmployerReviewPersistenceMode {
  return value === 'durable_record' || value === 'audit_only';
}

function isEmployerReviewPersistenceTarget(value: unknown): value is EmployerReviewPersistenceTarget {
  return value === 'employer_acceptance'
    || value === 'review_queue_item'
    || value === 'outbox_event'
    || value === 'audit_event';
}

function isEmployerAcceptanceScope(value: unknown): value is EmployerAcceptanceScope {
  return value === 'pilot' || value === 'full' || value === 'partial';
}

function isCanonicalTruthStatuses(
  value: unknown,
): value is Record<CanonicalTruthDimensionId, CanonicalTruthStatus> {
  if (!isRecord(value)) {
    return false;
  }

  return ['identity', 'safety', 'authority', 'eligibility'].every((dimension) => isString(value[dimension]));
}

function isCanonicalSourceCoverageSummary(
  value: unknown,
): value is CanonicalSourceCoverageSummary {
  if (!isRecord(value)) {
    return false;
  }

  return [
    'checked',
    'stale',
    'pending',
    'gated',
    'unavailable',
    'accessRequired',
    'reviewRequired',
    'notDecisionGrade',
    'previewOnly',
  ].every((key) => isStringArray(value[key]));
}

function isDecisionTrustSnapshot(value: unknown): value is DecisionTrustSnapshot {
  return isRecord(value)
    && isString(value.snapshotHash)
    && isString(value.capturedAt)
    && isString(value.npi)
    && isString(value.readinessStatus)
    && isNumber(value.readinessScore)
    && isString(value.readinessLevel)
    && isString(value.trustBand)
    && isString(value.trustBandLabel)
    && isNumber(value.trustScore)
    && isNumber(value.trustScoreConfidence)
    && isString(value.exclusionStatus)
    && isNullableString(value.exclusionCheckedAt)
    && isString(value.pecosEnrollmentStatus)
    && isNumber(value.verifiedCredentialCount)
    && isNumber(value.staleCredentialCount)
    && isNumber(value.reviewRequiredCount)
    && isNumber(value.blockerCount)
    && isStringArray(value.topBlockers)
    && isStringArray(value.missingDomains)
    && isStringArray(value.gatedDomains)
    && isCanonicalTruthStatuses(value.truthStatuses)
    && isCanonicalSourceCoverageSummary(value.sourceCoverageSummary)
    && isNullableString(value.lastCheckedAt);
}

function isEmployerReviewAcceptanceRecord(value: unknown): value is EmployerReviewAcceptanceRecord {
  return isRecord(value)
    && isNullableString(value.acceptedByOrgId)
    && isString(value.acceptedAt)
    && isEmployerAcceptanceScope(value.acceptanceScope)
    && isNullableString(value.acceptanceReason);
}

function isEmployerReviewActionDetails(value: unknown): value is EmployerReviewActionDetails {
  return isRecord(value)
    && isStringArray(value.staleSources)
    && isStringArray(value.missingDomains)
    && isNullableString(value.reason)
    && (
      typeof value.priority === 'undefined'
      || value.priority === null
      || isEmployerReviewPriority(value.priority)
    );
}

function isEmployerReviewActionPersistence(
  value: unknown,
): value is EmployerReviewActionState['persistence'] {
  return isRecord(value)
    && isEmployerReviewPersistenceMode(value.mode)
    && isEmployerReviewPersistenceTarget(value.target)
    && isNullableString(value.acceptanceId)
    && isNullableString(value.reviewItemId)
    && isNullableString(value.outboxEventId)
    && typeof value.reviewItemCreated === 'boolean';
}

function isEmployerReviewActionSummary(value: unknown): value is EmployerReviewActionState['summary'] {
  return isRecord(value)
    && isString(value.title)
    && isString(value.description);
}

export function isEmployerReviewActionState(value: unknown): value is EmployerReviewActionState {
  return isRecord(value)
    && isEmployerReviewActionIntent(value.action)
    && isString(value.entityId)
    && isString(value.clinicianNpi)
    && isString(value.auditEventId)
    && isString(value.timestamp)
    && isEmployerReviewActionPersistence(value.persistence)
    && isEmployerReviewActionSummary(value.summary)
    && isEmployerReviewActionDetails(value.details)
    && (
      typeof value.trustSnapshot === 'undefined'
      || isDecisionTrustSnapshot(value.trustSnapshot)
    )
    && (
      typeof value.acceptance === 'undefined'
      || isEmployerReviewAcceptanceRecord(value.acceptance)
    );
}

export function normalizeEmployerReviewActionState(
  value: unknown,
  expectedAction?: EmployerReviewActionIntent,
): EmployerReviewActionState | null {
  if (!isEmployerReviewActionState(value)) {
    return null;
  }

  if (expectedAction && value.action !== expectedAction) {
    return null;
  }

  return value;
}

export function normalizeEmployerReviewActionResponse(
  value: unknown,
  expectedAction?: EmployerReviewActionIntent,
): EmployerReviewActionResponse | null {
  if (!isRecord(value) || value.ok !== true) {
    return null;
  }

  const state = normalizeEmployerReviewActionState(value.state, expectedAction);
  if (!state) {
    return null;
  }

  return {
    ok: true,
    state,
  };
}

export function normalizeEmployerReviewStatusResponse(
  value: unknown,
): EmployerReviewStatusResponse | null {
  if (!isRecord(value) || value.ok !== true) {
    return null;
  }

  if (value.state === null) {
    return { ok: true, state: null };
  }

  const state = normalizeEmployerReviewActionState(value.state);
  if (!state) {
    return null;
  }

  return {
    ok: true,
    state,
  };
}

export function normalizeEmployerAcceptanceHistoryResponse(
  value: unknown,
): EmployerAcceptanceHistoryResponse | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.summary) || !Array.isArray(value.history)) {
    return null;
  }

  if (
    !isNumber(value.summary.acceptedOrganizationCount)
    || typeof value.summary.hasPriorAcceptances !== 'boolean'
    || !isString(value.summary.headline)
    || !isNullableString(value.summary.trustCopy)
  ) {
    return null;
  }

  const history = value.history.filter((entry): entry is EmployerAcceptanceHistoryEntry => (
    isRecord(entry)
    && isNullableString(entry.acceptanceId)
    && isString(entry.orgLabel)
    && typeof entry.isAnonymized === 'boolean'
    && isNullableString(entry.acceptedByOrgId)
    && isString(entry.acceptedAt)
    && isEmployerAcceptanceScope(entry.acceptanceScope)
    && isNullableString(entry.acceptanceReason)
  ));

  if (history.length !== value.history.length) {
    return null;
  }

  return {
    ok: true,
    summary: {
      acceptedOrganizationCount: value.summary.acceptedOrganizationCount,
      hasPriorAcceptances: value.summary.hasPriorAcceptances,
      headline: value.summary.headline,
      trustCopy: value.summary.trustCopy ?? null,
    },
    history,
  };
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
    return 'This environment captured audit-boundary metadata only.';
  }

  return null;
}

export function formatEmployerReviewPersistedDetail(state: EmployerReviewActionState): string {
  const details = [
    state.summary.description,
    formatPersistenceConfirmation(state),
    `Audit-boundary entry ${state.auditEventId} was captured ${new Date(state.timestamp).toLocaleString()}.`,
    state.trustSnapshot ? `Trust snapshot ${state.trustSnapshot.snapshotHash.slice(0, 12)}... was captured with the decision.` : null,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return details.join(' ');
}
