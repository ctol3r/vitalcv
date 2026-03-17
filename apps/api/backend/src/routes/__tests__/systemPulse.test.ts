import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      count: jest.fn(),
    },
    investigatorFinding: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    storyline: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../services/storylines/storylineService', () => ({
  syncPersistedStorylines: jest.fn(),
}));

jest.mock('../../services/investigators/investigatorEngineService', () => ({
  runScheduledInvestigators: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { publish, resetEventBusForTests } from '../../core/events/eventBus';
import { runScheduledInvestigators } from '../../services/investigators/investigatorEngineService';
import { syncPersistedStorylines } from '../../services/storylines/storylineService';
import { resetPulseRecoveryStateForTests } from '../../services/system/pulseService';
import { registerSystemStatusRoutes } from '../systemStatus';

const prismaMock = prisma as unknown as {
  provider: {
    count: jest.Mock;
  };
  investigatorFinding: {
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  storyline: {
    count: jest.Mock;
    findFirst: jest.Mock;
  };
};

const syncPersistedStorylinesMock =
  syncPersistedStorylines as jest.MockedFunction<typeof syncPersistedStorylines>;
const runScheduledInvestigatorsMock =
  runScheduledInvestigators as jest.MockedFunction<typeof runScheduledInvestigators>;

function buildApp() {
  const app = express();
  registerSystemStatusRoutes(app);
  return app;
}

describe('system pulse route', () => {
  beforeEach(() => {
    resetEventBusForTests();
    resetPulseRecoveryStateForTests();

    prismaMock.provider.count.mockReset();
    prismaMock.investigatorFinding.count.mockReset();
    prismaMock.investigatorFinding.findFirst.mockReset();
    prismaMock.storyline.count.mockReset();
    prismaMock.storyline.findFirst.mockReset();
    syncPersistedStorylinesMock.mockReset();
    runScheduledInvestigatorsMock.mockReset();

    prismaMock.provider.count.mockResolvedValue(0);
    prismaMock.investigatorFinding.count.mockResolvedValue(0);
    prismaMock.investigatorFinding.findFirst.mockResolvedValue(null);
    prismaMock.storyline.count.mockResolvedValue(0);
    prismaMock.storyline.findFirst.mockResolvedValue(null);
    syncPersistedStorylinesMock.mockResolvedValue('2026-03-17T09:00:00.000Z');
    runScheduledInvestigatorsMock.mockResolvedValue([]);
  });

  it('returns ALIVE when provider, finding, and storyline counts are all present', async () => {
    const app = buildApp();
    prismaMock.provider.count.mockResolvedValue(4);
    prismaMock.investigatorFinding.count.mockResolvedValue(7);
    prismaMock.storyline.count.mockResolvedValue(3);
    prismaMock.investigatorFinding.findFirst.mockResolvedValue({
      updatedAt: new Date('2026-03-17T10:04:00.000Z'),
    });
    prismaMock.storyline.findFirst.mockResolvedValue({
      lastActivityAt: new Date('2026-03-17T10:03:00.000Z'),
    });

    await publish({
      type: 'STORYLINE_UPDATED',
      timestamp: '2026-03-17T10:05:00.000Z',
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
      .get('/api/system/pulse')
      .expect(200);

    expect(response.body).toEqual({
      providers: 4,
      findings: 7,
      storylines: 3,
      lastEventAt: '2026-03-17T10:05:00.000Z',
      systemState: 'ALIVE',
    });
    expect(runScheduledInvestigatorsMock).not.toHaveBeenCalled();
  });

  it('returns WARMING and triggers investigator recovery when findings are empty', async () => {
    const app = buildApp();
    prismaMock.provider.count.mockResolvedValue(2);
    prismaMock.investigatorFinding.count.mockResolvedValue(0);
    prismaMock.storyline.count.mockResolvedValue(0);

    const response = await request(app)
      .get('/api/system/pulse')
      .expect(200);

    expect(response.body.systemState).toBe('WARMING');
    expect(runScheduledInvestigatorsMock).toHaveBeenCalledTimes(1);
  });

  it('guards recovery so repeated pulse checks do not stampede investigator runs', async () => {
    const app = buildApp();
    prismaMock.provider.count.mockResolvedValue(1);
    prismaMock.investigatorFinding.count.mockResolvedValue(0);
    prismaMock.storyline.count.mockResolvedValue(0);

    await request(app).get('/api/system/pulse').expect(200);
    await request(app).get('/api/system/pulse').expect(200);

    expect(runScheduledInvestigatorsMock).toHaveBeenCalledTimes(1);
  });
});
