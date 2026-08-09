process.env.FEATURE_SD_JWT_ISSUER = 'true';
process.env.ISSUER_KEY_ENCRYPTION_SECRET = 'wave199-test-secret';
process.env.ISSUER_DID = 'did:web:vitalcv.com';
// SD-JWT issuance is now operator-gated (it was anonymous credential issuance
// behind nothing but the tenant guard). Set before importing app: app.ts reads
// MONITORING_SECRET at module load.
process.env.MONITORING_SECRET = 'wave199-monitoring-secret';

import { createHash } from 'node:crypto';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';
import { rotateKey } from '../src/services/sd-jwt/keyManager';
import { sha256ForPayload } from '../src/utils/deterministic';

const runWave199Suite = process.env.DATABASE_URL ? describe : describe.skip;
const TENANT_HEADERS = {
  'x-org-id': '00000000-0000-0000-0000-000000000199',
  'x-monitoring-secret': 'wave199-monitoring-secret',
};

function sha256b64url(input: string): string {
  return Buffer.from(createHash('sha256').update(input).digest()).toString('base64url');
}

async function clearWave199State(): Promise<void> {
  await prisma.issuedCredentialRecord.deleteMany();
  await prisma.issuerSigningKey.deleteMany();
  await prisma.auditReceiptRecord.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.npiDidBinding.deleteMany();
}

runWave199Suite('Wave 199 SD-JWT issuer service', () => {
  beforeEach(async () => {
    await clearWave199State();
  });

  afterAll(async () => {
    await clearWave199State();
    await prisma.$disconnect();
    // jest runs maxWorkers:1, so process.env mutations persist across test
    // FILES. Leaving MONITORING_SECRET set changes how later suites' copy of
    // app.ts initialises.
    delete process.env.MONITORING_SECRET;
  });

  it('issues SD-JWT credentials with persisted receipt, audit link, and hashed claim evidence', async () => {
    const holderDid = 'did:key:z6Mkholder199';
    const response = await request(app)
      .post('/api/credentials/sd-jwt/issue')
      .set(TENANT_HEADERS)
      .send({
        holderDid,
        type: 'HEALTHCARE_LICENSE',
        claims: [
          { key: 'licenseNumber', value: 'RN-12345', disclosed: false },
          { key: 'jurisdiction', value: 'CA', disclosed: true },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      credentialId: expect.any(String),
      kid: expect.any(String),
      receiptId: expect.any(String),
      auditEventId: expect.any(String),
    });
    expect(response.body.disclosures).toHaveLength(1);

    const record = await prisma.issuedCredentialRecord.findUnique({
      where: { credentialId: response.body.credentialId as string },
    });
    expect(record).not.toBeNull();
    expect(record?.holderDid).toBe(holderDid);
    expect(record?.credentialType).toBe('HEALTHCARE_LICENSE');
    expect(record?.format).toBe('vc+sd-jwt');
    expect(record?.kid).toBe(response.body.kid);
    expect(record?.disclosureDigests).toEqual([
      sha256b64url(response.body.disclosures[0] as string),
    ]);
    expect(record?.holderBindingHash).toBe(
      sha256ForPayload({
        issuerDid: 'did:web:vitalcv.com',
        holderDid,
      }),
    );

    const claimDigests = record?.claimDigests as Record<string, string>;
    expect(Object.keys(claimDigests)).toEqual(
      expect.arrayContaining(['licenseNumber', 'jurisdiction']),
    );
    expect(claimDigests.licenseNumber).toMatch(/^[a-f0-9]{64}$/);
    expect(claimDigests.jurisdiction).toMatch(/^[a-f0-9]{64}$/);

    const receipt = await prisma.auditReceiptRecord.findUnique({
      where: { receiptId: response.body.receiptId as string },
    });
    expect(receipt).not.toBeNull();
    expect(receipt?.type).toBe('ISSUANCE');
    expect(receipt?.subject).toBe(holderDid);

    const auditEvent = await prisma.auditEvent.findUnique({
      where: { id: response.body.auditEventId as string },
    });
    expect(auditEvent).not.toBeNull();
    expect(auditEvent?.referenceId).toBe(response.body.credentialId);
    expect(auditEvent?.type).toBe('SD_JWT_ISSUED');
  });

  it('denies issuance when the holder DID is contested', async () => {
    const contestedDid = 'did:key:z6Mkcontested199';
    await prisma.npiDidBinding.create({
      data: {
        npi: '1234567890',
        did: contestedDid,
        sourceFingerprint: 'sha256:test-binding',
        evidencePointers: [],
        status: 'CONTESTED',
        contestReason: 'manual dispute',
      },
    });

    const response = await request(app)
      .post('/api/credentials/sd-jwt/issue')
      .set(TENANT_HEADERS)
      .send({
        holderDid: contestedDid,
        type: 'HEALTHCARE_LICENSE',
        claims: [
          { key: 'licenseNumber', value: 'RN-99999', disclosed: false },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('contested');

    const count = await prisma.issuedCredentialRecord.count();
    expect(count).toBe(0);
  });

  it('denies issuance when issuer capability is missing', async () => {
    const response = await request(app)
      .post('/api/credentials/sd-jwt/issue')
      .set(TENANT_HEADERS)
      .send({
        holderDid: 'did:key:z6Mkmissingcap199',
        type: 'UNAUTHORIZED_TYPE',
        claims: [
          { key: 'licenseNumber', value: 'RN-22222', disclosed: false },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('missing capability');
    expect(await prisma.issuedCredentialRecord.count()).toBe(0);
  });

  it('publishes active and grace keys in JWKS and honors pinned kids', async () => {
    const firstIssue = await request(app)
      .post('/api/credentials/sd-jwt/issue')
      .set(TENANT_HEADERS)
      .send({
        holderDid: 'did:key:z6Mkrotation199a',
        type: 'HEALTHCARE_LICENSE',
        claims: [
          { key: 'licenseNumber', value: 'RN-00001', disclosed: false },
        ],
      });

    expect(firstIssue.status).toBe(201);
    const rotatedKid = await rotateKey(firstIssue.body.kid as string, 'did:web:vitalcv.com');

    const rootJwks = await request(app).get('/.well-known/jwks.json');
    expect(rootJwks.status).toBe(200);
    expect(rootJwks.body.keys.map((key: { kid: string }) => key.kid)).toEqual(
      expect.arrayContaining([firstIssue.body.kid, rotatedKid]),
    );

    const apiJwks = await request(app).get('/api/.well-known/jwks.json');
    expect(apiJwks.status).toBe(200);
    expect(apiJwks.body.keys.map((key: { kid: string }) => key.kid)).toEqual(
      expect.arrayContaining([firstIssue.body.kid, rotatedKid]),
    );

    const pinnedIssue = await request(app)
      .post('/api/credentials/sd-jwt/issue')
      .set(TENANT_HEADERS)
      .send({
        holderDid: 'did:key:z6Mkrotation199b',
        type: 'HEALTHCARE_LICENSE',
        kid: rotatedKid,
        claims: [
          { key: 'licenseNumber', value: 'RN-00002', disclosed: false },
        ],
      });

    expect(pinnedIssue.status).toBe(201);
    expect(pinnedIssue.body.kid).toBe(rotatedKid);
  });
});
