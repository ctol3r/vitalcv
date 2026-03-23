import express from 'express';
import request from 'supertest';
import prisma from '../src/graphql/prisma_client';
import { registerPassportEntityRoutes } from '../src/routes/passportEntity';

const runDbSuite = process.env.DATABASE_URL ? describe : describe.skip;

async function resetShareState(): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.bundleShareEvent.deleteMany();
  await prisma.vcvOrgContextStatusEvent.deleteMany();
  await prisma.vcvOrgContextSubject.deleteMany();
  await prisma.vcvOrganizationContext.deleteMany();
  await prisma.vcvEducationRecord.deleteMany();
  await prisma.vcvCredential.deleteMany();
  await prisma.verificationReceiptRecord.deleteMany();
  await prisma.verificationArtifact.deleteMany();
  await prisma.vcvEntityRelationship.deleteMany();
  await prisma.vcvEntityRole.deleteMany();
  await prisma.vcvEntity.deleteMany();
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerPassportEntityRoutes(app);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'unknown error';
    const status =
      typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : typeof error === 'object' && error !== null && 'statusCode' in error && typeof (error as { statusCode?: unknown }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : 500;
    res.status(status).json({ error: message });
  });
  return app;
}

runDbSuite('passport entity share contracts', () => {
  beforeEach(async () => {
    await resetShareState();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates an org context, attaches the clinician subject, and persists an auditable share payload', async () => {
    const issuerNppes = await prisma.vcvEntity.create({
      data: {
        entityType: 'ORGANIZATION',
        canonicalId: 'test:issuer:nppes',
        displayName: 'CMS NPPES',
        sourceIds: ['cms:nppes'],
        metadata: {},
      },
    });
    const issuerOig = await prisma.vcvEntity.create({
      data: {
        entityType: 'ORGANIZATION',
        canonicalId: 'test:issuer:oig',
        displayName: 'HHS OIG LEIE',
        sourceIds: ['hhs:oig'],
        metadata: {},
      },
    });
    const issuerBoard = await prisma.vcvEntity.create({
      data: {
        entityType: 'ORGANIZATION',
        canonicalId: 'test:issuer:ca-board',
        displayName: 'Medical Board of California',
        sourceIds: ['state_board:CA'],
        metadata: {},
      },
    });

    const subject = await prisma.vcvEntity.create({
      data: {
        entityType: 'PERSON',
        canonicalId: 'test:subject:share',
        displayName: 'Ada Lovelace',
        npi: '1558302470',
        npiType: 'TYPE_1',
        sourceIds: ['NPPES_API', 'OIG_LEIE', 'STATE_BOARD'],
        verifiedAt: new Date('2026-03-22T12:00:00.000Z'),
        metadata: {
          specialty: 'Family Medicine',
        },
      },
    });

    const requestor = await prisma.vcvEntity.create({
      data: {
        entityType: 'ORGANIZATION',
        canonicalId: 'test:requestor:share',
        displayName: 'Regional Health System',
        sourceIds: ['TEST_ORG'],
        metadata: {},
      },
    });

    const identityArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: '1558302470',
        source: 'NPPES',
        status: 'ACTIVE',
        checksum: 'artifact:nppes',
        verifiedAt: new Date('2026-03-20T12:00:00.000Z'),
        observedAt: new Date('2026-03-20T12:00:00.000Z'),
        rawPayload: { payload_json: { provider_name: 'Ada Lovelace' } },
        trustTier: 'GOLD',
        confidenceScore: 0.99,
        trustState: 'verified',
      },
    });
    const exclusionArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: '1558302470',
        source: 'OIG',
        status: 'CLEAR',
        checksum: 'artifact:oig',
        verifiedAt: new Date('2026-03-20T12:10:00.000Z'),
        observedAt: new Date('2026-03-20T12:10:00.000Z'),
        rawPayload: { payload_json: { verdict: 'CLEAR' } },
        trustTier: 'GOLD',
        confidenceScore: 0.97,
        trustState: 'verified',
      },
    });
    const licensureArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: '1558302470',
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        checksum: 'artifact:license',
        verifiedAt: new Date('2026-03-20T12:20:00.000Z'),
        observedAt: new Date('2026-03-20T12:20:00.000Z'),
        expiresAt: new Date('2028-03-20T12:20:00.000Z'),
        rawPayload: { payload_json: { state: 'CA', license_number: 'CA-MD-12345' } },
        trustTier: 'GOLD',
        confidenceScore: 0.96,
        trustState: 'verified',
      },
    });

    await prisma.verificationReceiptRecord.createMany({
      data: [
        {
          receiptId: 'receipt-identity',
          claimId: 'claim-identity',
          verificationArtifactId: identityArtifact.id,
          subjectNpi: '1558302470',
          entityId: 'npi:1558302470',
          field: 'identity',
          value: { npi: '1558302470' },
          trustTier: 'GOLD',
          confidence: 0.99,
          sourceArtifactId: identityArtifact.id,
          sourceSystem: 'NPPES_API',
          parserVersion: 'test/v1',
          observedAt: new Date('2026-03-20T12:00:00.000Z'),
          explanation: 'Identity verified',
        },
        {
          receiptId: 'receipt-exclusion',
          claimId: 'claim-exclusion',
          verificationArtifactId: exclusionArtifact.id,
          subjectNpi: '1558302470',
          entityId: 'npi:1558302470',
          field: 'exclusion',
          value: { verdict: 'CLEAR' },
          trustTier: 'GOLD',
          confidence: 0.97,
          sourceArtifactId: exclusionArtifact.id,
          sourceSystem: 'OIG_LEIE',
          parserVersion: 'test/v1',
          observedAt: new Date('2026-03-20T12:10:00.000Z'),
          explanation: 'Exclusion clear',
        },
        {
          receiptId: 'receipt-license',
          claimId: 'claim-license',
          verificationArtifactId: licensureArtifact.id,
          subjectNpi: '1558302470',
          entityId: 'npi:1558302470',
          field: 'license',
          value: { state: 'CA', licenseNumber: 'CA-MD-12345' },
          trustTier: 'GOLD',
          confidence: 0.96,
          sourceArtifactId: licensureArtifact.id,
          sourceSystem: 'STATE_BOARD',
          parserVersion: 'test/v1',
          observedAt: new Date('2026-03-20T12:20:00.000Z'),
          explanation: 'License verified',
        },
      ],
    });

    await prisma.vcvCredential.createMany({
      data: [
        {
          subjectId: subject.id,
          issuerId: issuerNppes.id,
          credentialKey: 'share:identity',
          credentialFamilyKey: 'share:identity:family',
          domain: 'IDENTITY',
          credentialType: 'NPI_ENROLLMENT',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          claimValue: { npi: '1558302470' },
          artifactIds: [identityArtifact.id],
          receiptIds: ['receipt-identity'],
          observedAt: new Date('2026-03-20T12:00:00.000Z'),
          verifiedAt: new Date('2026-03-20T12:00:00.000Z'),
          trustTier: 'GOLD',
          confidence: 0.99,
          metadata: {},
        },
        {
          subjectId: subject.id,
          issuerId: issuerOig.id,
          credentialKey: 'share:exclusion',
          credentialFamilyKey: 'share:exclusion:family',
          domain: 'EXCLUSION_CHECK',
          credentialType: 'OIG_LEIE',
          status: 'CLEAR',
          verificationLevel: 'SOURCE_VERIFIED',
          claimValue: { verdict: 'CLEAR' },
          artifactIds: [exclusionArtifact.id],
          receiptIds: ['receipt-exclusion'],
          observedAt: new Date('2026-03-20T12:10:00.000Z'),
          verifiedAt: new Date('2026-03-20T12:10:00.000Z'),
          trustTier: 'GOLD',
          confidence: 0.97,
          metadata: {},
        },
        {
          subjectId: subject.id,
          issuerId: issuerBoard.id,
          credentialKey: 'share:license',
          credentialFamilyKey: 'share:license:family',
          domain: 'LICENSURE',
          credentialType: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          claimValue: { state: 'CA', licenseNumber: 'CA-MD-12345' },
          artifactIds: [licensureArtifact.id],
          receiptIds: ['receipt-license'],
          observedAt: new Date('2026-03-20T12:20:00.000Z'),
          verifiedAt: new Date('2026-03-20T12:20:00.000Z'),
          expiresAt: new Date('2028-03-20T12:20:00.000Z'),
          jurisdiction: 'CA',
          trustTier: 'GOLD',
          confidence: 0.96,
          metadata: {},
        },
      ],
    });

    const app = buildTestApp();

    const contextResponse = await request(app)
      .post('/api/organization-context')
      .set('x-clerk-user-id', 'user_test_share')
      .send({
        requestorEntityId: requestor.id,
        contextType: 'EMPLOYMENT_REVIEW',
        title: 'Regional onboarding review',
        subjectEntityIds: [subject.id],
      });

    expect(contextResponse.status).toBe(201);
    expect(contextResponse.body.context.status).toBe('PENDING');

    const shareResponse = await request(app)
      .post('/api/share')
      .set('x-clerk-user-id', 'user_test_share')
      .send({
        entityId: subject.id,
        organizationContextId: contextResponse.body.context.id,
      });

    expect(shareResponse.status).toBe(201);
    expect(shareResponse.body).toMatchObject({
      shareEventId: expect.any(String),
      eventId: expect.any(String),
      deliveryStatus: 'DELIVERED',
      credentialsShared: 3,
      bundleId: expect.any(String),
    });
    expect(shareResponse.body.shareEventId).toBe(shareResponse.body.eventId);

    const shareEvent = await prisma.bundleShareEvent.findUniqueOrThrow({
      where: { id: shareResponse.body.shareEventId },
    });
    const contextSubject = await prisma.vcvOrgContextSubject.findUniqueOrThrow({
      where: {
        contextId_subjectId: {
          contextId: contextResponse.body.context.id,
          subjectId: subject.id,
        },
      },
    });
    const refreshedContext = await prisma.vcvOrganizationContext.findUniqueOrThrow({
      where: { id: contextResponse.body.context.id },
    });

    const bundlePayload = shareEvent.bundlePayload as Record<string, unknown>;
    const sourceCoverage = shareEvent.sourceCoverage as Record<string, unknown>;
    const submissionData = contextSubject.submissionData as Record<string, unknown>;

    expect(shareEvent.organizationContextId).toBe(contextResponse.body.context.id);
    expect(shareEvent.subjectEntityId).toBe(subject.id);
    expect(shareEvent.deliveryStatus).toBe('DELIVERED');
    expect(shareEvent.receiptRefs).toEqual(['receipt-exclusion', 'receipt-identity', 'receipt-license']);
    expect(bundlePayload).toEqual(
      expect.objectContaining({
        schema: 'vitalcv.employer.review.v1',
        identitySummary: expect.objectContaining({
          entityId: subject.id,
          displayName: 'Ada Lovelace',
          npi: '1558302470',
        }),
        readinessSummary: expect.objectContaining({
          status: expect.any(String),
        }),
        shareMetadata: expect.objectContaining({
          organizationContextId: contextResponse.body.context.id,
          requestorEntityId: requestor.id,
          sharedByUserId: 'user_test_share',
        }),
      }),
    );
    expect(sourceCoverage).toEqual(
      expect.objectContaining({
        credentialCount: 3,
        sources: expect.arrayContaining(['NPPES', 'OIG', 'STATE_BOARD']),
      }),
    );
    expect(submissionData).toEqual(
      expect.objectContaining({
        shareEventId: shareEvent.id,
        eventId: shareEvent.id,
        bundleId: shareEvent.bundleId,
        receiptRefs: ['receipt-exclusion', 'receipt-identity', 'receipt-license'],
        credentialIds: expect.any(Array),
      }),
    );
    expect(contextSubject.subjectStatus).toBe('SUBMITTED');
    expect(refreshedContext.status).toBe('ACTIVE');
  });
});
