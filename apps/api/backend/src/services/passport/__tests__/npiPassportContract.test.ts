jest.mock('../../../routes/passport', () => ({
  loadPassportData: jest.fn(),
}));

jest.mock('../../entity/passportService', () => ({
  buildPassportTruth: jest.fn(({ sourceCoverage }) => ({
    identity: {
      kind: 'verification',
      status: 'VERIFIED',
      satisfied: true,
      decisionGrade: true,
      coverage: sourceCoverage.checks[0],
    },
    safety: {
      kind: 'clearance',
      status: 'CLEAR',
      satisfied: true,
      decisionGrade: true,
      coverage: sourceCoverage.checks[1],
    },
    authority: {
      kind: 'verification',
      status: 'VERIFIED',
      satisfied: true,
      decisionGrade: true,
      coverage: sourceCoverage.checks[2],
    },
    eligibility: {
      kind: 'enrollment',
      status: 'ENROLLED',
      satisfied: true,
      decisionGrade: true,
      coverage: sourceCoverage.checks[3],
    },
  })),
  buildPassportTrustPosture: jest.fn(({ readiness }) => ({
    band: readiness.level,
    bandLabel: 'Moderate trust',
    score: readiness.score,
    dimensions: [],
    freshness: {
      state: 'current',
      label: 'Current attached checks',
      items: [],
    },
    safeToRelyOnNow: ['Identity confirmed via CMS NPPES.'],
    missingItems: [],
    gatedItems: [],
    reviewRequiredItems: [],
    staleItems: [],
    blockers: readiness.blockers,
  })),
  buildDecisionPosture: jest.fn(({ readiness }) => ({
    status: readiness.status,
    headline: 'All decision-grade sources checked. Safe to proceed.',
    proven: [],
    missing: [],
    blockers: readiness.blockers,
    freshness: { state: 'current', label: 'Current attached checks', items: [] },
    nextAction: 'Accept as head start and move to privileging.',
  })),
}));

// Profile enrichment reads the DB (NPPES practice-location claim + PersonProfile
// self-attested). This suite is a pure contract-transform test, so stub both
// readers to null — an unclaimed NPI with no self-attested data.
jest.mock('../profileEnrichment', () => ({
  loadPracticeLocationByNpi: jest.fn().mockResolvedValue(null),
  loadSelfReportedByNpi: jest.fn().mockResolvedValue(null),
}));

import { loadPassportData } from '../../../routes/passport';
import { buildPassportDataByNpi } from '../npiPassportContract';

const loadPassportDataMock = loadPassportData as jest.MockedFunction<typeof loadPassportData>;

describe('buildPassportDataByNpi', () => {
  beforeEach(() => {
    loadPassportDataMock.mockReset();
  });

  it('builds the frontend-safe passport contract from legacy NPI passport data', async () => {
    loadPassportDataMock.mockResolvedValue({
      passport: {
        npi: '1234567890',
        accessMode: 'public',
        public: {
          name: 'Ada Lovelace, MD',
          specialty: 'Internal Medicine',
          providerType: 'INDIVIDUAL',
          state: 'CA',
          trustBand: 'GREEN',
          readinessScore: 91,
          totalCredentials: 5,
          activeCredentials: 5,
          shareUrl: 'https://vitalcv.example/p/1234567890',
          embedUrl: 'https://vitalcv.example/api/passport/1234567890/embed.svg',
        },
        credentials: [
          {
            id: 'cred-identity',
            type: 'NPI_IDENTITY',
            name: 'NPI Identity',
            issuer: 'CMS NPPES',
            status: 'ACTIVE',
            verifiedAt: '2026-04-01T00:00:00.000Z',
            expiresAt: null,
            isPublic: true,
          },
          {
            id: 'cred-license',
            type: 'STATE_LICENSE',
            name: 'CA State License',
            issuer: 'California Medical Board',
            status: 'ACTIVE',
            verifiedAt: '2026-04-01T01:00:00.000Z',
            expiresAt: '2027-04-01T01:00:00.000Z',
            isPublic: true,
          },
          {
            id: 'cred-board',
            type: 'BOARD_CERTIFICATION',
            name: 'Internal Medicine Board Certification',
            issuer: 'American Board of Internal Medicine',
            status: 'ACTIVE',
            verifiedAt: '2026-04-01T02:00:00.000Z',
            expiresAt: '2028-04-01T02:00:00.000Z',
            isPublic: true,
          },
          {
            id: 'cred-dea',
            type: 'DEA_REGISTRATION',
            name: 'DEA Registration',
            issuer: 'U.S. Drug Enforcement Administration',
            status: 'ACTIVE',
            verifiedAt: '2026-04-01T03:00:00.000Z',
            expiresAt: '2027-04-01T03:00:00.000Z',
            isPublic: false,
          },
          {
            id: 'cred-pecos',
            type: 'ENROLLMENT',
            name: 'Medicare Enrollment',
            issuer: 'CMS PECOS',
            status: 'ACTIVE',
            verifiedAt: '2026-04-01T04:00:00.000Z',
            expiresAt: null,
            isPublic: true,
          },
        ],
        sanctions: {
          status: 'CLEAR',
          checkedAt: '2026-04-01T05:00:00.000Z',
        },
        privileges: [],
        decisions: [],
        meta: {
          methodology: '243.3',
          computedAt: '2026-04-03T12:00:00.000Z',
          passportVersion: '2.0',
        },
      },
      trust: {
        npi: '1234567890',
        trustBand: 'GREEN',
        readinessScore: 91,
        readinessStatus: 'ready_for_share',
        computedAt: '2026-04-03T12:00:00.000Z',
        shareUrl: 'https://vitalcv.example/p/1234567890',
      },
      trustState: {
        npi: '1234567890',
        identityVerified: true,
        licensureStatus: 'verified',
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        pecosStatus: 'ENROLLED',
        credentialCount: 5,
        readiness_level: 'L2',
        readiness_status: 'ready_for_share',
        readiness_score: 91,
        gap_summary: [],
        methodology_version: '243.3',
        computed_at: '2026-04-03T12:00:00.000Z',
        trustBand: 'L2',
        trustScore: 91,
        facts: [],
        gaps: [],
        computedAt: '2026-04-03T12:00:00.000Z',
      },
    });

    const result = await buildPassportDataByNpi('1234567890');

    expect(loadPassportDataMock).toHaveBeenCalledWith('1234567890');
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      entityId: '1234567890',
      npi: '1234567890',
      identity: {
        displayName: 'Ada Lovelace, MD',
        specialty: 'Internal Medicine',
        entityType: 'PERSON',
        status: 'ACTIVE',
        npi: '1234567890',
      },
      readiness: {
        status: 'READY',
        score: 91,
        level: 'L2',
        blockers: [],
      },
      standing: {
        exclusionStatus: 'CLEAR',
        licensureStatus: 'verified',
        deaStatus: 'registered',
        pecosEnrollmentStatus: 'ENROLLED',
      },
    });

    expect(result?.credentials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATE_LICENSE',
        label: 'CA State License',
        source: 'California Medical Board',
        status: 'ACTIVE',
        timestamp: '2026-04-01T01:00:00.000Z',
      }),
      expect.objectContaining({
        type: 'ENROLLMENT',
        label: 'Medicare Enrollment',
        source: 'CMS PECOS',
        status: 'ACTIVE',
        timestamp: '2026-04-01T04:00:00.000Z',
      }),
    ]));

    expect(result?.authority.credentials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'LICENSURE',
        type: 'STATE_LICENSE',
        issuerName: 'California Medical Board',
        sourceId: 'STATE_BOARD',
        status: 'ACTIVE',
      }),
      expect.objectContaining({
        domain: 'BOARD_CERTIFICATION',
        type: 'BOARD_CERTIFICATION',
        issuerName: 'American Board of Internal Medicine',
      }),
    ]));

    expect(result?.sourceCoverage.checks).toHaveLength(4);
    expect(result?.sourceCoverage.summary.checked).toEqual(expect.arrayContaining([
      'NPPES_API',
      'OIG_LEIE',
      'STATE_BOARD',
      'PECOS_PUBLIC',
    ]));

    for (const credential of result?.credentials ?? []) {
      expect(credential.id).toBeTruthy();
      expect(credential.type).toBeTruthy();
      expect(credential.label).toBeTruthy();
      expect(credential.source).toBeTruthy();
      expect(credential.status).toBeTruthy();
      expect(credential.timestamp).toBeTruthy();
    }
  });
});
