jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

import { Prisma } from '@prisma/client';
import { ensureLaunchOpportunitiesBootstrappedForStartup } from '../launchOpportunitySeed';

const logger = jest.fn<
  void,
  ['info' | 'warn' | 'error', string, Record<string, unknown>?]
>();

describe('ensureLaunchOpportunitiesBootstrappedForStartup', () => {
  beforeEach(() => {
    logger.mockReset();
  });

  it('logs and skips when bootstrap hits an opportunity schema gap', async () => {
    const bootstrap = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing Opportunity table', {
        code: 'P2021',
        clientVersion: '6.19.2',
      }),
    );

    await expect(ensureLaunchOpportunitiesBootstrappedForStartup({
      logger,
      bootstrap,
    })).resolves.toBeNull();

    expect(bootstrap).toHaveBeenCalledWith({
      logger,
      prismaClient: undefined,
    });
    expect(logger).toHaveBeenCalledWith(
      'warn',
      'launch_opportunity_seed.startup_skipped_schema_gap',
      expect.objectContaining({
        event: 'launch_opportunity_seed.startup_skipped_schema_gap',
        prisma_code: 'P2021',
        reason: 'schema_compatibility',
        error: 'missing Opportunity table',
      }),
    );
  });

  it('rethrows non-schema Prisma initialization failures', async () => {
    const error = new Prisma.PrismaClientInitializationError('db auth failed', '6.19.2');
    const bootstrap = jest.fn().mockRejectedValue(error);

    await expect(ensureLaunchOpportunitiesBootstrappedForStartup({
      logger,
      bootstrap,
    })).rejects.toBe(error);

    expect(logger).not.toHaveBeenCalled();
  });

  it('returns the underlying bootstrap summary when bootstrap succeeds', async () => {
    const summary = {
      activeOpportunityCount: 5,
      seededOpportunityCount: 0,
      createdOrganizationCount: 0,
      skipped: false,
    };
    const bootstrap = jest.fn().mockResolvedValue(summary);

    await expect(ensureLaunchOpportunitiesBootstrappedForStartup({
      logger,
      bootstrap,
    })).resolves.toEqual(summary);

    expect(bootstrap).toHaveBeenCalledWith({
      logger,
      prismaClient: undefined,
    });
    expect(logger).not.toHaveBeenCalled();
  });
});
