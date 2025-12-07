import { buildLicenseProof } from '../licenseProofBuilder';
import { buildPrivilegeProof } from '../privilegeProofBuilder';
import { buildEnrollmentProof } from '../enrollmentProofBuilder';

const TEST_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  d: 'nWGxne/9WmT5g2AKb5PgrY2o9zc3h2mJCu+Y927wrcA',
  x: '11qYAYLefDp3E3EfrBz-0zg1Q0b5afZ7Y2h1f4rFo8g',
  alg: 'EdDSA',
  kid: 'test-key',
};

jest.mock('../../../identity/signingKeyProvider', () => ({
  getActiveSigningKey: jest.fn().mockResolvedValue({
    kid: TEST_JWK.kid,
    jwk: TEST_JWK,
  }),
}));

describe('NCI proof builders', () => {
  it('builds license proof envelope', async () => {
    const proof = await buildLicenseProof({
      clinicianDid: 'did:example:123',
      licenses: [
        {
          state: 'CA',
          licenseNumber: 'A123',
          status: 'ACTIVE',
          issueDate: '2020-01-01T00:00:00Z',
          expiryDate: '2026-01-01T00:00:00Z',
          disciplinaryFlag: false,
        },
      ],
    });

    expect(proof).toBeTruthy();
    expect(proof?.type).toBe('NCI_LICENSE_VERIFICATION');
    expect(proof?.digest.value).toBeDefined();
  });

  it('builds privilege proof envelope', async () => {
    const proof = await buildPrivilegeProof({
      clinicianDid: 'did:example:123',
      grants: [
        {
          id: 'priv-1',
          privilegeSetId: 'set-1',
          privilegeCodes: ['CARD-CATH'],
          status: 'ACTIVE',
          grantedAt: null,
          expiresAt: null,
          renewalDue: null,
          dependencySatisfied: true,
          missingDependencies: [],
        },
      ],
    });

    expect(proof).toBeTruthy();
    expect(proof?.type).toBe('NCI_PRIVILEGE_VERIFICATION');
  });

  it('builds enrollment proof envelope', async () => {
    const proof = await buildEnrollmentProof({
      clinicianDid: 'did:example:123',
      enrollments: [
        {
          id: 'enroll-1',
          payerId: 'payer-1',
          payerName: 'Payer',
          status: 'ACTIVE',
          states: ['CA'],
          specialties: [],
          panelType: 'PAR',
          effectiveDate: '2022-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          lastStatusChange: '2024-12-15T00:00:00Z',
          metadata: null,
        },
      ],
    });

    expect(proof).toBeTruthy();
    expect(proof?.type).toBe('NCI_ENROLLMENT_VERIFICATION');
  });
});

