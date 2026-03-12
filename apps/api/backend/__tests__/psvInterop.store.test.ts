jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  Prisma: {},
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
    monitoringEvent: {
      create: jest.fn(),
    },
    nursysEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../src/obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../src/graphql/prisma_client';
import {
  NpiRegistryAdapter,
  NursysENotifyAdapter,
  createJsonHttpTransport,
  InMemoryMonitoringSubscriptionState,
} from '../../../../packages/psv-adapters';
import npiLookupFixture from '../../../../packages/psv-adapters/fixtures/npiRegistry.lookupByNpi.json';
import nursysDisciplineFixture from '../../../../packages/psv-adapters/fixtures/nursys.webhook.discipline.json';
import { BackendCanonicalCredentialFactStore } from '../src/services/psvInterop/canonicalFactStore';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    text: async () => JSON.stringify(body),
  } as Response;
}

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
  };
  monitoringEvent: {
    create: jest.Mock;
  };
  nursysEvent: {
    create: jest.Mock;
  };
};

describe('BackendCanonicalCredentialFactStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'artifact-1' });
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.monitoringEvent.create.mockResolvedValue({ id: 'monitor-1' });
    prismaMock.nursysEvent.create.mockResolvedValue({ id: 'nursys-1' });
  });

  it('persists NPI bootstrap batches into VerificationArtifact and AuditEvent with trust signal emission', async () => {
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(npiLookupFixture),
      }),
    });
    const batch = await adapter.lookupByNpi('1234567893');
    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);

    await store.recordQueryAudit({
      subjectId: batch.subjectId,
      source: batch.source,
      queryHash: batch.queryHash,
      queryKind: batch.queryKind,
      retrievalMethod: 'api',
      occurredAt: batch.retrievalTime,
    });
    const persisted = await store.persistBatch({ batch });

    expect(persisted.idempotent).toBe(false);
    expect(prismaMock.verificationArtifact.create).toHaveBeenCalledTimes(1);
    const artifactCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
    expect(artifactCall.data.source).toBe('npi-registry');
    expect(artifactCall.data.status).toBe('ACTIVE');
    expect(artifactCall.data.rawPayload.batch.batchId).toBe(batch.batchId);
    expect(prismaMock.auditEvent.create).toHaveBeenCalled();
    const eventTypes = prismaMock.auditEvent.create.mock.calls.map(
      (call) => call[0].data.type as string,
    );
    expect(eventTypes).toContain('PSV_ADAPTER_QUERY');
    expect(eventTypes).toContain('TrustSignalRaised');
  });

  it('persists Nursys deltas into NursysEvent and MonitoringEvent while updating artifact status', async () => {
    const subscriptionState = new InMemoryMonitoringSubscriptionState();
    const adapter = new NursysENotifyAdapter({
      institutionId: 'org-1',
      subscriptionState,
    });
    const enrollment = await adapter.enrollMonitoring({
      npi: '1234567893',
      deliveryMethod: 'WEBHOOK',
      webhookTarget: 'https://vitalcv.test/hooks/nursys',
    });
    const subscription = enrollment.facts.find(
      (entry) => entry.fact.factType === 'MonitoringSubscription',
    )?.fact;
    if (!subscription || subscription.factType !== 'MonitoringSubscription') {
      throw new Error('expected monitoring subscription fact');
    }

    const batch = await adapter.ingestWebhook({
      subscriptionId: subscription.subscriptionId,
      payload: nursysDisciplineFixture,
    });
    prismaMock.verificationArtifact.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'artifact-prev',
        status: 'EXPIRED',
        source: 'nursys-enotify',
        verifiedAt: new Date('2026-03-10T00:00:00.000Z'),
      });

    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);
    const persisted = await store.persistBatch({ batch });

    expect(persisted.status).toBe('ACTIVE');
    expect(prismaMock.verificationArtifact.create).toHaveBeenCalledTimes(1);
    const artifactCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
    expect(artifactCall.data.source).toBe('nursys-enotify');
    expect(artifactCall.data.monitoring).toBe(true);
    expect(prismaMock.nursysEvent.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.monitoringEvent.create).toHaveBeenCalledTimes(1);
    const monitoringCall = prismaMock.monitoringEvent.create.mock.calls[0][0];
    expect(monitoringCall.data.previousStatus).toBe('EXPIRED');
    expect(monitoringCall.data.newStatus).toBe('ACTIVE');
  });
});
