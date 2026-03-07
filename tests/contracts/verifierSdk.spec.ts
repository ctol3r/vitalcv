import app from '../../apps/api/backend/src/app';
import { VitalCVIssuer } from '../../packages/issuer-sdk/src/index';
import { VitalCVVerifier } from '../../packages/verifier-sdk/src/index';
import { VitalCVWallet } from '../../packages/wallet-sdk/src/index';
import { buildLicenseClaims, createClinicianFixture } from '../fixtures/clinician';
import { createIssuerFixture } from '../fixtures/issuer';
import { createVerifierFixture } from '../fixtures/verifier';
import { startSdkTestServer, type SdkTestServer } from '../helpers/sdkTestServer';

describe('verifier SDK contract', () => {
  const clinician = createClinicianFixture(Date.now() + 2);
  const issuerFixture = createIssuerFixture(`verifier-${clinician.npi}`);
  const verifierFixture = createVerifierFixture(`verifier-${clinician.npi}`);

  let server: SdkTestServer;
  let issuer: VitalCVIssuer;
  let wallet: VitalCVWallet;
  let verifier: VitalCVVerifier;

  beforeAll(async () => {
    process.env.CREDENTIAL_SIGNING_KEY_PEM = issuerFixture.privateKey;
    server = await startSdkTestServer(app, issuerFixture.organizationId);
    issuer = new VitalCVIssuer({
      baseUrl: server.baseUrl,
      apiKey: 'verifier-contract-issuer-key',
      issuerId: issuerFixture.issuerId,
    });
    wallet = new VitalCVWallet({
      baseUrl: server.baseUrl,
      npi: clinician.npi,
      holderDid: clinician.holderDid,
    });
    verifier = new VitalCVVerifier({
      baseUrl: server.baseUrl,
      apiKey: verifierFixture.apiKey,
    });

    await issuer.registerIssuer({
      issuerName: issuerFixture.issuerName,
      issuerType: 'medical_board',
      jurisdiction: clinician.state,
      publicKey: issuerFixture.publicKey,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  test('verifies presentations, accepts them, checks revocation, and exports audit events', async () => {
    const issued = await issuer.issueCredential({
      npi: clinician.npi,
      credentialType: 'MedicalLicense',
      claims: buildLicenseClaims(clinician),
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    const trustBand = await verifier.getTrustBand(clinician.npi);
    expect(trustBand.subject).toBe(clinician.npi);
    expect(['L0', 'L1', 'L2', 'L3']).toContain(trustBand.band);
    expect(typeof trustBand.haipCompliant).toBe('boolean');

    const substrateState = await verifier.getSubstrateTrustState(clinician.npi);
    expect(substrateState.subject).toBe(clinician.npi);
    expect(Array.isArray(substrateState.issuerTrust)).toBe(true);
    expect(Array.isArray(substrateState.credentialRisk)).toBe(true);

    const presentation = await wallet.createPresentation({
      credentialIds: [issued.credentialId],
      verifierDid: verifierFixture.verifierDid,
    });

    const verification = await verifier.verifyPresentation({
      vpJwt: presentation.vpJwt,
      expectedNpi: clinician.npi,
    });

    expect(verification.valid).toBe(true);
    expect(verification.presentationId).toBe(presentation.presentationId);
    expect(verification.subject).toBe(clinician.npi);
    expect(verification.credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          credentialId: issued.credentialId,
          issuer: issuerFixture.issuerId,
          valid: true,
        }),
      ]),
    );

    const acceptance = await verifier.acceptPresentation({
      presentationId: presentation.presentationId,
    });

    expect(acceptance.accepted).toBe(true);
    expect(acceptance.presentationId).toBe(presentation.presentationId);
    expect(acceptance.subject).toBe(clinician.npi);
    expect(acceptance.credentialsAccepted).toContain(issued.credentialId);

    await issuer.revokeCredential(issued.credentialId, {
      reason: 'verification contract revoke',
    });

    const revocation = await verifier.checkRevocation(issued.credentialId);
    expect(revocation.credentialId).toBe(issued.credentialId);
    expect(revocation.revoked).toBe(true);
    expect(revocation.reason).toBe('verification contract revoke');

    const auditEvents = await verifier.getAuditEvents({ limit: 20 });
    expect(Array.isArray(auditEvents.events)).toBe(true);
    expect(auditEvents.ledgerSize).toBeGreaterThan(0);
  });
});
