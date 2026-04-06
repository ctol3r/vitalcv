/**
 * pilotKpiService.ts — Pilot Operations KPI Engine
 *
 * Answers the seven Interview-to-Start Velocity questions from real product data:
 *
 *   1. How many packets were shared?
 *   2. How many employers opened review?
 *   3. How many decisions were made, by type?
 *   4. Median days: first review → decision
 *   5. Median days: first review → readiness L2+
 *   6. Median days: first review → actual start
 *   7. Blocker categories and average resolution time
 *
 * SAFETY CONTRACT
 * ───────────────
 * This service is READ-ONLY. It touches:
 *   bundle_share_events, advisory_outcome_events,
 *   employer_decision_events, start_outcome_events,
 *   blocker_resolution_events, employer_acceptances,
 *   start_attestations
 *
 * It MUST NOT write to:
 *   trust_state, claims, artifacts, receipts, readiness_score
 *
 * All timing is computed from stored timestamps — no mutation.
 */

import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Pilot Filter ─────────────────────────────────────────────────────────

/**
 * PilotFilter — restricts KPI queries to a specific pilot / org / lane.
 *
 * All fields are optional. When all are null the query is unfiltered (global view).
 * Each non-null field narrows the result set via JSONB metadata path equality.
 *
 * Safe fallback: events that predate scoping have no metadata keys → they are
 * excluded from scoped queries and included in global queries.
 */
export interface PilotFilter {
  /** Filter by pilotId stored in metadata.pilotId */
  pilotId?: string | null;
  /** Filter by workflowLane stored in metadata.workflowLane */
  workflowLane?: string | null;
  /** Filter by organizationContextId FK (UUID, first-class column) */
  orgContextId?: string | null;
  /** Filter by geographyTag stored in metadata.geographyTag */
  geographyTag?: string | null;
}

function normalizePilotFilter(filter: PilotFilter | undefined): PilotFilter {
  return {
    pilotId: filter?.pilotId ?? null,
    workflowLane: filter?.workflowLane ?? null,
    orgContextId: filter?.orgContextId ?? null,
    geographyTag: filter?.geographyTag ?? null,
  };
}

const REVIEW_OPEN_EVENT_TYPE = 'EMPLOYER_REVIEW' as const;
const REVIEW_OPEN_ADVISORY_VERSION = 'pilot-review-open' as const;
const READY_READINESS_THRESHOLD = 60;
const PILOT_OPS_EVENT_AUDIT_TYPE = 'PILOT_OPS_EVENT' as const;
const PILOT_PROOF_EVENT_AUDIT_TYPE = 'PILOT_PROOF_EVENT' as const;
const BLOCKER_RESOLVED_EVENT_TYPE = 'blocker_resolved' as const;
const DID_NOT_START_OUTCOME_STATUS = 'DID_NOT_START' as const;
const DECISION_BUCKETS = [
  ['proceedCount', 'PROCEED'],
  ['refreshCount', 'REQUEST_REFRESH'],
  ['routeCount', 'ROUTE_TO_REVIEW'],
  ['rejectCount', 'REJECT'],
  ['holdCount', 'HOLD'],
] as const;
const CORE_PROOF_CHAIN_EVENTS = [
  'packet_shared',
  'employer_review_opened',
  'employer_decision_recorded',
  'start_outcome_recorded',
] as const;
const METADATA_SCOPE_FIELDS = [
  { key: 'pilotId', path: ['pilotId'] },
  { key: 'workflowLane', path: ['workflowLane'] },
  { key: 'geographyTag', path: ['geographyTag'] },
] as const;

type MetadataPathEquals = {
  path: string[];
  equals: string;
};

/** Build Prisma JSONB path filters for metadata-stored scope fields */
function metadataScopeWhere(filter: PilotFilter): MetadataPathEquals[] {
  return METADATA_SCOPE_FIELDS.flatMap((field) => {
    const value = filter[field.key];
    return value ? [{ path: [...field.path], equals: value }] : [];
  });
}

/** True when filter would restrict results */
function isFiltered(filter: PilotFilter): boolean {
  return !!(filter.pilotId || filter.workflowLane || filter.orgContextId || filter.geographyTag);
}

function advisoryOutcomeWhere(
  since: Date,
  filter: PilotFilter,
  extra: Omit<Prisma.AdvisoryOutcomeEventWhereInput, 'eventTimestamp' | 'organizationContextId' | 'AND'> = {},
): Prisma.AdvisoryOutcomeEventWhereInput {
  const clauses = metadataScopeWhere(filter);

  return {
    eventTimestamp: { gte: since },
    ...(filter.orgContextId ? { organizationContextId: filter.orgContextId } : {}),
    ...extra,
    ...(clauses.length > 0
      ? { AND: clauses.map((clause) => ({ metadata: clause })) }
      : {}),
  };
}

function employerDecisionWhere(
  since: Date,
  filter: PilotFilter,
): Prisma.EmployerDecisionEventWhereInput {
  const clauses = metadataScopeWhere(filter);

  return {
    decidedAt: { gte: since },
    ...(filter.orgContextId ? { organizationContextId: filter.orgContextId } : {}),
    ...(clauses.length > 0
      ? { AND: clauses.map((clause) => ({ metadata: clause })) }
      : {}),
  };
}

function blockerResolutionWhere(
  since: Date,
  filter: PilotFilter,
): Prisma.BlockerResolutionEventWhereInput {
  const clauses = metadataScopeWhere(filter);

  return {
    openedAt: { gte: since },
    ...(clauses.length > 0
      ? { AND: clauses.map((clause) => ({ metadata: clause })) }
      : {}),
  };
}

function startOutcomeWhere(
  since: Date,
  filter: PilotFilter,
): Prisma.StartOutcomeEventWhereInput {
  const clauses = metadataScopeWhere(filter);

  return {
    startedAt: { gte: since },
    ...(filter.orgContextId ? { organizationContextId: filter.orgContextId } : {}),
    ...(clauses.length > 0
      ? { AND: clauses.map((clause) => ({ metadata: clause })) }
      : {}),
  };
}

const SHARE_EVENT_SELECT = {
  id: true,
  bundleId: true,
  subjectEntityId: true,
  organizationContextId: true,
  organizationId: true,
  deliveryStatus: true,
  sharedAt: true,
  npi: true,
} satisfies Prisma.BundleShareEventSelect;

const ADVISORY_EVENT_SELECT = {
  id: true,
  entityId: true,
  organizationContextId: true,
  advisoryVersion: true,
  eventType: true,
  eventTimestamp: true,
  readinessScoreAtEvent: true,
  blockersAtEvent: true,
  metadata: true,
} satisfies Prisma.AdvisoryOutcomeEventSelect;

const DECISION_EVENT_SELECT = {
  id: true,
  entityId: true,
  organizationContextId: true,
  decision: true,
  decidedAt: true,
  readinessScoreAtDecision: true,
  blockersAtDecision: true,
  metadata: true,
} satisfies Prisma.EmployerDecisionEventSelect;

const BLOCKER_EVENT_SELECT = {
  id: true,
  entityId: true,
  blockerCode: true,
  openedAt: true,
  resolvedAt: true,
  resolutionDays: true,
  resolutionMethod: true,
  status: true,
  metadata: true,
} satisfies Prisma.BlockerResolutionEventSelect;

const START_OUTCOME_SELECT = {
  id: true,
  entityId: true,
  organizationContextId: true,
  startedAt: true,
  daysFromFirstReview: true,
  daysFromShare: true,
  daysFromReady: true,
  readinessScoreAtStart: true,
  blockersAtStart: true,
  metadata: true,
} satisfies Prisma.StartOutcomeEventSelect;

const AUDIT_EVENT_SELECT = {
  id: true,
  type: true,
  referenceId: true,
  clinicianId: true,
  organizationId: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.AuditEventSelect;

type StartOutcomeRow = Prisma.StartOutcomeEventGetPayload<{ select: typeof START_OUTCOME_SELECT }>;
type AuditEventRow = Prisma.AuditEventGetPayload<{ select: typeof AUDIT_EVENT_SELECT }>;
type AdvisoryEventRow = Prisma.AdvisoryOutcomeEventGetPayload<{ select: typeof ADVISORY_EVENT_SELECT }>;

export type PilotProofChainEventName =
  | 'packet_shared'
  | 'employer_review_opened'
  | 'employer_decision_recorded'
  | 'readiness_changed'
  | 'blocker_opened'
  | 'blocker_resolved'
  | 'start_outcome_recorded';

export interface PilotProofChainEvent {
  eventName: PilotProofChainEventName;
  occurredAt: string;
  caseKey: string;
  entityId: string | null;
  npi: string | null;
  organizationContextId: string | null;
  organizationId: string | null;
  pilotId: string | null;
  workflowLane: string | null;
  geographyTag: string | null;
  sourceRecordType: string;
  sourceRecordId: string;
  outcomeStatus: string | null;
  detail: string | null;
}

export interface PilotProofChainCase {
  caseKey: string;
  entityId: string | null;
  npi: string | null;
  organizationContextId: string | null;
  organizationId: string | null;
  eventNames: PilotProofChainEventName[];
  missingCoreEvents: Array<(typeof CORE_PROOF_CHAIN_EVENTS)[number]>;
  replayable: boolean;
  lastOccurredAt: string;
  nonStartReason: string | null;
}

export interface PilotProofChainSummary {
  totalEvents: number;
  totalCases: number;
  replayableCases: number;
  partialCases: number;
  cases: PilotProofChainCase[];
  events: PilotProofChainEvent[];
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface PacketShareStats {
  total: number;
  distinctEntities: number;
  distinctOrgs: number;
  byDeliveryStatus: Record<string, number>;
  earliestSharedAt: string | null;
  latestSharedAt: string | null;
}

export interface ReviewOpenedStats {
  total: number;
  distinctEntities: number;
  byOrgContext: Array<{ orgContextId: string | null; count: number }>;
  earliestAt: string | null;
  latestAt: string | null;
}

export interface DecisionStats {
  total: number;
  byType: Record<string, number>;
  proceedCount: number;
  refreshCount: number;
  routeCount: number;
  rejectCount: number;
  holdCount: number;
}

export interface VelocityStats {
  /** Median days from first EMPLOYER_REVIEW advisory event to first employer decision */
  medianDaysFirstReviewToDecision: number | null;
  /** Median days from first EMPLOYER_REVIEW advisory event to readiness score ≥ 60 */
  medianDaysFirstReviewToReady: number | null;
  /** Median days from first EMPLOYER_REVIEW advisory event to StartOutcomeEvent */
  medianDaysFirstReviewToStart: number | null;
  /** Median days from BundleShareEvent to first EmployerDecisionEvent */
  medianDaysShareToDecision: number | null;
  /** Sample sizes for each calculation */
  sampleSizes: {
    reviewToDecision: number;
    reviewToReady: number;
    reviewToStart: number;
    shareToDecision: number;
  };
}

export interface BlockerKpi {
  code: string;
  openCount: number;
  resolvedCount: number;
  avgResolutionDays: number | null;
  medianResolutionDays: number | null;
  byResolutionMethod: Record<string, number>;
}

export interface ReadinessDistribution {
  /** Clinicians with at least one employer review whose latest advisory score is READY (≥60) */
  ready: number;
  /** Clinicians whose latest advisory score is PARTIAL (30–59) */
  partial: number;
  /** Clinicians whose latest advisory score is BLOCKED (<30) or had explicit blockers at review */
  blocked: number;
  /** Total distinct clinicians with at least one review event in the window */
  total: number;
  /** Clinicians who were reviewed but have no score recorded (pre-date score capture) */
  noScore: number;
}

export interface StartOutcomeStats {
  totalStarts: number;
  totalOutcomeRecords: number;
  didNotStartCount: number;
  nonStartReasons: Array<{ reason: string; count: number }>;
  distinctEntities: number;
  readinessAtStart: {
    avgScore: number | null;
    medianScore: number | null;
    withBlockers: number;
  };
}

export interface PilotKpiSnapshot {
  generatedAt: string;
  windowDays: number;
  since: string;
  /** Active filter — null values mean unfiltered / global */
  appliedFilter: PilotFilter;
  /** True when at least one filter field is active */
  isFiltered: boolean;

  /** KPI 1 — Packet shares */
  packetShares: PacketShareStats;

  /** KPI 2 — Employer review opens */
  reviewsOpened: ReviewOpenedStats;

  /** KPI 3 — Employer decisions by type */
  decisions: DecisionStats;

  /** KPI 4–6 — Time-to-X velocity calculations */
  velocity: VelocityStats;

  /** KPI 7 — Blocker categories + resolution time */
  blockers: BlockerKpi[];

  /** Start outcomes */
  startOutcomes: StartOutcomeStats;

  /** Audit-trail counts — confirms the event chain is firing */
  eventChain: {
    bundleShareEvents: number;
    advisoryOutcomeEvents: number;
    employerDecisionEvents: number;
    blockerResolutionEvents: number;
    blockerResolvedMetricEvents: number;
    readinessChangeEvents: number;
    startOutcomeEvents: number;
    nonStartOutcomeEvents: number;
    employerAcceptances: number;
    startAttestations: number;
  };

  /** Readiness distribution — READY/PARTIAL/BLOCKED counts for reviewed clinicians */
  readinessDistribution: ReadinessDistribution;

  /** Normalized proof chain — replayable live pilot event sequence */
  proofChain: PilotProofChainSummary;

  /** Missing fields in this window — informs what to collect next */
  gaps: string[];
}

export interface PilotKpiExportRow {
  section: string;
  label: string;
  value: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? null);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function readJson(value: unknown): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function groupRowsByKey<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;

    const existing = grouped.get(key) ?? [];
    existing.push(row);
    grouped.set(key, existing);
  }

  return grouped;
}

function earliestDateByKey<T>(
  rows: T[],
  keyOf: (row: T) => string | null | undefined,
  dateOf: (row: T) => Date,
): Map<string, Date> {
  const dates = new Map<string, Date>();

  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;

    const candidate = dateOf(row);
    const existing = dates.get(key);
    if (!existing || candidate < existing) {
      dates.set(key, candidate);
    }
  }

  return dates;
}

function readTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readScopeFields(metadata: Record<string, unknown>): {
  pilotId: string | null;
  workflowLane: string | null;
  geographyTag: string | null;
} {
  return {
    pilotId: readString(metadata.pilotId),
    workflowLane: readString(metadata.workflowLane),
    geographyTag: readString(metadata.geographyTag),
  };
}

function matchesEventScope(metadata: Record<string, unknown>, filter: PilotFilter): boolean {
  if (filter.orgContextId) {
    const orgContextId =
      readString(metadata.organizationContextId)
      ?? readString(metadata.orgContextId)
      ?? null;
    if (orgContextId !== filter.orgContextId) {
      return false;
    }
  }

  const scope = readScopeFields(metadata);
  if (filter.pilotId && scope.pilotId !== filter.pilotId) {
    return false;
  }
  if (filter.workflowLane && scope.workflowLane !== filter.workflowLane) {
    return false;
  }
  if (filter.geographyTag && scope.geographyTag !== filter.geographyTag) {
    return false;
  }

  return true;
}

function reviewChainKey(
  entityId: string | null | undefined,
  organizationContextId: string | null | undefined,
  metadata?: unknown,
): string | null {
  if (!entityId) {
    return null;
  }

  const scope = readScopeFields(readJson(metadata));
  return [
    entityId,
    organizationContextId ?? '(global)',
    scope.pilotId ?? '(all)',
    scope.workflowLane ?? '(all)',
    scope.geographyTag ?? '(all)',
  ].join('|');
}

function shareDecisionChainKey(
  entityId: string | null | undefined,
  organizationContextId: string | null | undefined,
): string | null {
  return entityId ? `${entityId}|${organizationContextId ?? '(global)'}` : null;
}

function hasMetadataScopedFilter(filter: PilotFilter): boolean {
  return Boolean(filter.pilotId || filter.workflowLane || filter.geographyTag);
}

function isReviewOpenEvent(event: AdvisoryEventRow): boolean {
  if (event.eventType !== REVIEW_OPEN_EVENT_TYPE) {
    return false;
  }

  if (event.advisoryVersion === REVIEW_OPEN_ADVISORY_VERSION) {
    return true;
  }

  const metadata = readJson(event.metadata);
  const eventName = readString(metadata.eventName);
  if (eventName && eventName !== 'employer_review_opened') {
    return false;
  }

  return readString(metadata.reason) !== 'refresh_requested';
}

function proofChainCaseKey(event: {
  entityId: string | null;
  npi: string | null;
  organizationContextId: string | null;
}): string {
  return [
    event.entityId ?? event.npi ?? 'unscoped',
    event.organizationContextId ?? 'global',
  ].join('|');
}

function buildProofChainSummary(
  events: PilotProofChainEvent[],
): PilotProofChainSummary {
  const eventsByCase = new Map<string, PilotProofChainEvent[]>();

  for (const event of events) {
    const existing = eventsByCase.get(event.caseKey) ?? [];
    existing.push(event);
    eventsByCase.set(event.caseKey, existing);
  }

  const cases = [...eventsByCase.entries()].map(([caseKey, caseEvents]) => {
    const sortedEvents = [...caseEvents].sort(
      (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt),
    );
    const eventNames: PilotProofChainEventName[] = [...new Set(sortedEvents.map((event) => event.eventName))];
    const missingCoreEvents = CORE_PROOF_CHAIN_EVENTS.filter((eventName) => !eventNames.includes(eventName));
    const lastEvent = sortedEvents[sortedEvents.length - 1];
    const latestNonStart = [...sortedEvents]
      .reverse()
      .find((event) => (
        event.eventName === 'start_outcome_recorded'
        && event.outcomeStatus === DID_NOT_START_OUTCOME_STATUS
      ));

    return {
      caseKey,
      entityId: lastEvent?.entityId ?? null,
      npi: lastEvent?.npi ?? null,
      organizationContextId: lastEvent?.organizationContextId ?? null,
      organizationId: lastEvent?.organizationId ?? null,
      eventNames,
      missingCoreEvents,
      replayable: missingCoreEvents.length === 0,
      lastOccurredAt: lastEvent?.occurredAt ?? new Date(0).toISOString(),
      nonStartReason: latestNonStart?.detail ?? null,
    } satisfies PilotProofChainCase;
  }).sort((left, right) => Date.parse(right.lastOccurredAt) - Date.parse(left.lastOccurredAt));

  return {
    totalEvents: events.length,
    totalCases: cases.length,
    replayableCases: cases.filter((item) => item.replayable).length,
    partialCases: cases.filter((item) => !item.replayable).length,
    cases,
    events: [...events].sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)),
  };
}

function startOutcomeCorrectionKey(row: StartOutcomeRow): string {
  return [
    row.entityId,
    row.organizationContextId ?? '(global)',
    row.startedAt.toISOString(),
  ].join('|');
}

function startOutcomeRecordedAtMs(row: StartOutcomeRow): number | null {
  const metadata = readJson(row.metadata);
  return readTimestampMs(metadata.capturedAt)
    ?? readTimestampMs(metadata.recordedAt)
    ?? readTimestampMs(metadata.monitoredAt);
}

function shouldReplaceStartOutcome(current: StartOutcomeRow, candidate: StartOutcomeRow): boolean {
  const currentRecordedAt = startOutcomeRecordedAtMs(current);
  const candidateRecordedAt = startOutcomeRecordedAtMs(candidate);

  if (currentRecordedAt === null && candidateRecordedAt === null) {
    return false;
  }

  if (currentRecordedAt === null) {
    return true;
  }

  if (candidateRecordedAt === null) {
    return false;
  }

  return candidateRecordedAt >= currentRecordedAt;
}

function collapseCorrectedStartOutcomes(rows: StartOutcomeRow[]): StartOutcomeRow[] {
  const effectiveRows = new Map<string, StartOutcomeRow>();

  for (const row of rows) {
    const key = startOutcomeCorrectionKey(row);
    const existing = effectiveRows.get(key);

    if (!existing || shouldReplaceStartOutcome(existing, row)) {
      effectiveRows.set(key, row);
    }
  }

  return [...effectiveRows.values()].sort(
    (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
  );
}

// ── Main query ─────────────────────────────────────────────────────────────

export async function computePilotKpis(
  options: { windowDays?: number; filter?: PilotFilter } = {},
): Promise<PilotKpiSnapshot> {
  const windowDays = options.windowDays ?? 90;
  const filter = normalizePilotFilter(options.filter);
  const filtered = isFiltered(filter);
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const sinceStr = since.toISOString();

  const [
    shareEvents,
    advisoryEvents,
    decisionEvents,
    blockerEvents,
    startOutcomeRows,
    proofAuditRows,
    auditCounts,
  ] = await Promise.all([
    prisma.bundleShareEvent.findMany({
      where: {
        sharedAt: { gte: since },
        ...(filter.orgContextId ? { organizationContextId: filter.orgContextId } : {}),
      },
      select: SHARE_EVENT_SELECT,
      orderBy: { sharedAt: 'asc' },
    }),

    prisma.advisoryOutcomeEvent.findMany({
      where: advisoryOutcomeWhere(since, filter),
      select: ADVISORY_EVENT_SELECT,
      orderBy: { eventTimestamp: 'asc' },
    }),

    prisma.employerDecisionEvent.findMany({
      where: employerDecisionWhere(since, filter),
      select: DECISION_EVENT_SELECT,
      orderBy: { decidedAt: 'asc' },
    }),

    prisma.blockerResolutionEvent.findMany({
      where: blockerResolutionWhere(since, filter),
      select: BLOCKER_EVENT_SELECT,
    }),

    prisma.startOutcomeEvent.findMany({
      where: startOutcomeWhere(since, filter),
      select: START_OUTCOME_SELECT,
      orderBy: { startedAt: 'asc' },
    }),

    prisma.auditEvent.findMany({
      where: {
        createdAt: { gte: since },
        type: { in: [PILOT_OPS_EVENT_AUDIT_TYPE, PILOT_PROOF_EVENT_AUDIT_TYPE] },
      },
      select: AUDIT_EVENT_SELECT,
      orderBy: { createdAt: 'asc' },
    }),

    Promise.all([
      prisma.bundleShareEvent.count({
        where: {
          sharedAt: { gte: since },
          ...(filter.orgContextId ? { organizationContextId: filter.orgContextId } : {}),
        },
      }),
      prisma.advisoryOutcomeEvent.count({
        where: advisoryOutcomeWhere(since, filter),
      }),
      prisma.employerDecisionEvent.count({
        where: employerDecisionWhere(since, filter),
      }),
      prisma.blockerResolutionEvent.count({
        where: blockerResolutionWhere(since, filter),
      }),
      prisma.startOutcomeEvent.count({
        where: startOutcomeWhere(since, filter),
      }),
      prisma.employerAcceptance.count({
        where: { acceptedAt: { gte: since } },
      }),
      prisma.startAttestation.count({
        where: { startedAt: { gte: since } },
      }),
    ]),
  ]);

  const effectiveStartOutcomeRows = collapseCorrectedStartOutcomes(startOutcomeRows);
  const reviewEvents = advisoryEvents.filter(isReviewOpenEvent);
  const relevantAuditRows = proofAuditRows.filter((row) => {
    const metadata = readJson(row.metadata);

    if (row.type === PILOT_OPS_EVENT_AUDIT_TYPE) {
      if (readString(metadata.eventType) !== BLOCKER_RESOLVED_EVENT_TYPE) {
        return false;
      }
    } else if (row.type === PILOT_PROOF_EVENT_AUDIT_TYPE) {
      const eventName = readString(metadata.eventName);
      if (eventName !== 'readiness_changed' && eventName !== 'start_outcome_recorded') {
        return false;
      }
    } else {
      return false;
    }

    return matchesEventScope(metadata, filter);
  });
  const readinessChangeAuditRows = relevantAuditRows.filter((row) => (
    row.type === PILOT_PROOF_EVENT_AUDIT_TYPE
    && readString(readJson(row.metadata).eventName) === 'readiness_changed'
  ));
  const nonStartOutcomeAuditRows = relevantAuditRows.filter((row) => {
    if (row.type !== PILOT_PROOF_EVENT_AUDIT_TYPE) {
      return false;
    }

    const metadata = readJson(row.metadata);
    return readString(metadata.eventName) === 'start_outcome_recorded'
      && readString(metadata.outcomeStatus) === DID_NOT_START_OUTCOME_STATUS;
  });
  const blockerResolvedMetricRows = relevantAuditRows.filter((row) => (
    row.type === PILOT_OPS_EVENT_AUDIT_TYPE
    && readString(readJson(row.metadata).eventType) === BLOCKER_RESOLVED_EVENT_TYPE
  ));

  const [
    bundleShareCount,
    advisoryOutcomeCount,
    employerDecisionCount,
    blockerCount,
    startOutcomeCount,
    acceptanceCount,
    startAttestationCount,
  ] = auditCounts;

  // ── KPI 1: Packet Shares ──────────────────────────────────────────────
  const distinctShareEntities = new Set(
    shareEvents.map((event) => event.subjectEntityId ?? event.npi),
  ).size;
  const distinctShareOrgs = new Set(
    shareEvents.map((event) => event.organizationContextId ?? event.organizationId),
  ).size;
  const byDeliveryStatus: Record<string, number> = {};

  for (const event of shareEvents) {
    byDeliveryStatus[event.deliveryStatus] = (byDeliveryStatus[event.deliveryStatus] ?? 0) + 1;
  }

  const packetShares: PacketShareStats = {
    total: shareEvents.length,
    distinctEntities: distinctShareEntities,
    distinctOrgs: distinctShareOrgs,
    byDeliveryStatus,
    earliestSharedAt: toIso(shareEvents[0]?.sharedAt),
    latestSharedAt: toIso(shareEvents[shareEvents.length - 1]?.sharedAt),
  };

  // ── KPI 2: Review Opens ───────────────────────────────────────────────
  const reviewsByOrg = new Map<string | null, number>();

  for (const event of reviewEvents) {
    const key = event.organizationContextId ?? null;
    reviewsByOrg.set(key, (reviewsByOrg.get(key) ?? 0) + 1);
  }

  const reviewsOpened: ReviewOpenedStats = {
    total: reviewEvents.length,
    distinctEntities: new Set(reviewEvents.map((event) => event.entityId)).size,
    byOrgContext: [...reviewsByOrg.entries()].map(([orgContextId, count]) => ({ orgContextId, count })),
    earliestAt: toIso(reviewEvents[0]?.eventTimestamp),
    latestAt: toIso(reviewEvents[reviewEvents.length - 1]?.eventTimestamp),
  };

  // ── KPI 3: Decisions by Type ──────────────────────────────────────────
  const byType: Record<string, number> = {};

  for (const event of decisionEvents) {
    byType[event.decision] = (byType[event.decision] ?? 0) + 1;
  }

  const decisions = {
    total: decisionEvents.length,
    byType,
    proceedCount: 0,
    refreshCount: 0,
    routeCount: 0,
    rejectCount: 0,
    holdCount: 0,
  } satisfies DecisionStats;

  for (const [bucket, decisionType] of DECISION_BUCKETS) {
    decisions[bucket] = byType[decisionType] ?? 0;
  }

  // ── KPI 4–6: Velocity calculations ───────────────────────────────────
  const firstReviewByChain = earliestDateByKey(
    reviewEvents,
    (event) => reviewChainKey(event.entityId, event.organizationContextId, event.metadata),
    (event) => event.eventTimestamp,
  );
  const firstDecisionByReviewChain = earliestDateByKey(
    decisionEvents,
    (event) => reviewChainKey(event.entityId, event.organizationContextId, event.metadata),
    (event) => event.decidedAt,
  );
  const firstDecisionByShareChain = earliestDateByKey(
    decisionEvents,
    (event) => shareDecisionChainKey(event.entityId, event.organizationContextId),
    (event) => event.decidedAt,
  );
  const firstShareByChain = earliestDateByKey(
    shareEvents,
    (event) => shareDecisionChainKey(event.subjectEntityId, event.organizationContextId),
    (event) => event.sharedAt,
  );

  const reviewToDecisionDays: number[] = [];
  firstReviewByChain.forEach((reviewAt, chainKey) => {
    const decisionAt = firstDecisionByReviewChain.get(chainKey);
    if (decisionAt && decisionAt >= reviewAt) {
      reviewToDecisionDays.push(daysBetween(reviewAt, decisionAt));
    }
  });

  const reviewToReadyDays: number[] = [];
  const advisoryEventsByChain = groupRowsByKey(
    advisoryEvents,
    (event) => reviewChainKey(event.entityId, event.organizationContextId, event.metadata),
  );
  advisoryEventsByChain.forEach((events, chainKey) => {
    const firstReview = firstReviewByChain.get(chainKey);
    if (!firstReview) return;

    const readyEvent = events.find((event) =>
      event.eventTimestamp >= firstReview
      && (event.readinessScoreAtEvent ?? 0) >= READY_READINESS_THRESHOLD,
    );

    if (readyEvent) {
      reviewToReadyDays.push(daysBetween(firstReview, readyEvent.eventTimestamp));
    }
  });

  const reviewToStartDays = effectiveStartOutcomeRows
    .map((row) => row.daysFromFirstReview)
    .filter((value): value is number => value !== null);

  const shareToDecisionDays: number[] = [];
  firstShareByChain.forEach((sharedAt, chainKey) => {
    const decisionAt = firstDecisionByShareChain.get(chainKey);
    if (decisionAt && decisionAt >= sharedAt) {
      shareToDecisionDays.push(daysBetween(sharedAt, decisionAt));
    }
  });

  const velocity: VelocityStats = {
    medianDaysFirstReviewToDecision: median(reviewToDecisionDays),
    medianDaysFirstReviewToReady: median(reviewToReadyDays),
    medianDaysFirstReviewToStart: median(reviewToStartDays),
    medianDaysShareToDecision: median(shareToDecisionDays),
    sampleSizes: {
      reviewToDecision: reviewToDecisionDays.length,
      reviewToReady: reviewToReadyDays.length,
      reviewToStart: reviewToStartDays.length,
      shareToDecision: shareToDecisionDays.length,
    },
  };

  // ── KPI 7: Blocker Categories ─────────────────────────────────────────
  const blockersByCode = groupRowsByKey(blockerEvents, (event) => event.blockerCode);
  const blockers: BlockerKpi[] = [...blockersByCode.entries()].map(([code, rows]) => {
    const resolvedRows = rows.filter((row) => row.status === 'RESOLVED');
    const resolutionDays = resolvedRows
      .map((row) => row.resolutionDays)
      .filter((value): value is number => value !== null);
    const byResolutionMethod: Record<string, number> = {};

    for (const row of resolvedRows) {
      const method = row.resolutionMethod ?? 'UNKNOWN';
      byResolutionMethod[method] = (byResolutionMethod[method] ?? 0) + 1;
    }

    return {
      code,
      openCount: rows.filter((row) => row.status === 'OPEN').length,
      resolvedCount: resolvedRows.length,
      avgResolutionDays: average(resolutionDays),
      medianResolutionDays: median(resolutionDays),
      byResolutionMethod,
    };
  }).sort((left, right) => (
    (right.openCount + right.resolvedCount) - (left.openCount + left.resolvedCount)
  ));

  // ── Start Outcomes ────────────────────────────────────────────────────
  // Filtered views intentionally do not infer pilot scope from canonical starts because
  // StartAttestation and EmployerAcceptance do not carry pilot metadata today.
  const totalStarts = effectiveStartOutcomeRows.length || (filtered ? 0 : startAttestationCount);
  const recordedStartCount = effectiveStartOutcomeRows.length;
  const distinctOutcomeSubjects = new Set([
    ...effectiveStartOutcomeRows.map((row) => row.entityId),
    ...nonStartOutcomeAuditRows.map((row) => {
      const metadata = readJson(row.metadata);
      return (
        readString(metadata.entityId)
        ?? row.referenceId
        ?? readString(metadata.npi)
        ?? row.clinicianId
      );
    }),
  ].filter((value): value is string => Boolean(value))).size;
  const distinctStartEntities = new Set(
    effectiveStartOutcomeRows.map((row) => row.entityId),
  ).size;
  const scoresAtStart = effectiveStartOutcomeRows
    .map((row) => row.readinessScoreAtStart)
    .filter((value): value is number => value !== null);
  const nonStartReasonCounts = new Map<string, number>();

  for (const row of nonStartOutcomeAuditRows) {
    const reason = readString(readJson(row.metadata).nonStartReason) ?? 'unspecified';
    nonStartReasonCounts.set(reason, (nonStartReasonCounts.get(reason) ?? 0) + 1);
  }

  const startOutcomes: StartOutcomeStats = {
    totalStarts,
    totalOutcomeRecords: recordedStartCount + nonStartOutcomeAuditRows.length,
    didNotStartCount: nonStartOutcomeAuditRows.length,
    nonStartReasons: [...nonStartReasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
    distinctEntities: distinctOutcomeSubjects || distinctStartEntities || totalStarts,
    readinessAtStart: {
      avgScore: average(scoresAtStart),
      medianScore: median(scoresAtStart),
      withBlockers: effectiveStartOutcomeRows.filter((row) =>
        Array.isArray(row.blockersAtStart) && row.blockersAtStart.length > 0,
      ).length,
    },
  };

  // ── Readiness Distribution ────────────────────────────────────────────
  // For each distinct entity that had at least one EMPLOYER_REVIEW advisory event in the
  // window, take their LATEST readinessScoreAtEvent and bucket into READY/PARTIAL/BLOCKED.
  // This is an event-sourced approximation — it reflects readiness at last review, not
  // current live score. Sufficient for pilot reporting purposes.
  const READY_MIN = 60;
  const PARTIAL_MIN = 30;

  // Bucket against the newest review event per entity using the event timestamp,
  // not query order, and preserve explicit null scores as "No Score".
  const latestScoreByEntity = new Map<string, {
    score: number | null;
    eventTimestampMs: number;
  }>();
  for (const event of reviewEvents) {
    const eventTimestampMs = event.eventTimestamp.getTime();
    if (!Number.isFinite(eventTimestampMs)) {
      continue;
    }

    const prev = latestScoreByEntity.get(event.entityId);
    if (prev && prev.eventTimestampMs > eventTimestampMs) {
      continue;
    }

    latestScoreByEntity.set(event.entityId, {
      score: event.readinessScoreAtEvent ?? null,
      eventTimestampMs,
    });
  }

  let readyCount = 0;
  let partialCount = 0;
  let blockedCount = 0;
  let noScoreCount = 0;

  for (const { score } of latestScoreByEntity.values()) {
    if (score === null) { noScoreCount++; continue; }
    if (score >= READY_MIN) readyCount++;
    else if (score >= PARTIAL_MIN) partialCount++;
    else blockedCount++;
  }

  const readinessDistribution: ReadinessDistribution = {
    ready: readyCount,
    partial: partialCount,
    blocked: blockedCount,
    total: latestScoreByEntity.size,
    noScore: noScoreCount,
  };

  const proofChainEvents = [
    ...shareEvents.map((event) => ({
      eventName: 'packet_shared',
      occurredAt: event.sharedAt.toISOString(),
      entityId: event.subjectEntityId ?? null,
      npi: event.npi ?? null,
      organizationContextId: event.organizationContextId ?? null,
      organizationId: event.organizationId ?? null,
      pilotId: null,
      workflowLane: null,
      geographyTag: null,
      sourceRecordType: 'BundleShareEvent',
      sourceRecordId: event.id,
      outcomeStatus: null,
      detail: event.bundleId ?? event.deliveryStatus,
    } satisfies Omit<PilotProofChainEvent, 'caseKey'>)),
    ...reviewEvents.map((event) => {
      const metadata = readJson(event.metadata);
      const scope = readScopeFields(metadata);
      return {
        eventName: 'employer_review_opened',
        occurredAt: event.eventTimestamp.toISOString(),
        entityId: event.entityId,
        npi: null,
        organizationContextId: event.organizationContextId ?? readString(metadata.organizationContextId),
        organizationId: readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'AdvisoryOutcomeEvent',
        sourceRecordId: event.id,
        outcomeStatus: null,
        detail: readString(metadata.bundleId) ?? 'employer_review_opened',
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    ...decisionEvents.map((event) => {
      const metadata = readJson(event.metadata);
      const scope = readScopeFields(metadata);
      return {
        eventName: 'employer_decision_recorded',
        occurredAt: event.decidedAt.toISOString(),
        entityId: event.entityId,
        npi: null,
        organizationContextId: event.organizationContextId ?? readString(metadata.organizationContextId),
        organizationId: readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'EmployerDecisionEvent',
        sourceRecordId: event.id,
        outcomeStatus: event.decision,
        detail: event.decision,
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    ...readinessChangeAuditRows.map((row) => {
      const metadata = readJson(row.metadata);
      const scope = readScopeFields(metadata);
      const previousBand = readString(metadata.previousBand);
      const newBand = readString(metadata.newBand);
      return {
        eventName: 'readiness_changed',
        occurredAt: readString(metadata.occurredAt) ?? row.createdAt.toISOString(),
        entityId: readString(metadata.entityId),
        npi: readString(metadata.npi) ?? row.clinicianId ?? null,
        organizationContextId: readString(metadata.organizationContextId),
        organizationId: row.organizationId ?? readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'AuditEvent',
        sourceRecordId: row.id,
        outcomeStatus: newBand,
        detail: [previousBand, newBand].filter((value): value is string => value !== null).join(' -> ') || null,
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    // blocker_opened — from BlockerResolutionEvent rows (all rows have openedAt)
    ...blockerEvents.map((row) => {
      const metadata = readJson(row.metadata);
      const scope = readScopeFields(metadata);
      return {
        eventName: 'blocker_opened' as const,
        occurredAt: row.openedAt.toISOString(),
        entityId: row.entityId,
        npi: null,
        organizationContextId: null,
        organizationId: null,
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'BlockerResolutionEvent',
        sourceRecordId: row.id,
        outcomeStatus: row.status,
        detail: row.blockerCode,
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    // blocker_resolved — from PilotOps audit events with eventType=blocker_resolved
    ...blockerResolvedMetricRows.map((row) => {
      const metadata = readJson(row.metadata);
      const scope = readScopeFields(metadata);
      const entity = readJson(metadata.entity);
      const details = readJson(metadata.details);
      return {
        eventName: 'blocker_resolved' as const,
        occurredAt: row.createdAt.toISOString(),
        entityId: readString(entity.id) ?? readString(metadata.entityId),
        npi: readString(metadata.npi) ?? row.clinicianId ?? null,
        organizationContextId: readString(metadata.organizationContextId),
        organizationId: row.organizationId ?? readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'PilotOpsAuditEvent',
        sourceRecordId: row.id,
        outcomeStatus: null,
        detail:
          readString(details.blockerCode)
          ?? readString(metadata.message)
          ?? readString(entity.label)
          ?? BLOCKER_RESOLVED_EVENT_TYPE,
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    ...effectiveStartOutcomeRows.map((row) => {
      const metadata = readJson(row.metadata);
      const scope = readScopeFields(metadata);
      return {
        eventName: 'start_outcome_recorded',
        occurredAt: row.startedAt.toISOString(),
        entityId: row.entityId,
        npi: readString(metadata.npi),
        organizationContextId: row.organizationContextId ?? readString(metadata.organizationContextId),
        organizationId: readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'StartOutcomeEvent',
        sourceRecordId: row.id,
        outcomeStatus: 'STARTED',
        detail: readString(metadata.note) ?? 'started',
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
    ...nonStartOutcomeAuditRows.map((row) => {
      const metadata = readJson(row.metadata);
      const scope = readScopeFields(metadata);
      return {
        eventName: 'start_outcome_recorded',
        occurredAt: readString(metadata.occurredAt) ?? row.createdAt.toISOString(),
        entityId: readString(metadata.entityId) ?? row.referenceId ?? null,
        npi: readString(metadata.npi) ?? row.clinicianId ?? null,
        organizationContextId: readString(metadata.organizationContextId),
        organizationId: row.organizationId ?? readString(metadata.organizationId),
        pilotId: scope.pilotId,
        workflowLane: scope.workflowLane,
        geographyTag: scope.geographyTag,
        sourceRecordType: 'AuditEvent',
        sourceRecordId: row.id,
        outcomeStatus: readString(metadata.outcomeStatus),
        detail: readString(metadata.nonStartReason),
      } satisfies Omit<PilotProofChainEvent, 'caseKey'>;
    }),
  ].map((event) => ({
    ...event,
    caseKey: proofChainCaseKey(event),
  })) satisfies PilotProofChainEvent[];

  const proofChain = buildProofChainSummary(proofChainEvents);

  // ── Gaps detection ────────────────────────────────────────────────────
  const gaps: string[] = [];
  if (reviewEvents.length === 0) {
    gaps.push('No EMPLOYER_REVIEW advisory events — ensure /review/[entityId] fires captureAdvisoryEvent on load.');
  }
  if (velocity.sampleSizes.reviewToDecision === 0) {
    gaps.push('No entities have both a review event and a decision event — velocity review→decision cannot be computed yet.');
  }
  if (velocity.sampleSizes.reviewToStart === 0) {
    gaps.push('No start outcome events with daysFromFirstReview — fire captureStartOutcome at StartAttestation creation.');
  }
  if (blockerEvents.length === 0) {
    gaps.push('No blocker resolution events — call syncBlockerEvents() at readiness computation to populate.');
  }
  if (shareEvents.length === 0) {
    gaps.push('No bundle share events in the window — confirm ApplyBundle.share() writes BundleShareEvent.');
  }
  if (!filter.orgContextId && hasMetadataScopedFilter(filter)) {
    gaps.push('Bundle share events are only org-context scoped today. Exact packet-share attribution still requires bundle-share scope metadata when multiple pilots or lanes are active.');
  }
  if (filtered && startAttestationCount > 0 && effectiveStartOutcomeRows.length === 0) {
    gaps.push('Scoped start KPIs rely on start_outcome_events. Canonical start_attestations are unscoped health signals only and are excluded from filtered start metrics.');
  }
  if (proofChain.partialCases > 0) {
    gaps.push(`${proofChain.partialCases} pilot case${proofChain.partialCases === 1 ? '' : 's'} are missing at least one core proof-chain event for full replay.`);
  }

  log('info', 'pilot_kpi_computed', {
    windowDays,
    pilotId: filter.pilotId ?? null,
    workflowLane: filter.workflowLane ?? null,
    orgContextId: filter.orgContextId ?? null,
    geographyTag: filter.geographyTag ?? null,
    packets: packetShares.total,
    reviews: reviewsOpened.total,
    decisions: decisions.total,
    starts: startOutcomes.totalStarts,
    replayableCases: proofChain.replayableCases,
    gaps: gaps.length,
  });

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    since: sinceStr,
    appliedFilter: filter,
    isFiltered: filtered,
    packetShares,
    reviewsOpened,
    decisions,
    velocity,
    blockers,
    startOutcomes,
    readinessDistribution,
    eventChain: {
      bundleShareEvents: bundleShareCount,
      advisoryOutcomeEvents: advisoryOutcomeCount,
      employerDecisionEvents: employerDecisionCount,
      blockerResolutionEvents: blockerCount,
      blockerResolvedMetricEvents: blockerResolvedMetricRows.length,
      readinessChangeEvents: readinessChangeAuditRows.length,
      startOutcomeEvents: startOutcomeCount,
      nonStartOutcomeEvents: nonStartOutcomeAuditRows.length,
      employerAcceptances: acceptanceCount,
      startAttestations: startAttestationCount,
    },
    proofChain,
    gaps,
  };
}

const VELOCITY_EXPORT_DEFINITIONS = [
  {
    label: 'median_days_first_review_to_decision',
    value: (snap: PilotKpiSnapshot) => snap.velocity.medianDaysFirstReviewToDecision,
    sampleLabel: 'sample_review_to_decision',
    sampleValue: (snap: PilotKpiSnapshot) => snap.velocity.sampleSizes.reviewToDecision,
  },
  {
    label: 'median_days_first_review_to_ready',
    value: (snap: PilotKpiSnapshot) => snap.velocity.medianDaysFirstReviewToReady,
    sampleLabel: 'sample_review_to_ready',
    sampleValue: (snap: PilotKpiSnapshot) => snap.velocity.sampleSizes.reviewToReady,
  },
  {
    label: 'median_days_first_review_to_start',
    value: (snap: PilotKpiSnapshot) => snap.velocity.medianDaysFirstReviewToStart,
    sampleLabel: 'sample_review_to_start',
    sampleValue: (snap: PilotKpiSnapshot) => snap.velocity.sampleSizes.reviewToStart,
  },
  {
    label: 'median_days_share_to_decision',
    value: (snap: PilotKpiSnapshot) => snap.velocity.medianDaysShareToDecision,
    sampleLabel: 'sample_share_to_decision',
    sampleValue: (snap: PilotKpiSnapshot) => snap.velocity.sampleSizes.shareToDecision,
  },
] as const;

function formatExportValue(
  value: number | string | null | undefined,
  fallback: string = 'n/a',
): string {
  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  return fallback;
}

function csvCell(cell: string): string {
  return cell.includes(',') || cell.includes('"') || cell.includes('\n')
    ? `"${cell.replace(/"/g, '""')}"`
    : cell;
}

// ── CSV export ─────────────────────────────────────────────────────────────
// Returns a flat CSV suitable for pasting into a pilot report spreadsheet.

export function kpiSnapshotToExportRows(snap: PilotKpiSnapshot): PilotKpiExportRow[] {
  const filter = snap.appliedFilter ?? {};
  const rows: PilotKpiExportRow[] = [
    { section: 'metadata', label: 'generated_at', value: snap.generatedAt },
    { section: 'metadata', label: 'window_days', value: String(snap.windowDays) },
    { section: 'metadata', label: 'since', value: snap.since },
    { section: 'filters', label: 'pilot_id', value: filter.pilotId ?? '(all)' },
    { section: 'filters', label: 'workflow_lane', value: filter.workflowLane ?? '(all)' },
    { section: 'filters', label: 'org_context_id', value: filter.orgContextId ?? '(all)' },
    { section: 'filters', label: 'geography_tag', value: filter.geographyTag ?? '(all)' },
    { section: 'packet_shares', label: 'total', value: String(snap.packetShares.total) },
    { section: 'packet_shares', label: 'distinct_entities', value: String(snap.packetShares.distinctEntities) },
    { section: 'packet_shares', label: 'distinct_organizations', value: String(snap.packetShares.distinctOrgs) },
    { section: 'packet_shares', label: 'earliest_shared_at', value: snap.packetShares.earliestSharedAt ?? 'none' },
    { section: 'packet_shares', label: 'latest_shared_at', value: snap.packetShares.latestSharedAt ?? 'none' },
    { section: 'reviews_opened', label: 'total', value: String(snap.reviewsOpened.total) },
    { section: 'reviews_opened', label: 'distinct_entities', value: String(snap.reviewsOpened.distinctEntities) },
    { section: 'reviews_opened', label: 'earliest_at', value: snap.reviewsOpened.earliestAt ?? 'none' },
    { section: 'reviews_opened', label: 'latest_at', value: snap.reviewsOpened.latestAt ?? 'none' },
    { section: 'decisions', label: 'total', value: String(snap.decisions.total) },
    { section: 'decisions', label: 'proceed_count', value: String(snap.decisions.proceedCount) },
    { section: 'decisions', label: 'refresh_count', value: String(snap.decisions.refreshCount) },
    { section: 'decisions', label: 'route_count', value: String(snap.decisions.routeCount) },
    { section: 'decisions', label: 'reject_count', value: String(snap.decisions.rejectCount) },
    { section: 'decisions', label: 'hold_count', value: String(snap.decisions.holdCount) },
    { section: 'start_outcomes', label: 'total_starts', value: String(snap.startOutcomes.totalStarts) },
    { section: 'start_outcomes', label: 'total_outcome_records', value: String(snap.startOutcomes.totalOutcomeRecords) },
    { section: 'start_outcomes', label: 'did_not_start_count', value: String(snap.startOutcomes.didNotStartCount) },
    { section: 'start_outcomes', label: 'distinct_entities', value: String(snap.startOutcomes.distinctEntities) },
    {
      section: 'start_outcomes',
      label: 'avg_readiness_score',
      value: formatExportValue(snap.startOutcomes.readinessAtStart.avgScore),
    },
    {
      section: 'start_outcomes',
      label: 'median_readiness_score',
      value: formatExportValue(snap.startOutcomes.readinessAtStart.medianScore),
    },
    {
      section: 'start_outcomes',
      label: 'starts_with_blockers',
      value: String(snap.startOutcomes.readinessAtStart.withBlockers),
    },
    { section: 'proof_chain_summary', label: 'total_events', value: String(snap.proofChain.totalEvents) },
    { section: 'proof_chain_summary', label: 'total_cases', value: String(snap.proofChain.totalCases) },
    { section: 'proof_chain_summary', label: 'replayable_cases', value: String(snap.proofChain.replayableCases) },
    { section: 'proof_chain_summary', label: 'partial_cases', value: String(snap.proofChain.partialCases) },
  ];

  for (const [deliveryStatus, count] of Object.entries(snap.packetShares.byDeliveryStatus).sort(([left], [right]) => left.localeCompare(right))) {
    rows.push({
      section: 'packet_share_delivery_status',
      label: deliveryStatus.toLowerCase(),
      value: String(count),
    });
  }

  for (const [decisionType, count] of Object.entries(snap.decisions.byType).sort(([left], [right]) => left.localeCompare(right))) {
    rows.push({
      section: 'decision_types',
      label: decisionType.toLowerCase(),
      value: String(count),
    });
  }

  for (const metric of VELOCITY_EXPORT_DEFINITIONS) {
    rows.push({
      section: 'velocity',
      label: metric.label,
      value: formatExportValue(metric.value(snap), 'insufficient data'),
    });
    rows.push({
      section: 'velocity_samples',
      label: metric.sampleLabel,
      value: String(metric.sampleValue(snap)),
    });
  }

  for (const blocker of snap.blockers) {
    const blockerSection = `blocker:${blocker.code.toLowerCase()}`;
    rows.push(
      { section: blockerSection, label: 'open_count', value: String(blocker.openCount) },
      { section: blockerSection, label: 'resolved_count', value: String(blocker.resolvedCount) },
      { section: blockerSection, label: 'avg_resolution_days', value: formatExportValue(blocker.avgResolutionDays) },
      { section: blockerSection, label: 'median_resolution_days', value: formatExportValue(blocker.medianResolutionDays) },
    );

    for (const [method, count] of Object.entries(blocker.byResolutionMethod).sort(([left], [right]) => left.localeCompare(right))) {
      rows.push({
        section: `${blockerSection}:resolution_method`,
        label: method.toLowerCase(),
        value: String(count),
      });
    }
  }

  rows.push(
    { section: 'readiness_distribution', label: 'total_reviewed', value: String(snap.readinessDistribution.total) },
    { section: 'readiness_distribution', label: 'ready', value: String(snap.readinessDistribution.ready) },
    { section: 'readiness_distribution', label: 'partial', value: String(snap.readinessDistribution.partial) },
    { section: 'readiness_distribution', label: 'blocked', value: String(snap.readinessDistribution.blocked) },
    { section: 'readiness_distribution', label: 'no_score_recorded', value: String(snap.readinessDistribution.noScore) },
  );

  for (const { orgContextId, count } of snap.reviewsOpened.byOrgContext) {
    rows.push({
      section: 'review_org_context',
      label: orgContextId ?? '(none)',
      value: String(count),
    });
  }

  for (const [eventName, count] of Object.entries(snap.eventChain).sort(([left], [right]) => left.localeCompare(right))) {
    rows.push({
      section: 'event_chain',
      label: eventName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
      value: String(count),
    });
  }

  for (const { reason, count } of snap.startOutcomes.nonStartReasons) {
    rows.push({
      section: 'non_start_reasons',
      label: reason,
      value: String(count),
    });
  }

  snap.proofChain.cases.forEach((proofCase, index) => {
    const section = `proof_chain_case:${index + 1}`;
    rows.push(
      { section, label: 'case_key', value: proofCase.caseKey },
      { section, label: 'entity_id', value: proofCase.entityId ?? 'none' },
      { section, label: 'npi', value: proofCase.npi ?? 'none' },
      { section, label: 'organization_context_id', value: proofCase.organizationContextId ?? 'none' },
      { section, label: 'organization_id', value: proofCase.organizationId ?? 'none' },
      { section, label: 'replayable', value: String(proofCase.replayable) },
      { section, label: 'event_names', value: proofCase.eventNames.join('|') || 'none' },
      { section, label: 'missing_core_events', value: proofCase.missingCoreEvents.join('|') || 'none' },
      { section, label: 'last_occurred_at', value: proofCase.lastOccurredAt },
      { section, label: 'non_start_reason', value: proofCase.nonStartReason ?? 'none' },
    );
  });

  snap.proofChain.events.forEach((event, index) => {
    const section = `proof_chain_event:${index + 1}`;
    rows.push(
      { section, label: 'case_key', value: event.caseKey },
      { section, label: 'event_name', value: event.eventName },
      { section, label: 'occurred_at', value: event.occurredAt },
      { section, label: 'entity_id', value: event.entityId ?? 'none' },
      { section, label: 'npi', value: event.npi ?? 'none' },
      { section, label: 'organization_context_id', value: event.organizationContextId ?? 'none' },
      { section, label: 'organization_id', value: event.organizationId ?? 'none' },
      { section, label: 'pilot_id', value: event.pilotId ?? 'none' },
      { section, label: 'workflow_lane', value: event.workflowLane ?? 'none' },
      { section, label: 'geography_tag', value: event.geographyTag ?? 'none' },
      { section, label: 'source_record_type', value: event.sourceRecordType },
      { section, label: 'source_record_id', value: event.sourceRecordId },
      { section, label: 'outcome_status', value: event.outcomeStatus ?? 'none' },
      { section, label: 'detail', value: event.detail ?? 'none' },
    );
  });

  if (snap.gaps.length === 0) {
    rows.push({ section: 'gaps', label: 'status', value: 'none' });
  } else {
    snap.gaps.forEach((gap, index) => {
      rows.push({
        section: 'gaps',
        label: `gap_${index + 1}`,
        value: gap,
      });
    });
  }

  return rows;
}

export function kpiSnapshotToCsv(snap: PilotKpiSnapshot): string {
  const rows = kpiSnapshotToExportRows(snap);
  return [
    ['section', 'label', 'value'],
    ...rows.map((row) => [row.section, row.label, row.value]),
  ].map((row) => row.map(csvCell).join(',')).join('\n');
}
