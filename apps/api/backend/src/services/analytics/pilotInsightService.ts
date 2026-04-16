import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

const PILOT_EVENT_AUDIT_TYPE = 'PILOT_OPS_EVENT';
const DEFAULT_LOOKBACK_DAYS = 30;

export const PILOT_INSIGHT_FLOW_STEPS = [
  'npi_submitted',
  'readiness_viewed',
  'passport_viewed',
  'review_opened',
  'cta_clicked',
  'action_completed',
  'flow_exited',
] as const;

export type PilotInsightFlowStep = (typeof PILOT_INSIGHT_FLOW_STEPS)[number];
export type PilotInsightSeverity = 'low' | 'medium' | 'high';

interface AuditEventRow {
  id: string;
  createdAt: Date;
  metadata: Prisma.JsonValue | null;
}

interface NormalizedPilotEvent {
  id: string;
  sessionId: string;
  sessionResolution: string;
  step: PilotInsightFlowStep;
  eventType: string;
  route: string | null;
  createdAt: Date;
}

export interface PilotInsightSessionStep {
  step: PilotInsightFlowStep;
  firstSeenAt: string;
  route: string | null;
  eventTypes: string[];
  count: number;
}

export interface PilotInsightSession {
  sessionId: string;
  sessionResolution: string;
  steps: PilotInsightSessionStep[];
}

export interface PilotInsightStepMetrics {
  step: PilotInsightFlowStep;
  sessionCount: number;
  conversionRate: number;
  dropoffRate: number;
  avgTimePerStepMs: number | null;
}

export interface PilotFlowInsight {
  issue: string;
  location: string;
  severity: PilotInsightSeverity;
  affectedSessions: number;
  sessionRate: number;
}

export interface PilotInsightSnapshot {
  generatedAt: string;
  windowDays: number;
  since: string;
  totalSessions: number;
  conversionRate: number;
  dropoffRate: number;
  steps: PilotInsightStepMetrics[];
  sessions: PilotInsightSession[];
  insights: PilotFlowInsight[];
}

function readRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 1000) / 10;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizePilotEventType(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

function normalizeFlowStep(eventType: string | null): PilotInsightFlowStep | null {
  switch (normalizePilotEventType(eventType)) {
    case 'npi_submit_attempt':
    case 'npi_submitted':
      return 'npi_submitted';
    case 'readiness_viewed':
    case 'readiness_revealed':
      return 'readiness_viewed';
    case 'passport_viewed':
    case 'wallet_viewed':
      return 'passport_viewed';
    case 'review_opened':
      return 'review_opened';
    case 'share_cta_clicked':
    case 'employer_action_clicked':
    case 'review_requested':
    case 'apply_started':
      return 'cta_clicked';
    case 'employer_action_taken':
    case 'apply_submitted':
      return 'action_completed';
    case 'dead_end_reached':
    case 'route_failure':
    case 'auth_failure':
      return 'flow_exited';
    default:
      return null;
  }
}

function resolveSessionId(metadata: Record<string, Prisma.JsonValue>): {
  sessionId: string;
  sessionResolution: string;
} | null {
  const details = readRecord(metadata.details);
  const entity = readRecord(metadata.entity);
  const seeds: Array<{ source: string; value: string | null }> = [
    { source: 'session_id', value: readString(details.sessionId) },
    { source: 'flow_session_id', value: readString(details.flowSessionId) },
    { source: 'funnel_subject_hash', value: readString(details.funnelSubjectHash) },
    { source: 'user_id', value: readString(metadata.userId) },
    { source: 'email', value: readString(metadata.email) },
    { source: 'entity_id', value: readString(entity.id) },
  ];

  for (const seed of seeds) {
    if (!seed.value) {
      continue;
    }

    return {
      sessionId: `${seed.source}:${sha256Hex(seed.value).slice(0, 16)}`,
      sessionResolution: seed.source,
    };
  }

  return null;
}

function normalizePilotEvent(row: AuditEventRow): NormalizedPilotEvent | null {
  const metadata = readRecord(row.metadata);
  const eventType = readString(metadata.eventType);
  const step = normalizeFlowStep(eventType);
  if (!step) {
    return null;
  }

  const session = resolveSessionId(metadata);
  if (!session) {
    return null;
  }

  return {
    id: row.id,
    sessionId: session.sessionId,
    sessionResolution: session.sessionResolution,
    step,
    eventType: eventType ?? 'unknown',
    route: readString(metadata.route),
    createdAt: row.createdAt,
  };
}

function hasLaterProgressionStep(
  stepsByName: Map<PilotInsightFlowStep, PilotInsightSessionStep>,
  step: PilotInsightFlowStep,
): boolean {
  const currentIndex = PILOT_INSIGHT_FLOW_STEPS.indexOf(step);
  if (currentIndex < 0) {
    return false;
  }

  for (const candidate of PILOT_INSIGHT_FLOW_STEPS.slice(currentIndex + 1)) {
    if (candidate === 'flow_exited') {
      continue;
    }

    if (stepsByName.has(candidate)) {
      return true;
    }
  }

  return false;
}

function mostCommonRoute(
  sessions: readonly PilotInsightSession[],
  step: PilotInsightFlowStep,
): string {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const sessionStep = session.steps.find((candidate) => candidate.step === step);
    const route = sessionStep?.route?.trim();
    if (!route) {
      continue;
    }
    counts.set(route, (counts.get(route) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });

  return sorted[0]?.[0] ?? step;
}

function classifySeverity(rate: number): PilotInsightSeverity {
  if (rate >= 50) {
    return 'high';
  }
  if (rate >= 20) {
    return 'medium';
  }
  return 'low';
}

function buildInsights(sessions: readonly PilotInsightSession[]): PilotFlowInsight[] {
  const sessionsWithPassport = sessions.filter((session) =>
    session.steps.some((step) => step.step === 'passport_viewed'));
  const passportExitSessions = sessionsWithPassport.filter((session) => {
    const stepsByName = new Map(session.steps.map((step) => [step.step, step]));
    return !hasLaterProgressionStep(stepsByName, 'passport_viewed');
  });

  const sessionsWithCta = sessions.filter((session) =>
    session.steps.some((step) => step.step === 'cta_clicked'));
  const ctaAmbiguitySessions = sessionsWithCta.filter((session) => {
    const ctaStep = session.steps.find((step) => step.step === 'cta_clicked');
    if (!ctaStep) {
      return false;
    }

    return new Set(ctaStep.eventTypes).size > 1 || ctaStep.count > 1;
  });

  const insights: PilotFlowInsight[] = [];

  if (passportExitSessions.length > 0) {
    const rate = percent(passportExitSessions.length, sessionsWithPassport.length);
    insights.push({
      issue: 'decision unclear',
      location: mostCommonRoute(passportExitSessions, 'passport_viewed'),
      severity: classifySeverity(rate),
      affectedSessions: passportExitSessions.length,
      sessionRate: rate,
    });
  }

  if (ctaAmbiguitySessions.length > 0) {
    const rate = percent(ctaAmbiguitySessions.length, sessionsWithCta.length);
    insights.push({
      issue: 'action ambiguity',
      location: mostCommonRoute(ctaAmbiguitySessions, 'cta_clicked'),
      severity: classifySeverity(rate),
      affectedSessions: ctaAmbiguitySessions.length,
      sessionRate: rate,
    });
  }

  return insights.sort((left, right) => {
    const severityRank = { high: 3, medium: 2, low: 1 };
    if (severityRank[right.severity] !== severityRank[left.severity]) {
      return severityRank[right.severity] - severityRank[left.severity];
    }
    if (right.sessionRate !== left.sessionRate) {
      return right.sessionRate - left.sessionRate;
    }
    return left.issue.localeCompare(right.issue);
  });
}

function buildSessions(events: readonly NormalizedPilotEvent[]): PilotInsightSession[] {
  const sessions = new Map<string, {
    sessionResolution: string;
    stepEntries: Map<PilotInsightFlowStep, {
      firstSeenAt: Date;
      route: string | null;
      eventTypes: string[];
      count: number;
    }>;
  }>();

  for (const event of [...events].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())) {
    const current = sessions.get(event.sessionId) ?? {
      sessionResolution: event.sessionResolution,
      stepEntries: new Map(),
    };
    const existing = current.stepEntries.get(event.step);
    if (!existing) {
      current.stepEntries.set(event.step, {
        firstSeenAt: event.createdAt,
        route: event.route,
        eventTypes: [event.eventType],
        count: 1,
      });
    } else {
      existing.count += 1;
      if (!existing.eventTypes.includes(event.eventType)) {
        existing.eventTypes.push(event.eventType);
      }
      if (!existing.route && event.route) {
        existing.route = event.route;
      }
    }
    sessions.set(event.sessionId, current);
  }

  return [...sessions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([sessionId, value]) => ({
      sessionId,
      sessionResolution: value.sessionResolution,
      steps: PILOT_INSIGHT_FLOW_STEPS
        .filter((step) => value.stepEntries.has(step))
        .map((step) => {
          const entry = value.stepEntries.get(step)!;
          return {
            step,
            firstSeenAt: entry.firstSeenAt.toISOString(),
            route: entry.route,
            eventTypes: [...entry.eventTypes].sort((left, right) => left.localeCompare(right)),
            count: entry.count,
          };
        }),
    }));
}

function buildStepMetrics(sessions: readonly PilotInsightSession[]): PilotInsightStepMetrics[] {
  return PILOT_INSIGHT_FLOW_STEPS.map((step, index) => {
    const sessionsWithStep = sessions.filter((session) =>
      session.steps.some((sessionStep) => sessionStep.step === step));

    const progressionDropoffs = index >= PILOT_INSIGHT_FLOW_STEPS.length - 2
      ? 0
      : sessionsWithStep.filter((session) => {
          const stepsByName = new Map(session.steps.map((sessionStep) => [sessionStep.step, sessionStep]));
          return !hasLaterProgressionStep(stepsByName, step);
        }).length;

    const previousStep = index > 0 ? PILOT_INSIGHT_FLOW_STEPS[index - 1] : null;
    const durations = previousStep
      ? sessions.flatMap((session) => {
          const previous = session.steps.find((sessionStep) => sessionStep.step === previousStep);
          const current = session.steps.find((sessionStep) => sessionStep.step === step);
          if (!previous || !current) {
            return [];
          }

          const previousTime = Date.parse(previous.firstSeenAt);
          const currentTime = Date.parse(current.firstSeenAt);
          if (!Number.isFinite(previousTime) || !Number.isFinite(currentTime) || currentTime < previousTime) {
            return [];
          }

          return [currentTime - previousTime];
        })
      : [];

    return {
      step,
      sessionCount: sessionsWithStep.length,
      conversionRate: percent(sessionsWithStep.length, sessions.length),
      dropoffRate: index >= PILOT_INSIGHT_FLOW_STEPS.length - 2
        ? 0
        : percent(progressionDropoffs, sessionsWithStep.length),
      avgTimePerStepMs: average(durations),
    };
  });
}

export async function getPilotInsightSnapshot(
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
): Promise<PilotInsightSnapshot> {
  const windowDays = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? Math.round(lookbackDays)
    : DEFAULT_LOOKBACK_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const rows = await prisma.auditEvent.findMany({
      where: {
        type: PILOT_EVENT_AUDIT_TYPE,
        createdAt: { gte: since },
      },
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
    });

    const normalizedEvents = rows
      .map(normalizePilotEvent)
      .filter((event): event is NormalizedPilotEvent => event !== null);
    const sessions = buildSessions(normalizedEvents);
    const steps = buildStepMetrics(sessions);
    const totalSessions = sessions.length;
    const completedSessions = steps.find((step) => step.step === 'action_completed')?.sessionCount ?? 0;
    const exitedSessions = steps.find((step) => step.step === 'flow_exited')?.sessionCount ?? 0;

    const snapshot: PilotInsightSnapshot = {
      generatedAt: new Date().toISOString(),
      windowDays,
      since: since.toISOString(),
      totalSessions,
      conversionRate: percent(completedSessions, totalSessions),
      dropoffRate: percent(exitedSessions, totalSessions),
      steps,
      sessions,
      insights: buildInsights(sessions),
    };

    log('info', 'pilot_insight_snapshot_generated', {
      totalSessions: snapshot.totalSessions,
      conversionRate: snapshot.conversionRate,
      dropoffRate: snapshot.dropoffRate,
      insights: snapshot.insights.length,
    });

    return snapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to generate pilot insight snapshot.';
    log('error', 'pilot_insight_snapshot_error', { error: message });
    return {
      generatedAt: new Date().toISOString(),
      windowDays,
      since: since.toISOString(),
      totalSessions: 0,
      conversionRate: 0,
      dropoffRate: 0,
      steps: PILOT_INSIGHT_FLOW_STEPS.map((step) => ({
        step,
        sessionCount: 0,
        conversionRate: 0,
        dropoffRate: 0,
        avgTimePerStepMs: null,
      })),
      sessions: [],
      insights: [],
    };
  }
}
