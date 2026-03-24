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

  const effectiveStartOutcomeRows = collapseCorrectedStartOutcomes(startOutcomeRows);
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

  const reviewToStartDays = effectiveStartOutcomeRows
    .map((row) => row.daysFromFirstReview)
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
  const totalStarts = effectiveStartOutcomeRows.length || (filtered ? 0 : startAttestationCount);
  const distinctStartEntities = new Set(
    effectiveStartOutcomeRows.map((row) => row.entityId),
  ).size;
  const scoresAtStart = effectiveStartOutcomeRows
    .map((row) => row.readinessScoreAtStart)
    .filter((value): value is number => value !== null);

  const startOutcomes: StartOutcomeStats = {
    totalStarts,
    distinctEntities: distinctStartEntities || totalStarts,
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

  // reviewEvents is ordered eventTimestamp asc — iterate forward so the last write
  // per entityId is the most recent score (last-write-wins).
  const latestScoreByEntity = new Map<string, number | null>();
  for (const event of reviewEvents) {
    const score = event.readinessScoreAtEvent ?? null;
    // Always overwrite — last event per entity is the latest
    const prev = latestScoreByEntity.get(event.entityId);
    if (prev === undefined || score !== null) {
      latestScoreByEntity.set(event.entityId, score);
    }
  }

  let readyCount = 0;
  let partialCount = 0;
  let blockedCount = 0;
  let noScoreCount = 0;

  for (const score of latestScoreByEntity.values()) {
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
