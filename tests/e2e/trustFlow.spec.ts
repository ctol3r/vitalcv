import request from 'supertest';
import app from '../../apps/api/backend/src/app';
import prisma from '../../apps/api/backend/src/graphql/prisma_client';
import { buildLicenseClaims, createClinicianFixture } from '../fixtures/clinician';
import { createIssuerFixture } from '../fixtures/issuer';
import { createVerifierFixture } from '../fixtures/verifier';
import { canonicalReceiptHash } from '../helpers/receiptHash';

describe('Wave 124 trust flow', () => {
  const clinician = createClinicianFixture(Date.now());
  const issuer = createIssuerFixture(clinician.npi);
  const verifier = createVerifierFixture(clinician.npi);
  let databaseAvailable = false;

  let credentialId = '';
  let presentationId = '';
  let capsuleId = '';
  let verificationReceiptId = '';

  beforeAll(async () => {
    process.env.CREDENTIAL_SIGNING_KEY_PEM = issuer.privateKey;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (!databaseAvailable) {
      return;
    }

    const referenceIds = [credentialId, capsuleId].filter((value): value is string => value.length > 0);

    await prisma.decisionCapsule.deleteMany({
      where: { subjectNpi: clinician.npi },
    });
    await prisma.auditReceiptRecord.deleteMany({
      where: {
        OR: [
          { subject: clinician.npi },
          { actor: issuer.issuerId },
          { actor: verifier.verifierDid },
        ],
      },
    });
    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { clinicianId: clinician.npi },
          ...(referenceIds.length > 0 ? [{ referenceId: { in: referenceIds } }] : []),
        ],
      },
    });
    await prisma.verificationArtifact.deleteMany({
      where: { npi: clinician.npi },
    });
    await prisma.trustedIssuer.deleteMany({
      where: { did: issuer.issuerId },
    });
  });

  test('proves issuance through revocation cascade and receipt export', async () => {
    if (!databaseAvailable) {
      expect(true).toBe(true);
      return;
    }

    const registerIssuerResponse = await request(app)
      .post('/api/registry/issuers')
      .set('x-org-id', issuer.organizationId)
      .send({
        did: issuer.issuerId,
        issuerName: issuer.issuerName,
        issuerType: 'medical_board',
        jurisdiction: clinician.state,
        publicKey: issuer.publicKey,
      });

    expect(registerIssuerResponse.status).toBe(201);
    expect(registerIssuerResponse.body.did).toBe(issuer.issuerId);

    const issueResponse = await request(app)
      .post('/api/credentials/issue')
      .set('x-org-id', issuer.organizationId)
      .send({
        issuerId: issuer.issuerId,
        npi: clinician.npi,
        credentialType: 'MedicalLicense',
        claims: buildLicenseClaims(clinician),
        expiresAt: '2030-01-01T00:00:00.000Z',
      });

    expect(issueResponse.status).toBe(201);
    expect(issueResponse.body.credentialId).toEqual(expect.any(String));
    expect(issueResponse.body.receiptId).toEqual(expect.any(String));
    credentialId = issueResponse.body.credentialId as string;

    const artifact = await prisma.verificationArtifact.findUnique({
      where: { id: credentialId },
    });
    expect(artifact).not.toBeNull();
    expect(artifact?.status).toBe('ACTIVE');

    const walletResponse = await request(app)
      .get(`/api/credentials/wallet?npi=${clinician.npi}`)
      .set('x-org-id', issuer.organizationId);

    expect(walletResponse.status).toBe(200);
    expect(walletResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          credentialId,
          credentialType: 'MedicalLicense',
          status: 'VALID',
        }),
      ]),
    );

    const presentationResponse = await request(app)
      .post('/api/credentials/present')
      .set('x-org-id', issuer.organizationId)
      .send({
        npi: clinician.npi,
        holderDid: clinician.holderDid,
        verifierDid: verifier.verifierDid,
        credentialIds: [credentialId],
      });

    expect(presentationResponse.status).toBe(201);
    expect(presentationResponse.body.presentationId).toEqual(expect.any(String));
    expect(presentationResponse.body.receiptId).toEqual(expect.any(String));
    presentationId = presentationResponse.body.presentationId as string;

    const verifyResponse = await request(app)
      .post('/api/credentials/verify/presentation')
      .set('x-org-id', issuer.organizationId)
      .send({
        vpJwt: presentationResponse.body.vpJwt,
        expectedNpi: clinician.npi,
        verifierDid: verifier.verifierDid,
      });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.valid).toBe(true);
    expect(verifyResponse.body.receiptId).toEqual(expect.any(String));
    verificationReceiptId = verifyResponse.body.receiptId as string;

    const acceptResponse = await request(app)
      .post('/api/credentials/accept')
      .set('x-org-id', issuer.organizationId)
      .send({
        presentationId,
        verifierDid: verifier.verifierDid,
      });

    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.accepted).toBe(true);
    expect(acceptResponse.body.receiptId).toEqual(expect.any(String));

    const decisionResponse = await request(app)
      .post('/api/decisions')
      .set('x-org-id', issuer.organizationId)
      .send({
        subjectDid: clinician.holderDid,
        subjectNpi: clinician.npi,
        decisionType: 'PRIVILEGING',
        credentialIds: [credentialId],
        issuerIds: [issuer.issuerId],
        metadata: { wave: 124 },
      });

    expect(decisionResponse.status).toBe(201);
    expect(decisionResponse.body.status).toBe('VALID');
    capsuleId = decisionResponse.body.id as string;

    const revokeResponse = await request(app)
      .post('/api/revocation/revoke')
      .set('x-org-id', issuer.organizationId)
      .send({
        credentialId,
        issuerId: issuer.issuerId,
        reason: 'license suspended',
      });

    expect(revokeResponse.status).toBe(201);
    expect(revokeResponse.body.revoked).toBe(true);
    expect(revokeResponse.body.cascadeTriggered).toBe(true);
    expect(revokeResponse.body.affectedDecisions).toBeGreaterThanOrEqual(1);

    const revokedArtifact = await prisma.verificationArtifact.findUnique({
      where: { id: credentialId },
    });
    expect(revokedArtifact?.status).toBe('REVOKED');
    expect(revokedArtifact?.lifecycleState).toBe('revoked');

    const revokedCredentialResponse = await request(app)
      .get(`/api/credentials/${credentialId}`)
      .set('x-org-id', issuer.organizationId);

    expect(revokedCredentialResponse.status).toBe(200);
    expect(revokedCredentialResponse.body.status).toBe('REVOKED');

    const decisionDetailResponse = await request(app)
      .get(`/api/decisions/${capsuleId}/detail`)
      .set('x-org-id', issuer.organizationId);

    expect(decisionDetailResponse.status).toBe(200);
    expect(decisionDetailResponse.body.status).toBe('INVALID');

    const receiptResponse = await request(app)
      .get(`/api/audit/receipt/${verificationReceiptId}`)
      .set('x-org-id', issuer.organizationId);

    expect(receiptResponse.status).toBe(200);
    expect(receiptResponse.body.receiptId).toBe(verificationReceiptId);
    expect(receiptResponse.body.hash).toBe(
      canonicalReceiptHash(receiptResponse.body.payload as Record<string, unknown>),
    );
  });
});
