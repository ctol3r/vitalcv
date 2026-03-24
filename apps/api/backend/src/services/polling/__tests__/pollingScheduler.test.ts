const mockIngestClinicianIdentity = jest.fn();
const mockEmitIntelligenceEvent = jest.fn();
const mockStoreFinding = jest.fn();
const mockIngestFinding = jest.fn();
const mockLog = jest.fn();

const mockPrisma = {
  verificationArtifact: {
    findFirst: jest.fn(),
  },
} as const;

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('../../identity/identityIngestionPipeline', () => ({
  ingestClinicianIdentity: (...args: unknown[]) => mockIngestClinicianIdentity(...args),
}));

jest.mock('../../intelligence/intelligenceEngine', () => ({
  emitIntelligenceEvent: (...args: unknown[]) => mockEmitIntelligenceEvent(...args),
}));

jest.mock('../../investigators/framework', () => ({
  storeFinding: (...args: unknown[]) => mockStoreFinding(...args),
}));

jest.mock('../../storylines/storylineEngine', () => ({
  ingestFinding: (...args: unknown[]) => mockIngestFinding(...args),
}));

jest.mock('../../../obs/logger', () => ({
  log: (...args: unknown[]) => mockLog(...args),
}));

import { processBurstEvent } from '../pollingScheduler';

describe('pollingScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIngestClinicianIdentity.mockResolvedValue({ ok: true });
    mockStoreFinding.mockImplementation((input: unknown) => input);
  });

  it('processes a PECOS burst with canonical source ids and records the bulk-sync outcome', async () => {
    mockPrisma.verificationArtifact.findFirst
      .mockResolvedValueOnce({
        rawPayload: { claimState: 'ENROLLED', dataVersion: '2026-Q1' },
      })
      .mockResolvedValueOnce({
        rawPayload: { claimState: 'NOT_FOUND', dataVersion: '2026-Q1' },
      });

    const result = await processBurstEvent({
      source: 'PECOS_PUBLIC',
      description: 'Quarterly PECOS sync',
      npis: ['1558302470', '2558302470'],
      batchSize: 2,
      delayMs: 0,
    });

    expect(mockIngestClinicianIdentity).toHaveBeenNthCalledWith(1, '1558302470', ['PECOS_PUBLIC']);
    expect(mockIngestClinicianIdentity).toHaveBeenNthCalledWith(2, '2558302470', ['PECOS_PUBLIC']);
    expect(result).toMatchObject({
      source: 'PECOS_PUBLIC',
      totalNpis: 2,
      processedNpis: 2,
      addedCount: 2,
      changedCount: 0,
      errorCount: 0,
      findings: 1,
    });
    expect(mockStoreFinding).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        burstSource: 'PECOS_PUBLIC',
        processed: 2,
        added: 2,
      }),
    }));
    expect(mockIngestFinding).toHaveBeenCalledTimes(1);
  });
});
