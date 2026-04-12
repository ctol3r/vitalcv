import { sha256ForPayload, stableStringify } from '../../utils/deterministic';

export const SUPPORT_LEARNING_FUNNEL_STEPS = [
  'MATCH_CREATED',
  'MATCH_VIEWED',
  'APPLICATION_SUBMITTED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED',
  'OFFER_EXTENDED',
  'OFFER_ACCEPTED',
  'HIRED',
] as const;

export type SupportLearningFunnelStep = (typeof SUPPORT_LEARNING_FUNNEL_STEPS)[number];

const MATCH_PROGRESS_SCORES: Readonly<Record<SupportLearningFunnelStep, number>> = {
  MATCH_CREATED: 10,
  MATCH_VIEWED: 20,
  APPLICATION_SUBMITTED: 40,
  INTERVIEW_SCHEDULED: 55,
  INTERVIEW_COMPLETED: 70,
  OFFER_EXTENDED: 80,
  OFFER_ACCEPTED: 90,
  HIRED: 100,
};

export interface Event {
  id: string;
  type: string;
  timestamp: string;
  providerId: string;
  jobId: string;
  employerId: string;
  metadata: Record<string, unknown>;
}

export interface TrackEventInput {
  type: string;
  timestamp: string | Date;
  providerId: string;
  jobId: string;
  employerId: string;
  metadata?: Record<string, unknown>;
}

export interface EventStore {
  append(event: Event): void;
  getById(id: string): Event | null;
  list(): Event[];
}

export interface FunnelStepSnapshot {
  step: string;
  eventCount: number;
  matchCount: number;
  providerCount: number;
  conversionFromPrevious: number | null;
}

export interface FunnelSnapshot {
  totalMatches: number;
  terminalStep: string | null;
  completedMatches: number;
  steps: FunnelStepSnapshot[];
}

export interface MatchScoreBreakdown {
  key: 'progression' | 'feedback' | 'support';
  value: number;
  detail: string;
}

export interface MatchScoreResult {
  providerId: string;
  jobId: string;
  employerId: string;
  score: number;
  band: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_SIGNAL';
  progressionScore: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  supportRequestedCount: number;
  supportResolvedCount: number;
  lastEventAt: string | null;
  breakdown: MatchScoreBreakdown[];
}

export interface PerformanceInsight {
  code:
    | 'STRONG_MATCH_QUALITY'
    | 'HIGH_COMPLETION_RATE'
    | 'INTERVIEW_DROP_OFF'
    | 'NEGATIVE_FEEDBACK_PATTERN'
    | 'SUPPORT_FRICTION';
  severity: 'info' | 'warning';
  message: string;
  evidence: Record<string, number>;
}

export interface UserPerformance {
  providerId: string;
  eventCount: number;
  matchCount: number;
  averageMatchScore: number;
  totals: {
    matchViewed: number;
    applicationsSubmitted: number;
    interviewsScheduled: number;
    interviewsCompleted: number;
    offersAccepted: number;
    hires: number;
    feedbackSubmitted: number;
    positiveFeedback: number;
    negativeFeedback: number;
    supportRequested: number;
    supportResolved: number;
  };
  rates: {
    applicationRate: number;
    interviewCompletionRate: number;
    hireRate: number;
    supportResolutionRate: number | null;
    positiveFeedbackRate: number | null;
  };
  insights: PerformanceInsight[];
}

function normalizeRequiredString(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function normalizeTimestamp(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('timestamp must be a valid ISO-8601 string or Date');
  }
  return parsed.toISOString();
}

function normalizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  return JSON.parse(stableStringify(metadata as object)) as Record<string, unknown>;
}

function buildEventId(input: Omit<Event, 'id'>): string {
  return `evt_${sha256ForPayload(input).slice(0, 24)}`;
}

function matchKey(event: Pick<Event, 'providerId' | 'jobId' | 'employerId'>): string {
  return `${event.providerId}::${event.jobId}::${event.employerId}`;
}

function dedupeEvents(events: readonly Event[]): Event[] {
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function filterEvents(
  events: readonly Event[],
  filter?: Partial<Pick<Event, 'providerId' | 'jobId' | 'employerId'>>,
): Event[] {
  const deduped = dedupeEvents(events);

  return deduped.filter((event) => {
    if (filter?.providerId && event.providerId !== filter.providerId) return false;
    if (filter?.jobId && event.jobId !== filter.jobId) return false;
    if (filter?.employerId && event.employerId !== filter.employerId) return false;
    return true;
  });
}

function countDistinctMatches(events: readonly Event[]): number {
  return new Set(events.map((event) => matchKey(event))).size;
}

function countDistinctProviders(events: readonly Event[]): number {
  return new Set(events.map((event) => event.providerId)).size;
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return roundToTwo(numerator / denominator);
}

function readRatingSignal(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value >= 4) return 1;
  if (value <= 2) return -1;
  return 0;
}

function feedbackSignal(event: Event): number {
  if (event.type !== 'FEEDBACK_SUBMITTED') {
    return 0;
  }

  const sentiment = typeof event.metadata.sentiment === 'string'
    ? event.metadata.sentiment.trim().toLowerCase()
    : null;

  if (sentiment === 'positive') return 1;
  if (sentiment === 'negative') return -1;
  if (sentiment === 'neutral') return 0;

  return readRatingSignal(event.metadata.rating) ?? 0;
}

function progressionScore(events: readonly Event[]): number {
  let score = 0;

  for (const event of events) {
    if (event.type in MATCH_PROGRESS_SCORES) {
      const nextScore = MATCH_PROGRESS_SCORES[event.type as SupportLearningFunnelStep];
      if (nextScore > score) {
        score = nextScore;
      }
    }
  }

  return score;
}

function scoreBand(score: number): MatchScoreResult['band'] {
  if (score >= 80) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  if (score > 0) return 'LOW';
  return 'NO_SIGNAL';
}

function countStepMatches(events: readonly Event[], step: string): number {
  return countDistinctMatches(events.filter((event) => event.type === step));
}

export function createInMemoryEventStore(initialEvents: readonly Event[] = []): EventStore {
  const eventsById = new Map<string, Event>();

  for (const event of dedupeEvents(initialEvents)) {
    eventsById.set(event.id, event);
  }

  return {
    append(event) {
      eventsById.set(event.id, event);
    },
    getById(id) {
      return eventsById.get(id) ?? null;
    },
    list() {
      return dedupeEvents([...eventsById.values()]);
    },
  };
}

export function trackEvent(input: TrackEventInput, store?: EventStore): Event {
  const normalized: Omit<Event, 'id'> = {
    type: normalizeRequiredString(input.type, 'type'),
    timestamp: normalizeTimestamp(input.timestamp),
    providerId: normalizeRequiredString(input.providerId, 'providerId'),
    jobId: normalizeRequiredString(input.jobId, 'jobId'),
    employerId: normalizeRequiredString(input.employerId, 'employerId'),
    metadata: normalizeMetadata(input.metadata),
  };

  const event: Event = {
    ...normalized,
    id: buildEventId(normalized),
  };

  if (!store) {
    return event;
  }

  const existing = store.getById(event.id);
  if (existing) {
    return existing;
  }

  store.append(event);
  return event;
}

export function computeFunnel(
  events: readonly Event[],
  options?: {
    steps?: readonly string[];
    providerId?: string;
    jobId?: string;
    employerId?: string;
  },
): FunnelSnapshot {
  const filtered = filterEvents(events, options);
  const steps = options?.steps?.length ? [...options.steps] : [...SUPPORT_LEARNING_FUNNEL_STEPS];
  const totalMatches = countDistinctMatches(filtered);

  let previousMatchCount: number | null = null;
  const snapshots = steps.map((step) => {
    const stepEvents = filtered.filter((event) => event.type === step);
    const matchCount = countDistinctMatches(stepEvents);
    const conversionFromPrevious = previousMatchCount === null
      ? null
      : safeRate(matchCount, previousMatchCount);

    previousMatchCount = matchCount;

    return {
      step,
      eventCount: stepEvents.length,
      matchCount,
      providerCount: countDistinctProviders(stepEvents),
      conversionFromPrevious,
    };
  });

  const terminalStep = [...snapshots].reverse().find((step) => step.matchCount > 0)?.step ?? null;
  const completedMatches = snapshots[snapshots.length - 1]?.matchCount ?? 0;

  return {
    totalMatches,
    terminalStep,
    completedMatches,
    steps: snapshots,
  };
}

export function computeMatchScore(
  events: readonly Event[],
  input: Pick<Event, 'providerId' | 'jobId' | 'employerId'>,
): MatchScoreResult {
  const filtered = filterEvents(events, input);
  const progress = progressionScore(filtered);
  const feedbackSignals = filtered.map(feedbackSignal);
  const positiveFeedbackCount = feedbackSignals.filter((signal) => signal > 0).length;
  const negativeFeedbackCount = feedbackSignals.filter((signal) => signal < 0).length;
  const supportRequestedCount = filtered.filter((event) => event.type === 'SUPPORT_REQUESTED').length;
  const supportResolvedCount = filtered.filter((event) => event.type === 'SUPPORT_RESOLVED').length;
  const openSupportCount = Math.max(0, supportRequestedCount - supportResolvedCount);

  const feedbackAdjustment = Math.max(
    -14,
    Math.min(14, (positiveFeedbackCount - negativeFeedbackCount) * 7),
  );
  const supportAdjustment = supportRequestedCount === 0
    ? 0
    : openSupportCount === 0
      ? Math.min(6, supportResolvedCount * 3)
      : -Math.min(18, openSupportCount * 9);

  const score = Math.max(0, Math.min(100, progress + feedbackAdjustment + supportAdjustment));

  return {
    providerId: input.providerId,
    jobId: input.jobId,
    employerId: input.employerId,
    score,
    band: scoreBand(score),
    progressionScore: progress,
    positiveFeedbackCount,
    negativeFeedbackCount,
    supportRequestedCount,
    supportResolvedCount,
    lastEventAt: filtered[filtered.length - 1]?.timestamp ?? null,
    breakdown: [
      {
        key: 'progression',
        value: progress,
        detail: `Highest completed funnel milestone contributed ${progress} points.`,
      },
      {
        key: 'feedback',
        value: feedbackAdjustment,
        detail: `${positiveFeedbackCount} positive and ${negativeFeedbackCount} negative feedback events adjusted the score by ${feedbackAdjustment}.`,
      },
      {
        key: 'support',
        value: supportAdjustment,
        detail: `${supportRequestedCount} support requests and ${supportResolvedCount} support resolutions adjusted the score by ${supportAdjustment}.`,
      },
    ],
  };
}

export function generatePerformanceInsights(input: {
  averageMatchScore: number;
  applicationsSubmitted: number;
  interviewsScheduled: number;
  interviewsCompleted: number;
  hires: number;
  feedbackSubmitted: number;
  positiveFeedback: number;
  negativeFeedback: number;
  supportRequested: number;
  supportResolved: number;
}): PerformanceInsight[] {
  const insights: PerformanceInsight[] = [];
  const supportResolutionRate = input.supportRequested > 0
    ? input.supportResolved / input.supportRequested
    : null;
  const interviewCompletionRate = input.interviewsScheduled > 0
    ? input.interviewsCompleted / input.interviewsScheduled
    : 0;
  const hireRate = input.applicationsSubmitted > 0
    ? input.hires / input.applicationsSubmitted
    : 0;

  if (input.averageMatchScore >= 80 && input.hires > 0) {
    insights.push({
      code: 'STRONG_MATCH_QUALITY',
      severity: 'info',
      message: 'Provider consistently reaches high-confidence match outcomes.',
      evidence: {
        averageMatchScore: input.averageMatchScore,
        hires: input.hires,
      },
    });
  }

  if (hireRate >= 0.5 && input.applicationsSubmitted > 0) {
    insights.push({
      code: 'HIGH_COMPLETION_RATE',
      severity: 'info',
      message: 'Provider converts submitted applications into starts at a high rate.',
      evidence: {
        applicationsSubmitted: input.applicationsSubmitted,
        hires: input.hires,
        hireRate: roundToTwo(hireRate),
      },
    });
  }

  if (input.interviewsScheduled > 0 && interviewCompletionRate < 0.5) {
    insights.push({
      code: 'INTERVIEW_DROP_OFF',
      severity: 'warning',
      message: 'Interview scheduling is not converting into completed interviews.',
      evidence: {
        interviewsScheduled: input.interviewsScheduled,
        interviewsCompleted: input.interviewsCompleted,
        interviewCompletionRate: roundToTwo(interviewCompletionRate),
      },
    });
  }

  if (input.feedbackSubmitted > 0 && input.negativeFeedback > input.positiveFeedback) {
    insights.push({
      code: 'NEGATIVE_FEEDBACK_PATTERN',
      severity: 'warning',
      message: 'Negative feedback exceeds positive feedback for this provider.',
      evidence: {
        feedbackSubmitted: input.feedbackSubmitted,
        positiveFeedback: input.positiveFeedback,
        negativeFeedback: input.negativeFeedback,
      },
    });
  }

  if (supportResolutionRate !== null && supportResolutionRate < 0.75) {
    insights.push({
      code: 'SUPPORT_FRICTION',
      severity: 'warning',
      message: 'Support requests are accumulating faster than they are being resolved.',
      evidence: {
        supportRequested: input.supportRequested,
        supportResolved: input.supportResolved,
        supportResolutionRate: roundToTwo(supportResolutionRate),
      },
    });
  }

  return insights;
}

export function computeUserPerformance(
  events: readonly Event[],
  providerId: string,
): UserPerformance {
  const normalizedProviderId = normalizeRequiredString(providerId, 'providerId');
  const filtered = filterEvents(events, { providerId: normalizedProviderId });
  const grouped = new Map<string, Event[]>();

  for (const event of filtered) {
    const key = matchKey(event);
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  const scores = [...grouped.values()].map((group) => computeMatchScore(group, group[0]!));
  const totals = {
    matchViewed: countStepMatches(filtered, 'MATCH_VIEWED'),
    applicationsSubmitted: countStepMatches(filtered, 'APPLICATION_SUBMITTED'),
    interviewsScheduled: countStepMatches(filtered, 'INTERVIEW_SCHEDULED'),
    interviewsCompleted: countStepMatches(filtered, 'INTERVIEW_COMPLETED'),
    offersAccepted: countStepMatches(filtered, 'OFFER_ACCEPTED'),
    hires: countStepMatches(filtered, 'HIRED'),
    feedbackSubmitted: filtered.filter((event) => event.type === 'FEEDBACK_SUBMITTED').length,
    positiveFeedback: filtered.filter((event) => feedbackSignal(event) > 0).length,
    negativeFeedback: filtered.filter((event) => feedbackSignal(event) < 0).length,
    supportRequested: filtered.filter((event) => event.type === 'SUPPORT_REQUESTED').length,
    supportResolved: filtered.filter((event) => event.type === 'SUPPORT_RESOLVED').length,
  };
  const averageMatchScore = scores.length > 0
    ? roundToTwo(scores.reduce((sum, score) => sum + score.score, 0) / scores.length)
    : 0;
  const rates = {
    applicationRate: safeRate(totals.applicationsSubmitted, Math.max(grouped.size, 1)),
    interviewCompletionRate: safeRate(totals.interviewsCompleted, Math.max(totals.interviewsScheduled, 1)),
    hireRate: safeRate(totals.hires, Math.max(totals.applicationsSubmitted, 1)),
    supportResolutionRate: totals.supportRequested > 0
      ? safeRate(totals.supportResolved, totals.supportRequested)
      : null,
    positiveFeedbackRate: totals.feedbackSubmitted > 0
      ? safeRate(totals.positiveFeedback, totals.feedbackSubmitted)
      : null,
  };

  return {
    providerId: normalizedProviderId,
    eventCount: filtered.length,
    matchCount: grouped.size,
    averageMatchScore,
    totals,
    rates,
    insights: generatePerformanceInsights({
      averageMatchScore,
      applicationsSubmitted: totals.applicationsSubmitted,
      interviewsScheduled: totals.interviewsScheduled,
      interviewsCompleted: totals.interviewsCompleted,
      hires: totals.hires,
      feedbackSubmitted: totals.feedbackSubmitted,
      positiveFeedback: totals.positiveFeedback,
      negativeFeedback: totals.negativeFeedback,
      supportRequested: totals.supportRequested,
      supportResolved: totals.supportResolved,
    }),
  };
}
