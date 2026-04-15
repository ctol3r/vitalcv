jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    notification: { create: jest.fn() },
    auditEvent: { create: jest.fn() },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../pilot/pilotOpsService', () => ({
  recordPilotMetricEvent: jest.fn(),
}));

jest.mock('../../integration/webhookSystem', () => ({
  enqueueIntegrationWebhookEvent: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { recordPilotMetricEvent } from '../../pilot/pilotOpsService';
import { enqueueIntegrationWebhookEvent } from '../../integration/webhookSystem';
import {
  HARD_DRIFT_EVENT,
  handleDriftEvent,
  registerDriftReactionHandlers,
  __unregisterDriftReactionHandlersForTests,
} from '../driftReactionHandler';
import { emit, __resetEventBusForTests } from '../eventBus';

const prismaMock = prisma as unknown as {
  notification: { create: jest.Mock };
  auditEvent: { create: jest.Mock };
};
const recordPilotMetricEventMock = recordPilotMetricEvent as jest.MockedFunction<typeof recordPilotMetricEvent>;
const enqueueIntegrationWebhookEventMock =
  enqueueIntegrationWebhookEvent as jest.MockedFunction<typeof enqueueIntegrationWebhookEvent>;

describe('driftReactionHandler', () => {
  beforeEach(() => {
    prismaMock.notification.create.mockReset();
    prismaMock.notification.create.mockResolvedValue({});
    prismaMock.auditEvent.create.mockReset();
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    recordPilotMetricEventMock.mockReset();
    recordPilotMetricEventMock.mockResolvedValue({
      eventId: 'pilot-event-1',
      queueItemId: null,
    });
    enqueueIntegrationWebhookEventMock.mockReset().mockResolvedValue(0);
    __resetEventBusForTests();
    __unregisterDriftReactionHandlersForTests();
  });

  it('persists notification, audit, and KPI writes for a drift event', async () => {
    await handleDriftEvent({
      type: HARD_DRIFT_EVENT,
      clinicianNpi: '1234567890',
      source: 'omega',
      severity: 'high',
      timestamp: '2026-04-14T00:00:00.000Z',
      payload: { reasons: ['Readiness blockers present: 2'] },
    });

    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clinicianNpi: '1234567890',
        eventType: HARD_DRIFT_EVENT,
        severity: 'high',
        message: expect.stringContaining('Hard drift detected'),
      }),
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'drift.detected',
        referenceId: '1234567890',
        metadata: expect.objectContaining({
          clinicianNpi: '1234567890',
          sourceEventType: HARD_DRIFT_EVENT,
          severity: 'high',
          readinessPosture: 'degraded',
        }),
      }),
      select: { id: true },
    });
    expect(recordPilotMetricEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'drift_detected',
        route: '/api/omega',
        severity: 'high',
        entity: expect.objectContaining({
          id: '1234567890',
        }),
        details: expect.objectContaining({
          readinessPosture: 'degraded',
        }),
      }),
    );
    expect(enqueueIntegrationWebhookEventMock).toHaveBeenCalledWith({
      eventType: 'drift.detected',
      subjectNpi: '1234567890',
      manifestId: null,
      timestamp: '2026-04-14T00:00:00.000Z',
      dedupeKey: 'audit-1',
    });
  });

  it('skips persistence when the event has no clinicianNpi', async () => {
    await handleDriftEvent({
      type: HARD_DRIFT_EVENT,
      severity: 'high',
      timestamp: '2026-04-14T00:00:00.000Z',
    });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
    expect(recordPilotMetricEventMock).not.toHaveBeenCalled();
  });

  it('swallows persistence errors so emitter flow is not disturbed', async () => {
    prismaMock.notification.create.mockRejectedValue(new Error('db down'));
    prismaMock.auditEvent.create.mockRejectedValue(new Error('audit down'));
    recordPilotMetricEventMock.mockRejectedValue(new Error('metric down'));
    await expect(
      handleDriftEvent({
        type: HARD_DRIFT_EVENT,
        clinicianNpi: '1234567890',
        severity: 'high',
        timestamp: '2026-04-14T00:00:00.000Z',
      }),
    ).resolves.toBeUndefined();
  });

  it('registers subscribers that pick up events from the bus', async () => {
    registerDriftReactionHandlers();
    await emit({
      type: HARD_DRIFT_EVENT,
      clinicianNpi: '1234567890',
      severity: 'high',
      timestamp: '2026-04-14T00:00:00.000Z',
    });
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(recordPilotMetricEventMock).toHaveBeenCalledTimes(1);
  });
});
