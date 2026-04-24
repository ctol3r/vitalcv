import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      findMany: jest.fn(),
    },
    investigatorFinding: {
      findMany: jest.fn(),
    },
    storyline: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../services/storylines/storylineService', () => ({
  syncPersistedStorylines: jest.fn(),
}));

jest.mock('../../services/intelligence/intelligenceAutoWarmService', () => ({
  runIntelligenceAutoWarm: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { publish, resetEventBusForTests } from '../../core/events/eventBus';
import {
  resetLiveFeedStateForTests,
} from '../../services/feed/liveFeedService';
import { runIntelligenceAutoWarm } from '../../services/intelligence/intelligenceAutoWarmService';
import { syncPersistedStorylines } from '../../services/storylines/storylineService';
import { registerFeedRoutes } from '../feed';

const prismaMock = prisma as unknown as {
  provider: {
    findMany: jest.Mock;
  };
  investigatorFinding: {
    findMany: jest.Mock;
  };
  storyline: {
    findMany: jest.Mock;
  };
};

const syncPersistedStorylinesMock =
  syncPersistedStorylines as jest.MockedFunction<typeof syncPersistedStorylines>;
const runIntelligenceAutoWarmMock =
  runIntelligenceAutoWarm as jest.MockedFunction<typeof runIntelligenceAutoWarm>;

function buildApp() {
  const app = express();
  registerFeedRoutes(app);
  return app;
}

describe('feed routes', () => {
  beforeEach(() => {
    resetEventBusForTests();
    resetLiveFeedStateForTests();
    prismaMock.provider.findMany.mockReset();
    prismaMock.investigatorFinding.findMany.mockReset();
    prismaMock.storyline.findMany.mockReset();
    syncPersistedStorylinesMock.mockReset();
    runIntelligenceAutoWarmMock.mockReset();

    prismaMock.provider.findMany.mockResolvedValue([]);
    prismaMock.investigatorFinding.findMany.mockResolvedValue([]);
    prismaMock.storyline.findMany.mockResolvedValue([]);
    syncPersistedStorylinesMock.mockResolvedValue('2026-03-17T09:00:00.000Z');
    runIntelligenceAutoWarmMock.mockResolvedValue({
      trigger: 'feed_live_empty',
      triggered: false,
      reason: 'cooldown',
      seeded: false,
      providersBefore: 0,
      findingsBefore: 0,
      storylinesBefore: 0,
      providersAfter: 0,
      findingsAfter: 0,
      storylinesAfter: 0,
      findingsGenerated: 0,
      targetProviders: 0,
    });
  });

  it('returns live provider, finding, and storyline events in descending timestamp order', async () => {
    const app = buildApp();

    await publish({
      type: 'PROVIDER_UPDATED',
      timestamp: '2026-03-17T09:59:00.000Z',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    });
    await publish({
      type: 'FINDING_CREATED',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        runId: 'run-1',
        findingId: 'finding-1',
        investigatorId: 'trust_decline',
        severity: 'high',
        status: 'new',
        entityIds: ['1234567890'],
        storylineKey: 'storyline-1',
        operation: 'created',
      },
    });
    await publish({
      type: 'INVESTIGATOR_RUN_COMPLETE',
      timestamp: '2026-03-17T10:01:00.000Z',
      payload: {
        runId: 'run-1',
        investigatorId: 'trust_decline',
        trigger: 'manual',
        status: 'succeeded',
        entityType: 'provider',
        targetEntityIds: ['1234567890'],
        startedAt: '2026-03-17T10:00:00.000Z',
        completedAt: '2026-03-17T10:01:00.000Z',
        durationMs: 60_000,
        entitiesScanned: 1,
        findingsGenerated: 1,
        findingsCreated: 1,
        findingsUpdated: 0,
        findingsResolved: 0,
        findingsSuppressed: 0,
        storylinesMerged: 0,
        errorMessage: null,
      },
    });
    await publish({
      type: 'STORYLINE_UPDATED',
      timestamp: '2026-03-17T10:02:00.000Z',
      payload: {
        storylineId: 'storyline-1',
        storylineType: 'trust decline',
        status: 'active',
        severity: 'high',
        entityIds: ['provider:1234567890'],
        findingIds: ['finding-1'],
        operation: 'updated',
      },
    });

    const response = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.cached).toBe(false);
    expect(response.body.events.map((event: { type: string }) => event.type)).toEqual([
      'STORYLINE_UPDATED',
      'FINDING_CREATED',
      'PROVIDER_UPDATED',
    ]);
    expect(response.body.events.every((event: { source: string }) => event.source === 'event_bus')).toBe(true);
  });

  it('backfills from persisted providers, findings, and storylines when the bus is empty', async () => {
    const app = buildApp();
    prismaMock.provider.findMany.mockResolvedValue([
      {
        npi: '1902301456',
        fullName: 'Amelia Hart',
        createdAt: new Date('2026-03-17T09:00:00.000Z'),
        updatedAt: new Date('2026-03-17T10:05:00.000Z'),
      },
    ]);
    prismaMock.investigatorFinding.findMany.mockResolvedValue([
      {
        findingId: 'finding-2',
        investigatorId: 'freshness_gap',
        severity: 'medium',
        status: 'investigating',
        entityIds: ['1234567890'],
        storylineKey: 'storyline-2',
        metadata: { runId: 'run-2' },
        occurrenceCount: 3,
        createdAt: new Date('2026-03-17T08:00:00.000Z'),
        updatedAt: new Date('2026-03-17T10:03:00.000Z'),
      },
    ]);
    prismaMock.storyline.findMany.mockResolvedValue([
      {
        storylineId: 'storyline-3',
        storylineType: 'TRUST_DECLINE',
        status: 'ESCALATED',
        severity: 'HIGH',
        entityIds: ['provider:1234567890'],
        findingIds: ['finding-3'],
        lastActivityAt: new Date('2026-03-17T10:01:00.000Z'),
        updatedAt: new Date('2026-03-17T10:04:00.000Z'),
        statusEvents: [{ eventType: 'ESCALATED' }],
      },
    ]);

    const response = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(syncPersistedStorylinesMock).toHaveBeenCalledTimes(1);
    expect(response.body.total).toBe(3);
    expect(response.body.events[0]).toMatchObject({
      type: 'PROVIDER_UPDATED',
      source: 'db_backfill',
      payload: {
        npi: '1902301456',
        providerLabel: 'Amelia Hart',
        operation: 'updated',
      },
    });
    expect(response.body.events[1]).toMatchObject({
      type: 'STORYLINE_UPDATED',
      source: 'db_backfill',
      payload: {
        storylineId: 'storyline-3',
        operation: 'status_changed',
      },
    });
    expect(response.body.events[2]).toMatchObject({
      type: 'FINDING_CREATED',
      source: 'db_backfill',
      payload: {
        findingId: 'finding-2',
        runId: 'run-2',
        operation: 'updated',
      },
    });
  });

  it('excludes non-feed event types even when they are recent', async () => {
    const app = buildApp();

    await publish({
      type: 'INVESTIGATOR_RUN_COMPLETE',
      payload: {
        runId: 'run-1',
        investigatorId: 'trust_decline',
        trigger: 'manual',
        status: 'succeeded',
        entityType: 'provider',
        targetEntityIds: ['1234567890'],
        startedAt: '2026-03-17T10:00:00.000Z',
        completedAt: '2026-03-17T10:01:00.000Z',
        durationMs: 60_000,
        entitiesScanned: 1,
        findingsGenerated: 0,
        findingsCreated: 0,
        findingsUpdated: 0,
        findingsResolved: 0,
        findingsSuppressed: 0,
        storylinesMerged: 0,
        errorMessage: null,
      },
    });

    const response = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(response.body.total).toBe(0);
    expect(response.body.events).toEqual([]);
  });

  it('returns the last successful feed snapshot when a later build fails', async () => {
    const app = buildApp();

    await publish({
      type: 'FINDING_CREATED',
      timestamp: '2026-03-17T10:00:00.000Z',
      payload: {
        runId: 'run-1',
        findingId: 'finding-1',
        investigatorId: 'trust_decline',
        severity: 'critical',
        status: 'new',
        entityIds: ['1234567890'],
        storylineKey: 'storyline-1',
        operation: 'created',
      },
    });

    const warm = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(warm.body.total).toBe(1);
    expect(warm.body.cached).toBe(false);

    resetEventBusForTests();
    syncPersistedStorylinesMock.mockRejectedValueOnce(new Error('db offline'));

    const fallback = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(fallback.body.total).toBe(1);
    expect(fallback.body.cached).toBe(true);
    expect(fallback.body.degradedReason).toBe('backend_failure');
    expect(fallback.body.events[0].payload.findingId).toBe('finding-1');
  });

  it('rebuilds projections from persisted rows after an in-memory crash reset', async () => {
    const app = buildApp();

    await publish({
      type: 'PROVIDER_UPDATED',
      timestamp: '2026-03-17T09:59:00.000Z',
      payload: {
        providerId: 'provider-1',
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
        operation: 'updated',
      },
    });

    const warm = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(warm.body.total).toBe(1);
    expect(warm.body.events[0]).toMatchObject({
      type: 'PROVIDER_UPDATED',
      source: 'event_bus',
    });

    resetEventBusForTests();
    resetLiveFeedStateForTests();

    prismaMock.provider.findMany.mockResolvedValue([
      {
        npi: '1234567890',
        fullName: 'Ada Lovelace',
        createdAt: new Date('2026-03-17T09:00:00.000Z'),
        updatedAt: new Date('2026-03-17T09:59:00.000Z'),
      },
    ]);

    const rebuilt = await request(app)
      .get('/api/feed/live')
      .expect(200);

    expect(rebuilt.body.cached).toBe(false);
    expect(rebuilt.body.degradedReason).toBe(null);
    expect(rebuilt.body.events[0]).toMatchObject({
      type: 'PROVIDER_UPDATED',
      source: 'db_backfill',
      payload: {
        npi: '1234567890',
        providerLabel: 'Ada Lovelace',
      },
    });
  });
});
