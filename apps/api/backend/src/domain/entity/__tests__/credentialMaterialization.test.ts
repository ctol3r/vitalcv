/**
 * credentialMaterialization.test.ts
 *
 * Tests for the claim → VcvCredential materialization path.
 * Uses mocked Prisma and real mapping logic.
 * Does NOT require a live database.
 */

import {
  upsertVcvCredential,
  materializeCredentials,
} from '../../../services/entity/upsertVcvCredential';
import type { NormalizedClaim } from '../../../services/identity/evidenceModel';

// ── Prisma mock ────────────────────────────────────────────────────────────────

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvCredential: {
      findFirst: jest.fn(),
      create:    jest.fn(),
      update:    jest.fn(),
    },
    vcvEntity: {
      findFirst: jest.fn().mockResolvedValue(null), // no issuer in cache
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeClaim(overrides: Partial<NormalizedClaim> = {}): NormalizedClaim {
  return {
    claimId:         'claim-abc-123',
    claimType:       'LICENSE',
    sourceId:        'NPPES_API',
    artifactId:      'artifact-xyz',
    subjectNpi:      '1234567890',
    tier:            'GOLD',
    confidence:      'HIGH',
    confidenceScore: 0.95,
    status:          'ACTIVE',
    reviewRequired:  false,
    observedAt:      '2026-03-22T18:00:00.000Z',
    value: {
      _type:         'LICENSE',
      licenseState:  'CA',
      licenseType:   'MD',
      licenseStatus: 'ACTIVE',
      licenseNumber: 'G12345',
    },
    ...overrides,
  } as unknown as NormalizedClaim;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('upsertVcvCredential', () => {

  beforeEach(() => jest.clearAllMocks());

  it('returns null for claims with no domain mapping', async () => {
    const claim = makeClaim({ claimType: 'PUBLICATION' as NormalizedClaim['claimType'] });
    const result = await upsertVcvCredential(claim, 'entity-1');
    expect(result).toBeNull();
  });

  it('creates a credential when no existing claimId match', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-new-1' });

    const claim = makeClaim();
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result).not.toBeNull();
    expect(result?.action).toBe('created');
    expect(result?.domain).toBe('LICENSURE');
    expect(mockPrisma.vcvCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subjectId:      'entity-1',
          domain:         'LICENSURE',
          credentialType: 'MD_CA',
          status:         'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          jurisdiction:   'CA',
          claimId:        'claim-abc-123',
        }),
      }),
    );
  });

  it('updates an existing credential when claimId matches', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue({ id: 'cred-existing-1' });
    (mockPrisma.vcvCredential.update as jest.Mock).mockResolvedValue({ id: 'cred-existing-1' });

    const claim = makeClaim();
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result?.action).toBe('updated');
    expect(result?.credentialId).toBe('cred-existing-1');
    expect(mockPrisma.vcvCredential.update).toHaveBeenCalled();
    expect(mockPrisma.vcvCredential.create).not.toHaveBeenCalled();
  });

  it('maps EXCLUSION_STATUS → EXCLUSION_CHECK domain', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-excl-1' });

    const claim = makeClaim({
      claimType: 'EXCLUSION_STATUS',
      value: { _type: 'EXCLUSION_STATUS', excluded: false, matchType: 'NO_MATCH', source: 'OIG_LEIE', exclusionType: null, exclusionDate: null, reinstatementDate: null, waiverState: null } as unknown as NormalizedClaim['value'],
    });
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result?.domain).toBe('EXCLUSION_CHECK');
    expect(mockPrisma.vcvCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain:         'EXCLUSION_CHECK',
          credentialType: 'OIG_LEIE_EXCLUSION_CHECK',
        }),
      }),
    );
  });

  it('marks OIG uncertain result as REVIEW_REQUIRED', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-unc-1' });

    const claim = makeClaim({
      claimType:      'EXCLUSION_STATUS',
      confidence:     'UNCERTAIN',
      confidenceScore: 0.3,
      reviewRequired: true,
      value: { _type: 'EXCLUSION_STATUS', excluded: false, matchType: 'NO_MATCH', source: 'OIG_LEIE', exclusionType: null, exclusionDate: null, reinstatementDate: null, waiverState: null } as unknown as NormalizedClaim['value'],
    });
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result?.domain).toBe('EXCLUSION_CHECK');
    expect(mockPrisma.vcvCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REVIEW_REQUIRED',
        }),
      }),
    );
  });

  it('maps ENROLLMENT_STATUS → MEDICARE_ENROLLMENT domain', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-enrl-1' });

    const claim = makeClaim({
      claimType: 'ENROLLMENT_STATUS',
      value: {
        _type: 'ENROLLMENT_STATUS', enrolled: true,
        enrollmentType: 'INDIVIDUAL', eligibleToOrderRefer: true,
        source: 'PECOS',
      },
    });
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result?.domain).toBe('MEDICARE_ENROLLMENT');
  });

  it('maps NPI_IDENTITY → IDENTITY domain', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-id-1' });

    const claim = makeClaim({
      claimType: 'NPI_IDENTITY',
      value: {
        _type: 'NPI_IDENTITY', npi: '1234567890', enumerationType: 'NPI-1',
        enumerationDate: '2010-01-01', lastUpdated: '2026-01-01',
        status: 'A', credential: [],
      } as unknown as NormalizedClaim['value'],
    });
    const result = await upsertVcvCredential(claim, 'entity-1');

    expect(result?.domain).toBe('IDENTITY');
    expect(result?.action).toBe('created');
  });

  it('assigns SOURCE_VERIFIED level for GOLD tier + high confidence', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);

    let capturedData: Record<string, unknown> = {};
    (mockPrisma.vcvCredential.create as jest.Mock).mockImplementation(({ data }) => {
      capturedData = data as Record<string, unknown>;
      return Promise.resolve({ id: 'cred-level-1' });
    });

    const claim = makeClaim({ tier: 'GOLD', confidenceScore: 0.97 });
    await upsertVcvCredential(claim, 'entity-1');

    expect(capturedData['verificationLevel']).toBe('SOURCE_VERIFIED');
  });

  it('assigns SOURCE_MATCHED for GOLD tier + medium confidence', async () => {
    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);

    let capturedData: Record<string, unknown> = {};
    (mockPrisma.vcvCredential.create as jest.Mock).mockImplementation(({ data }) => {
      capturedData = data as Record<string, unknown>;
      return Promise.resolve({ id: 'cred-level-2' });
    });

    const claim = makeClaim({ tier: 'GOLD', confidenceScore: 0.7 });
    await upsertVcvCredential(claim, 'entity-1');

    expect(capturedData['verificationLevel']).toBe('SOURCE_MATCHED');
  });
});

describe('materializeCredentials', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns correct counts for mixed claim set', async () => {
    // Mappable: LICENSE, EXCLUSION_STATUS, ENROLLMENT_STATUS, NPI_IDENTITY
    // Non-mappable: PUBLICATION, SPECIALTY
    const claims = [
      makeClaim({ claimType: 'LICENSE',           claimId: 'c1' }),
      makeClaim({ claimType: 'EXCLUSION_STATUS',  claimId: 'c2' }),
      makeClaim({ claimType: 'ENROLLMENT_STATUS', claimId: 'c3' }),
      makeClaim({ claimType: 'NPI_IDENTITY',      claimId: 'c4' }),
      makeClaim({ claimType: 'PUBLICATION' as NormalizedClaim['claimType'], claimId: 'c5' }),
      makeClaim({ claimType: 'SPECIALTY'   as NormalizedClaim['claimType'], claimId: 'c6' }),
    ];

    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.vcvCredential.create as jest.Mock).mockResolvedValue({ id: 'cred-x' });

    const result = await materializeCredentials(claims, 'entity-1');

    expect(result.created).toBe(4);  // LICENSE + EXCLUSION + ENROLLMENT + NPI_IDENTITY
    expect(result.skipped).toBe(2);  // PUBLICATION + SPECIALTY
    expect(result.updated).toBe(0);
  });

  it('counts updates correctly when credentials exist', async () => {
    const claims = [
      makeClaim({ claimType: 'LICENSE', claimId: 'c-existing' }),
    ];

    (mockPrisma.vcvCredential.findFirst as jest.Mock).mockResolvedValue({ id: 'cred-existing' });
    (mockPrisma.vcvCredential.update as jest.Mock).mockResolvedValue({ id: 'cred-existing' });

    const result = await materializeCredentials(claims, 'entity-1');

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });
});
