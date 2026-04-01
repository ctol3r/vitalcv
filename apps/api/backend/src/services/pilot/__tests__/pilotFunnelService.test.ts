jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    auditEvent: {
      findMany: jest.fn(),
    },
    advisoryOutcomeEvent: {
      findMany: jest.fn(),
    },
    employerDecisionEvent: {
      findMany: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  getPilotFunnelSnapshot,
  pilotFunnelSnapshotToLog,
} from '../pilotFunnelService';

const prismaMock = prisma as unknown as {
  auditEvent: {
    findMany: jest.Mock;
  };
  advisoryOutcomeEvent: {
    findMany: jest.Mock;
  };
  employerDecisionEvent: {
    findMany: jest.Mock;
  };
};

describe('pilotFunnelService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T12:00:00.000Z'));
    prismaMock.auditEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.advisoryOutcomeEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.employerDecisionEvent.findMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns ordered funnel counts with authoritative review and decision steps', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        metadata: {
          eventType: 'npi_submitted',
          details: { funnelSubjectHash: 'subject-a' },
        },
      },
      {
        id: 'evt-2',
        createdAt: new Date('2026-03-31T10:02:00.000Z'),
        metadata: {
          eventType: 'readiness_viewed',
          details: { funnelSubjectHash: 'subject-a' },
        },
      },
      {
        id: 'evt-3',
        createdAt: new Date('2026-03-31T10:03:00.000Z'),
        metadata: {
          eventType: 'passport_viewed',
          details: { funnelSubjectHash: 'subject-a' },
        },
      },
      {
        id: 'evt-4',
        createdAt: new Date('2026-03-31T11:00:00.000Z'),
        metadata: {
          eventType: 'npi_submitted',
          details: { funnelSubjectHash: 'subject-b' },
        },
      },
      {
        id: 'evt-5',
        createdAt: new Date('2026-03-31T11:02:00.000Z'),
        metadata: {
          eventType: 'readiness_viewed',
          details: { funnelSubjectHash: 'subject-b' },
        },
      },
    ]);
    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-1',
        eventTimestamp: new Date('2026-03-31T12:00:00.000Z'),
        advisoryVersion: 'pilot-review-open',
        eventType: 'EMPLOYER_REVIEW',
        metadata: {},
      },
    ]);
    prismaMock.employerDecisionEvent.findMany.mockResolvedValue([
      {
        id: 'decision-1',
        entityId: 'entity-1',
        decidedAt: new Date('2026-03-31T13:00:00.000Z'),
      },
    ]);

    const snapshot = await getPilotFunnelSnapshot(30);

    expect(snapshot.steps).toEqual([
      {
        step: 'npi_submitted',
        source: 'pilot_ops_event',
        eventCount: 2,
        peopleCount: 2,
      },
      {
        step: 'readiness_viewed',
        source: 'pilot_ops_event',
        eventCount: 2,
        peopleCount: 2,
      },
      {
        step: 'passport_viewed',
        source: 'pilot_ops_event',
        eventCount: 1,
        peopleCount: 1,
      },
      {
        step: 'review_opened',
        source: 'advisory_outcome_event',
        eventCount: 1,
        peopleCount: 1,
      },
      {
        step: 'employer_action_taken',
        source: 'employer_decision_event',
        eventCount: 1,
        peopleCount: 1,
      },
    ]);
    expect(snapshot.answer).toEqual({
      question: 'How many people got through the funnel?',
      peopleThroughFunnel: 1,
      completedStep: 'employer_action_taken',
    });
  });

  it('falls back to pilot ops review and action events when authoritative rows are absent', async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        createdAt: new Date('2026-03-31T10:00:00.000Z'),
        metadata: {
          eventType: 'review_opened',
          details: { funnelSubjectHash: 'subject-a' },
        },
      },
      {
        id: 'evt-2',
        createdAt: new Date('2026-03-31T11:00:00.000Z'),
        metadata: {
          eventType: 'employer_action_taken',
          details: { funnelSubjectHash: 'subject-a' },
        },
      },
    ]);

    const snapshot = await getPilotFunnelSnapshot(30);

    expect(snapshot.steps[3]).toEqual({
      step: 'review_opened',
      source: 'pilot_ops_event',
      eventCount: 1,
      peopleCount: 1,
    });
    expect(snapshot.steps[4]).toEqual({
      step: 'employer_action_taken',
      source: 'pilot_ops_event',
      eventCount: 1,
      peopleCount: 1,
    });
    expect(pilotFunnelSnapshotToLog(snapshot)).toContain('review_opened: 1 people, 1 events [pilot_ops_event]');
  });
});
