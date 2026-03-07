import app from '../../apps/api/backend/src/app';
import { VitalCVIssuer } from '../../packages/issuer-sdk/src/index';
import { VitalCVWallet } from '../../packages/wallet-sdk/src/index';
import { createClinicianFixture } from '../fixtures/clinician';
import { createIssuerFixture } from '../fixtures/issuer';
import { createVerifierFixture } from '../fixtures/verifier';
import { startSdkTestServer, type SdkTestServer } from '../helpers/sdkTestServer';

describe('wallet SDK contract', () => {
  const clinician = createClinicianFixture(Date.now() + 1);
  const issuerFixture = createIssuerFixture(`wallet-${clinician.npi}`);
  const verifier = createVerifierFixture(`wallet-${clinician.npi}`);

  let server: SdkTestServer;
  let issuer: VitalCVIssuer;
  let wallet: VitalCVWallet;

  beforeAll(async () => {
    process.env.CREDENTIAL_SIGNING_KEY_PEM = issuerFixture.privateKey;
    server = await startSdkTestServer(app, issuerFixture.organizationId);
    issuer = new VitalCVIssuer({
      baseUrl: server.baseUrl,
      apiKey: 'wallet-contract-issuer-key',
      issuerId: issuerFixture.issuerId,
    });
    wallet = new VitalCVWallet({
      baseUrl: server.baseUrl,
      npi: clinician.npi,
      holderDid: clinician.holderDid,
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

  test('accepts offers and exposes wallet, summary, presentation, and trust contracts', async () => {
    const offer = await issuer.createOID4VCICredentialOffer({
      npi: clinician.npi,
      credentialType: 'MedicalLicense',
      claims: {
        state: clinician.state,
        licenseNumber: clinician.licenseNumber,
      },
    });

    const accepted = await wallet.acceptCredentialOffer({
      offerId: offer.offerId,
      credentialOfferUri: offer.credentialOfferUri,
      credentialType: 'MedicalLicense',
      issuer: issuerFixture.issuerId,
      expiresAt: offer.expiresAt,
    });

    expect(accepted.credentialId).toEqual(expect.any(String));
    expect(accepted.credentialType).toBe('MedicalLicense');
    expect(accepted.issuer).toBe(issuerFixture.issuerId);

    const credentials = await wallet.listCredentials();
    expect(credentials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          credentialId: accepted.credentialId,
          credentialType: 'MedicalLicense',
          status: 'VALID',
        }),
      ]),
    );

    const summary = await wallet.getSummary();
    expect(summary.npi).toBe(clinician.npi);
    expect(summary.totalCredentials).toBeGreaterThanOrEqual(1);
    expect(['L0', 'L1', 'L2', 'L3']).toContain(summary.trustBand);

    const credential = await wallet.getCredential(accepted.credentialId);
    expect(credential.credentialId).toBe(accepted.credentialId);
    expect(credential.credentialType).toBe('MedicalLicense');
    expect(credential.issuerId).toBe(issuerFixture.issuerId);

    const presentation = await wallet.createPresentation({
      credentialIds: [accepted.credentialId],
      verifierDid: verifier.verifierDid,
    });

    expect(presentation.presentationId).toEqual(expect.any(String));
    expect(presentation.vpJwt).toEqual(expect.any(String));
    expect(presentation.subject).toBe(clinician.npi);

    const trustState = await wallet.getTrustState();
    expect(['L0', 'L1', 'L2', 'L3']).toContain(trustState.band);
    expect(typeof trustState.haipCompliant).toBe('boolean');
    expect(trustState.computedAt).toEqual(expect.any(String));
  });
});
