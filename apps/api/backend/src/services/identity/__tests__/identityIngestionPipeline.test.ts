jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    sourceRun: {
      create: jest.fn().mockResolvedValue({ id: 'source-run-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    fetchJob: {
      create: jest.fn().mockResolvedValue({ id: 'fetch-job-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    parseJob: {
      create: jest.fn().mockResolvedValue({ id: 'parse-job-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    claimDerivationJob: {
      create: jest.fn().mockResolvedValue({ id: 'claim-job-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    deltaDetectionJob: {
      create: jest.fn().mockResolvedValue({ id: 'delta-job-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    alertJob: {
      create: jest.fn().mockResolvedValue({ id: 'alert-job-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    sourceRecord: {
      update: jest.fn().mockResolvedValue({}),
    },
    verificationArtifact: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'artifact-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
  Prisma: {
    JsonNull: null,
  },
}));

jest.mock('../identityStore', () => ({
  appendIdentityIndexArtifact: jest.fn(),
  loadClaimRecordsForNpi: jest.fn().mockResolvedValue([]),
  loadVerificationReceiptRecordsForNpi: jest.fn().mockResolvedValue([]),
  persistClaimRecords: jest.fn(),
  persistIdentityClaimDeltas: jest.fn().mockResolvedValue([]),
  persistSourceRecord: jest.fn().mockResolvedValue({ id: 'source-record-1' }),
  persistVerificationReceiptRecords: jest.fn(),
  recordIdentityResolutionDecision: jest.fn(),
  updateClaimRecordState: jest.fn(),
}));

jest.mock('../watchtowerEngine', () => ({
  emitWatchtowerArtifactsForPersistedDeltas: jest.fn(),
  recordSkippedSourceWatchtower: jest.fn().mockResolvedValue({ deltaEvents: [] }),
  scanSourceStalenessForNpi: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../entity/vcvCredentialMaterializer', () => ({
  materializeClaimsToVcvCredentials: jest.fn().mockResolvedValue({ credentialIds: [] }),
}));

jest.mock('../claimEngine', () => {
  const actual = jest.requireActual('../claimEngine');
  return {
    ...actual,
    parseNppesResult: jest.fn(() => {
      throw new Error('parser drift');
    }),
  };
});

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { parseNppesResult } from '../claimEngine';
import { persistSourceRecord } from '../identityStore';
import { ingestClinicianIdentity } from '../identityIngestionPipeline';

const prismaMock = prisma as unknown as {
  sourceRecord: { update: jest.Mock };
  parseJob: { update: jest.Mock };
  verificationArtifact: { update: jest.Mock };
};

const parseNppesResultMock = parseNppesResult as jest.MockedFunction<typeof parseNppesResult>;
const persistSourceRecordMock = persistSourceRecord as jest.MockedFunction<typeof persistSourceRecord>;

describe('identity ingestion pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            number: '1234567890',
            basic: {
              first_name: 'Jane',
              last_name: 'Doe',
              status: 'A',
              enumeration_date: '2020-01-01',
            },
          },
        ],
      }),
      headers: new Headers(),
    }) as unknown as typeof fetch;
  });

  it('quarantines the source record when a live-source parser throws', async () => {
    const report = await ingestClinicianIdentity('1234567890', ['NPPES_API']);

    expect(parseNppesResultMock).toHaveBeenCalled();
    expect(persistSourceRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: 'NPPES_API',
      subjectNpi: '1234567890',
      status: 'FETCHED',
    }));
    expect(report.sourcesFailed).toBe(1);
    expect(report.results).toEqual([
      expect.objectContaining({
        source: 'NPPES_API',
        sourceRecordId: 'source-record-1',
        status: 'FAILED',
        error: 'parser drift',
      }),
    ]);
    expect(prismaMock.sourceRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'source-record-1' },
      data: expect.objectContaining({
        status: 'QUARANTINED',
        quarantineReason: 'parser drift',
      }),
    }));
    expect(prismaMock.parseJob.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'QUARANTINED',
        quarantineReason: 'parser drift',
      }),
    }));
    expect(prismaMock.verificationArtifact.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'QUARANTINED',
        lifecycleState: 'quarantined',
        conflictReason: 'parser drift',
      }),
    }));
  });
});
