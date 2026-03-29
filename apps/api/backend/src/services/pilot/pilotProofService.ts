import { ApplicationStatus, Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { computePilotKpis, type PilotKpiSnapshot } from './pilotKpiService';
import {
  listAllOrgApplications,
  listClinicianApplications,
  type MarketplaceApplication,
} from '../opportunities/applicationService';
import {
  getTrustStateHistory,
  type ClinicianTrustState,
  type TrustBand,
} from '../trust/trustStateEngine';

const PILOT_EVENT_AUDIT_TYPE = 'PILOT_OPS_EVENT';
const DEFAULT_LOOKBACK_HOURS = 30 * 24;
const DEFAULT_HISTORY_WINDOW_DAYS = 90;

type OutcomeObjectType = 'user' | 'application' | 'provider' | 'case';
type OutcomeType =
  | 'onboarding_completed'
  | 'blocker_resolved'
  | 'readiness_improved'
  | 'trust_state_changed'
  | 'application_submitted'
  | 'application_status_moved'
  | 'employer_reviewed'
  | 'employer_action_generated'
  | 'finding_surfaced'
  | 'storyline_created';

type AuditEventRow = {
  id: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type TrustSnapshot = {
  npi: string;
  readinessLevel: TrustBand;
  readinessScore: number;
  readinessStatus: string;
  gapSummary: string[];
  computedAt: string;
};

type TrustTransition = {
  current: TrustSnapshot;
  previous: TrustSnapshot | null;
  deltaScore: number | null;
  newGaps: string[];
  resolvedGaps: string[];
};

export interface OutcomeStateChange {
  id: string;
  objectType: OutcomeObjectType;
  objectId: string;
  outcomeType: OutcomeType;
  summary: string;
  occurredAt: string;
  href: string | null;
}

export interface ClinicianProofSummary {
  generatedAt: string;
  userSummary: string | null;
  metrics: {
    onboardingCompletionMinutes: number | null;
    blockersResolved: number;
    applicationsSubmitted: number;
    applicationsMoving: number;
    readinessDelta: number | null;
    readinessFromScore: number | null;
    readinessToScore: number | null;
    readinessFromLevel: TrustBand | null;
    readinessToLevel: TrustBand | null;
  };
  completedBecauseOfVCV: string[];
  recentChanges: OutcomeStateChange[];
  applicationSummaries: Array<{
    applicationId: string;
    status: string;
    summary: string;
    occurredAt: string;
  }>;
}

export interface EmployerValueSignalMetric {
  id: string;
  label: string;
  value: number;
  detail: string;
}

export interface EmployerValueSignals {
  generatedAt: string;
  metrics: {
    activeApplications: number;
    candidatesReadyVisible: number;
    issuesFlaggedBeforeReview: number;
    preparedContexts: number;
    reviewActions: number;
    actionQueueGenerated: number;
  };
  signals: EmployerValueSignalMetric[];
  candidateSummaries: Array<{
    applicationId: string;
    clinicianLabel: string;
    status: string;
    summary: string;
    occurredAt: string;
    preparedContext: string[];
    issueCount: number;
    actionCount: number;
  }>;
  recentChanges: OutcomeStateChange[];
}

export interface PilotProofGap {
  id: string;
  title: string;
  detail: string;
  status: 'fixed' | 'remaining';
}

export interface PilotProofSummary {
  generatedAt: string;
  lookbackHours: number;
  counts: {
    usersOnboarded: number;
    readinessCompleted: number;
    blockersResolved: number;
    appliedUsers: number;
    applicationsSubmitted: number;
    applicationsMoving: number;
    trustChangesSurfaced: number;
    findingsSurfaced: number;
    storylinesSurfaced: number;
    employerReviews: number;
    employerActionsGenerated: number;
  };
  onboardingCompletion: {
    sampleSize: number;
    averageMinutes: number | null;
    medianMinutes: number | null;
  };
  readinessProgress: {
    improvedUsers: number;
    averageDelta: number | null;
    readyUsers: number;
  };
  systemActivity: {
    pilotEvents: number;
    supportIssues: number;
    routeFailures: number;
  };
  baselineComparison: {
    baselineAt: string | null;
    currentAt: string;
    baseline: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
    current: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
    delta: {
      applications: number;
      readinessCompleted: number;
      findings: number;
      storylines: number;
      employerActionsGenerated: number;
    };
  };
  dropOff: Array<{
    stage: string;
    count: number;
    detail: string;
  }>;
  recentProgress: OutcomeStateChange[];
  topProofGaps: PilotProofGap[];
  remainingGaps: PilotProofGap[];
  livePilot: {
    windowDays: number;
    measuredDelta: PilotKpiSnapshot['velocity'];
    startOutcomes: Pick<
      PilotKpiSnapshot['startOutcomes'],
      'totalStarts' | 'totalOutcomeRecords' | 'didNotStartCount' | 'nonStartReasons'
    >;
    eventChain: PilotKpiSnapshot['eventChain'];
    proofChain: PilotKpiSnapshot['proofChain'];
    exports: {
      json: true;
      csv: true;
    };
  };
}

const FIXED_PROOF_GAPS: PilotProofGap[] = [
  {
    id: 'readiness_delta_hidden',
    title: 'Readiness improved, but the user could not see the before/after change.',
    detail: 'Clinician proof now exposes readiness movement from the oldest recorded state to the latest live state.',
    status: 'fixed',
  },
  {
    id: 'resolved_blockers_hidden',
    title: 'Resolved blockers disappeared without proving that progress happened.',
    detail: 'Resolved readiness gaps are now counted from trust-state transitions and surfaced in clinician and internal proof views.',
    status: 'fixed',
  },
  {
    id: 'application_progress_static',
    title: 'Applications moved, but the product did not clearly show what changed.',
    detail: 'Application state-change summaries now explain submitted, reviewed, accepted, declined, and in-flight movement.',
    status: 'fixed',
  },
  {
    id: 'employer_context_implicit',
    title: 'Employers saw data, but not the prep work already done before review.',
    detail: 'Employer value signals now show readiness visibility, pre-flagged issues, prepared context, and generated actions.',
    status: 'fixed',
  },
  {
    id: 'pilot_truth_scattered',
    title: 'Pilot truth lived across multiple pages instead of one internal source of record.',
    detail: 'The internal proof snapshot now aggregates outcomes, recent deltas, baseline comparison, and surfaced gaps in one exportable response.',
    status: 'fixed',
  },
];

const REMAINING_PROOF_GAPS: PilotProofGap[] = [
  {
    id: 'time_saved_numeric_gap',
    title: 'Numeric time-saved minutes are not yet directly measured end-to-end.',
    detail: 'Prepared context is now visible, but a defensible manual-vs-assisted timing baseline is not yet persisted.',
    status: 'remaining',
  },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readBoolean(value: Prisma.JsonValue | undefined): boolean {
  return value === true;
}

function readStringArray(value: Prisma.JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' && entry.trim().length > 0 ? entry.trim() : null))
    .filter((entry): entry is string => Boolean(entry));
}

function asTrustBand(value: string | null): TrustBand | null {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3'
    ? value
    : null;
}

function bandRank(value: TrustBand | null): number {
  switch (value) {
    case 'L3':
      return 3;
    case 'L2':
      return 2;
    case 'L1':
      return 1;
    case 'L0':
    default:
      return 0;
  }
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return sorted[middle] ?? null;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function minutesBetween(startedAt: Date, completedAt: Date): number | null {
  const delta = completedAt.getTime() - startedAt.getTime();
  if (delta < 0) {
    return null;
  }

  return Math.round(delta / 60_000);
}

function statusLabel(status: string): string {
  switch (status) {
    case ApplicationStatus.PENDING:
      return 'pending';
    case ApplicationStatus.REVIEWED:
      return 'reviewed';
    case ApplicationStatus.ACCEPTED:
      return 'accepted';
    case ApplicationStatus.DECLINED:
      return 'declined';
    case ApplicationStatus.WITHDRAWN:
      return 'withdrawn';
    default:
      return status.toLowerCase();
  }
}

function providerLabel(application: MarketplaceApplication): string {
  return application.provider?.fullName
    ?? application.provider?.npi
    ?? application.npi
    ?? 'Clinician';
}

function applicationOccurredAt(application: MarketplaceApplication): string {
  if (application.status === ApplicationStatus.PENDING) {
    return application.createdAt;
  }

  return application.reviewedAt ?? application.updatedAt ?? application.createdAt;
}

function applicationSummary(application: MarketplaceApplication): string {
  const readiness = application.readiness;
  const readinessText = readiness
    ? `${readiness.readinessLevel} ${readiness.readinessScore}/100`
    : 'the latest readiness state';

  switch (application.status) {
    case ApplicationStatus.ACCEPTED:
      return `Application accepted after review with ${readinessText} attached.`;
    case ApplicationStatus.REVIEWED:
      return `Application moved to reviewed with ${readinessText} available to the employer.`;
    case ApplicationStatus.DECLINED:
      return `Application was reviewed and declined after ${readinessText} was shared.`;
    case ApplicationStatus.WITHDRAWN:
      return 'Application was withdrawn after submission.';
    case ApplicationStatus.PENDING:
    default:
      return readiness
        ? `Application submitted with ${readinessText} attached.`
        : 'Application submitted with the current VitalCV profile attached.';
  }
}

function appHref(applicationId: string): string {
  return `/holder/applications/${encodeURIComponent(applicationId)}`;
}

function buildApplicationChange(application: MarketplaceApplication): OutcomeStateChange {
  const pending = application.status === ApplicationStatus.PENDING;
  return {
    id: `application:${application.id}:${pending ? 'submitted' : application.status}`,
    objectType: 'application',
    objectId: application.id,
    outcomeType: pending ? 'application_submitted' : 'application_status_moved',
    summary: applicationSummary(application),
    occurredAt: applicationOccurredAt(application),
    href: appHref(application.id),
  };
}

function buildEmployerApplicationChange(application: MarketplaceApplication): OutcomeStateChange {
  const pending = application.status === ApplicationStatus.PENDING;
  const reviewLabel = pending ? 'arrived for review' : `moved to ${statusLabel(application.status)}`;
  const readiness = application.readiness;
  const readinessText = readiness
    ? `${readiness.readinessLevel} ${readiness.readinessScore}/100`
    : 'no readiness snapshot';

  return {
    id: `employer-application:${application.id}:${pending ? 'arrived' : application.status}`,
    objectType: 'application',
    objectId: application.id,
    outcomeType: pending ? 'application_submitted' : 'employer_reviewed',
    summary: `${providerLabel(application)} ${reviewLabel} with ${readinessText}.`,
    occurredAt: applicationOccurredAt(application),
    href: '/verifier/inbox',
  };
}

function buildTrustSnapshot(state: ClinicianTrustState): TrustSnapshot {
  return {
    npi: state.npi,
    readinessLevel: state.readiness_level,
    readinessScore: state.readiness_score,
    readinessStatus: state.readiness_status,
    gapSummary: [...state.gap_summary],
    computedAt: state.computedAt ?? state.computed_at,
  };
}

function buildTrustTransitions(history: readonly ClinicianTrustState[]): TrustTransition[] {
  const snapshots = history
    .map((state) => buildTrustSnapshot(state))
    .sort((left, right) => Date.parse(left.computedAt) - Date.parse(right.computedAt));

  return snapshots.map((current, index) => {
    const previous = index > 0 ? snapshots[index - 1] ?? null : null;
    const previousGaps = previous?.gapSummary ?? [];
    return {
      current,
      previous,
      deltaScore: previous ? current.readinessScore - previous.readinessScore : null,
      newGaps: current.gapSummary.filter((gap) => !previousGaps.includes(gap)),
      resolvedGaps: previousGaps.filter((gap) => !current.gapSummary.includes(gap)),
    };
  });
}

function trustTransitionSummary(transition: TrustTransition): string | null {
  if (!transition.previous) {
    return null;
  }

  const levelChanged = transition.current.readinessLevel !== transition.previous.readinessLevel;
  const scoreChanged = transition.deltaScore !== null && transition.deltaScore !== 0;
  if (!levelChanged && !scoreChanged && transition.newGaps.length === 0 && transition.resolvedGaps.length === 0) {
    return null;
  }

  if ((transition.deltaScore ?? 0) > 0 || bandRank(transition.current.readinessLevel) > bandRank(transition.previous.readinessLevel)) {
    if (transition.resolvedGaps.length > 0) {
      return `Readiness improved after resolving ${transition.resolvedGaps.length} ${pluralize(transition.resolvedGaps.length, 'blocker')}.`;
    }
    return `Readiness improved from ${transition.previous.readinessLevel} ${transition.previous.readinessScore}/100 to ${transition.current.readinessLevel} ${transition.current.readinessScore}/100.`;
  }

  if ((transition.deltaScore ?? 0) < 0 || bandRank(transition.current.readinessLevel) < bandRank(transition.previous.readinessLevel)) {
    if (transition.newGaps[0]) {
      return `Trust state changed after ${transition.newGaps[0].toLowerCase()}.`;
    }
    return `Trust state changed from ${transition.previous.readinessLevel} ${transition.previous.readinessScore}/100 to ${transition.current.readinessLevel} ${transition.current.readinessScore}/100.`;
  }

  if (transition.resolvedGaps.length > 0) {
    return `${transition.resolvedGaps.length} ${pluralize(transition.resolvedGaps.length, 'blocker')} resolved while readiness stayed at ${transition.current.readinessLevel}.`;
  }

  if (transition.newGaps[0]) {
    return `New blocker detected: ${transition.newGaps[0]}.`;
  }

  return null;
}

function buildTrustChanges(npi: string, history: readonly ClinicianTrustState[]): OutcomeStateChange[] {
  const changes: OutcomeStateChange[] = [];

  buildTrustTransitions(history).forEach((transition) => {
    const summary = trustTransitionSummary(transition);
    if (!summary) {
      return;
    }

    changes.push({
      id: `provider:${npi}:${transition.current.computedAt}`,
      objectType: 'provider',
      objectId: npi,
      outcomeType:
        (transition.deltaScore ?? 0) > 0 || transition.resolvedGaps.length > 0
          ? 'readiness_improved'
          : 'trust_state_changed',
      summary,
      occurredAt: transition.current.computedAt,
      href: '/holder/readiness',
    });
  });

  return changes.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
}

function resolvedBlockerCount(history: readonly ClinicianTrustState[]): number {
  return buildTrustTransitions(history)
    .reduce((total, transition) => total + transition.resolvedGaps.length, 0);
}

function buildOnboardingProgress(events: readonly AuditEventRow[], clerkUserId?: string | null): {
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
} {
  const relevantEvents = events
    .map((row) => ({
      createdAt: row.createdAt,
      metadata: readRecord(row.metadata),
    }))
    .filter((event) => {
      const eventUserId = readString(event.metadata.userId);
      if (clerkUserId && eventUserId !== clerkUserId) {
        return false;
      }
      if (readBoolean(readRecord(event.metadata.details).guestMode)) {
        return false;
      }
      return true;
    })
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  const startedAt = relevantEvents.find((event) => readString(event.metadata.eventType) === 'onboarding_started')?.createdAt ?? null;
  const completedAt = relevantEvents.find((event) => {
    if (readString(event.metadata.eventType) !== 'onboarding_completed') {
      return false;
    }
    return startedAt ? event.createdAt.getTime() >= startedAt.getTime() : true;
  })?.createdAt ?? null;

  return {
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
    durationMinutes: startedAt && completedAt ? minutesBetween(startedAt, completedAt) : null,
  };
}

function buildOnboardingCompletionChange(input: {
  durationMinutes: number | null;
  completedAt: string | null;
}): OutcomeStateChange | null {
  if (!input.completedAt) {
    return null;
  }

  const durationText = input.durationMinutes === null ? 'completed' : `completed in ${input.durationMinutes}m`;
  return {
    id: `user:onboarding:${input.completedAt}`,
    objectType: 'user',
    objectId: 'current-user',
    outcomeType: 'onboarding_completed',
    summary: `Onboarding ${durationText}.`,
    occurredAt: input.completedAt,
    href: '/holder/home',
  };
}

function completedBecauseOfVCV(input: {
  onboardingMinutes: number | null;
  blockersResolved: number;
  applicationsSubmitted: number;
  applicationsMoving: number;
  oldestTrust: TrustSnapshot | null;
  latestTrust: TrustSnapshot | null;
}): string[] {
  const lines: string[] = [];
  if (input.onboardingMinutes !== null) {
    lines.push(`Onboarding completed in ${input.onboardingMinutes}m.`);
  }
  if (input.blockersResolved > 0) {
    lines.push(`${input.blockersResolved} ${pluralize(input.blockersResolved, 'blocker')} resolved across readiness updates.`);
  }
  if (input.oldestTrust && input.latestTrust && input.oldestTrust.computedAt !== input.latestTrust.computedAt) {
    const changed = input.latestTrust.readinessScore - input.oldestTrust.readinessScore;
    if (changed !== 0 || input.oldestTrust.readinessLevel !== input.latestTrust.readinessLevel) {
      lines.push(`Readiness moved from ${input.oldestTrust.readinessLevel} ${input.oldestTrust.readinessScore}/100 to ${input.latestTrust.readinessLevel} ${input.latestTrust.readinessScore}/100.`);
    }
  }
  if (input.applicationsSubmitted > 0) {
    lines.push(`${input.applicationsSubmitted} ${pluralize(input.applicationsSubmitted, 'application')} submitted with live profile context.`);
  }
  if (input.applicationsMoving > 0) {
    lines.push(`${input.applicationsMoving} ${pluralize(input.applicationsMoving, 'application')} moved beyond submitted status.`);
  }
  return lines;
}

function summarizeUserOutcome(input: {
  blockersResolved: number;
  onboardingCompletionMinutes: number | null;
  latestTrust: TrustSnapshot | null;
  oldestTrust: TrustSnapshot | null;
  applicationsSubmitted: number;
}): string | null {
  if (input.latestTrust && input.oldestTrust && input.latestTrust.computedAt !== input.oldestTrust.computedAt) {
    if (input.blockersResolved > 0) {
      return `Readiness improved after resolving ${input.blockersResolved} ${pluralize(input.blockersResolved, 'blocker')}.`;
    }
    const delta = input.latestTrust.readinessScore - input.oldestTrust.readinessScore;
    if (delta !== 0 || input.latestTrust.readinessLevel !== input.oldestTrust.readinessLevel) {
      return `Readiness changed from ${input.oldestTrust.readinessLevel} ${input.oldestTrust.readinessScore}/100 to ${input.latestTrust.readinessLevel} ${input.latestTrust.readinessScore}/100.`;
    }
  }

  if (input.applicationsSubmitted > 0) {
    return `${input.applicationsSubmitted} ${pluralize(input.applicationsSubmitted, 'application')} submitted with the latest VitalCV profile attached.`;
  }

  if (input.onboardingCompletionMinutes !== null) {
    return `Onboarding completed in ${input.onboardingCompletionMinutes}m and the profile is active.`;
  }

  return null;
}

function sortChanges(changes: readonly OutcomeStateChange[], limit = 8): OutcomeStateChange[] {
  return [...changes]
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
    .slice(0, limit);
}

function findingSummary(title: string, severity: string): string {
  return `Finding surfaced (${severity.toLowerCase()}): ${title}.`;
}

function storylineSummary(title: string, findingCount: number): string {
  return findingCount > 0
    ? `${title} created from ${findingCount} related ${pluralize(findingCount, 'signal')}.`
    : `${title} created from related signals.`;
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export async function getClinicianProofSummary(
  clerkUserId: string,
): Promise<ClinicianProofSummary> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    include: { personProfile: true },
  });
  const npi = user?.personProfile?.npi ?? null;

  const [applications, eventRows, trustHistory, findings, storylines] = await Promise.all([
    listClinicianApplications(clerkUserId),
    prisma.auditEvent.findMany({
      where: {
        type: PILOT_EVENT_AUDIT_TYPE,
        createdAt: { gte: new Date(Date.now() - DEFAULT_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    npi ? getTrustStateHistory(npi, 12) : Promise.resolve([]),
    npi
      ? prisma.findingEntityLink.findMany({
          where: {
            entityType: 'provider',
            entityId: npi,
          },
          select: {
            entityId: true,
            createdAt: true,
            finding: {
              select: {
                findingId: true,
                title: true,
                severity: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 4,
        })
      : Promise.resolve([]),
    npi
      ? prisma.storylineEntityLink.findMany({
          where: {
            entityType: 'PROVIDER',
            entityKey: npi,
          },
          include: {
            storyline: {
              select: {
                storylineId: true,
                title: true,
                findingIds: true,
                createdAt: true,
              },
            },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 4,
        })
      : Promise.resolve([]),
  ]);

  const onboarding = buildOnboardingProgress(eventRows, clerkUserId);
  const trustTransitions = buildTrustTransitions(trustHistory);
  const oldestTrust = trustTransitions[0]?.current ?? null;
  const latestTrust = trustTransitions[trustTransitions.length - 1]?.current ?? null;
  const blockerCount = resolvedBlockerCount(trustHistory);
  const applicationChanges = applications.map((application) => buildApplicationChange(application));
  const trustChanges = npi ? buildTrustChanges(npi, trustHistory) : [];
  const findingChanges: OutcomeStateChange[] = findings.map((row) => ({
    id: `finding:${row.finding.findingId}`,
    objectType: 'provider',
    objectId: row.entityId,
    outcomeType: 'finding_surfaced',
    summary: findingSummary(row.finding.title, row.finding.severity),
    occurredAt: row.finding.createdAt.toISOString(),
    href: '/holder/readiness',
  }));
  const storylineChanges: OutcomeStateChange[] = storylines.map((row) => ({
    id: `storyline:${row.storyline.storylineId}`,
    objectType: 'case',
    objectId: row.storyline.storylineId,
    outcomeType: 'storyline_created',
    summary: storylineSummary(row.storyline.title, row.storyline.findingIds.length),
    occurredAt: row.storyline.createdAt.toISOString(),
    href: '/holder/readiness',
  }));

  const recentChanges = sortChanges(uniqueById([
    ...applicationChanges,
    ...trustChanges,
    ...findingChanges,
    ...storylineChanges,
    ...(() => {
      const onboardingChange = buildOnboardingCompletionChange({
        durationMinutes: onboarding.durationMinutes,
        completedAt: onboarding.completedAt,
      });
      return onboardingChange ? [onboardingChange] : [];
    })(),
  ]));

  return {
    generatedAt: new Date().toISOString(),
    userSummary: summarizeUserOutcome({
      blockersResolved: blockerCount,
      onboardingCompletionMinutes: onboarding.durationMinutes,
      latestTrust,
      oldestTrust,
      applicationsSubmitted: applications.length,
    }),
    metrics: {
      onboardingCompletionMinutes: onboarding.durationMinutes,
      blockersResolved: blockerCount,
      applicationsSubmitted: applications.length,
      applicationsMoving: applications.filter((application) => (
        application.status !== ApplicationStatus.PENDING
        && application.status !== ApplicationStatus.WITHDRAWN
      )).length,
      readinessDelta: oldestTrust && latestTrust ? latestTrust.readinessScore - oldestTrust.readinessScore : null,
      readinessFromScore: oldestTrust?.readinessScore ?? null,
      readinessToScore: latestTrust?.readinessScore ?? null,
      readinessFromLevel: oldestTrust?.readinessLevel ?? null,
      readinessToLevel: latestTrust?.readinessLevel ?? null,
    },
    completedBecauseOfVCV: completedBecauseOfVCV({
      onboardingMinutes: onboarding.durationMinutes,
      blockersResolved: blockerCount,
      applicationsSubmitted: applications.length,
      applicationsMoving: applications.filter((application) => (
        application.status !== ApplicationStatus.PENDING
        && application.status !== ApplicationStatus.WITHDRAWN
      )).length,
      oldestTrust,
      latestTrust,
    }),
    recentChanges,
    applicationSummaries: applications.map((application) => ({
      applicationId: application.id,
      status: application.status,
      summary: applicationSummary(application),
      occurredAt: applicationOccurredAt(application),
    })),
  };
}

function buildPreparedContext(input: {
  application: MarketplaceApplication;
  issueCount: number;
  storylineCount: number;
  actionCount: number;
}): string[] {
  const context: string[] = [];
  const readiness = input.application.readiness;

  if (readiness) {
    context.push(`Readiness visible (${readiness.readinessLevel} ${readiness.readinessScore}/100)`);
    if (readiness.keyCredentials.length > 0) {
      context.push(`${readiness.keyCredentials.length} key ${pluralize(readiness.keyCredentials.length, 'credential')} summarized`);
    }
  }
  if (input.issueCount > 0) {
    context.push(`${input.issueCount} issue${input.issueCount === 1 ? '' : 's'} flagged before review`);
  }
  if (input.storylineCount > 0) {
    context.push(`${input.storylineCount} storyline${input.storylineCount === 1 ? '' : 's'} already prepared`);
  }
  if (input.actionCount > 0) {
    context.push(`${input.actionCount} action${input.actionCount === 1 ? '' : 's'} generated from live signals`);
  }

  return context;
}

function buildEmployerCandidateSummary(input: {
  application: MarketplaceApplication;
  issueCount: number;
  storylineCount: number;
  actionCount: number;
}): EmployerValueSignals['candidateSummaries'][number] {
  const preparedContext = buildPreparedContext(input);
  const readiness = input.application.readiness;
  const readinessText = readiness
    ? `${readiness.readinessLevel} ${readiness.readinessScore}/100`
    : 'no readiness snapshot';
  const issueText = input.issueCount > 0
    ? `${input.issueCount} issue${input.issueCount === 1 ? '' : 's'} identified before review`
    : 'no pre-review issues currently attached';

  return {
    applicationId: input.application.id,
    clinicianLabel: providerLabel(input.application),
    status: input.application.status,
    summary: `${providerLabel(input.application)} is ${statusLabel(input.application.status)} with ${readinessText} and ${issueText}.`,
    occurredAt: applicationOccurredAt(input.application),
    preparedContext,
    issueCount: input.issueCount,
    actionCount: input.actionCount,
  };
}

export async function getEmployerValueSignals(
  clerkUserId: string,
): Promise<EmployerValueSignals> {
  const applications = await listAllOrgApplications(clerkUserId);
  const providerNpis = [...new Set(applications
    .map((application) => application.provider?.npi ?? application.npi)
    .filter((npi): npi is string => Boolean(npi)))];

  const [findings, storylines, actions] = providerNpis.length > 0
    ? await Promise.all([
        prisma.findingEntityLink.findMany({
          where: {
            entityType: 'provider',
            entityId: { in: providerNpis },
          },
          select: {
            entityId: true,
            createdAt: true,
            finding: {
              select: {
                findingId: true,
                title: true,
                severity: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.storylineEntityLink.findMany({
          where: {
            entityType: 'PROVIDER',
            entityKey: { in: providerNpis },
          },
          include: {
            storyline: {
              select: {
                storylineId: true,
                title: true,
                findingIds: true,
                createdAt: true,
              },
            },
          },
          orderBy: { lastSeenAt: 'desc' },
        }),
        prisma.actionRecommendation.findMany({
          where: {
            targetEntityType: 'provider',
            targetEntityId: { in: providerNpis },
            dismissedAt: null,
          },
          select: {
            id: true,
            targetEntityId: true,
            actionType: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ])
    : [[], [], []];

  const findingsByNpi = new Map<string, typeof findings>();
  findings.forEach((row) => {
    const current = findingsByNpi.get(row.entityId) ?? [];
    current.push(row);
    findingsByNpi.set(row.entityId, current);
  });

  const storylinesByNpi = new Map<string, typeof storylines>();
  storylines.forEach((row) => {
    const current = storylinesByNpi.get(row.entityKey) ?? [];
    current.push(row);
    storylinesByNpi.set(row.entityKey, current);
  });

  const actionsByNpi = new Map<string, typeof actions>();
  actions.forEach((row) => {
    const current = actionsByNpi.get(row.targetEntityId) ?? [];
    current.push(row);
    actionsByNpi.set(row.targetEntityId, current);
  });

  const candidateSummaries = applications.map((application) => {
    const providerNpi = application.provider?.npi ?? application.npi ?? '';
    return buildEmployerCandidateSummary({
      application,
      issueCount: providerNpi ? (findingsByNpi.get(providerNpi)?.length ?? 0) + (application.readiness?.gapSummary.length ?? 0) : (application.readiness?.gapSummary.length ?? 0),
      storylineCount: providerNpi ? (storylinesByNpi.get(providerNpi)?.length ?? 0) : 0,
      actionCount: providerNpi ? (actionsByNpi.get(providerNpi)?.length ?? 0) : 0,
    });
  });

  const recentChanges = sortChanges(uniqueById([
    ...applications.map((application) => buildEmployerApplicationChange(application)),
    ...findings.slice(0, 6).map((row) => ({
      id: `employer-finding:${row.finding.findingId}`,
      objectType: 'provider',
      objectId: row.entityId,
      outcomeType: 'finding_surfaced',
      summary: findingSummary(row.finding.title, row.finding.severity),
      occurredAt: row.finding.createdAt.toISOString(),
      href: '/findings',
    }) satisfies OutcomeStateChange),
    ...storylines.slice(0, 6).map((row) => ({
      id: `employer-storyline:${row.storyline.storylineId}`,
      objectType: 'case',
      objectId: row.storyline.storylineId,
      outcomeType: 'storyline_created',
      summary: storylineSummary(row.storyline.title, row.storyline.findingIds.length),
      occurredAt: row.storyline.createdAt.toISOString(),
      href: '/storylines',
    }) satisfies OutcomeStateChange),
    ...actions.slice(0, 6).map((row) => ({
      id: `employer-action:${row.id}`,
      objectType: 'provider',
      objectId: row.targetEntityId,
      outcomeType: 'employer_action_generated',
      summary: `${row.actionType.replace(/_/g, ' ').toLowerCase()} action generated from live signals.`,
      occurredAt: row.updatedAt.toISOString(),
      href: '/actions',
    }) satisfies OutcomeStateChange),
  ]));

  const metrics = {
    activeApplications: applications.length,
    candidatesReadyVisible: applications.filter((application) => application.readiness !== null).length,
    issuesFlaggedBeforeReview: candidateSummaries.filter((entry) => entry.issueCount > 0).length,
    preparedContexts: candidateSummaries.filter((entry) => entry.preparedContext.length > 0).length,
    reviewActions: applications.filter((application) => application.reviewedAt !== null).length,
    actionQueueGenerated: actions.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    signals: [
      {
        id: 'readiness_visible',
        label: 'Candidate readiness visible',
        value: metrics.candidatesReadyVisible,
        detail: `${metrics.activeApplications} active ${pluralize(metrics.activeApplications, 'application')} in employer review.`,
      },
      {
        id: 'issues_pre_flagged',
        label: 'Issues identified before review',
        value: metrics.issuesFlaggedBeforeReview,
        detail: 'Counts applications carrying readiness gaps or linked findings before manual review begins.',
      },
      {
        id: 'prepared_contexts',
        label: 'Prepared review context',
        value: metrics.preparedContexts,
        detail: 'Applications already carrying readiness, findings, storylines, or actions.',
      },
      {
        id: 'action_queue',
        label: 'Action queue generated',
        value: metrics.actionQueueGenerated,
        detail: `${metrics.reviewActions} review ${pluralize(metrics.reviewActions, 'action')} already recorded.`,
      },
    ],
    candidateSummaries,
    recentChanges,
  };
}

function distinctUserCount(events: readonly AuditEventRow[], eventType: string): number {
  const ids = new Set<string>();
  events.forEach((row) => {
    const metadata = readRecord(row.metadata);
    const details = readRecord(metadata.details);
    if (readString(metadata.eventType) !== eventType || readBoolean(details.guestMode)) {
      return;
    }
    const userId = readString(metadata.userId);
    if (userId) {
      ids.add(userId);
    }
  });
  return ids.size;
}

function onboardingDurationSamples(events: readonly AuditEventRow[]): number[] {
  const eventsByUser = new Map<string, AuditEventRow[]>();

  events.forEach((row) => {
    const metadata = readRecord(row.metadata);
    const details = readRecord(metadata.details);
    if (readBoolean(details.guestMode)) {
      return;
    }
    const userId = readString(metadata.userId);
    if (!userId) {
      return;
    }
    const current = eventsByUser.get(userId) ?? [];
    current.push(row);
    eventsByUser.set(userId, current);
  });

  return [...eventsByUser.values()]
    .map((rows) => buildOnboardingProgress(rows))
    .map((progress) => progress.durationMinutes)
    .filter((value): value is number => value !== null);
}

function latestTrustByNpi(rows: readonly ClinicianTrustState[]): Map<string, ClinicianTrustState> {
  const map = new Map<string, ClinicianTrustState>();
  [...rows]
    .sort((left, right) => Date.parse(right.computedAt ?? right.computed_at) - Date.parse(left.computedAt ?? left.computed_at))
    .forEach((row) => {
      if (!map.has(row.npi)) {
        map.set(row.npi, row);
      }
    });
  return map;
}

export async function getPilotProofSummary(
  options: { lookbackHours?: number } = {},
): Promise<PilotProofSummary> {
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  const livePilotWindowDays = Math.max(1, Math.round(lookbackHours / 24));
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const historyWindowSince = new Date(Date.now() - DEFAULT_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    eventRows,
    applications,
    trustArtifacts,
    recentFindings,
    recentStorylines,
    recentActions,
    currentFindingsCount,
    currentStorylinesCount,
    currentActionsCount,
    earliestPilotEvent,
    earliestApplication,
    earliestTrustArtifact,
    earliestFinding,
    earliestStoryline,
    livePilotSnapshot,
  ] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        type: PILOT_EVENT_AUDIT_TYPE,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.application.findMany({
      select: {
        id: true,
        clerkUserId: true,
        npi: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.verificationArtifact.findMany({
      where: {
        source: 'TRUST_STATE_ENGINE',
        verifiedAt: { gte: historyWindowSince },
      },
      select: {
        rawPayload: true,
      },
    }),
    prisma.investigatorFinding.findMany({
      where: { createdAt: { gte: since } },
      select: {
        findingId: true,
        title: true,
        severity: true,
        createdAt: true,
        entityIds: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.storyline.findMany({
      where: { createdAt: { gte: since } },
      select: {
        storylineId: true,
        title: true,
        createdAt: true,
        findingIds: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.actionRecommendation.findMany({
      where: {
        createdAt: { gte: since },
        dismissedAt: null,
      },
      select: {
        id: true,
        targetEntityId: true,
        createdAt: true,
        updatedAt: true,
        actionType: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 12,
    }),
    prisma.investigatorFinding.count(),
    prisma.storyline.count(),
    prisma.actionRecommendation.count({ where: { dismissedAt: null } }),
    prisma.auditEvent.findFirst({
      where: { type: PILOT_EVENT_AUDIT_TYPE },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.application.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.verificationArtifact.findFirst({
      where: { source: 'TRUST_STATE_ENGINE' },
      orderBy: { verifiedAt: 'asc' },
      select: { verifiedAt: true },
    }),
    prisma.investigatorFinding.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.storyline.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    computePilotKpis({ windowDays: livePilotWindowDays }),
  ]);

  const trustHistory: ClinicianTrustState[] = [];
  trustArtifacts.forEach((artifact) => {
    const record = readRecord(artifact.rawPayload);
    const snapshot = readRecord(record.trust_state_snapshot);
    const source = Object.keys(snapshot).length > 0 ? snapshot : record;
    const npi = readString(source.npi);
    const readinessLevel = asTrustBand(readString(source.readiness_level) ?? readString(source.trustBand));
    const readinessScore = source.readiness_score;
    const readinessStatus = readString(source.readiness_status);
    const computedAt = readString(source.computedAt) ?? readString(source.computed_at);
    if (!npi || !readinessLevel || !readinessStatus || !computedAt || !isFiniteNumber(readinessScore)) {
      return;
    }
    trustHistory.push({
      npi,
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      credentialCount: 0,
      readiness_level: readinessLevel,
      readiness_status: readinessStatus,
      readiness_score: readinessScore,
      gap_summary: readStringArray(source.gap_summary),
      methodology_version: readString(source.methodology_version) ?? 'unknown',
      computed_at: computedAt,
      trustBand: readinessLevel,
      trustScore: readinessScore,
      facts: [],
      gaps: [],
      computedAt,
    });
  });

  const trustByNpi = new Map<string, ClinicianTrustState[]>();
  trustHistory.forEach((row) => {
    const current = trustByNpi.get(row.npi) ?? [];
    current.push(row);
    trustByNpi.set(row.npi, current);
  });

  const trustChanges = [...trustByNpi.entries()].flatMap(([npi, history]) => buildTrustChanges(npi, history));
  const latestTrust = latestTrustByNpi(trustHistory);
  const appliedUsers = new Set(applications.map((application) => application.clerkUserId));
  const appliedNpis = new Set(applications.map((application) => application.npi).filter((value): value is string => Boolean(value)));
  const onboardingSamples = onboardingDurationSamples(eventRows);

  const baselineCandidates = [
    earliestPilotEvent?.createdAt ?? null,
    earliestApplication?.createdAt ?? null,
    earliestTrustArtifact?.verifiedAt ?? null,
    earliestFinding?.createdAt ?? null,
    earliestStoryline?.createdAt ?? null,
  ].filter((value): value is Date => value !== null);
  const baselineAt = baselineCandidates.length > 0
    ? new Date(Math.min(...baselineCandidates.map((value) => value.getTime())))
    : null;

  const baseline = baselineAt
    ? {
        applications: applications.filter((application) => application.createdAt.getTime() <= baselineAt.getTime()).length,
        readinessCompleted: trustHistory.filter((row) => Date.parse(row.computedAt) <= baselineAt.getTime())
          .reduce((set, row) => set.add(row.npi), new Set<string>()).size,
        findings: await prisma.investigatorFinding.count({
          where: { createdAt: { lte: baselineAt } },
        }),
        storylines: await prisma.storyline.count({
          where: { createdAt: { lte: baselineAt } },
        }),
        employerActionsGenerated: await prisma.actionRecommendation.count({
          where: {
            dismissedAt: null,
            createdAt: { lte: baselineAt },
          },
        }),
      }
    : {
        applications: 0,
        readinessCompleted: 0,
        findings: 0,
        storylines: 0,
        employerActionsGenerated: 0,
      };

  const current = {
    applications: applications.length,
    readinessCompleted: latestTrust.size,
    findings: currentFindingsCount,
    storylines: currentStorylinesCount,
    employerActionsGenerated: currentActionsCount,
  };

  const recentProgress = sortChanges(uniqueById([
    ...trustChanges,
    ...applications.slice(0, 8).map((application) => ({
      id: `internal-application:${application.id}:${application.status}`,
      objectType: 'application',
      objectId: application.id,
      outcomeType: application.status === ApplicationStatus.PENDING ? 'application_submitted' : 'application_status_moved',
      summary: `Application ${application.id} is ${statusLabel(application.status)}.`,
      occurredAt: (application.reviewedAt ?? application.updatedAt ?? application.createdAt).toISOString(),
      href: null,
    }) satisfies OutcomeStateChange),
    ...recentFindings.map((finding) => ({
      id: `internal-finding:${finding.findingId}`,
      objectType: 'provider',
      objectId: finding.entityIds[0] ?? finding.findingId,
      outcomeType: 'finding_surfaced',
      summary: findingSummary(finding.title, finding.severity),
      occurredAt: finding.createdAt.toISOString(),
      href: null,
    }) satisfies OutcomeStateChange),
    ...recentStorylines.map((storyline) => ({
      id: `internal-storyline:${storyline.storylineId}`,
      objectType: 'case',
      objectId: storyline.storylineId,
      outcomeType: 'storyline_created',
      summary: storylineSummary(storyline.title, storyline.findingIds.length),
      occurredAt: storyline.createdAt.toISOString(),
      href: null,
    }) satisfies OutcomeStateChange),
    ...recentActions.map((action) => ({
      id: `internal-action:${action.id}`,
      objectType: 'provider',
      objectId: action.targetEntityId,
      outcomeType: 'employer_action_generated',
      summary: `${action.actionType.replace(/_/g, ' ').toLowerCase()} action queued from live signals.`,
      occurredAt: action.updatedAt.toISOString(),
      href: null,
    }) satisfies OutcomeStateChange),
  ]));

  const latestTrustTransitions = [...trustByNpi.values()]
    .map((history) => buildTrustTransitions(history))
    .map((history) => history[history.length - 1] ?? null)
    .filter((entry): entry is TrustTransition => entry !== null);

  return {
    generatedAt: new Date().toISOString(),
    lookbackHours,
    counts: {
      usersOnboarded: distinctUserCount(eventRows, 'onboarding_completed'),
      readinessCompleted: latestTrust.size,
      blockersResolved: [...trustByNpi.values()].reduce((total, history) => total + resolvedBlockerCount(history), 0),
      appliedUsers: appliedUsers.size,
      applicationsSubmitted: applications.length,
      applicationsMoving: applications.filter((application) => (
        application.status !== ApplicationStatus.PENDING
        && application.status !== ApplicationStatus.WITHDRAWN
      )).length,
      trustChangesSurfaced: trustChanges.length,
      findingsSurfaced: currentFindingsCount,
      storylinesSurfaced: currentStorylinesCount,
      employerReviews: applications.filter((application) => application.reviewedAt !== null).length,
      employerActionsGenerated: currentActionsCount,
    },
    onboardingCompletion: {
      sampleSize: onboardingSamples.length,
      averageMinutes: average(onboardingSamples),
      medianMinutes: median(onboardingSamples),
    },
    readinessProgress: {
      improvedUsers: latestTrustTransitions.filter((transition) => {
        if (!transition.previous) {
          return false;
        }
        return (transition.deltaScore ?? 0) > 0
          || bandRank(transition.current.readinessLevel) > bandRank(transition.previous.readinessLevel);
      }).length,
      averageDelta: average(latestTrustTransitions
        .map((transition) => transition.deltaScore)
        .filter((value): value is number => value !== null)),
      readyUsers: [...latestTrust.values()].filter((row) => row.readiness_level === 'L3').length,
    },
    systemActivity: {
      pilotEvents: eventRows.length,
      supportIssues: eventRows.filter((row) => readString(readRecord(row.metadata).eventType) === 'support_triggered').length,
      routeFailures: eventRows.filter((row) => readString(readRecord(row.metadata).eventType) === 'route_failure').length,
    },
    baselineComparison: {
      baselineAt: baselineAt?.toISOString() ?? null,
      currentAt: new Date().toISOString(),
      baseline,
      current,
      delta: {
        applications: current.applications - baseline.applications,
        readinessCompleted: current.readinessCompleted - baseline.readinessCompleted,
        findings: current.findings - baseline.findings,
        storylines: current.storylines - baseline.storylines,
        employerActionsGenerated: current.employerActionsGenerated - baseline.employerActionsGenerated,
      },
    },
    dropOff: [
      {
        stage: 'onboarding_started_without_completion',
        count: Math.max(distinctUserCount(eventRows, 'onboarding_started') - distinctUserCount(eventRows, 'onboarding_completed'), 0),
        detail: 'Users who started onboarding but do not yet have a completion event.',
      },
      {
        stage: 'readiness_with_open_blockers',
        count: [...latestTrust.values()].filter((row) => row.gap_summary.length > 0).length,
        detail: 'Providers with a current trust snapshot that still carries open readiness gaps.',
      },
      {
        stage: 'ready_not_applied',
        count: [...latestTrust.values()].filter((row) => row.readiness_level === 'L3' && !appliedNpis.has(row.npi)).length,
        detail: 'Providers who reached L3 readiness but do not yet have an application on file.',
      },
      {
        stage: 'applied_still_pending',
        count: applications.filter((application) => application.status === ApplicationStatus.PENDING).length,
        detail: 'Applications that were submitted but have not yet moved into reviewed, accepted, or declined status.',
      },
      {
        stage: 'reviewed_awaiting_final_decision',
        count: applications.filter((application) => application.status === ApplicationStatus.REVIEWED).length,
        detail: 'Applications that reached reviewed status but have not yet been accepted or declined.',
      },
    ],
    recentProgress,
    topProofGaps: FIXED_PROOF_GAPS,
    remainingGaps: REMAINING_PROOF_GAPS,
    livePilot: {
      windowDays: livePilotSnapshot.windowDays,
      measuredDelta: livePilotSnapshot.velocity,
      startOutcomes: {
        totalStarts: livePilotSnapshot.startOutcomes.totalStarts,
        totalOutcomeRecords: livePilotSnapshot.startOutcomes.totalOutcomeRecords,
        didNotStartCount: livePilotSnapshot.startOutcomes.didNotStartCount,
        nonStartReasons: livePilotSnapshot.startOutcomes.nonStartReasons,
      },
      eventChain: livePilotSnapshot.eventChain,
      proofChain: livePilotSnapshot.proofChain,
      exports: {
        json: true,
        csv: true,
      },
    },
  };
}

export interface PilotProofExportRow {
  section: string;
  label: string;
  value: string;
}

function csvCell(cell: string): string {
  return cell.includes(',') || cell.includes('"') || cell.includes('\n')
    ? `"${cell.replace(/"/g, '""')}"`
    : cell;
}

function exportValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'none';
  }

  return String(value);
}

export function pilotProofSummaryToExportRows(summary: PilotProofSummary): PilotProofExportRow[] {
  const rows: PilotProofExportRow[] = [
    { section: 'metadata', label: 'generated_at', value: summary.generatedAt },
    { section: 'metadata', label: 'lookback_hours', value: String(summary.lookbackHours) },
    { section: 'live_pilot', label: 'window_days', value: String(summary.livePilot.windowDays) },
    { section: 'live_pilot', label: 'median_days_first_review_to_decision', value: exportValue(summary.livePilot.measuredDelta.medianDaysFirstReviewToDecision) },
    { section: 'live_pilot', label: 'median_days_first_review_to_ready', value: exportValue(summary.livePilot.measuredDelta.medianDaysFirstReviewToReady) },
    { section: 'live_pilot', label: 'median_days_first_review_to_start', value: exportValue(summary.livePilot.measuredDelta.medianDaysFirstReviewToStart) },
    { section: 'live_pilot', label: 'median_days_share_to_decision', value: exportValue(summary.livePilot.measuredDelta.medianDaysShareToDecision) },
    { section: 'live_pilot', label: 'sample_review_to_decision', value: String(summary.livePilot.measuredDelta.sampleSizes.reviewToDecision) },
    { section: 'live_pilot', label: 'sample_review_to_ready', value: String(summary.livePilot.measuredDelta.sampleSizes.reviewToReady) },
    { section: 'live_pilot', label: 'sample_review_to_start', value: String(summary.livePilot.measuredDelta.sampleSizes.reviewToStart) },
    { section: 'live_pilot', label: 'sample_share_to_decision', value: String(summary.livePilot.measuredDelta.sampleSizes.shareToDecision) },
    { section: 'start_outcomes', label: 'total_starts', value: String(summary.livePilot.startOutcomes.totalStarts) },
    { section: 'start_outcomes', label: 'total_outcome_records', value: String(summary.livePilot.startOutcomes.totalOutcomeRecords) },
    { section: 'start_outcomes', label: 'did_not_start_count', value: String(summary.livePilot.startOutcomes.didNotStartCount) },
    { section: 'proof_chain', label: 'total_events', value: String(summary.livePilot.proofChain.totalEvents) },
    { section: 'proof_chain', label: 'total_cases', value: String(summary.livePilot.proofChain.totalCases) },
    { section: 'proof_chain', label: 'replayable_cases', value: String(summary.livePilot.proofChain.replayableCases) },
    { section: 'proof_chain', label: 'partial_cases', value: String(summary.livePilot.proofChain.partialCases) },
  ];

  summary.livePilot.startOutcomes.nonStartReasons.forEach((entry) => {
    rows.push({
      section: 'non_start_reasons',
      label: entry.reason,
      value: String(entry.count),
    });
  });

  summary.livePilot.proofChain.cases.forEach((proofCase, index) => {
    const section = `proof_chain_case:${index + 1}`;
    rows.push(
      { section, label: 'case_key', value: proofCase.caseKey },
      { section, label: 'replayable', value: String(proofCase.replayable) },
      { section, label: 'missing_core_events', value: proofCase.missingCoreEvents.join('|') || 'none' },
      { section, label: 'non_start_reason', value: proofCase.nonStartReason ?? 'none' },
    );
  });

  summary.livePilot.proofChain.events.forEach((event, index) => {
    const section = `proof_chain_event:${index + 1}`;
    rows.push(
      { section, label: 'event_name', value: event.eventName },
      { section, label: 'occurred_at', value: event.occurredAt },
      { section, label: 'case_key', value: event.caseKey },
      { section, label: 'entity_id', value: event.entityId ?? 'none' },
      { section, label: 'organization_context_id', value: event.organizationContextId ?? 'none' },
      { section, label: 'outcome_status', value: event.outcomeStatus ?? 'none' },
      { section, label: 'detail', value: event.detail ?? 'none' },
    );
  });

  return rows;
}

export function pilotProofSummaryToCsv(summary: PilotProofSummary): string {
  const rows = pilotProofSummaryToExportRows(summary);
  return [
    ['section', 'label', 'value'],
    ...rows.map((row) => [row.section, row.label, row.value]),
  ].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function getPilotProofSnapshot(
  options: { lookbackDays?: number } = {},
): Promise<PilotProofSummary> {
  const lookbackDays = options.lookbackDays;
  return getPilotProofSummary({
    lookbackHours: typeof lookbackDays === 'number' && Number.isFinite(lookbackDays) && lookbackDays > 0
      ? Math.round(lookbackDays * 24)
      : undefined,
  });
}
