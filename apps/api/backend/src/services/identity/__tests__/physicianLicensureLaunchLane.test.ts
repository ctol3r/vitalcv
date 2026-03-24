import type { NormalizedClaim } from '../evidenceModel';
import {
  PHYSICIAN_LICENSURE_LAUNCH_STATE,
  resolvePhysicianLicensureLaunchLane,
} from '../physicianLicensureLaunchLane';

function makeFsmbLicenseClaim(state: string): NormalizedClaim {
  return {
    claimId: `claim-${state.toLowerCase()}`,
    claimType: 'LICENSE',
    sourceId: 'FSMB',
    artifactId: `artifact-${state.toLowerCase()}`,
    artifactChecksum: `checksum-${state.toLowerCase()}`,
    parserVersion: 'fsmb-claim-mapper/v2',
    subjectNpi: '1234567890',
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.95,
    status: 'ACTIVE',
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
    observedAt: '2026-03-24T12:00:00.000Z',
    derivedAt: '2026-03-24T12:00:00.000Z',
    validFrom: '2026-03-24T12:00:00.000Z',
    validUntil: '2027-03-24T12:00:00.000Z',
    expiresAt: '2027-03-24T12:00:00.000Z',
    supersededBy: null,
    supersedes: null,
    value: {
      _type: 'LICENSE',
      state,
      licenseNumber: `${state}-12345`,
      issueDate: '2024-01-01T00:00:00.000Z',
      expiryDate: '2027-03-24T12:00:00.000Z',
      licenseStatus: 'ACTIVE',
      disciplinaryActions: [],
      source: 'FSMB',
      authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
      sourceScope: 'FSMB_MED_API',
      issuerEntityId: 'authority:fsmb',
      effectiveAt: '2024-01-01T00:00:00.000Z',
      verifiedAt: '2026-03-24T12:00:00.000Z',
      confidenceLabel: 'Confirmed',
      dataFreshness: 'Updated weekly',
      participationStatus: 'verified_result',
      boardOrderSeverity: 'NONE',
      connectorState: 'connected',
    },
  };
}

describe('resolvePhysicianLicensureLaunchLane', () => {
  it('uses the live CA state-board lane when available', async () => {
    const result = await resolvePhysicianLicensureLaunchLane({
      npi: '1234567890',
      observedAt: '2026-03-24T12:00:00.000Z',
      candidateStates: [PHYSICIAN_LICENSURE_LAUNCH_STATE],
      stateBoardLookup: async () => ({
        npi: '1234567890',
        state: 'CA',
        licenseNumber: 'CA-7788',
        licenseStatus: 'ACTIVE',
        licensee: 'Dr Example',
        expirationDate: '2027-04-01T00:00:00.000Z',
        boardName: 'Medical Board of California',
        lastVerifiedAt: '2026-03-24T12:00:00.000Z',
        sourceUrl: 'https://mbc.ca.gov/breeze/',
      }),
    });

    expect(result.route).toBe('state_board');
    expect(result.launchState).toBe('CA');
    expect(result.claims).toEqual([
      expect.objectContaining({
        claimType: 'LICENSE',
        sourceId: 'STATE_BOARD',
        status: 'ACTIVE',
        value: expect.objectContaining({
          state: 'CA',
          sourceScope: 'STATE_BOARD_CA_API',
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
        }),
      }),
    ]);
  });

  it('falls back to FSMB for the CA launch state when the state-board lane is unavailable', async () => {
    const result = await resolvePhysicianLicensureLaunchLane({
      npi: '1234567890',
      observedAt: '2026-03-24T12:00:00.000Z',
      candidateStates: ['TX', PHYSICIAN_LICENSURE_LAUNCH_STATE],
      stateBoardLookup: async () => ({
        npi: '1234567890',
        state: 'CA',
        licenseNumber: null,
        licenseStatus: 'NOT_AVAILABLE',
        licensee: null,
        expirationDate: null,
        boardName: 'Medical Board of California',
        lastVerifiedAt: '2026-03-24T12:00:00.000Z',
        sourceUrl: 'https://mbc.ca.gov/breeze/',
      }),
      fsmbClaimFetcher: async () => ({
        claims: [
          makeFsmbLicenseClaim('TX'),
          makeFsmbLicenseClaim('CA'),
        ],
        sourced: true,
        fetchedAt: '2026-03-24T12:00:00.000Z',
      }),
    });

    expect(result.route).toBe('fsmb');
    expect(result.launchState).toBe('CA');
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0]).toMatchObject({
      sourceId: 'FSMB',
      value: expect.objectContaining({
        state: 'CA',
        sourceScope: 'FSMB_MED_API',
      }),
    });
  });

  it('returns an honest manual-only claim for unsupported states', async () => {
    const result = await resolvePhysicianLicensureLaunchLane({
      npi: '1234567890',
      observedAt: '2026-03-24T12:00:00.000Z',
      candidateStates: ['TX'],
    });

    expect(result.route).toBe('unsupported');
    expect(result.launchState).toBeNull();
    expect(result.claims).toEqual([
      expect.objectContaining({
        claimType: 'AUTHORITY_UNAVAILABLE',
        sourceId: 'STATE_BOARD',
        value: expect.objectContaining({
          jurisdiction: 'TX',
          sourceScope: 'STATE_BOARD_MANUAL',
          participationStatus: 'manual_verification_required',
        }),
      }),
    ]);
  });
});
