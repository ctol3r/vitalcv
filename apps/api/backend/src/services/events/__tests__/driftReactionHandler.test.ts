jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    notification: { create: jest.fn() },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  HARD_DRIFT_EVENT,
  handleDriftEvent,
  registerDriftReactionHandlers,
  __unregisterDriftReactionHandlersForTests,
} from '../driftReactionHandler';
import { emit, __resetEventBusForTests } from '../eventBus';

const prismaMock = prisma as unknown as {
  notification: { create: jest.Mock };
};

describe('driftReactionHandler', () => {
  beforeEach(() => {
    prismaMock.notification.create.mockReset();
    prismaMock.notification.create.mockResolvedValue({});
    __resetEventBusForTests();
    __unregisterDriftReactionHandlersForTests();
  });

  it('persists a notification with the drift severity and message', async () => {
    await handleDriftEvent({
      type: HARD_DRIFT_EVENT,
      clinicianNpi: '1234567890',
      source: 'omega',
      severity: 'HARD_DRIFT',
      timestamp: '2026-04-14T00:00:00.000Z',
    });

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianNpi: '1234567890',
        eventType: HARD_DRIFT_EVENT,
        severity: 'HARD_DRIFT',
        message: expect.stringContaining('Hard drift detected'),
      }),
    });
  });

  it('skips persistence when the event has no clinicianNpi', async () => {
    await handleDriftEvent({
      type: HARD_DRIFT_EVENT,
      severity: 'HARD_DRIFT',
      timestamp: '2026-04-14T00:00:00.000Z',
    });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it('swallows prisma errors so emitter flow is not disturbed', async () => {
    prismaMock.notification.create.mockRejectedValue(new Error('db down'));
    await expect(
      handleDriftEvent({
        type: HARD_DRIFT_EVENT,
        clinicianNpi: '1234567890',
        severity: 'HARD_DRIFT',
        timestamp: '2026-04-14T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('registers subscribers that pick up events from the bus', async () => {
    registerDriftReactionHandlers();
    await emit({
      type: HARD_DRIFT_EVENT,
      clinicianNpi: '1234567890',
      severity: 'HARD_DRIFT',
      timestamp: '2026-04-14T00:00:00.000Z',
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });
});
