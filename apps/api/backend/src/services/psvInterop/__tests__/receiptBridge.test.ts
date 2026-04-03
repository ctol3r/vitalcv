const mockAppendReceipt = jest.fn();
const mockPrismaBackedPsvStore = jest.fn().mockImplementation(() => ({
  appendReceipt: mockAppendReceipt,
}));

jest.mock('../../../graphql/prisma_client', () => ({
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

jest.mock('../../psv/PrismaBackedPsvStore', () => ({
  PrismaBackedPsvStore: mockPrismaBackedPsvStore,
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { log } from '../../../obs/logger';
import type { CredentialFactBatch } from '@vitalcv/psv-adapters';
import { BackendCanonicalCredentialFactStore } from '../canonicalFactStore';

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

type BatchOverrides = Partial<CredentialFactBatch> & {
  summary?: Partial<CredentialFactBatch['summary']>;
};

function createBatch(overrides: BatchOverrides = {}): CredentialFactBatch {
  const defaultBatch: CredentialFactBatch = {
    batchId: 'batch-1',
    subjectId: '1234567890',
    source: 'npi-registry',
    sourceMode: 'PUBLIC_API',
    adapterVersion: '1.0.0',
    retrievalTime: '2026-03-14T00:00:00.000Z',
    queryKind: 'lookup',
    queryHash: 'query-hash-1',
    rawResponse: { provider: 'test' },
    rawResponseHash:
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    evidencePointer: 'evidence://batch-1',
    idempotencyKey: 'idempotency-key-1',
    facts: [],
    events: [],
    summary: {
      status: 'ACTIVE',
      sourceUrl: 'https://example.test/source',
      factCount: 0,
      monitoringEnabled: false,
    },
  };

  return {
    ...defaultBatch,
    ...overrides,
    summary: {
      ...defaultBatch.summary,
      ...overrides.summary,
    },
  };
}

describe('receipt bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    prismaMock.verificationArtifact.create.mockResolvedValue({ id: 'artifact-1' });
    prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
    prismaMock.monitoringEvent.create.mockResolvedValue({ id: 'monitor-1' });
    prismaMock.nursysEvent.create.mockResolvedValue({ id: 'nursys-1' });
    mockAppendReceipt.mockResolvedValue(undefined);
  });

  it('writes a PsvReceipt after persisting a CredentialFactBatch', async () => {
    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);
    const batch = createBatch();

    await store.persistBatch({ batch });

    expect(mockPrismaBackedPsvStore).toHaveBeenCalledTimes(1);
    expect(mockAppendReceipt).toHaveBeenCalledTimes(1);
    const appendInput = mockAppendReceipt.mock.calls[0][0];
    expect(appendInput.clinician_id).toBe('1234567890');
    expect(appendInput.lane).toBe('PUBLIC');
    expect(appendInput.verification_check).toBe('NPI_IDENTITY');
    expect(appendInput.verification_outcome).toBe('PASS');
    expect(appendInput.receipt.receipt_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('does not throw when the receipt bridge write fails', async () => {
    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);
    mockAppendReceipt.mockRejectedValueOnce(new Error('receipt write failed'));

    await expect(store.persistBatch({ batch: createBatch() })).resolves.toMatchObject({
      artifactId: 'artifact-1',
      idempotent: false,
    });

    expect(log).toHaveBeenCalledWith(
      'error',
      'psv_interop_receipt_bridge_error',
      expect.objectContaining({
        batchId: 'batch-1',
        source: 'npi-registry',
        error: 'Error: receipt write failed',
      }),
    );
  });

  it('marks verification_outcome PASS when batch.summary.status is ACTIVE', async () => {
    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);

    await store.persistBatch({
      batch: createBatch({
        summary: {
          status: 'ACTIVE',
          sourceUrl: 'https://example.test/source',
          factCount: 0,
          monitoringEnabled: false,
        },
      }),
    });

    expect(mockAppendReceipt.mock.calls[0][0].verification_outcome).toBe('PASS');
  });

  it('maps case-insensitive npi sources to NPI_IDENTITY verification_check', async () => {
    const store = new BackendCanonicalCredentialFactStore(prismaMock as never);

    await store.persistBatch({
      batch: createBatch({ source: 'NPI-Registry' }),
    });

    expect(mockAppendReceipt.mock.calls[0][0].verification_check).toBe('NPI_IDENTITY');
  });
});
