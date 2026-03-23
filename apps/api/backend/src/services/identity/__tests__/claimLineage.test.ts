import type { NormalizedClaim } from '../evidenceModel';
import { compareClaimSnapshots } from '../identityIngestionPipeline';

function makeSpecialtyClaim(input: {
  claimId: string;
  taxonomyCode: string;
  taxonomyDescription: string;
  state: string;
  licenseNumber: string;
}): NormalizedClaim {
  return {
    claimId: input.claimId,
    claimType: 'SPECIALTY',
    subjectNpi: '1234567890',
    value: {
      _type: 'SPECIALTY',
      taxonomyCode: input.taxonomyCode,
      taxonomyDescription: input.taxonomyDescription,
      isPrimary: true,
      state: input.state,
      licenseNumber: input.licenseNumber,
    },
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.95,
    sourceId: 'NPPES_API',
    artifactId: 'artifact-1',
    artifactChecksum: 'checksum-1',
    parserVersion: 'parser-v1',
    derivedAt: '2026-03-23T12:05:00.000Z',
    observedAt: '2026-03-23T12:00:00.000Z',
    validFrom: null,
    validUntil: null,
    expiresAt: null,
    status: 'ACTIVE',
    supersededBy: null,
    supersedes: null,
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
  };
}

describe('compareClaimSnapshots', () => {
  it('supersedes within a claim family without expiring unrelated same-type claims', () => {
    const priorLicenseFamily = makeSpecialtyClaim({
      claimId: 'claim-prior-1',
      taxonomyCode: '207Q00000X',
      taxonomyDescription: 'Family Medicine',
      state: 'CA',
      licenseNumber: 'LIC-1',
    });
    const priorOtherFamily = makeSpecialtyClaim({
      claimId: 'claim-prior-2',
      taxonomyCode: '208D00000X',
      taxonomyDescription: 'General Practice',
      state: 'NY',
      licenseNumber: 'LIC-2',
    });
    const nextLicenseFamily = makeSpecialtyClaim({
      claimId: 'claim-next-1',
      taxonomyCode: '207Q00000X',
      taxonomyDescription: 'Family Medicine and Sports Medicine',
      state: 'CA',
      licenseNumber: 'LIC-1',
    });
    const nextOtherFamily = {
      ...priorOtherFamily,
    };

    const result = compareClaimSnapshots({
      priorClaims: [priorLicenseFamily, priorOtherFamily],
      newClaims: [nextLicenseFamily, nextOtherFamily],
      observedAt: '2026-03-23T12:30:00.000Z',
      matchingStrategy: 'NPI_EXACT',
    });

    expect(result.claims.find((claim) => claim.claimId === 'claim-next-1')?.supersedes).toBe('claim-prior-1');
    expect(result.transitions).toEqual([
      {
        claimId: 'claim-prior-1',
        status: 'SUPERSEDED',
        supersededByClaimId: 'claim-next-1',
        expiresAt: '2026-03-23T12:30:00.000Z',
      },
    ]);
    expect(result.deltaEvents).toEqual([
      expect.objectContaining({
        type: 'CLAIM_CHANGED',
        previousClaimId: 'claim-prior-1',
        currentClaimId: 'claim-next-1',
      }),
    ]);
    expect(result.deltaEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          previousClaimId: 'claim-prior-2',
          type: 'CLAIM_EXPIRED',
        }),
      ]),
    );
  });
});
