jest.mock('../../nursysAdapter', () => ({
  queryNursysLicense: jest.fn(),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { queryNursysLicense } from '../../nursysAdapter';
import { fetchNursysClaim } from '../nursysClaimMapper';

const queryNursysLicenseMock = queryNursysLicense as jest.MockedFunction<typeof queryNursysLicense>;

describe('fetchNursysClaim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits an explicit authority-unavailable claim for an unavailable authorized path', async () => {
    queryNursysLicenseMock.mockResolvedValue({
      licenseStatus: 'LICENSE_NOT_AVAILABLE_FOR_STATE',
      jurisdiction: 'CA',
      lastUpdated: '2026-03-23T16:00:00.000Z',
      expirationDate: null,
      sourceUrl: 'https://www.nursys.com/',
      sourceQueriedAt: '2026-03-23T16:00:00.000Z',
      participationStatus: 'non_participating_state',
      disciplineFlag: false,
      connectorState: 'unavailable',
      issuerEntityId: 'authority:nursys',
      sourceScope: 'NURSYS_AUTHORIZED_PATH',
      effectiveAt: null,
      verifiedAt: '2026-03-23T16:00:00.000Z',
      confidenceLabel: 'Authority unavailable',
      dataFreshness: 'Freshness unavailable',
      unavailableReason: 'CA does not participate in Nursys E-Notify.',
    });

    const claim = await fetchNursysClaim('1234567890', '2026-03-23T16:00:00.000Z');

    expect(claim).not.toBeNull();
    expect(claim?.claimType).toBe('AUTHORITY_UNAVAILABLE');
    expect(claim?.artifactId).toContain('nursys-authority');
    expect(claim?.status).toBe('UNVERIFIED');
    expect(claim?.value).toEqual(expect.objectContaining({
      authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
      sourceScope: 'NURSYS_AUTHORIZED_PATH',
      connectorState: 'unavailable',
      participationStatus: 'non_participating_state',
      reason: 'CA does not participate in Nursys E-Notify.',
    }));
  });

  it('maps a disciplined nurse result into an authority-backed discipline claim', async () => {
    queryNursysLicenseMock.mockResolvedValue({
      licenseStatus: 'SUSPENDED',
      jurisdiction: 'TX',
      lastUpdated: '2026-03-23T16:00:00.000Z',
      expirationDate: '2027-01-01T00:00:00.000Z',
      sourceUrl: 'https://www.nursys.com/',
      sourceQueriedAt: '2026-03-23T16:00:00.000Z',
      participationStatus: 'verified_result',
      disciplineFlag: true,
      connectorState: 'connected',
      issuerEntityId: 'authority:nursys',
      sourceScope: 'NURSYS_AUTHORIZED_PATH',
      effectiveAt: '2024-01-01T00:00:00.000Z',
      verifiedAt: '2026-03-23T16:00:00.000Z',
      confidenceLabel: 'Confirmed',
      dataFreshness: 'Updated in real-time',
    });

    const claim = await fetchNursysClaim('1234567890', '2026-03-23T16:00:00.000Z');

    expect(claim).not.toBeNull();
    expect(claim?.claimType).toBe('NURSING_DISCIPLINE');
    expect(claim?.status).toBe('BLOCKED');
    expect(claim?.reviewRequired).toBe(true);
    expect(claim?.artifactId).toContain('nursing_discipline');
    expect(claim?.value).toEqual(expect.objectContaining({
      authorityClaimCode: 'RN_LICENSE_DISCIPLINED',
      sourceScope: 'NURSYS_AUTHORIZED_PATH',
      connectorState: 'connected',
      participationStatus: 'verified_result',
      state: 'TX',
    }));
  });
});
