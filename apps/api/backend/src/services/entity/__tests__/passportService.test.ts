jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvCredential: {
      findMany: jest.fn(),
    },
    vcvEducationRecord: {
      findMany: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../entityResolutionService', () => ({
  getEntityById: jest.fn(),
  resolveEntityFromNpi: jest.fn(),
}));

jest.mock('../../trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
}));

jest.mock('../evidenceIntegrity', () => ({
  resolveCredentialEvidence: jest.fn(),
}));

jest.mock('../readinessActions', () => ({
  buildReadinessNextActions: jest.fn(() => []),
}));

jest.mock('../../seal/sealEventCapture', () => ({
  syncBlockerEvents: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import prisma from '../../../graphql/prisma_client';
import { getEntityById } from '../entityResolutionService';
import { getCachedTrustState } from '../../trust/trustStateEngine';
import { resolveCredentialEvidence } from '../evidenceIntegrity';
import { buildPassport } from '../passportService';

const prismaMock = prisma as unknown as {
  vcvCredential: { findMany: jest.Mock };
  vcvEducationRecord: { findMany: jest.Mock };
  verificationArtifact: { findMany: jest.Mock; findFirst: jest.Mock };
};

function buildCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred-1',
    subjectId: 'entity-1',
    issuerId: null,
    domain: 'LICENSURE',
    status: 'ACTIVE',
    credentialType: 'STATE_LICENSE',
    verificationLevel: 'SOURCE_VERIFIED',
    jurisdiction: 'CA',
    issuedAt: null,
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
    observedAt: new Date('2026-03-23T12:00:00.000Z'),
    nextReverifyAt: null,
    metadata: {
      sourceId: 'STATE_BOARD',
      authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
      claimConfidenceLabel: 'HIGH',
      dataFreshnessLabel: 'Weekly',
      sourceScope: 'STATE_BOARD_CA_API',
    },
    claimValue: {
      authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
    },
    artifactIds: [],
    receiptIds: [],
    issuer: null,
    ...overrides,
  };
}

describe('passportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Dr. Ada Lovelace',
        npi: '1234567890',
        entityType: 'PERSON',
        sourceIds: ['NPPES_API'],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          specialty: 'Family Medicine',
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/get-ready',
      subjectLabel: 'Provider',
    });
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential(),
      buildCredential({
        id: 'cred-exclusion',
        domain: 'EXCLUSION_CHECK',
        credentialType: 'OIG_LEIE_CHECK',
        metadata: {
          sourceId: 'OIG_LEIE',
          claimState: 'CLEAR',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Daily',
        },
        claimValue: {
          claimState: 'CLEAR',
        },
      }),
      buildCredential({
        id: 'cred-pecos',
        domain: 'MEDICARE_ENROLLMENT',
        credentialType: 'PECOS_ENROLLMENT',
        metadata: {
          sourceId: 'PECOS_PUBLIC',
          claimState: 'ENROLLED',
          dataVersion: '2026-Q1',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Quarterly',
        },
        claimValue: {
          claimState: 'ENROLLED',
        },
      }),
    ]);
    prismaMock.vcvEducationRecord.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'artifact-nppes',
      rawPayload: {
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Ada',
          last_name: 'Lovelace',
        },
      },
      verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
      observedAt: new Date('2026-03-23T12:00:00.000Z'),
      expiresAt: new Date('2026-03-30T12:00:00.000Z'),
    });
    (resolveCredentialEvidence as jest.Mock).mockReturnValue({
      publicSafe: true,
      validArtifactIds: [],
      validReceiptIds: [],
      issues: [],
    });
  });

  it('inherits trust-state source coverage and omits the old passport enrichment field', async () => {
    const checks = [
      createCanonicalSourceCoverage({
        sourceId: 'NPPES_API',
        state: 'checked',
        reason: 'NPPES identity checked',
        checkedAt: '2026-03-23T12:00:00.000Z',
        observedAt: '2026-03-23T12:00:00.000Z',
        artifactId: 'artifact-nppes',
        sourceUrl: 'https://api.nppes.cms.hhs.gov/api',
        rawArtifactRef: 'artifacts/nppes/entity-1.json',
        checksum: 'sha256:nppes',
        parserVersion: 'nppes@2026.03.23',
        freshnessWindowHours: 168,
        proof: {
          artifactIds: ['artifact-nppes'],
          receiptIds: ['receipt-nppes'],
        },
      }),
      createCanonicalSourceCoverage({
        sourceId: 'OIG_LEIE',
        state: 'checked',
        reason: 'OIG LEIE check clear',
        checkedAt: '2026-03-23T12:00:00.000Z',
        observedAt: '2026-03-23T12:00:00.000Z',
        artifactId: 'artifact-oig',
        sourceUrl: 'https://oig.hhs.gov/exclusions/',
        rawArtifactRef: 'artifacts/oig/entity-1.csv',
        checksum: 'sha256:oig',
        parserVersion: 'oig@2026.03.23',
        freshnessWindowHours: 168,
        proof: {
          artifactIds: ['artifact-oig'],
          receiptIds: ['receipt-oig'],
        },
      }),
      createCanonicalSourceCoverage({
        sourceId: 'STATE_BOARD',
        state: 'accessRequired',
        reason: 'CA physician licensure lane requires checked state-board or FSMB access',
        checkedAt: '2026-03-23T12:00:00.000Z',
        freshnessWindowHours: 168,
        sourceUrl: 'https://www.mbc.ca.gov/',
        parserVersion: 'state-board@2026.03.23',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'stale',
        reason: 'PECOS evidence is stale and must be refreshed',
        checkedAt: '2026-03-23T12:00:00.000Z',
        observedAt: '2025-12-01T12:00:00.000Z',
        artifactId: 'artifact-pecos',
        sourceUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment',
        rawArtifactRef: 'artifacts/pecos/entity-1.csv',
        checksum: 'sha256:pecos',
        parserVersion: 'pecos@2026.03.23',
        freshnessWindowHours: 2160,
        proof: {
          artifactIds: ['artifact-pecos'],
          receiptIds: ['receipt-pecos'],
        },
      }),
    ];
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      licensureStatus: 'pending',
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      readiness_level: 'L1',
      readiness_score: 59,
      gap_summary: ['PECOS enrollment verification stale'],
      blockers: [],
      sourceCoverage: checks,
    });

    const passport = await buildPassport('entity-1');

    expect(passport).not.toBeNull();
    expect(passport?.sourceCoverage.summary).toEqual(summarizeCanonicalSourceCoverage(checks));
    expect(passport?.sourceCoverage.checks).toEqual(
      expect.arrayContaining(
        checks.map((check) => expect.objectContaining({
          sourceId: check.sourceId,
          state: check.state,
          reason: check.reason,
        })),
      ),
    );
    expect(passport?.readiness.gaps).toContain('PECOS enrollment verification stale');
    expect(passport?.trustPosture.band).toBe('L1');
    expect(passport?.trustPosture.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'identity', state: 'current' }),
        expect.objectContaining({ id: 'safety', state: 'current' }),
        expect.objectContaining({ id: 'authority', state: 'gated' }),
        expect.objectContaining({ id: 'eligibility', state: 'stale' }),
      ]),
    );
    expect(passport?.trustPosture.gatedItems).toContain(
      'CA physician licensure lane requires checked state-board or FSMB access',
    );
    expect(passport?.trustPosture.staleItems).toContain('PECOS enrollment verification stale');
    expect(passport?.truth.identity.status).toBe('VERIFIED');
    expect(passport?.truth.safety.status).toBe('CLEAR');
    expect(passport?.truth.authority.status).toBe('ACCESS_REQUIRED');
    expect(passport?.truth.eligibility.status).toBe('PENDING');
    expect(passport?.sourceCoverage.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'NPPES_API',
        observedAt: '2026-03-23T12:00:00.000Z',
        freshness: expect.objectContaining({
          status: 'current',
        }),
        provenance: expect.objectContaining({
          artifactId: expect.any(String),
          artifactIds: expect.any(Array),
        }),
      }),
    ]));
    expect('enrichment' in (passport ?? {})).toBe(false);
  });

  it('prefers NPPES personal identity fields over a stale entity display name', async () => {
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Dr. Sarah Chen',
        npi: '1234567890',
        entityType: 'PERSON',
        sourceIds: ['NPPES_API'],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          specialty: 'Family Medicine',
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/get-ready',
      subjectLabel: 'Provider',
    });
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'artifact-nppes',
      rawPayload: {
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Ardalan',
          last_name: 'Enkeshafi',
        },
      },
    });

    const passport = await buildPassport('entity-1');

    expect(passport?.identity.displayName).toBe('Ardalan Enkeshafi');
  });

  it('uses NPPES organization_name for organization passports', async () => {
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Unknown Organization',
        npi: '1234567890',
        entityType: 'ORGANIZATION',
        sourceIds: ['NPPES_API'],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/employers',
      subjectLabel: 'Organization',
    });
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'artifact-nppes',
      rawPayload: {
        enumeration_type: 'NPI-2',
        basic: {
          organization_name: 'Vital Health Group',
        },
      },
    });

    const passport = await buildPassport('entity-1');

    expect(passport?.identity.displayName).toBe('Vital Health Group');
  });

  it('hydrates specialty from the attached NPPES taxonomy when entity metadata is blank', async () => {
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Unknown Provider',
        npi: '1234567890',
        entityType: 'PERSON',
        sourceIds: ['NPPES_API'],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/get-ready',
      subjectLabel: 'Provider',
    });
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      id: 'artifact-nppes',
      rawPayload: {
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Macie',
          last_name: 'Miller',
        },
        taxonomies: [
          { code: '363LP2300X', desc: 'Primary Care Nurse Practitioner', primary: true },
        ],
      },
      verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
      observedAt: new Date('2026-03-23T12:00:00.000Z'),
      expiresAt: new Date('2026-03-30T12:00:00.000Z'),
    });

    const passport = await buildPassport('entity-1');

    expect(passport?.identity.displayName).toBe('Macie Miller');
    expect(passport?.identity.specialty).toBe('Primary Care Nurse Practitioner');
    expect(passport?.sourceCoverage.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'NPPES_API',
          state: 'checked',
          provenance: expect.objectContaining({
            artifactId: 'artifact-nppes',
            artifactIds: ['artifact-nppes'],
          }),
        }),
      ]),
    );
  });

  it('uses a generic placeholder only when no identity source is available', async () => {
    (getEntityById as jest.Mock).mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Unknown Provider',
        npi: '1234567890',
        entityType: 'PERSON',
        sourceIds: [],
        verifiedAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: {
          status: 'ACTIVE',
        },
      },
      roles: [],
      relationships: [],
      credentials: [],
      routingEntry: '/get-ready',
      subjectLabel: 'Provider',
    });
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);

    const passport = await buildPassport('entity-1');

    expect(passport?.identity.displayName).toBe('Clinician 1234567890');
  });

  it('builds explicit fallback source coverage with freshness windows when trust state is missing', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential({
        id: 'cred-licensure-manual',
        status: 'UNRESOLVED',
        metadata: {
          sourceId: 'STATE_BOARD',
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          participationStatus: 'manual_verification_required',
          claimConfidenceLabel: 'MEDIUM',
          dataFreshnessLabel: 'Weekly',
          sourceScope: 'STATE_BOARD_MANUAL',
        },
        claimValue: {
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
          participationStatus: 'manual_verification_required',
        },
      }),
    ]);
    (getCachedTrustState as jest.Mock).mockResolvedValue(null);

    const passport = await buildPassport('entity-1');
    const stateBoard = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'STATE_BOARD');
    const nppes = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'NPPES_API');
    const pecos = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'PECOS_PUBLIC');

    expect(passport).not.toBeNull();
    expect(stateBoard).toEqual(expect.objectContaining({
      state: 'notDecisionGrade',
      freshnessWindowHours: 168,
      freshness: expect.objectContaining({
        status: 'unknown',
      }),
    }));
    expect(nppes).toEqual(expect.objectContaining({
      state: 'pending',
      freshnessWindowHours: 168,
      freshness: expect.objectContaining({
        status: 'unknown',
      }),
    }));
    expect(pecos).toEqual(expect.objectContaining({
      state: 'pending',
      freshnessWindowHours: 2160,
      freshness: expect.objectContaining({
        status: 'unknown',
      }),
    }));
    expect(passport?.trustPosture.safeToRelyOnNow).toEqual([]);
    expect(passport?.readiness.status).toBe('PARTIAL');
    expect(passport?.readiness.score).toBe(0);
    expect(passport?.readiness.level).toBe('L0');
    expect(passport?.readiness.blockers).toEqual([]);
    expect(passport?.readiness.gaps).toEqual(
      expect.arrayContaining([
        'Missing: EXCLUSION_CHECK',
        'Missing: IDENTITY',
        'Missing: LICENSURE',
      ]),
    );
    expect(passport?.trustPosture.missingItems).toEqual(
      expect.arrayContaining([
        'NPPES identity source not yet checked',
        'State licensure is outside the current production lane and must be verified manually',
        'OIG LEIE source not yet checked',
        'PECOS enrollment source not yet checked',
      ]),
    );
    expect(passport?.trustPosture.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'identity', state: 'missing' }),
        expect.objectContaining({ id: 'authority', state: 'missing' }),
        expect.objectContaining({ id: 'safety', state: 'missing' }),
        expect.objectContaining({ id: 'eligibility', state: 'missing' }),
      ]),
    );
  });

  it('downgrades optimistic NPPES checked coverage when no NPPES artifact is attached', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      licensureStatus: 'unknown',
      exclusionStatus: 'UNCHECKED',
      pecosStatus: 'UNCHECKED',
      readiness_level: 'L3',
      readiness_score: 91,
      gap_summary: [],
      blockers: [],
      sourceCoverage: [
        createCanonicalSourceCoverage({
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'NPPES identity checked',
        }),
      ],
    });

    const passport = await buildPassport('entity-1');
    const nppes = passport?.sourceCoverage.checks.find((check) => check.sourceId === 'NPPES_API');

    expect(nppes).toEqual(expect.objectContaining({
      state: 'pending',
      reason: 'NPPES identity source not yet checked',
    }));
    expect(passport?.truth.identity.status).toBe('PENDING');
    expect(passport?.readiness.score).toBe(0);
  });

  it('surfaces a healthy posture with source-backed claims that are safe to rely on now', async () => {
    const checks = [
      createCanonicalSourceCoverage({
        sourceId: 'NPPES_API',
        state: 'checked',
        reason: 'NPPES identity checked',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'OIG_LEIE',
        state: 'checked',
        reason: 'OIG LEIE check clear',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'STATE_BOARD',
        state: 'checked',
        reason: 'Licensure checked',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'checked',
        reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
      }),
    ];
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      licensureStatus: 'verified',
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      readiness_level: 'L3',
      readiness_score: 91,
      gap_summary: [],
      blockers: [],
      sourceCoverage: checks,
    });

    const passport = await buildPassport('entity-1');

    expect(passport).not.toBeNull();
    expect(passport?.trustPosture.band).toBe('L3');
    expect(passport?.trustPosture.bandLabel).toBe('High trust');
    expect(passport?.trustPosture.safeToRelyOnNow).toEqual(
      expect.arrayContaining([
        'Identity confirmed via CMS NPPES.',
        'OIG/LEIE exclusion check is clear.',
        'Active state licensure is verified from a source-backed authority check.',
        'CMS PECOS shows Medicare enrollment (2026-Q1).',
      ]),
    );
    expect(passport?.trustPosture.blockers).toEqual([]);
    expect(passport?.trustPosture.freshness.state).toBe('current');
  });

  it('explains review-required safety states when exclusion returns a possible match', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential(),
      buildCredential({
        id: 'cred-exclusion-review',
        domain: 'EXCLUSION_CHECK',
        credentialType: 'OIG_LEIE_CHECK',
        metadata: {
          sourceId: 'OIG_LEIE',
          claimState: 'POSSIBLE_MATCH',
          claimConfidenceLabel: 'MEDIUM',
          dataFreshnessLabel: 'Daily',
        },
        claimValue: {
          claimState: 'POSSIBLE_MATCH',
        },
      }),
      buildCredential({
        id: 'cred-pecos',
        domain: 'MEDICARE_ENROLLMENT',
        credentialType: 'PECOS_ENROLLMENT',
        metadata: {
          sourceId: 'PECOS_PUBLIC',
          claimState: 'ENROLLED',
          dataVersion: '2026-Q1',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Quarterly',
        },
        claimValue: {
          claimState: 'ENROLLED',
        },
      }),
    ]);
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      licensureStatus: 'verified',
      exclusionStatus: 'POSSIBLE_MATCH',
      pecosStatus: 'ENROLLED',
      readiness_level: 'L1',
      readiness_score: 52,
      gap_summary: [],
      blockers: [],
      sourceCoverage: [
        createCanonicalSourceCoverage({
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'NPPES identity checked',
        }),
        createCanonicalSourceCoverage({
          sourceId: 'OIG_LEIE',
          state: 'reviewRequired',
          reason: 'OIG LEIE returned a possible match and requires human adjudication',
        }),
        createCanonicalSourceCoverage({
          sourceId: 'STATE_BOARD',
          state: 'checked',
          reason: 'Licensure checked',
        }),
        createCanonicalSourceCoverage({
          sourceId: 'PECOS_PUBLIC',
          state: 'checked',
          reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
        }),
      ],
    });

    const passport = await buildPassport('entity-1');

    expect(passport).not.toBeNull();
    expect(passport?.trustPosture.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'safety',
          state: 'review_required',
        }),
      ]),
    );
    expect(passport?.trustPosture.reviewRequiredItems).toContain(
      'OIG LEIE returned a possible match and requires human adjudication',
    );
    expect(passport?.readiness.status).toBe('PARTIAL');
    expect(passport?.readiness.blockers).toEqual([]);
    expect(passport?.readiness.gaps).toContain('OIG/LEIE possible match requires review');
  });

  it('withholds unbacked credentials from public-safe passport truth and readiness', async () => {
    prismaMock.vcvCredential.findMany.mockResolvedValue([
      buildCredential({
        id: 'cred-licensure-unbacked',
      }),
      buildCredential({
        id: 'cred-exclusion',
        domain: 'EXCLUSION_CHECK',
        credentialType: 'OIG_LEIE_CHECK',
        metadata: {
          sourceId: 'OIG_LEIE',
          claimState: 'CLEAR',
          claimConfidenceLabel: 'HIGH',
          dataFreshnessLabel: 'Daily',
        },
        claimValue: {
          claimState: 'CLEAR',
        },
      }),
    ]);
    (resolveCredentialEvidence as jest.Mock).mockImplementation(({ credential }: { credential: { id: string } }) => (
      credential.id === 'cred-licensure-unbacked'
        ? {
            publicSafe: false,
            validArtifactIds: [],
            validReceiptIds: [],
            issues: ['missing_receipt'],
          }
        : {
            publicSafe: true,
            validArtifactIds: [],
            validReceiptIds: [],
            issues: [],
          }
    ));
    (getCachedTrustState as jest.Mock).mockResolvedValue(null);

    const passport = await buildPassport('entity-1');

    expect(passport).not.toBeNull();
    expect(passport?.authority.credentials).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ id: 'cred-licensure-unbacked' }),
      ]),
    );
    expect(passport?.authority.summary.active).toBe(0);
    expect(passport?.readiness.blockers).toContain('Proof missing: LICENSURE');
    expect(passport?.truth.authority.status).not.toBe('VERIFIED');
    expect(passport?.trustPosture.safeToRelyOnNow).not.toContain(
      'Active state licensure is verified from a source-backed authority check.',
    );
  });
});
