jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    learningEvent: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { resolveOutcome } from '../decisionSignalService';

const prismaMock = prisma as unknown as {
  learningEvent: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

describe('resolveOutcome', () => {
  beforeEach(() => {
    prismaMock.learningEvent.findFirst.mockReset();
    prismaMock.learningEvent.update.mockReset();
  });

  it('updates metadata on the most recent decision event with the new outcome', async () => {
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      metadata: { decision: 'accept', readinessScore: 80 },
    });
    prismaMock.learningEvent.update.mockResolvedValue({});

    await resolveOutcome({ clinicianNpi: '1234567890', outcome: 'START_ACTIVATED' });

    expect(prismaMock.learningEvent.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: {
        metadata: expect.objectContaining({
          decision: 'accept',
          readinessScore: 80,
          outcome: 'START_ACTIVATED',
          resolvedAt: expect.any(String),
        }),
      },
    });
  });

  it('no-ops when no pending decision event exists', async () => {
    prismaMock.learningEvent.findFirst.mockResolvedValue(null);
    await resolveOutcome({ clinicianNpi: '1234567890', outcome: 'START_ACTIVATED' });
    expect(prismaMock.learningEvent.update).not.toHaveBeenCalled();
  });

  it('does not overwrite an already-resolved terminal outcome', async () => {
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      metadata: { outcome: 'DRIFT_OCCURRED' },
    });
    await resolveOutcome({ clinicianNpi: '1234567890', outcome: 'START_ACTIVATED' });
    expect(prismaMock.learningEvent.update).not.toHaveBeenCalled();
  });

  it('updates when existing outcome is PENDING', async () => {
    prismaMock.learningEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      metadata: { outcome: 'PENDING' },
    });
    await resolveOutcome({ clinicianNpi: '1234567890', outcome: 'START_ACTIVATED' });
    expect(prismaMock.learningEvent.update).toHaveBeenCalled();
  });

  it('skips when input is missing required fields', async () => {
    await resolveOutcome({ clinicianNpi: '', outcome: 'X' });
    await resolveOutcome({ clinicianNpi: 'x', outcome: '' });
    expect(prismaMock.learningEvent.findFirst).not.toHaveBeenCalled();
  });

  it('swallows prisma errors without throwing', async () => {
    prismaMock.learningEvent.findFirst.mockRejectedValue(new Error('db'));
    await expect(
      resolveOutcome({ clinicianNpi: '1234567890', outcome: 'START_ACTIVATED' }),
    ).resolves.toBeUndefined();
  });
});
