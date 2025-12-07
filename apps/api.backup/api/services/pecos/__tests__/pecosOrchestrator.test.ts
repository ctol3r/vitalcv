import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { runPecosOrchestrator } from '../orchestrator.js';
import { PecosEnrollmentType, PecosProviderStatus } from '../models/PECOSProvider.js';

jest.mock('../../audit/payerEnrollmentEvents.js', () => ({
  EvidenceEventType: { PECOS_CHECK: 'pecos_check' },
  EvidenceResult: { PASS: 'PASS', WARNING: 'WARNING', FAIL: 'FAIL', ERROR: 'ERROR' },
  EvidenceSource: { PECOS: 'PECOS' },
  logEvidenceEvent: jest.fn(),
}));

const mockPrisma = {
  payerEnrollment: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  npiClaim: {
    findFirst: jest.fn(),
  },
  pECOSProvider: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  pECOSEnrollment: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  pECOSDocument: {
    upsert: jest.fn(),
  },
} as any;

const mockLookupSuccess = jest.fn().mockResolvedValue({
  provider: {
    clinicianId: 'did:example:123',
    npi: '1234567890',
    medicareId: 'MED-123',
    enrollmentType: PecosEnrollmentType.CMS855I,
    status: PecosProviderStatus.ENROLLED,
    effectiveDate: new Date().toISOString(),
    revalidationDate: new Date(Date.now() + 1_000_000).toISOString(),
    lastCheckedAt: new Date().toISOString(),
    specialties: ['207R00000X'],
    practiceLocations: [{ street: '123 Credentialing Way', city: 'Austin', state: 'TX', zip: '78701' }],
  },
  documents: [
    {
      documentType: 'CMS855I',
      submittedAt: new Date().toISOString(),
      parsedFields: { controlNumber: 'CMS855I-1' },
    },
  ],
  checkedAt: new Date(),
});

describe('PECOS orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.payerEnrollment.findMany.mockResolvedValue([
      {
        id: 'enroll-1',
        clinicianDid: 'did:example:123',
        status: 'APPROVED',
      },
    ]);
    mockPrisma.npiClaim.findFirst.mockResolvedValue({ npi: '1234567890' });
    mockPrisma.pECOSProvider.findUnique.mockResolvedValue(null);
    mockPrisma.pECOSProvider.upsert.mockResolvedValue({ id: 'provider-1' });
    mockPrisma.pECOSEnrollment.findUnique.mockResolvedValue(null);
    mockPrisma.pECOSEnrollment.upsert.mockResolvedValue({ id: 'lifecycle-1' });
  });

  it('updates PECOS provider records', async () => {
    const result = await runPecosOrchestrator({
      prismaClient: mockPrisma,
      lookupFn: mockLookupSuccess,
    });

    expect(result.success).toBe(true);
    expect(result.checked).toBe(1);
    expect(mockPrisma.pECOSProvider.upsert).toHaveBeenCalled();
    expect(mockPrisma.pECOSEnrollment.upsert).toHaveBeenCalled();
    expect(mockPrisma.pECOSDocument.upsert).toHaveBeenCalled();
    expect(mockPrisma.payerEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enroll-1' },
      data: expect.objectContaining({ pecosStatus: 'APPROVED' }),
    });
  });

  it('records failures when lookups keep failing', async () => {
    const failingLookup = jest.fn().mockRejectedValue(new Error('API down'));

    const result = await runPecosOrchestrator({
      prismaClient: mockPrisma,
      lookupFn: failingLookup,
      maxRetries: 1,
    });

    expect(result.success).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(mockPrisma.pECOSProvider.upsert).not.toHaveBeenCalled();
  });
});
