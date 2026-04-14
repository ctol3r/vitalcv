import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

const PILOT_EVENT_AUDIT_TYPE = 'PILOT_OPS_EVENT' as const;
const REVIEW_OPEN_EVENT_TYPE = 'EMPLOYER_REVIEW' as const;
const REVIEW_OPEN_ADVISORY_VERSION = 'pilot-review-open' as const;
const DEFAULT_LOOKBACK_DAYS = 30;

export const PILOT_FUNNEL_STEPS = [
  'npi_submitted',
  'readiness_viewed',
  'passport_viewed',
  'review_opened',
  'employer_action_taken',
] as const;

export type PilotFunnelStep = (typeof PILOT_FUNNEL_STEPS)[number];

export interface PilotFunnelStepCount {
  step: PilotFunnelStep;
  source: 'pilot_ops_event' | 'advisory_outcome_event' | 'employer_decision_event';
  eventCount: number;
  peopleCount: number;
}

export interface PilotFunnelSnapshot {
  generatedAt: string;
  windowDays: number;
  since: string;
  steps: PilotFunnelStepCount[];
  answer: {
    question: 'How many people got through the funnel?';
    peopleThroughFunnel: number;
    completedStep: 'employer_action_taken';
  };
}

type AuditEventRow = Prisma.AuditEventGetPayload<{
  select: {
    id: true;
    metadata: true;
    createdAt: true;
  };
}>;

// TODO: removed - referenced non-existent Prisma model (AdvisoryOutcomeEvent)
type AdvisoryReviewRow = {
  id: string;
  entityId: string;
  eventTimestamp: Date;
  advisoryVersion: string | null;
  eventType: string;
  metadata: Prisma.JsonValue | null;
};

// TODO: removed - referenced non-existent Prisma model (EmployerDecisionEvent)
type EmployerDecisionRow = {
  id: string;
  entityId: string;
  decidedAt: Date;
};

function readRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isReviewOpenEvent(row: AdvisoryReviewRow): boolean {
  if (row.eventType !== REVIEW_OPEN_EVENT_TYPE) {
    return false;
  }

  if (row.advisoryVersion === REVIEW_OPEN_ADVISORY_VERSION) {
    return true;
  }

  const metadata = readRecord(row.metadata);
  const eventName = readString(metadata.eventName);
  if (eventName && eventName !== 'employer_review_opened') {
    return false;
  }

  return readString(metadata.reason) !== 'refresh_requested';
}

function subjectKeyFromPilotEvent(row: AuditEventRow): string | null {
  const metadata = readRecord(row.metadata);
  const details = readRecord(metadata.details);
  const entity = readRecord(metadata.entity);

  return (
    readString(details.funnelSubjectHash)
    ?? readString(entity.id)
    ?? readString(metadata.userId)
    ?? readString(metadata.email)
  );
}

function countSubjects<T>(
  rows: readonly T[],
  subjectKeyOf: (row: T) => string | null,
): number {
  const subjects = new Set<string>();

  for (const row of rows) {
    const subjectKey = subjectKeyOf(row);
    if (subjectKey) {
      subjects.add(subjectKey);
    }
  }

  return subjects.size;
}

function pilotEventStepCount(
  rows: readonly AuditEventRow[],
  step: Extract<PilotFunnelStep, 'npi_submitted' | 'readiness_viewed' | 'passport_viewed' | 'review_opened' | 'employer_action_taken'>,
): PilotFunnelStepCount {
  const matching = rows.filter((row) => {
    const metadata = readRecord(row.metadata);
    return readString(metadata.eventType) === step;
  });

  return {
    step,
    source: 'pilot_ops_event',
    eventCount: matching.length,
    peopleCount: countSubjects(matching, subjectKeyFromPilotEvent),
  };
}

function reviewStepCount(rows: readonly AdvisoryReviewRow[]): PilotFunnelStepCount {
  const matching = rows.filter(isReviewOpenEvent);

  return {
    step: 'review_opened',
    source: 'advisory_outcome_event',
    eventCount: matching.length,
    peopleCount: countSubjects(matching, (row) => row.entityId),
  };
}

function employerActionStepCount(rows: readonly EmployerDecisionRow[]): PilotFunnelStepCount {
  return {
    step: 'employer_action_taken',
    source: 'employer_decision_event',
    eventCount: rows.length,
    peopleCount: countSubjects(rows, (row) => row.entityId),
  };
}

export async function getPilotFunnelSnapshot(
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<PilotFunnelSnapshot> {
  const windowDays = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? Math.round(lookbackDays)
    : DEFAULT_LOOKBACK_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [pilotEventRows, advisoryReviewRows, employerDecisionRows] = await Promise.all([
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
    }),
    // TODO: removed - referenced non-existent Prisma model (advisoryOutcomeEvent)
    Promise.resolve([] as AdvisoryReviewRow[]),
    // TODO: removed - referenced non-existent Prisma model (employerDecisionEvent)
    Promise.resolve([] as EmployerDecisionRow[]),
  ]);

  const npiSubmitted = pilotEventStepCount(pilotEventRows, 'npi_submitted');
  const readinessViewed = pilotEventStepCount(pilotEventRows, 'readiness_viewed');
  const passportViewed = pilotEventStepCount(pilotEventRows, 'passport_viewed');
  const reviewOpenedFallback = pilotEventStepCount(pilotEventRows, 'review_opened');
  const employerActionFallback = pilotEventStepCount(pilotEventRows, 'employer_action_taken');
  const reviewOpened = (() => {
    const authoritative = reviewStepCount(advisoryReviewRows);
    return authoritative.eventCount > 0 ? authoritative : reviewOpenedFallback;
  })();
  const employerActionTaken = (() => {
    const authoritative = employerActionStepCount(employerDecisionRows);
    return authoritative.eventCount > 0 ? authoritative : employerActionFallback;
  })();

  const steps: PilotFunnelStepCount[] = [
    npiSubmitted,
    readinessViewed,
    passportViewed,
    reviewOpened,
    employerActionTaken,
  ];

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    since: since.toISOString(),
    steps,
    answer: {
      question: 'How many people got through the funnel?',
      peopleThroughFunnel: employerActionTaken.peopleCount,
      completedStep: 'employer_action_taken',
    },
  };
}

export function pilotFunnelSnapshotToLog(snapshot: PilotFunnelSnapshot): string {
  const lines = [
    `VitalCV funnel proof (${snapshot.windowDays}d window)`,
    `Generated: ${snapshot.generatedAt}`,
    `Since: ${snapshot.since}`,
    '',
    ...snapshot.steps.map((step) => (
      `${step.step}: ${step.peopleCount} people, ${step.eventCount} events [${step.source}]`
    )),
    '',
    `${snapshot.answer.question} ${snapshot.answer.peopleThroughFunnel}`,
  ];

  return lines.join('\n');
}
