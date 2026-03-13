import request from 'supertest';
import app from '../../apps/api/backend/src/app';
import { InMemoryTrustRegistryRepository } from '../../apps/api/backend/repositories/trustRegistry.repo';
import { issueCredential } from '../../apps/api/backend/src/services/credentials/credentialIssuer';
import {
  removeCredential,
  storeCredential,
} from '../../apps/api/backend/src/services/credentials/credentialWallet';
import type { VerifiableCredential } from '../../apps/api/backend/src/services/credentials/credentialModel';
import {
  initializeTrustRegistryPersistence,
  registerIssuer,
  resetTrustRegistryRepository,
  setTrustRegistryRepository,
  type TrustedIssuer,
} from '../../apps/api/backend/src/services/registry/trustRegistry';
import { TEST_ORG_ID, TEST_PRIVATE_KEY_PEM, TEST_PUBLIC_KEY_PEM } from '../fixtures/issuer';

interface BundleVerificationDetail {
  credentialId: string;
  credentialType: string;
  issuer: string;
  valid: boolean;
  reason?: string;
}

function buildIssuer(params: {
  issuerId: string;
  issuerName: string;
  trustLevel: TrustedIssuer['trustLevel'];
  trustScore: number;
}): TrustedIssuer {
  return {
    issuerId: params.issuerId,
    issuerName: params.issuerName,
    publicKey: TEST_PUBLIC_KEY_PEM,
    trustLevel: params.trustLevel,
    status: 'ACTIVE',
    registeredAt: '2026-03-07T00:00:00.000Z',
    trustScore: params.trustScore,
    algorithmPolicy: ['ES256'],
    haipCompliant: true,
    assuranceProfile: 'IAL2',
  };
}

function tamperCompactJws(jwt: string): string {
  const segments = jwt.split('.');
  if (segments.length !== 3) {
    throw new Error('Expected compact JWS with three segments');
  }

  const signature = segments[2];
  const index = Math.max(0, Math.floor(signature.length / 2));
  const current = signature[index] ?? 'a';
  const replacement = current === 'a' ? 'b' : 'a';
  segments[2] = `${signature.slice(0, index)}${replacement}${signature.slice(index + 1)}`;

  return segments.join('.');
}

describe('Wave CX-145 payer verification', () => {
  const storedCredentialIds: string[] = [];
  const authoritativeIssuer = buildIssuer({
    issuerId: 'did:vitalcv:issuer:cx145-authoritative',
    issuerName: 'CX-145 Authoritative Issuer',
    trustLevel: 'AUTHORITATIVE',
    trustScore: 95,
  });
  const provisionalIssuer = buildIssuer({
    issuerId: 'did:vitalcv:issuer:cx145-provisional',
    issuerName: 'CX-145 Provisional Issuer',
    trustLevel: 'PROVISIONAL',
    trustScore: 45,
  });

  const eligibleNpi = '8111111111';
  const reviewNpi = '8222222222';
  const bundleNpi = '8333333333';
  const foreignNpi = '8444444444';

  let bundleValidCredential!: VerifiableCredential;
  let bundleTamperedCredential!: VerifiableCredential;
  let bundleForeignCredential!: VerifiableCredential;

  async function issueAndStoreCredential(params: {
    issuer: string;
    subject: string;
    claims: Record<string, unknown>;
  }): Promise<VerifiableCredential> {
    const credential = await issueCredential(
      {
        issuer: params.issuer,
        subject: params.subject,
        claims: params.claims,
      },
      TEST_PRIVATE_KEY_PEM,
    );
    storeCredential(credential);
    storedCredentialIds.push(credential.credentialId);
    return credential;
  }

  beforeAll(async () => {
    setTrustRegistryRepository(new InMemoryTrustRegistryRepository());
    await initializeTrustRegistryPersistence();
    await registerIssuer(authoritativeIssuer);
    await registerIssuer(provisionalIssuer);

    await issueAndStoreCredential({
      issuer: authoritativeIssuer.issuerId,
      subject: eligibleNpi,
      claims: {
        type: 'MedicalLicense',
        licenseNumber: 'CX145-ELIGIBLE-LICENSE',
      },
    });
    await issueAndStoreCredential({
      issuer: authoritativeIssuer.issuerId,
      subject: eligibleNpi,
      claims: {
        type: 'BoardCertification',
        board: 'ABIM',
      },
    });

    await issueAndStoreCredential({
      issuer: authoritativeIssuer.issuerId,
      subject: reviewNpi,
      claims: {
        type: 'BoardCertification',
        board: 'ABMS',
      },
    });
    await issueAndStoreCredential({
      issuer: provisionalIssuer.issuerId,
      subject: reviewNpi,
      claims: {
        type: 'MedicalLicense',
        licenseNumber: 'CX145-REVIEW-LICENSE',
      },
    });

    bundleValidCredential = await issueAndStoreCredential({
      issuer: authoritativeIssuer.issuerId,
      subject: bundleNpi,
      claims: {
        type: 'PayerEnrollment',
        payerId: 'payer:unitedhealth',
      },
    });

    const tamperedCredentialSource = await issueCredential(
      {
        issuer: authoritativeIssuer.issuerId,
        subject: bundleNpi,
        claims: {
          type: 'MedicalLicense',
          licenseNumber: 'CX145-TAMPERED',
        },
      },
      TEST_PRIVATE_KEY_PEM,
    );
    bundleTamperedCredential = {
      ...tamperedCredentialSource,
      credentialId: `${tamperedCredentialSource.credentialId}-tampered`,
      signature: tamperCompactJws(tamperedCredentialSource.signature),
    };
    storeCredential(bundleTamperedCredential);
    storedCredentialIds.push(bundleTamperedCredential.credentialId);

    bundleForeignCredential = await issueAndStoreCredential({
      issuer: authoritativeIssuer.issuerId,
      subject: foreignNpi,
      claims: {
        type: 'MedicalLicense',
        licenseNumber: 'CX145-FOREIGN',
      },
    });
  });

  afterAll(() => {
    for (const credentialId of storedCredentialIds) {
      removeCredential(credentialId);
    }
    resetTrustRegistryRepository();
  });

  test('returns deterministic eligibility for authoritative credentials', async () => {
    const response = await request(app)
      .get(`/api/payers/verify/${eligibleNpi}`)
      .set('x-org-id', TEST_ORG_ID)
      .query({ payerId: 'payer:unitedhealth' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      npi: eligibleNpi,
      payerId: 'payer:unitedhealth',
      status: 'ELIGIBLE',
      activeCredentials: 2,
      expiredCredentials: 0,
      revokedCredentials: 0,
      minIssuerTrustScore: 95,
      verifiedTypes: ['BoardCertification', 'MedicalLicense'],
      reasons: ['All qualifying credential checks passed'],
    }));
    expect(response.body.checkedAt).toEqual(expect.any(String));
  });

  test('downgrades eligibility when a provisional issuer is present', async () => {
    const response = await request(app)
      .get(`/api/payers/verify/${reviewNpi}`)
      .set('x-org-id', TEST_ORG_ID)
      .query({ payerId: 'payer:unitedhealth' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      npi: reviewNpi,
      payerId: 'payer:unitedhealth',
      status: 'NEEDS_REVIEW',
      activeCredentials: 1,
      expiredCredentials: 0,
      revokedCredentials: 0,
      minIssuerTrustScore: 95,
      verifiedTypes: ['BoardCertification'],
      reasons: [`Credential issuer ${provisionalIssuer.issuerId} has PROVISIONAL trust level`],
    }));
  });

  test('rejects bundle credentials on subject mismatch and signature failure', async () => {
    const credentialIds = [
      bundleForeignCredential.credentialId,
      bundleValidCredential.credentialId,
      bundleTamperedCredential.credentialId,
    ];

    const response = await request(app)
      .post('/api/payers/verifyBundle')
      .set('x-org-id', TEST_ORG_ID)
      .send({
        npi: bundleNpi,
        payerId: 'payer:unitedhealth',
        credentialIds,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      payerId: 'payer:unitedhealth',
      npi: bundleNpi,
      bundleSize: 3,
      validCredentials: 1,
      invalidCredentials: 2,
      overallValid: false,
    }));

    const detailIds = (response.body.details as BundleVerificationDetail[]).map((detail) => detail.credentialId);
    expect(detailIds).toEqual([...credentialIds].sort((left, right) => left.localeCompare(right)));

    const detailById = new Map(
      (response.body.details as BundleVerificationDetail[]).map((detail) => [detail.credentialId, detail] as const),
    );

    expect(detailById.get(bundleValidCredential.credentialId)).toEqual(expect.objectContaining({
      credentialId: bundleValidCredential.credentialId,
      credentialType: 'PayerEnrollment',
      issuer: authoritativeIssuer.issuerId,
      valid: true,
    }));
    expect(detailById.get(bundleForeignCredential.credentialId)).toEqual(expect.objectContaining({
      credentialId: bundleForeignCredential.credentialId,
      credentialType: 'MedicalLicense',
      issuer: authoritativeIssuer.issuerId,
      valid: false,
      reason: 'Credential subject does not match requested provider',
    }));
    expect(detailById.get(bundleTamperedCredential.credentialId)).toEqual(expect.objectContaining({
      credentialId: bundleTamperedCredential.credentialId,
      credentialType: 'MedicalLicense',
      issuer: authoritativeIssuer.issuerId,
      valid: false,
      reason: 'Credential signature validation failed',
    }));
    expect(response.body.checkedAt).toEqual(expect.any(String));
  });
});
