jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    revocationOutboxEvent: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../services/integration/webhookDispatcher', () => ({
  dispatchEnterpriseWebhook: jest.fn(),
  resolveEnterpriseWebhookTarget: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  dispatchEnterpriseWebhook,
  resolveEnterpriseWebhookTarget,
} from '../../services/integration/webhookDispatcher';
import { processRevocationOutboxBatch } from '../revocationOutboxWorker';

const prismaMock = prisma as unknown as {
  revocationOutboxEvent: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
};

const dispatchEnterpriseWebhookMock = dispatchEnterpriseWebhook as jest.Mock;
const resolveEnterpriseWebhookTargetMock = resolveEnterpriseWebhookTarget as jest.Mock;

function makeOutboxPayload() {
  return {
    event: 'credential.revoked',
    artifactId: 'cred-1',
    employerId: 'employer-1',
    acceptanceId: 'acceptance-1',
    source: 'NURSYS',
    npiPrefix: '1234······',
    lifecycleState: 'revoked',
    changedAt: '2026-03-14T10:00:00.000Z',
    reason: 'manual revoke',
    impactedCapsules: {
      total: 2,
      invalidated: 2,
      atRisk: 0,
      capsuleIds: ['cap-1', 'cap-2'],
    },
    trustState: {
      previousBand: 'L3',
      newBand: 'L1',
      snapshotArtifactId: 'snapshot-1',
      computedAt: '2026-03-14T10:05:00.000Z',
    },
  };
}

describe('revocationOutboxWorker', () => {
  beforeEach(() => {
    prismaMock.revocationOutboxEvent.findMany.mockReset();
    prismaMock.revocationOutboxEvent.updateMany.mockReset();
    prismaMock.revocationOutboxEvent.update.mockReset();
    dispatchEnterpriseWebhookMock.mockReset();
    resolveEnterpriseWebhookTargetMock.mockReset();
  });

  it('delivers pending outbox rows and marks them DELIVERED', async () => {
    prismaMock.revocationOutboxEvent.findMany.mockResolvedValue([
      {
        id: 'outbox-1',
        payload: makeOutboxPayload(),
        attemptCount: 0,
      },
    ]);
    prismaMock.revocationOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.revocationOutboxEvent.update.mockResolvedValue({});
    resolveEnterpriseWebhookTargetMock.mockResolvedValue({
      employerId: 'employer-1',
      endpointUrl: 'https://example.test/webhooks',
      signingSecret: 'secret',
      acceptanceId: 'acceptance-1',
    });
    dispatchEnterpriseWebhookMock.mockResolvedValue(undefined);

    const delivered = await processRevocationOutboxBatch();

    expect(delivered).toBe(1);
    expect(resolveEnterpriseWebhookTargetMock).toHaveBeenCalledWith('employer-1', 'acceptance-1');
    expect(dispatchEnterpriseWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        employerId: 'employer-1',
      }),
      expect.objectContaining({
        event: 'credential.revoked',
        delivery_id: 'outbox-1',
      }),
    );
    expect(prismaMock.revocationOutboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-1' },
      data: expect.objectContaining({
        status: 'DELIVERED',
        lastError: null,
      }),
    });
  });

  it('requeues failed deliveries with incremented attempt metadata', async () => {
    prismaMock.revocationOutboxEvent.findMany.mockResolvedValue([
      {
        id: 'outbox-2',
        payload: makeOutboxPayload(),
        attemptCount: 1,
      },
    ]);
    prismaMock.revocationOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.revocationOutboxEvent.update.mockResolvedValue({});
    resolveEnterpriseWebhookTargetMock.mockResolvedValue({
      employerId: 'employer-1',
      endpointUrl: 'https://example.test/webhooks',
      signingSecret: 'secret',
      acceptanceId: 'acceptance-1',
    });
    dispatchEnterpriseWebhookMock.mockRejectedValue(new Error('webhook timeout'));

    const delivered = await processRevocationOutboxBatch();

    expect(delivered).toBe(0);
    expect(prismaMock.revocationOutboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-2' },
      data: expect.objectContaining({
        status: 'PENDING',
        attemptCount: 2,
        lastError: 'webhook timeout',
        availableAt: expect.any(Date),
      }),
    });
  });

  it('marks rows FAILED after the final retry budget is exhausted', async () => {
    prismaMock.revocationOutboxEvent.findMany.mockResolvedValue([
      {
        id: 'outbox-3',
        payload: makeOutboxPayload(),
        attemptCount: 3,
      },
    ]);
    prismaMock.revocationOutboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.revocationOutboxEvent.update.mockResolvedValue({});
    resolveEnterpriseWebhookTargetMock.mockResolvedValue({
      employerId: 'employer-1',
      endpointUrl: 'https://example.test/webhooks',
      signingSecret: 'secret',
      acceptanceId: 'acceptance-1',
    });
    dispatchEnterpriseWebhookMock.mockRejectedValue(new Error('permanent failure'));

    const delivered = await processRevocationOutboxBatch();

    expect(delivered).toBe(0);
    expect(prismaMock.revocationOutboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'outbox-3' },
      data: expect.objectContaining({
        status: 'FAILED',
        attemptCount: 4,
        lastError: 'permanent failure',
      }),
    });
  });
});
