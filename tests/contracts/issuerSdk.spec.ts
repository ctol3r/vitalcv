import app from '../../apps/api/backend/src/app';
import { VitalCVIssuer } from '../../packages/issuer-sdk/src/index';
import { buildLicenseClaims, createClinicianFixture } from '../fixtures/clinician';
import { createIssuerFixture } from '../fixtures/issuer';
import { startSdkTestServer, type SdkTestServer } from '../helpers/sdkTestServer';

describe('issuer SDK contract', () => {
  const clinician = createClinicianFixture(Date.now());
  const issuerFixture = createIssuerFixture(`issuer-${clinician.npi}`);

  let server: SdkTestServer;
  let issuer: VitalCVIssuer;

  beforeAll(async () => {
    process.env.CREDENTIAL_SIGNING_KEY_PEM = issuerFixture.privateKey;
    server = await startSdkTestServer(app, issuerFixture.organizationId);
    issuer = new VitalCVIssuer({
      baseUrl: server.baseUrl,
      apiKey: 'issuer-contract-key',
      issuerId: issuerFixture.issuerId,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  test('registers issuer, issues, offers, and revokes with SDK envelopes', async () => {
    const registration = await issuer.registerIssuer({
      issuerName: issuerFixture.issuerName,
      issuerType: 'medical_board',
      jurisdiction: clinician.state,
      publicKey: issuerFixture.publicKey,
    });

    expect(registration.issuerId).toBe(issuerFixture.issuerId);
    expect(registration.did).toBe(issuerFixture.issuerId);
    expect(registration.status).toBe('ACTIVE');

    const issued = await issuer.issueCredential({
      npi: clinician.npi,
      credentialType: 'MedicalLicense',
      claims: buildLicenseClaims(clinician),
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    expect(issued.credentialId).toEqual(expect.any(String));
    expect(issued.issuerId).toBe(issuerFixture.issuerId);
    expect(issued.credentialType).toBe('MedicalLicense');
    expect(issued.receiptHash).toEqual(expect.any(String));
    expect(issued.traceId).toEqual(expect.any(String));

    const offer = await issuer.createOID4VCICredentialOffer({
      npi: clinician.npi,
      credentialType: 'BoardCertification',
      claims: { board: 'ABIM' },
      ttlSeconds: 300,
    });

    expect(offer.offerId).toEqual(expect.any(String));
    expect(offer.credentialOfferUri).toContain(`/api/oid4vci/credential-offer/${offer.offerId}`);

    const revocation = await issuer.revokeCredential(issued.credentialId, {
      reason: 'administrative withdrawal',
    });

    expect(revocation.credentialId).toBe(issued.credentialId);
    expect(revocation.revoked).toBe(true);
    expect(revocation.reason).toBe('administrative withdrawal');
    expect(typeof revocation.cascadeTriggered).toBe('boolean');
  });
});
