jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { fetchFsmbClaims } from '../fsmbClaimMapper';

describe('fetchFsmbClaims', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FSMB_ENABLED = 'true';
    delete process.env.FSMB_API_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.FSMB_ENABLED;
    delete process.env.FSMB_API_KEY;
  });

  it('emits explicit unavailable authority claims when FSMB is enabled without credentials', async () => {
    const result = await fetchFsmbClaims('1234567890', '2026-03-23T16:00:00.000Z');

    expect(result.sourced).toBe(true);
    expect(result.claims.length).toBeGreaterThan(0);
    expect(result.claims.every((claim) => Boolean(claim.artifactId))).toBe(true);
    expect(result.claims.every((claim) => claim.claimType === 'AUTHORITY_UNAVAILABLE')).toBe(true);
    expect(result.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claimType: 'AUTHORITY_UNAVAILABLE',
        value: expect.objectContaining({
          sourceScope: 'FSMB_MED_API',
          connectorState: 'unavailable',
          authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
        }),
      }),
      expect.objectContaining({
        claimType: 'AUTHORITY_UNAVAILABLE',
        value: expect.objectContaining({
          sourceScope: 'FSMB_TRAINING',
          connectorState: 'unavailable',
        }),
      }),
    ]));
  });

  it('maps board orders, certifications, and training with explicit FSMB scopes', async () => {
    process.env.FSMB_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        medicalLicenses: [
          {
            state: 'CA',
            licenseNumber: 'CA-1234',
            status: 'ACTIVE',
            issueDate: '2024-01-01T00:00:00.000Z',
            expirationDate: '2027-01-01T00:00:00.000Z',
            disciplinaryActions: [
              {
                description: 'Summary suspension order',
                severity: 'HIGH',
                effectiveDate: '2026-01-15T00:00:00.000Z',
              },
            ],
          },
        ],
        boardCertifications: [
          {
            certifyingBoard: 'ABIM',
            specialty: 'Internal Medicine',
            certificationStatus: 'CERTIFIED',
            issueDate: '2022-01-01T00:00:00.000Z',
            expirationDate: '2032-01-01T00:00:00.000Z',
          },
        ],
        training: [
          {
            programName: 'Residency Program',
            institution: 'Teaching Hospital',
            specialty: 'Internal Medicine',
            trainingType: 'Residency',
            completionDate: '2023-06-30T00:00:00.000Z',
          },
        ],
      }),
    }) as typeof fetch;

    const result = await fetchFsmbClaims('1234567890', '2026-03-23T16:00:00.000Z');

    expect(result.sourced).toBe(true);
    expect(result.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        claimType: 'LICENSE_DISCIPLINE',
        status: 'BLOCKED',
        value: expect.objectContaining({
          authorityClaimCode: 'BOARD_ORDER_PRESENT',
          sourceScope: 'FSMB_PDC',
          boardOrderSeverity: 'HIGH',
        }),
      }),
      expect.objectContaining({
        claimType: 'BOARD_CERTIFICATION',
        value: expect.objectContaining({
          authorityClaimCode: 'BOARD_CERTIFIED',
          sourceScope: 'FSMB_ABMS_INCLUDED',
        }),
      }),
      expect.objectContaining({
        claimType: 'TRAINING_COMPLETION',
        value: expect.objectContaining({
          authorityClaimCode: 'TRAINING_COMPLETED',
          sourceScope: 'FSMB_TRAINING',
          programName: 'Residency Program',
        }),
      }),
    ]));
  });
});
