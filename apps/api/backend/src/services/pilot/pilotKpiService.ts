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
const READY_READINESS_THRESHOLD = 60;
const DECISION_BUCKETS = [
  ['proceedCount', 'PROCEED'],
  ['refreshCount', 'REQUEST_REFRESH'],
  ['routeCount', 'ROUTE_TO_REVIEW'],
  ['rejectCount', 'REJECT'],
  ['holdCount', 'HOLD'],
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

type StartOutcomeRow = Prisma.StartOutcomeEventGetPayload<{ select: typeof START_OUTCOME_SELECT }>;
type StartOutcomeStatus = 'started' | 'not_started' | 'pending';

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
  distinctEntities: number;
  readinessAtStart: {
    avgScore: number | null;
    medianScore: number | null;
    withBlockers: number;
  };
}

export interface PilotOutcomeProofCase {
  entityId: string;
  organizationContextId: string | null;
  baselineProcessDurationDays: number | null;
  firstSharedAt: string | null;
  firstReviewAt: string | null;
  employerDecisionAt: string | null;
  actualStartDate: string | null;
  outcomeRecordedAt: string | null;
  outcomeStatus: StartOutcomeStatus;
  started: boolean;
  nonStartReason: string | null;
  daysFromFirstShare: number | null;
  daysFromFirstReview: number | null;
  daysFromReady: number | null;
  measuredProcessDurationDays: number | null;
  measuredDeltaDays: number | null;
  blockerResolution: {
    resolvedCount: number;
    avgDays: number | null;
    medianDays: number | null;
  };
  manualCorrection: boolean;
  note: string | null;
}

export interface PilotOutcomeProofSummary {
  totalCases: number;
  startedCases: number;
  notStartedCases: number;
  pendingCases: number;
  casesWithBaseline: number;
  casesWithMeasuredDelta: number;
  usableProofCases: number;
  avgMeasuredDeltaDays: number | null;
  medianMeasuredDeltaDays: number | null;
  automaticProofArtifactReady: boolean;
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

  /** Case-level proof contract for buyer-facing pilot evidence */
  proofCases: PilotOutcomeProofCase[];
  proofSummary: PilotOutcomeProofSummary;

  /** Audit-trail counts — confirms the event chain is firing */
  eventChain: {
    bundleShareEvents: number;
    advisoryOutcomeEvents: number;
    employerDecisionEvents: number;
    blockerResolutionEvents: number;
    startOutcomeEvents: number;
    employerAcceptances: number;
    startAttestations: number;
  };

  /** Readiness distribution — READY/PARTIAL/BLOCKED counts for reviewed clinicians */
  readinessDistribution: ReadinessDistribution;

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

function readJson(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
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

function readOptionalDate(value: unknown): Date | null {
  const timestampMs = readTimestampMs(value);
  return timestampMs === null ? null : new Date(timestampMs);
}

function elapsedDays(earlier: Date | null | undefined, later: Date | null | undefined): number | null {
  if (!earlier || !later) return null;
  const deltaMs = later.getTime() - earlier.getTime();
  if (deltaMs < 0) return null;
  return Math.max(0, Math.ceil(deltaMs / 86_400_000));
}

function startOutcomeStatus(row: StartOutcomeRow): Exclude<StartOutcomeStatus, 'pending'> {
  const metadata = readJson(row.metadata);
  return readString(metadata.outcomeStatus) === 'not_started' ? 'not_started' : 'started';
}

function startOutcomeActualStartDate(row: StartOutcomeRow): Date | null {
  const metadata = readJson(row.metadata);
  const explicitActualStartDate = readOptionalDate(metadata.actualStartDate);
  if (explicitActualStartDate) {
    return explicitActualStartDate;
  }

  return startOutcomeStatus(row) === 'started' ? row.startedAt : null;
}

function startOutcomeOutcomeRecordedAt(row: StartOutcomeRow): Date | null {
  const metadata = readJson(row.metadata);
  return readOptionalDate(metadata.outcomeRecordedAt)
    ?? readOptionalDate(metadata.capturedAt)
    ?? readOptionalDate(metadata.recordedAt)
    ?? readOptionalDate(metadata.monitoredAt)
    ?? row.startedAt;
}

function startOutcomeBaselineDays(row: StartOutcomeRow): number | null {
  const metadata = readJson(row.metadata);
  return readNumber(metadata.baselineProcessDurationDays)
    ?? readNumber(metadata.baseline_process_duration_days)
    ?? readNumber(metadata.baselineDays);
}

function startOutcomeNonStartReason(row: StartOutcomeRow): string | null {
  const metadata = readJson(row.metadata);
  return readString(metadata.nonStartReason)
    ?? readString(metadata.non_start_reason)
    ?? readString(metadata.reason);
}

function startOutcomeNote(row: StartOutcomeRow): string | null {
  const metadata = readJson(row.metadata);
  return readString(metadata.note);
}

function startOutcomeCorrectionKey(row: StartOutcomeRow): string {
  const metadata = readJson(row.metadata);
  const correctionGroupKey = readString(metadata.correctionGroupKey)
    ?? readString(metadata.correction_group_key);
  if (correctionGroupKey) {
    return correctionGroupKey;
  }

  const outcomeStatus = startOutcomeStatus(row);
  const effectiveDate = startOutcomeActualStartDate(row) ?? startOutcomeOutcomeRecordedAt(row) ?? row.startedAt;
  return [
    row.entityId,
    row.organizationContextId ?? '(global)',
    outcomeStatus,
    effectiveDate.toISOString(),
  ].join('|');
}

function startOutcomeRecordedAtMs(row: StartOutcomeRow): number | null {
  return startOutcomeOutcomeRecordedAt(row)?.getTime() ?? null;
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

function collapseCorrectedStartOutcomes(rows: StartOutcomeRow[]): {
  rows: StartOutcomeRow[];
  groupSizes: Map<string, number>;
} {
  const effectiveRows = new Map<string, StartOutcomeRow>();
  const groupSizes = new Map<string, number>();

  for (const row of rows) {
    const key = startOutcomeCorrectionKey(row);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
    const existing = effectiveRows.get(key);

    if (!existing || shouldReplaceStartOutcome(existing, row)) {
      effectiveRows.set(key, row);
    }
  }

  return {
    rows: [...effectiveRows.values()].sort(
      (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
    ),
    groupSizes,
  };
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

  const collapsedStartOutcomes = collapseCorrectedStartOutcomes(startOutcomeRows);
  const effectiveStartOutcomeRows = collapsedStartOutcomes.rows;
  const startOutcomeCorrectionGroups = collapsedStartOutcomes.groupSizes;
  const effectiveStartedOutcomeRows = effectiveStartOutcomeRows.filter((row) => startOutcomeStatus(row) === 'started');
  const reviewEvents = advisoryEvents.filter((event) => event.eventType === REVIEW_OPEN_EVENT_TYPE);

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
  const firstReviewByEntity = earliestDateByKey(
    reviewEvents,
    (event) => event.entityId,
    (event) => event.eventTimestamp,
  );
  const firstDecisionByEntity = earliestDateByKey(
    decisionEvents,
    (event) => event.entityId,
    (event) => event.decidedAt,
  );
  const firstShareByEntity = earliestDateByKey(
    shareEvents,
    (event) => event.subjectEntityId,
    (event) => event.sharedAt,
  );

  const reviewToDecisionDays: number[] = [];
  firstReviewByEntity.forEach((reviewAt, entityId) => {
    const decisionAt = firstDecisionByEntity.get(entityId);
    if (decisionAt && decisionAt >= reviewAt) {
      reviewToDecisionDays.push(daysBetween(reviewAt, decisionAt));
    }
  });

  const reviewToReadyDays: number[] = [];
  const advisoryEventsByEntity = groupRowsByKey(advisoryEvents, (event) => event.entityId);
  advisoryEventsByEntity.forEach((events, entityId) => {
    const firstReview = firstReviewByEntity.get(entityId);
    if (!firstReview) return;

    const readyEvent = events.find((event) =>
      event.eventTimestamp >= firstReview
      && (event.readinessScoreAtEvent ?? 0) >= READY_READINESS_THRESHOLD,
    );

    if (readyEvent) {
      reviewToReadyDays.push(daysBetween(firstReview, readyEvent.eventTimestamp));
    }
  });

  const reviewToStartDays = effectiveStartedOutcomeRows
    .map((row) => row.daysFromFirstReview ?? elapsedDays(
      firstReviewByEntity.get(row.entityId) ?? null,
      startOutcomeActualStartDate(row),
    ))
    .filter((value): value is number => value !== null);

  const shareToDecisionDays: number[] = [];
  firstShareByEntity.forEach((sharedAt, entityId) => {
    const decisionAt = firstDecisionByEntity.get(entityId);
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
  const totalStarts = effectiveStartedOutcomeRows.length || (filtered ? 0 : startAttestationCount);
  const distinctStartEntities = new Set(
    effectiveStartedOutcomeRows.map((row) => row.entityId),
  ).size;
  const scoresAtStart = effectiveStartedOutcomeRows
    .map((row) => row.readinessScoreAtStart)
    .filter((value): value is number => value !== null);

  const startOutcomes: StartOutcomeStats = {
    totalStarts,
    distinctEntities: distinctStartEntities || totalStarts,
    readinessAtStart: {
      avgScore: average(scoresAtStart),
      medianScore: median(scoresAtStart),
      withBlockers: effectiveStartedOutcomeRows.filter((row) =>
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

  // ── Case-level proof contract ────────────────────────────────────────
  const firstReadyByEntity = earliestDateByKey(
    advisoryEvents.filter((event) => (event.readinessScoreAtEvent ?? 0) >= READY_READINESS_THRESHOLD),
    (event) => event.entityId,
    (event) => event.eventTimestamp,
  );
  const blockerEventsByEntity = groupRowsByKey(blockerEvents, (event) => event.entityId);
  const startOutcomesByEntity = groupRowsByKey(effectiveStartOutcomeRows, (row) => row.entityId);
  const orgContextByEntity = new Map<string, string | null>();

  const rememberOrgContext = (entityId: string | null | undefined, orgContextId: string | null | undefined) => {
    if (!entityId || orgContextByEntity.has(entityId)) {
      return;
    }
    orgContextByEntity.set(entityId, orgContextId ?? null);
  };

  shareEvents.forEach((event) => rememberOrgContext(event.subjectEntityId, event.organizationContextId));
  reviewEvents.forEach((event) => rememberOrgContext(event.entityId, event.organizationContextId));
  decisionEvents.forEach((event) => rememberOrgContext(event.entityId, event.organizationContextId));
  effectiveStartOutcomeRows.forEach((row) => rememberOrgContext(row.entityId, row.organizationContextId));

  const proofEntityIds = [...new Set([
    ...shareEvents.map((event) => event.subjectEntityId).filter((value): value is string => Boolean(value)),
    ...reviewEvents.map((event) => event.entityId),
    ...decisionEvents.map((event) => event.entityId),
    ...effectiveStartOutcomeRows.map((row) => row.entityId),
  ])];

  const proofCases: PilotOutcomeProofCase[] = proofEntityIds.map((entityId) => {
    const outcomeRow = startOutcomesByEntity.get(entityId)?.[startOutcomesByEntity.get(entityId)!.length - 1] ?? null;
    const actualStartDate = outcomeRow ? startOutcomeActualStartDate(outcomeRow) : null;
    const outcomeStatus: StartOutcomeStatus = outcomeRow ? startOutcomeStatus(outcomeRow) : 'pending';
    const baselineProcessDurationDays = outcomeRow ? startOutcomeBaselineDays(outcomeRow) : null;
    const blockerResolutionDays = (blockerEventsByEntity.get(entityId) ?? [])
      .filter((row) => row.status === 'RESOLVED')
      .map((row) => row.resolutionDays)
      .filter((value): value is number => value !== null);
    const daysFromFirstShare = outcomeRow && outcomeStatus === 'started'
      ? outcomeRow.daysFromShare ?? elapsedDays(firstShareByEntity.get(entityId) ?? null, actualStartDate)
      : null;
    const daysFromFirstReview = outcomeRow && outcomeStatus === 'started'
      ? outcomeRow.daysFromFirstReview ?? elapsedDays(firstReviewByEntity.get(entityId) ?? null, actualStartDate)
      : null;
    const daysFromReady = outcomeRow && outcomeStatus === 'started'
      ? outcomeRow.daysFromReady ?? elapsedDays(firstReadyByEntity.get(entityId) ?? null, actualStartDate)
      : null;
    const correctionGroupSize = outcomeRow
      ? (startOutcomeCorrectionGroups.get(startOutcomeCorrectionKey(outcomeRow)) ?? 1)
      : 0;
    const metadata = outcomeRow ? readJson(outcomeRow.metadata) : {};
    const measuredProcessDurationDays = outcomeStatus === 'started' ? daysFromFirstReview : null;
    const measuredDeltaDays = baselineProcessDurationDays !== null && measuredProcessDurationDays !== null
      ? baselineProcessDurationDays - measuredProcessDurationDays
      : null;

    return {
      entityId,
      organizationContextId: orgContextByEntity.get(entityId) ?? null,
      baselineProcessDurationDays,
      firstSharedAt: toIso(firstShareByEntity.get(entityId) ?? null),
      firstReviewAt: toIso(firstReviewByEntity.get(entityId) ?? null),
      employerDecisionAt: toIso(firstDecisionByEntity.get(entityId) ?? null),
      actualStartDate: toIso(actualStartDate),
      outcomeRecordedAt: outcomeRow ? toIso(startOutcomeOutcomeRecordedAt(outcomeRow)) : null,
      outcomeStatus,
      started: outcomeStatus === 'started',
      nonStartReason: outcomeRow && outcomeStatus === 'not_started'
        ? startOutcomeNonStartReason(outcomeRow)
        : null,
      daysFromFirstShare,
      daysFromFirstReview,
      daysFromReady,
      measuredProcessDurationDays,
      measuredDeltaDays,
      blockerResolution: {
        resolvedCount: blockerResolutionDays.length,
        avgDays: average(blockerResolutionDays),
        medianDays: median(blockerResolutionDays),
      },
      manualCorrection: outcomeRow
        ? correctionGroupSize > 1
          || readBoolean(metadata.manualCorrection)
          || readString(metadata.correctionOfOutcomeId) !== null
        : false,
      note: outcomeRow ? startOutcomeNote(outcomeRow) : null,
    };
  }).sort((left, right) => {
    const leftTime = Date.parse(
      left.outcomeRecordedAt
      ?? left.actualStartDate
      ?? left.employerDecisionAt
      ?? left.firstReviewAt
      ?? left.firstSharedAt
      ?? '1970-01-01T00:00:00.000Z',
    );
    const rightTime = Date.parse(
      right.outcomeRecordedAt
      ?? right.actualStartDate
      ?? right.employerDecisionAt
      ?? right.firstReviewAt
      ?? right.firstSharedAt
      ?? '1970-01-01T00:00:00.000Z',
    );
    return rightTime - leftTime;
  });

  const measuredDeltaDays = proofCases
    .map((entry) => entry.measuredDeltaDays)
    .filter((value): value is number => value !== null);
  const proofSummary: PilotOutcomeProofSummary = {
    totalCases: proofCases.length,
    startedCases: proofCases.filter((entry) => entry.outcomeStatus === 'started').length,
    notStartedCases: proofCases.filter((entry) => entry.outcomeStatus === 'not_started').length,
    pendingCases: proofCases.filter((entry) => entry.outcomeStatus === 'pending').length,
    casesWithBaseline: proofCases.filter((entry) => entry.baselineProcessDurationDays !== null).length,
    casesWithMeasuredDelta: measuredDeltaDays.length,
    usableProofCases: proofCases.filter((entry) => (
      entry.outcomeStatus === 'started'
      && entry.baselineProcessDurationDays !== null
      && entry.measuredProcessDurationDays !== null
    )).length,
    avgMeasuredDeltaDays: average(measuredDeltaDays),
    medianMeasuredDeltaDays: median(measuredDeltaDays),
    automaticProofArtifactReady: proofCases.some((entry) => (
      entry.outcomeStatus === 'started'
      && entry.baselineProcessDurationDays !== null
      && entry.measuredProcessDurationDays !== null
    )),
  };

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
  if (filtered && startAttestationCount > 0 && effectiveStartOutcomeRows.length === 0) {
    gaps.push('Scoped start KPIs rely on start_outcome_events. Canonical start_attestations are unscoped health signals only and are excluded from filtered start metrics.');
  }
  if (proofCases.some((entry) => entry.outcomeStatus === 'started' && entry.baselineProcessDurationDays === null)) {
    gaps.push('Started cases are missing baseline_process_duration_days — measured TTS deltas require the buyer/employer baseline.');
  }
  if (proofCases.some((entry) => entry.outcomeStatus === 'not_started' && entry.nonStartReason === null)) {
    gaps.push('Not-started cases are missing non_start_reason — proof exports need an explicit employer/buyer reason.');
  }

  log('info', 'pilot_kpi_computed', {
    windowDays,
    pilotId: filter.pilotId ?? null,
    workflowLane: filter.workflowLane ?? null,
    orgContextId: filter.orgContextId ?? null,
    packets: packetShares.total,
    reviews: reviewsOpened.total,
    decisions: decisions.total,
    starts: startOutcomes.totalStarts,
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
    proofCases,
    proofSummary,
    readinessDistribution,
    eventChain: {
      bundleShareEvents: bundleShareCount,
      advisoryOutcomeEvents: advisoryOutcomeCount,
      employerDecisionEvents: employerDecisionCount,
      blockerResolutionEvents: blockerCount,
      startOutcomeEvents: startOutcomeCount,
      employerAcceptances: acceptanceCount,
      startAttestations: startAttestationCount,
    },
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
    { section: 'proof_summary', label: 'total_cases', value: String(snap.proofSummary.totalCases) },
    { section: 'proof_summary', label: 'started_cases', value: String(snap.proofSummary.startedCases) },
    { section: 'proof_summary', label: 'not_started_cases', value: String(snap.proofSummary.notStartedCases) },
    { section: 'proof_summary', label: 'pending_cases', value: String(snap.proofSummary.pendingCases) },
    { section: 'proof_summary', label: 'cases_with_baseline', value: String(snap.proofSummary.casesWithBaseline) },
    { section: 'proof_summary', label: 'cases_with_measured_delta', value: String(snap.proofSummary.casesWithMeasuredDelta) },
    { section: 'proof_summary', label: 'usable_proof_cases', value: String(snap.proofSummary.usableProofCases) },
    {
      section: 'proof_summary',
      label: 'avg_measured_delta_days',
      value: formatExportValue(snap.proofSummary.avgMeasuredDeltaDays),
    },
    {
      section: 'proof_summary',
      label: 'median_measured_delta_days',
      value: formatExportValue(snap.proofSummary.medianMeasuredDeltaDays),
    },
    {
      section: 'proof_summary',
      label: 'automatic_proof_artifact_ready',
      value: String(snap.proofSummary.automaticProofArtifactReady),
    },
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

  for (const proofCase of snap.proofCases) {
    const caseSection = `proof_case:${proofCase.entityId}`;
    rows.push(
      { section: caseSection, label: 'organization_context_id', value: proofCase.organizationContextId ?? 'none' },
      { section: caseSection, label: 'baseline_process_duration_days', value: formatExportValue(proofCase.baselineProcessDurationDays) },
      { section: caseSection, label: 'first_shared_at', value: proofCase.firstSharedAt ?? 'none' },
      { section: caseSection, label: 'first_review_at', value: proofCase.firstReviewAt ?? 'none' },
      { section: caseSection, label: 'employer_decision_at', value: proofCase.employerDecisionAt ?? 'none' },
      { section: caseSection, label: 'actual_start_date', value: proofCase.actualStartDate ?? 'none' },
      { section: caseSection, label: 'outcome_recorded_at', value: proofCase.outcomeRecordedAt ?? 'none' },
      { section: caseSection, label: 'outcome_status', value: proofCase.outcomeStatus },
      { section: caseSection, label: 'started', value: String(proofCase.started) },
      { section: caseSection, label: 'non_start_reason', value: proofCase.nonStartReason ?? 'none' },
      { section: caseSection, label: 'days_from_first_share', value: formatExportValue(proofCase.daysFromFirstShare) },
      { section: caseSection, label: 'days_from_first_review', value: formatExportValue(proofCase.daysFromFirstReview) },
      { section: caseSection, label: 'days_from_ready', value: formatExportValue(proofCase.daysFromReady) },
      { section: caseSection, label: 'measured_process_duration_days', value: formatExportValue(proofCase.measuredProcessDurationDays) },
      { section: caseSection, label: 'measured_delta_days', value: formatExportValue(proofCase.measuredDeltaDays) },
      { section: caseSection, label: 'blockers_resolved_count', value: String(proofCase.blockerResolution.resolvedCount) },
      { section: caseSection, label: 'avg_blocker_resolution_days', value: formatExportValue(proofCase.blockerResolution.avgDays) },
      { section: caseSection, label: 'median_blocker_resolution_days', value: formatExportValue(proofCase.blockerResolution.medianDays) },
      { section: caseSection, label: 'manual_correction', value: String(proofCase.manualCorrection) },
      { section: caseSection, label: 'note', value: proofCase.note ?? 'none' },
    );
  }

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
