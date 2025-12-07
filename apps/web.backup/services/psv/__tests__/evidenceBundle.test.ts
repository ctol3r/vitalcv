import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  pECOSProvider: {
    findFirst: jest.fn(),
  },
  credentialRisk: {
    findUnique: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import { getPecosSummaryForClinician, getCredentialRiskSummary } from '../evidenceBundle.js';

describe('PECOS summary helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns serialized summary when provider exists', async () => {
    mockPrisma.pECOSProvider.findFirst.mockResolvedValue({
      id: 'provider-1',
      clinicianId: 'did:example:123',
      npi: '1234567890',
      medicareId: 'MED-123',
      enrollmentType: 'CMS855I',
      status: 'ENROLLED',
      effectiveDate: new Date('2024-01-01'),
      revalidationDate: new Date('2026-01-01'),
      lastCheckedAt: new Date('2024-02-01'),
      documents: [
        {
          documentType: 'CMS855I',
          submittedAt: new Date('2023-12-01'),
          parsedFields: { controlNumber: 'CMS855I-1' },
        },
      ],
    });

    const summary = await getPecosSummaryForClinician('did:example:123');

    expect(summary?.provider?.providerId).toBe('provider-1');
    expect(summary?.documents).toHaveLength(1);
  });

  it('returns null when no provider is stored', async () => {
    mockPrisma.pECOSProvider.findFirst.mockResolvedValue(null);
    const summary = await getPecosSummaryForClinician('missing');
    expect(summary).toBeNull();
  });
});

describe('Credential risk summary helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns serialized risk summary when a record exists', async () => {
    mockPrisma.credentialRisk.findUnique.mockResolvedValue({
      clinicianId: 'did:example:123',
      score: 78,
      factors: ['LICENSE_EXPIRED', 'NPDB_HIT'],
      updatedAt: new Date('2025-01-15T00:00:00Z'),
    });

    const summary = await getCredentialRiskSummary('did:example:123');
    expect(summary).toEqual({
      clinicianId: 'did:example:123',
      score: 78,
      factors: ['LICENSE_EXPIRED', 'NPDB_HIT'],
      updatedAt: new Date('2025-01-15T00:00:00Z').toISOString(),
    });
  });

  it('returns null when risk record is missing', async () => {
    mockPrisma.credentialRisk.findUnique.mockResolvedValue(null);
    const summary = await getCredentialRiskSummary('missing');
    expect(summary).toBeNull();
  });
});

describe('NCQA compliance snapshot helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('serializes NCQA rule records with summary stats', async () => {
    mockPrisma.nCQAComplianceRecord.findMany.mockResolvedValue([
      {
        clinicianId: 'clin-1',
        ruleCode: 'CR1',
        status: 'PASS',
        lastVerifiedAt: new Date('2025-01-01T00:00:00Z'),
        nextDueAt: new Date('2025-05-01T00:00:00Z'),
        evidenceRefs: [{ id: 'psv-1', type: 'PSV_RESULT' }],
        notes: null,
      },
      {
        clinicianId: 'clin-1',
        ruleCode: 'CR2',
        status: 'FAIL',
        lastVerifiedAt: new Date('2024-01-01T00:00:00Z'),
        nextDueAt: new Date('2024-12-01T00:00:00Z'),
        evidenceRefs: [],
        notes: 'Overdue',
      },
    ]);

    const snapshot = await getNcqaComplianceSnapshot('clin-1');
    expect(snapshot?.summary.totalRules).toBe(2);
    expect(snapshot?.summary.failingRules).toEqual(['CR2']);
    expect(snapshot?.rules[0].evidenceRefs).toHaveLength(1);
  });

  it('returns null when no NCQA records exist', async () => {
    mockPrisma.nCQAComplianceRecord.findMany.mockResolvedValue([]);
    const snapshot = await getNcqaComplianceSnapshot('clin-missing');
    expect(snapshot).toBeNull();
  });
});

