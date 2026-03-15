import express from 'express';
import request from 'supertest';
import prisma from '../../graphql/prisma_client';
import { registerIdentityLayerRoutes } from '../identityLayer';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIdentityLayerRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.alertDeliveryAttempt.deleteMany({});
  await prisma.watchlistHit.deleteMany({});
  await prisma.watchlist.deleteMany({});
  await prisma.trustDegradationEvent.deleteMany({});
  await prisma.sourceStalenessEvent.deleteMany({});
  await prisma.entityChangeEvent.deleteMany({});
  await prisma.trustAlertRecord.deleteMany({});
  await prisma.identityClaimDelta.deleteMany({});
  await prisma.verificationReceiptRecord.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.auditSnapshot.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
  await prisma.sourceRecord.deleteMany({});
  await prisma.sourceRun.deleteMany({});
}

async function seedIdentityFixture(): Promise<{ npi: string }> {
  const npi = '1093888745';
  const artifactId = '00000000-0000-0000-0000-000000001001';

  await prisma.verificationArtifact.create({
    data: {
      id: artifactId,
      npi,
      source: 'NPPES_API',
      status: 'ACTIVE',
      artifactType: 'IDENTITY',
      trustTier: 'GOLD',
      checksum: 'identity-mobile-artifact',
      lifecycleState: 'active',
      trustState: 'trusted',
      verifiedAt: new Date('2026-03-14T10:00:00.000Z'),
      rawPayload: {
        seeded: true,
      },
    },
  });

  await prisma.claimRecord.createMany({
    data: [
      {
        claimId: 'claim_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        claimType: 'NPI_IDENTITY',
        value: {
          _type: 'NPI_IDENTITY',
          npi,
          enumerationType: 'NPI-1',
          enumerationDate: '2020-01-01',
          lastUpdated: '2026-03-10',
          status: 'A',
          credential: 'MD',
        },
        trustTier: 'GOLD',
        confidenceLabel: 'HIGH',
        confidenceScore: 0.99,
        sourceId: 'NPPES_API',
        parserVersion: 'v1.0.0',
        status: 'ACTIVE',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        derivedAt: new Date('2026-03-14T10:00:00.000Z'),
      },
      {
        claimId: 'claim_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        claimType: 'PERSONAL_IDENTITY',
        value: {
          _type: 'PERSONAL_IDENTITY',
          firstName: 'Morgan',
          lastName: 'Lee',
          middleName: null,
          prefix: null,
          credential: 'MD',
          sex: null,
        },
        trustTier: 'GOLD',
        confidenceLabel: 'HIGH',
        confidenceScore: 0.98,
        sourceId: 'NPPES_API',
        parserVersion: 'v1.0.0',
        status: 'ACTIVE',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        derivedAt: new Date('2026-03-14T10:00:00.000Z'),
      },
      {
        claimId: 'claim_cccccccccccccccccccccccccccccccc',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        claimType: 'SPECIALTY',
        value: {
          _type: 'SPECIALTY',
          taxonomyCode: '207R00000X',
          taxonomyDescription: 'Internal Medicine',
          isPrimary: true,
          state: 'CA',
          licenseNumber: 'A12345',
        },
        trustTier: 'GOLD',
        confidenceLabel: 'HIGH',
        confidenceScore: 0.96,
        sourceId: 'NPPES_API',
        parserVersion: 'v1.0.0',
        status: 'ACTIVE',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        derivedAt: new Date('2026-03-14T10:00:00.000Z'),
      },
      {
        claimId: 'claim_dddddddddddddddddddddddddddddddd',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        claimType: 'PRACTICE_LOCATION',
        value: {
          _type: 'PRACTICE_LOCATION',
          addressType: 'LOCATION',
          address1: '100 Main St',
          address2: null,
          city: 'Los Angeles',
          state: 'CA',
          zip: '90001',
          country: 'US',
          phone: '555-111-2222',
          fax: null,
        },
        trustTier: 'GOLD',
        confidenceLabel: 'HIGH',
        confidenceScore: 0.95,
        sourceId: 'NPPES_API',
        parserVersion: 'v1.0.0',
        status: 'ACTIVE',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        derivedAt: new Date('2026-03-14T10:00:00.000Z'),
      },
      {
        claimId: 'claim_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        claimType: 'LICENSE',
        value: {
          _type: 'LICENSE',
          state: 'CA',
          licenseNumber: 'A12345',
          issueDate: '2021-01-01',
          expiryDate: '2027-01-01',
          licenseStatus: 'ACTIVE',
          disciplinaryActions: [],
          source: 'STATE_BOARD',
        },
        trustTier: 'GOLD',
        confidenceLabel: 'HIGH',
        confidenceScore: 0.97,
        sourceId: 'STATE_BOARD',
        parserVersion: 'v1.0.0',
        status: 'ACTIVE',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        derivedAt: new Date('2026-03-14T10:00:00.000Z'),
      },
    ],
  });

  await prisma.verificationReceiptRecord.createMany({
    data: [
      {
        receiptId: 'receipt-identity-mobile-1',
        claimId: 'claim_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        entityId: `npi:${npi}`,
        field: 'full_name',
        value: { name: 'Morgan Lee' },
        trustTier: 'GOLD',
        confidence: 0.98,
        sourceArtifactId: artifactId,
        sourceSystem: 'NPPES_API',
        parserVersion: 'v1.0.0',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        explanation: 'Derived from NPPES legal name record.',
      },
      {
        receiptId: 'receipt-identity-mobile-2',
        claimId: 'claim_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        verificationArtifactId: artifactId,
        subjectNpi: npi,
        entityId: `npi:${npi}`,
        field: 'license_status',
        value: { status: 'ACTIVE' },
        trustTier: 'GOLD',
        confidence: 0.97,
        sourceArtifactId: artifactId,
        sourceSystem: 'STATE_BOARD',
        parserVersion: 'v1.0.0',
        observedAt: new Date('2026-03-14T10:00:00.000Z'),
        explanation: 'Derived from state board license data.',
      },
    ],
  });

  return { npi };
}

describe('identity mobile routes', () => {
  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('serves mobile identity previews and paginated claim feeds', async () => {
    const { npi } = await seedIdentityFixture();
    const app = buildApp();

    const identity = await request(app)
      .get(`/api/identity/${npi}?view=mobile&depth=1&limit=2`)
      .expect(200);

    expect(identity.body.view).toBe('mobile');
    expect(identity.body.identity.fullName).toBe('Morgan Lee');
    expect(identity.body.previews.claims).toHaveLength(2);
    expect(identity.body.previews.receipts).toHaveLength(2);
    expect(identity.body.previews.relationships).toHaveLength(1);
    expect(identity.body.links.graph).toContain('/api/graph/mobile/');

    const claims = await request(app)
      .get(`/api/identity/${npi}/claims?view=mobile&limit=2`)
      .expect(200);

    expect(claims.body.claims).toHaveLength(2);
    expect(claims.body.page.nextCursor).toBe('2');

    const claimPageTwo = await request(app)
      .get(`/api/identity/${npi}/claims?view=mobile&limit=2&cursor=2`)
      .expect(200);

    expect(claimPageTwo.body.claims[0].claimId).not.toBe(claims.body.claims[0].claimId);

    const receipts = await request(app)
      .get(`/api/identity/${npi}/receipts?view=mobile&limit=1`)
      .expect(200);

    expect(receipts.body.receipts).toHaveLength(1);
    expect(receipts.body.page.nextCursor).toBe('1');
  });

  it('creates mobile watchtower subscriptions and serves the queued alert feed', async () => {
    const { npi } = await seedIdentityFixture();
    const app = buildApp();

    const subscriptionResponse = await request(app)
      .post('/api/watchtower/mobile/subscriptions')
      .send({
        name: 'Clinical Ops',
        monitoredProviders: [npi],
        trustScoreDrops: true,
        anomalyEvents: false,
        deviceId: 'ios-device-123',
        platform: 'ios',
      })
      .expect(201);

    const subscriptionId = subscriptionResponse.body.subscription.subscriptionId as string;
    expect(subscriptionId).toBeTruthy();

    const watchlists = await prisma.watchlist.findMany({
      where: {
        targetType: 'PROVIDER',
        targetValue: npi,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(watchlists).toHaveLength(1);

    const alert = await prisma.trustAlertRecord.create({
      data: {
        alertId: 'mobile-watchtower-alert-1',
        type: 'watchtower_delta',
        severity: 'HIGH',
        title: 'License status changed',
        description: 'California license changed to probation',
        subject: npi,
        recommendedAction: 'Review provider status before deployment.',
      },
    });

    await prisma.alertDeliveryAttempt.create({
      data: {
        trustAlertRecordId: alert.id,
        watchlistId: watchlists[0]!.id,
        channel: 'EVENT_SINK',
        status: 'PENDING',
        dedupeKey: 'mobile-watchtower-delivery-1',
        payload: {
          subject: npi,
          type: 'watchtower_delta',
        },
      },
    });

    const queue = await request(app)
      .get(`/api/watchtower/mobile/queue?subscriptionId=${encodeURIComponent(subscriptionId)}&limit=20`)
      .expect(200);

    expect(queue.body.subscriptionId).toBe(subscriptionId);
    expect(queue.body.alerts).toHaveLength(1);
    expect(queue.body.alerts[0].type).toBe('LICENSE_CHANGE');
    expect(queue.body.alerts[0].providerNpi).toBe(npi);

    const watchtowerMobile = await request(app)
      .get(`/api/identity/${npi}/watchtower?view=mobile&limit=20`)
      .expect(200);

    expect(watchtowerMobile.body.summary.totalAlerts).toBe(1);
    expect(watchtowerMobile.body.alerts[0].title).toBe('License status changed');

    const ack = await request(app)
      .post('/api/watchtower/mobile/queue/ack')
      .send({
        subscriptionId,
        deliveryAttemptId: queue.body.alerts[0].eventId,
      })
      .expect(200);

    expect(ack.body.status).toBe('DELIVERED');
  });
});
