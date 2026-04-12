import {
  computeFunnel,
  computeMatchScore,
  computeUserPerformance,
  createInMemoryEventStore,
  trackEvent,
} from '../feedbackLearningService';

describe('feedbackLearningService', () => {
  it('captures events deterministically and deduplicates equivalent payloads', () => {
    const store = createInMemoryEventStore();

    const first = trackEvent({
      type: 'MATCH_VIEWED',
      timestamp: '2026-04-12T12:00:00.000Z',
      providerId: 'provider-1',
      jobId: 'job-1',
      employerId: 'employer-1',
      metadata: {
        channel: 'email',
        nested: {
          source: 'campaign-a',
          priority: 'high',
        },
      },
    }, store);

    const second = trackEvent({
      type: 'MATCH_VIEWED',
      timestamp: '2026-04-12T12:00:00.000Z',
      providerId: 'provider-1',
      jobId: 'job-1',
      employerId: 'employer-1',
      metadata: {
        nested: {
          priority: 'high',
          source: 'campaign-a',
        },
        channel: 'email',
      },
    }, store);

    expect(second.id).toBe(first.id);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toEqual(first);
  });

  it('computes funnel counts from provider-job-employer events', () => {
    const store = createInMemoryEventStore();

    [
      { type: 'MATCH_CREATED', providerId: 'provider-1', jobId: 'job-1', employerId: 'employer-1', timestamp: '2026-04-12T10:00:00.000Z' },
      { type: 'MATCH_VIEWED', providerId: 'provider-1', jobId: 'job-1', employerId: 'employer-1', timestamp: '2026-04-12T10:05:00.000Z' },
      { type: 'APPLICATION_SUBMITTED', providerId: 'provider-1', jobId: 'job-1', employerId: 'employer-1', timestamp: '2026-04-12T10:10:00.000Z' },
      { type: 'INTERVIEW_SCHEDULED', providerId: 'provider-1', jobId: 'job-1', employerId: 'employer-1', timestamp: '2026-04-12T10:20:00.000Z' },
      { type: 'MATCH_CREATED', providerId: 'provider-2', jobId: 'job-2', employerId: 'employer-1', timestamp: '2026-04-12T11:00:00.000Z' },
      { type: 'MATCH_VIEWED', providerId: 'provider-2', jobId: 'job-2', employerId: 'employer-1', timestamp: '2026-04-12T11:03:00.000Z' },
      { type: 'APPLICATION_SUBMITTED', providerId: 'provider-2', jobId: 'job-2', employerId: 'employer-1', timestamp: '2026-04-12T11:08:00.000Z' },
      { type: 'MATCH_CREATED', providerId: 'provider-3', jobId: 'job-3', employerId: 'employer-2', timestamp: '2026-04-12T12:00:00.000Z' },
    ].forEach((event) => trackEvent(event, store));

    const funnel = computeFunnel(store.list());

    expect(funnel.totalMatches).toBe(3);
    expect(funnel.terminalStep).toBe('INTERVIEW_SCHEDULED');
    expect(funnel.completedMatches).toBe(0);
    expect(funnel.steps.slice(0, 4)).toEqual([
      {
        step: 'MATCH_CREATED',
        eventCount: 3,
        matchCount: 3,
        providerCount: 3,
        conversionFromPrevious: null,
      },
      {
        step: 'MATCH_VIEWED',
        eventCount: 2,
        matchCount: 2,
        providerCount: 2,
        conversionFromPrevious: 0.67,
      },
      {
        step: 'APPLICATION_SUBMITTED',
        eventCount: 2,
        matchCount: 2,
        providerCount: 2,
        conversionFromPrevious: 1,
      },
      {
        step: 'INTERVIEW_SCHEDULED',
        eventCount: 1,
        matchCount: 1,
        providerCount: 1,
        conversionFromPrevious: 0.5,
      },
    ]);
  });

  it('scores a match from funnel progression, feedback, and support resolution', () => {
    const store = createInMemoryEventStore();

    [
      { type: 'MATCH_CREATED', timestamp: '2026-04-12T09:00:00.000Z' },
      { type: 'MATCH_VIEWED', timestamp: '2026-04-12T09:02:00.000Z' },
      { type: 'APPLICATION_SUBMITTED', timestamp: '2026-04-12T09:05:00.000Z' },
      { type: 'INTERVIEW_SCHEDULED', timestamp: '2026-04-12T09:10:00.000Z' },
      { type: 'INTERVIEW_COMPLETED', timestamp: '2026-04-12T09:30:00.000Z' },
      { type: 'SUPPORT_REQUESTED', timestamp: '2026-04-12T09:35:00.000Z' },
      { type: 'SUPPORT_RESOLVED', timestamp: '2026-04-12T09:45:00.000Z' },
      {
        type: 'FEEDBACK_SUBMITTED',
        timestamp: '2026-04-12T09:50:00.000Z',
        metadata: { sentiment: 'positive', rating: 5 },
      },
    ].forEach((event) => trackEvent({
      providerId: 'provider-1',
      jobId: 'job-1',
      employerId: 'employer-1',
      metadata: {},
      ...event,
    }, store));

    const score = computeMatchScore(store.list(), {
      providerId: 'provider-1',
      jobId: 'job-1',
      employerId: 'employer-1',
    });

    expect(score.score).toBe(80);
    expect(score.band).toBe('HIGH');
    expect(score.progressionScore).toBe(70);
    expect(score.positiveFeedbackCount).toBe(1);
    expect(score.negativeFeedbackCount).toBe(0);
    expect(score.supportRequestedCount).toBe(1);
    expect(score.supportResolvedCount).toBe(1);
    expect(score.breakdown).toEqual([
      {
        key: 'progression',
        value: 70,
        detail: 'Highest completed funnel milestone contributed 70 points.',
      },
      {
        key: 'feedback',
        value: 7,
        detail: '1 positive and 0 negative feedback events adjusted the score by 7.',
      },
      {
        key: 'support',
        value: 3,
        detail: '1 support requests and 1 support resolutions adjusted the score by 3.',
      },
    ]);
  });

  it('generates performance insights from low completion, negative feedback, and unresolved support', () => {
    const store = createInMemoryEventStore();

    [
      { providerId: 'provider-9', jobId: 'job-a', employerId: 'employer-1', type: 'MATCH_CREATED', timestamp: '2026-04-12T08:00:00.000Z' },
      { providerId: 'provider-9', jobId: 'job-a', employerId: 'employer-1', type: 'APPLICATION_SUBMITTED', timestamp: '2026-04-12T08:05:00.000Z' },
      { providerId: 'provider-9', jobId: 'job-a', employerId: 'employer-1', type: 'INTERVIEW_SCHEDULED', timestamp: '2026-04-12T08:10:00.000Z' },
      { providerId: 'provider-9', jobId: 'job-a', employerId: 'employer-1', type: 'SUPPORT_REQUESTED', timestamp: '2026-04-12T08:12:00.000Z' },
      {
        providerId: 'provider-9',
        jobId: 'job-a',
        employerId: 'employer-1',
        type: 'FEEDBACK_SUBMITTED',
        timestamp: '2026-04-12T08:15:00.000Z',
        metadata: { sentiment: 'negative', rating: 1 },
      },
      { providerId: 'provider-9', jobId: 'job-b', employerId: 'employer-2', type: 'MATCH_CREATED', timestamp: '2026-04-12T09:00:00.000Z' },
      { providerId: 'provider-9', jobId: 'job-b', employerId: 'employer-2', type: 'APPLICATION_SUBMITTED', timestamp: '2026-04-12T09:03:00.000Z' },
      { providerId: 'provider-9', jobId: 'job-b', employerId: 'employer-2', type: 'INTERVIEW_SCHEDULED', timestamp: '2026-04-12T09:08:00.000Z' },
      {
        providerId: 'provider-9',
        jobId: 'job-b',
        employerId: 'employer-2',
        type: 'FEEDBACK_SUBMITTED',
        timestamp: '2026-04-12T09:12:00.000Z',
        metadata: { sentiment: 'negative', rating: 2 },
      },
    ].forEach((event) => trackEvent({
      metadata: {},
      ...event,
    }, store));

    const performance = computeUserPerformance(store.list(), 'provider-9');

    expect(performance.matchCount).toBe(2);
    expect(performance.averageMatchScore).toBe(43.5);
    expect(performance.totals).toEqual({
      matchViewed: 0,
      applicationsSubmitted: 2,
      interviewsScheduled: 2,
      interviewsCompleted: 0,
      offersAccepted: 0,
      hires: 0,
      feedbackSubmitted: 2,
      positiveFeedback: 0,
      negativeFeedback: 2,
      supportRequested: 1,
      supportResolved: 0,
    });
    expect(performance.rates).toEqual({
      applicationRate: 1,
      interviewCompletionRate: 0,
      hireRate: 0,
      supportResolutionRate: 0,
      positiveFeedbackRate: 0,
    });
    expect(performance.insights.map((insight) => insight.code)).toEqual([
      'INTERVIEW_DROP_OFF',
      'NEGATIVE_FEEDBACK_PATTERN',
      'SUPPORT_FRICTION',
    ]);
  });
});
