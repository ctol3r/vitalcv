jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    investigatorFinding: {
      count: jest.fn(),
    },
    storyline: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../investigators/investigatorEngineService', () => ({
  runTargetedInvestigators: jest.fn(),
}));

jest.mock('../../investigators/seedInvestigationData', () => ({
  ensureInvestigationSeedDataBootstrapped: jest.fn(),
}));

jest.mock('../../storylines/storylineService', () => ({
  listStorylines: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { runTargetedInvestigators } from '../../investigators/investigatorEngineService';
import { ensureInvestigationSeedDataBootstrapped } from '../../investigators/seedInvestigationData';
import { listStorylines } from '../../storylines/storylineService';
import {
  resetIntelligenceAutoWarmStateForTests,
  runIntelligenceAutoWarm,
} from '../intelligenceAutoWarmService';

const prismaMock = prisma as unknown as {
  provider: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  investigatorFinding: {
    count: jest.Mock;
  };
  storyline: {
    count: jest.Mock;
  };
};

const runTargetedInvestigatorsMock =
  runTargetedInvestigators as jest.MockedFunction<typeof runTargetedInvestigators>;
const ensureInvestigationSeedDataBootstrappedMock =
  ensureInvestigationSeedDataBootstrapped as jest.MockedFunction<typeof ensureInvestigationSeedDataBootstrapped>;
const listStorylinesMock =
  listStorylines as jest.MockedFunction<typeof listStorylines>;

describe('intelligence auto warm service', () => {
  beforeEach(() => {
    resetIntelligenceAutoWarmStateForTests();

    prismaMock.provider.count.mockReset();
    prismaMock.provider.findMany.mockReset();
    prismaMock.investigatorFinding.count.mockReset();
    prismaMock.storyline.count.mockReset();
    runTargetedInvestigatorsMock.mockReset();
    ensureInvestigationSeedDataBootstrappedMock.mockReset();
    listStorylinesMock.mockReset();

    prismaMock.provider.findMany.mockResolvedValue([]);
    runTargetedInvestigatorsMock.mockResolvedValue([]);
    ensureInvestigationSeedDataBootstrappedMock.mockResolvedValue(null);
    listStorylinesMock.mockResolvedValue({
      generatedAt: '2026-03-17T11:00:00.000Z',
      total: 0,
      storylines: [],
    } as never);
  });

  it('seeds and warms investigators when providers or findings are missing', async () => {
    prismaMock.provider.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    prismaMock.investigatorFinding.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3);
    prismaMock.storyline.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    prismaMock.provider.findMany.mockResolvedValue([
      { npi: '1234567890' },
      { npi: '1902301456' },
    ]);
    ensureInvestigationSeedDataBootstrappedMock.mockResolvedValue({
      seeded: true,
      marker: 'seed_investigation_data_v1',
      providers: 2,
      findingsByProvider: {},
      storylinesByProvider: {},
      investigatorRuns: [],
    });
    runTargetedInvestigatorsMock.mockResolvedValue([
      {
        investigatorId: 'trust_decline',
        findingsGenerated: 3,
        findingsCreated: 3,
        findingsUpdated: 0,
      },
    ] as never);

    const result = await runIntelligenceAutoWarm('startup');

    expect(ensureInvestigationSeedDataBootstrappedMock).toHaveBeenCalledTimes(1);
    expect(runTargetedInvestigatorsMock).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'provider',
      targetEntityIds: ['1234567890', '1902301456'],
      trigger: 'manual',
      metadata: expect.objectContaining({
        source: 'intelligence_auto_warm',
        trigger: 'startup',
      }),
    }));
    expect(listStorylinesMock).toHaveBeenCalledWith({ limit: 200, sync: true });
    expect(result).toMatchObject({
      triggered: true,
      reason: 'completed',
      seeded: true,
      findingsGenerated: 3,
      targetProviders: 2,
      providersAfter: 2,
      findingsAfter: 3,
      storylinesAfter: 2,
    });
  });

  it('returns cooldown metadata instead of rerunning immediately', async () => {
    prismaMock.provider.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.investigatorFinding.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    prismaMock.storyline.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const first = await runIntelligenceAutoWarm('manual');
    const second = await runIntelligenceAutoWarm('manual');

    expect(first.reason).toBe('completed');
    expect(second).toMatchObject({
      triggered: false,
      reason: 'cooldown',
      providersAfter: 1,
      findingsAfter: 1,
      storylinesAfter: 1,
    });
    expect(runTargetedInvestigatorsMock).not.toHaveBeenCalled();
  });
});
