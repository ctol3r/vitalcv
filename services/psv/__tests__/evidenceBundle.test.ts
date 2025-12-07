import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPrisma = {
  pECOSProvider: {
    findFirst: jest.fn(),
  },
  pECOSEnrollment: {
    findMany: jest.fn(),
  },
  compactsStatus: {
    findUnique: jest.fn(),
  },
  credentialRisk: {
    findUnique: jest.fn(),
  },
  nCQAComplianceRecord: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

import {
  getCompactEvidenceSummaries,
  getCredentialRiskSummary,
  getNcqaComplianceSnapshot,
  getPecosSummaryForClinician,
  getTrustArtifactsForManifest,
} from '../evidenceBundle.js';

describe('PECOS summary helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns serialized PECOS summary', async () => {
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
    mockPrisma.pECOSEnrollment.findMany.mockResolvedValue([
      {
        id: 'enroll-1',
        clinicianId: 'did:example:123',
        enrollmentType: 'CMS855I',
        currentStatus: 'ENROLLED',
        revalidationDueAt: new Date('2026-01-01'),
        lastCheckedAt: new Date('2024-02-01'),
        statuses: [
          { status: 'PENDING', occurredAt: '2023-11-01T00:00:00Z' },
          { status: 'ENROLLED', occurredAt: '2023-12-15T00:00:00Z' },
        ],
        anomalies: [],
      },
    ]);

    const summary = await getPecosSummaryForClinician('did:example:123');
    expect(summary?.provider?.providerId).toBe('provider-1');
    expect(summary?.documents).toHaveLength(1);
    expect(summary?.enrollments).toHaveLength(1);
    expect(summary?.enrollments[0].statuses[0].status).toBe('PENDING');
  });

  it('returns null when no provider exists', async () => {
    mockPrisma.pECOSProvider.findFirst.mockResolvedValue(null);
    mockPrisma.pECOSEnrollment.findMany.mockResolvedValue([]);
    const summary = await getPecosSummaryForClinician('missing');
    expect(summary).toBeNull();
  });
  it('builds compact evidence summaries when data exists', async () => {
    mockPrisma.compactsStatus.findUnique.mockResolvedValue({
      clinicianDid: 'did:example:compact',
      imlcStatus: 'LICENSED',
      imlcHomeState: 'TX',
      imlcCompactStates: ['WA'],
      psypactStatus: 'NOT_ELIGIBLE',
      psypactStates: [],
      counselingStatus: 'NOT_ELIGIBLE',
      counselingHomeState: undefined,
      counselingStates: [],
      lastComputedAt: new Date(),
      nextRefreshAt: new Date(),
    });

    const summaries = await getCompactEvidenceSummaries('did:example:compact');
    expect(summaries).toHaveLength(1);
    expect(summaries[0].compactType).toBe('IMLC');
    expect(summaries[0].authorizedStates.length).toBeGreaterThan(0);
  });

  it('returns empty compact summary list when no compacts status is found', async () => {
    mockPrisma.compactsStatus.findUnique.mockResolvedValue(null);
    const summaries = await getCompactEvidenceSummaries('unknown');
    expect(summaries).toHaveLength(0);
  });
});

describe('Credential risk summary helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns serialized risk summary when available', async () => {
    mockPrisma.credentialRisk.findUnique.mockResolvedValue({
      clinicianId: 'did:example:risk',
      score: 72,
      factors: ['LICENSE_EXPIRED', 'NPDB_HIT'],
      updatedAt: new Date('2025-02-01T00:00:00Z'),
    });

    const summary = await getCredentialRiskSummary('did:example:risk');
    expect(summary).toEqual({
      clinicianId: 'did:example:risk',
      score: 72,
      factors: ['LICENSE_EXPIRED', 'NPDB_HIT'],
      updatedAt: new Date('2025-02-01T00:00:00Z').toISOString(),
    });
  });

  it('returns null when credential risk missing', async () => {
    mockPrisma.credentialRisk.findUnique.mockResolvedValue(null);
    const summary = await getCredentialRiskSummary('missing');
    expect(summary).toBeNull();
  });
});

describe('Trust artifact builder', () => {
  it('maps manifest results to trust anchors', async () => {
    const manifest = {
      results: {
        licenseCheck: {
          checkId: 'license-1',
          state: 'CA',
          licenseNumber: 'A12345',
          sourceUrl: 'https://www.mbc.ca.gov/',
          checkedAt: '2025-11-01T00:00:00Z',
        },
        sanctionsCheck: {
          checkId: 'sanction-1',
          sanctioned: false,
          sourceUrl: 'https://oig.hhs.gov/exclusions/index.asp',
          checkedAt: '2025-11-01T00:00:00Z',
        },
      },
    };

    const licenseAnchor = {
      entityId: 'ca-medical-board',
      entityType: 'STATE_BOARD',
      did: 'did:web:trust.vitalcv/states/ca-medical-board',
      publicKeys: ['did:key:z6MkTest'],
      jurisdiction: 'CA',
      accreditationStatus: 'ACCREDITED',
      displayName: 'Medical Board of California',
      metadata: {},
      metrics: {
        verificationAccuracy: 0.99,
        freshnessHours: 6,
        uptimePercentage: 99.9,
      },
      score: {
        overallScore: 95,
        components: { accuracy: 99, freshness: 95, uptime: 100 },
        tier: 'ANCHOR',
        reasons: [],
      },
      trustScore: 95,
      tier: 'ANCHOR',
      updatedAt: new Date().toISOString(),
      source: 'registry',
      path: ['GLOBAL', 'STATE', 'CA'],
    };

    const verifierAnchor = {
      ...licenseAnchor,
      entityId: 'hhs-oig',
      did: 'did:web:trust.vitalcv/federal/hhs-oig',
      displayName: 'HHS OIG Exclusions',
      jurisdiction: 'US',
      path: ['GLOBAL', 'VERIFIER', 'HHS-OIG'],
    };

    const fakeGraph = {
      resolve: jest.fn().mockImplementation((request) => {
        if (request.kind === 'LICENSE') {
          return [licenseAnchor];
        }
        if (request.kind === 'SANCTIONS') {
          return [verifierAnchor];
        }
        return [];
      }),
    };

    const artifacts = await getTrustArtifactsForManifest(manifest, fakeGraph as any);

    expect(fakeGraph.resolve).toHaveBeenCalledWith({ kind: 'LICENSE', state: 'CA' });
    expect(fakeGraph.resolve).toHaveBeenCalledWith({ kind: 'SANCTIONS', authority: 'OIG' });
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0].anchors[0].displayName).toBe('Medical Board of California');
    expect(artifacts[1].anchors[0].entityId).toBe('hhs-oig');
  });
});
