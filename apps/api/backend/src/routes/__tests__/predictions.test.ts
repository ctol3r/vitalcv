import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { registerPredictionRoutes } from '../predictions';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPredictionRoutes(app);
  return app;
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function deleteResidencyProgramsIfAvailable(): Promise<void> {
  try {
    await prisma.residencyProgram.deleteMany({});
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}

async function createResidencyProgramIfAvailable(data: {
  name: string;
  specialty: string;
  acgme_code: string;
  hospital_affiliation: string;
}): Promise<void> {
  try {
    await prisma.residencyProgram.create({ data });
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
}

async function resetState(): Promise<void> {
  await prisma.predictionInsight.deleteMany({});
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.trustAlertRecord.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.trustScoreHistory.deleteMany({});
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.user.deleteMany({});
  await deleteResidencyProgramsIfAvailable();
}

async function seedInvestigatorFinding(): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId: 'finding-trust-risk',
      investigatorId: 'trust-decline-investigator',
      findingType: 'trust_decline',
      scope: 'provider',
      severity: 'high',
      status: 'new',
      title: 'Trust decline remains active for provider 1234567890',
      summary: 'Trust decline and stale source signals remain open.',
      explanation: 'Trust decline and stale source signals remain open.',
      confidence: 0.88,
      priorityScore: 0.81,
      trustImpact: 0.84,
      freshness: 0.71,
      novelty: 0.62,
      entityImportance: 0.77,
      graphCentrality: 0.59,
      entityIds: ['1234567890'],
      audienceRoles: ['operations'],
      supportingEvidence: [{
        evidenceId: 'finding-trust-risk:evidence',
        evidenceType: 'claim',
        sourceId: 'TRUST_SCORE_HISTORY',
        sourceLabel: 'TRUST_SCORE_HISTORY',
        snippet: 'Trust score declined 12 points.',
      }] as Prisma.InputJsonValue,
      rankBreakdown: {
        severity: 0.8,
        confidence: 0.88,
        trustImpact: 0.84,
        freshness: 0.71,
        novelty: 0.62,
        entityImportance: 0.77,
        graphCentrality: 0.59,
        total: 0.79,
      } as Prisma.InputJsonValue,
      metadata: {
        npi: '1234567890',
        staleDimensions: [{ claimClass: 'licensure' }],
      } as Prisma.InputJsonValue,
      storylineKey: 'trust-risk:1234567890',
      dedupeKey: 'finding-trust-risk',
      firstSeenAt: new Date('2026-02-20T00:00:00.000Z'),
      lastSeenAt: new Date('2026-03-15T00:00:00.000Z'),
      occurrenceCount: 1,
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      updatedAt: new Date('2026-03-15T00:00:00.000Z'),
      entityLinks: {
        create: [{
          entityType: 'provider',
          entityId: '1234567890',
          entityLabel: 'Dr. Ada Lovelace',
          relationship: 'subject',
          metadata: {},
        }],
      },
      statusEvents: {
        create: [{
          fromStatus: null,
          toStatus: 'new',
          note: 'Seeded for prediction route test.',
          metadata: {},
        }],
      },
    },
  });
}

async function seedPredictionFixture(): Promise<void> {
  const organization = await prisma.organization.create({
    data: {
      name: 'Mayo Clinic',
      slug: 'mayo-clinic',
    },
  });

  const user = await prisma.user.create({
    data: {
      clerkUserId: 'prediction-user-1',
      email: 'prediction-user-1@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
  });

  await prisma.personProfile.create({
    data: {
      userId: user.id,
      npi: '1234567890',
      npiType: 'TYPE_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
      completeness: 90,
    },
  });

  await createResidencyProgramIfAvailable({
    name: 'Mayo Clinic Cardiology Fellowship',
    specialty: 'Cardiology',
    acgme_code: '1402100046',
    hospital_affiliation: 'Mayo Clinic',
  });

  await prisma.graphNode.createMany({
    data: [
      {
        id: 'clinician:1234567890',
        canonicalKey: 'clinician:1234567890',
        type: 'clinician',
        label: 'Dr. Ada Lovelace',
        title: 'Dr. Ada Lovelace',
        colorGroup: '#f59e0b',
        groupKey: 'clinician',
        tags: ['cardiology'],
        metadata: {
          npi: '1234567890',
          specialty: 'Cardiology',
          institution: 'Mayo Clinic',
        },
        degree: 4,
        inDegree: 2,
        outDegree: 2,
        sourceRefs: ['OPENALEX', 'CLINICAL_TRIALS'],
      },
      {
        id: 'clinician:2234567890',
        canonicalKey: 'clinician:2234567890',
        type: 'clinician',
        label: 'Dr. Grace Hopper',
        title: 'Dr. Grace Hopper',
        colorGroup: '#22d3ee',
        groupKey: 'clinician',
        tags: ['cardiology'],
        metadata: {
          npi: '2234567890',
        },
        degree: 2,
        inDegree: 1,
        outDegree: 1,
        sourceRefs: ['OPENALEX'],
      },
      {
        id: 'publication:heart-paper',
        canonicalKey: 'publication:heart-paper',
        type: 'publication',
        label: 'Heart Paper',
        title: 'Heart Paper',
        colorGroup: '#06b6d4',
        groupKey: 'publication',
        tags: ['research'],
        metadata: {},
        degree: 1,
        inDegree: 1,
        outDegree: 0,
        sourceRefs: ['OPENALEX'],
      },
    ],
  });

  await prisma.graphEdge.createMany({
    data: [
      {
        id: 'edge:recent:1',
        canonicalKey: 'edge:recent:1',
        pairKey: 'clinician:1234567890|clinician:2234567890|co_author',
        sourceNodeId: 'clinician:1234567890',
        targetNodeId: 'clinician:2234567890',
        edgeType: 'co_author',
        directed: false,
        reciprocal: true,
        confidence: 0.91,
        status: 'ACTIVE',
        createdBy: 'system',
        provenance: {},
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        id: 'edge:recent:2',
        canonicalKey: 'edge:recent:2',
        pairKey: 'clinician:1234567890|publication:heart-paper|published_with',
        sourceNodeId: 'clinician:1234567890',
        targetNodeId: 'publication:heart-paper',
        edgeType: 'published_with',
        directed: false,
        reciprocal: true,
        confidence: 0.88,
        status: 'ACTIVE',
        createdBy: 'system',
        provenance: {},
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
      },
      {
        id: 'edge:previous:1',
        canonicalKey: 'edge:previous:1',
        pairKey: 'clinician:1234567890|clinician:3234567890|co_author',
        sourceNodeId: 'clinician:1234567890',
        targetNodeId: 'clinician:2234567890',
        edgeType: 'related_to',
        directed: false,
        reciprocal: true,
        confidence: 0.74,
        status: 'ACTIVE',
        createdBy: 'system',
        provenance: {},
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
      },
    ],
  });

  await prisma.trustScoreHistory.createMany({
    data: [
      {
        id: '10000000-0000-0000-0000-000000000101',
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 92,
        newScore: 88,
        scoreDelta: -4,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: 0.9,
        band: 'L3',
        methodologyVersion: 'TRUST_V1',
        metadata: {},
        recordedAt: new Date('2026-02-10T00:00:00.000Z'),
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
      },
      {
        id: '10000000-0000-0000-0000-000000000102',
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 88,
        newScore: 74,
        scoreDelta: -14,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: 0.94,
        band: 'L2',
        methodologyVersion: 'TRUST_V1',
        metadata: {},
        recordedAt: new Date('2026-03-14T00:00:00.000Z'),
        createdAt: new Date('2026-03-14T00:00:00.000Z'),
      },
    ],
  });

  await prisma.trustAlertRecord.create({
    data: {
      alertId: 'alert-provider-1',
      type: 'TRUST_DECLINE',
      severity: 'HIGH',
      title: 'Trust decline',
      description: 'Trust decline alert',
      subject: '1234567890',
      recommendedAction: 'Review provider',
      createdAt: new Date('2026-03-14T06:00:00.000Z'),
    },
  });

  const claimRows: Prisma.ClaimRecordCreateManyInput[] = [
    {
      claimId: 'claim-pub-recent-1',
      subjectNpi: '1234567890',
      claimType: 'PUBLICATION',
      value: { citationCount: 120, title: 'Recent publication one' },
      trustTier: 'SILVER',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.9,
      sourceId: 'OPENALEX',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-01T00:00:00.000Z'),
      derivedAt: new Date('2026-03-01T00:00:00.000Z'),
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    {
      claimId: 'claim-pub-recent-2',
      subjectNpi: '1234567890',
      claimType: 'CITATION_METRIC',
      value: { citationCount: 140, title: 'Recent citation metric' },
      trustTier: 'SILVER',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.92,
      sourceId: 'PUBMED',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-05T00:00:00.000Z'),
      derivedAt: new Date('2026-03-05T00:00:00.000Z'),
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
    },
    {
      claimId: 'claim-trial-recent',
      subjectNpi: '1234567890',
      claimType: 'CLINICAL_TRIAL',
      value: { role: 'PI' },
      trustTier: 'SILVER',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.88,
      sourceId: 'CLINICAL_TRIALS',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-06T00:00:00.000Z'),
      derivedAt: new Date('2026-03-06T00:00:00.000Z'),
      createdAt: new Date('2026-03-06T00:00:00.000Z'),
    },
    {
      claimId: 'claim-grant-recent',
      subjectNpi: '1234567890',
      claimType: 'NIH_GRANT',
      value: { grantId: 'grant-1' },
      trustTier: 'SILVER',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.86,
      sourceId: 'NIH_REPORTER',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-07T00:00:00.000Z'),
      derivedAt: new Date('2026-03-07T00:00:00.000Z'),
      createdAt: new Date('2026-03-07T00:00:00.000Z'),
    },
    {
      claimId: 'claim-pub-previous',
      subjectNpi: '1234567890',
      claimType: 'PUBLICATION',
      value: { citationCount: 40, title: 'Previous publication' },
      trustTier: 'SILVER',
      confidenceLabel: 'MEDIUM',
      confidenceScore: 0.7,
      sourceId: 'OPENALEX',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2025-10-01T00:00:00.000Z'),
      derivedAt: new Date('2025-10-01T00:00:00.000Z'),
      createdAt: new Date('2025-10-01T00:00:00.000Z'),
    },
    {
      claimId: 'claim-affiliation-recent',
      subjectNpi: '1234567890',
      claimType: 'INSTITUTION_AFFILIATION',
      value: { institution: 'Mayo Clinic' },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.96,
      sourceId: 'NPPES_API',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-04T00:00:00.000Z'),
      derivedAt: new Date('2026-03-04T00:00:00.000Z'),
      createdAt: new Date('2026-03-04T00:00:00.000Z'),
    },
    {
      claimId: 'claim-payment-recent',
      subjectNpi: '1234567890',
      claimType: 'INDUSTRY_PAYMENT',
      value: { topPayers: ['Acme Pharma', 'Beta Bio'] },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.93,
      sourceId: 'OPEN_PAYMENTS',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-02T00:00:00.000Z'),
      derivedAt: new Date('2026-03-02T00:00:00.000Z'),
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
    },
    {
      claimId: 'claim-payment-previous',
      subjectNpi: '1234567890',
      claimType: 'INDUSTRY_PAYMENT',
      value: { topPayers: ['Acme Pharma'] },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.89,
      sourceId: 'OPEN_PAYMENTS',
      parserVersion: 'v1',
      status: 'ACTIVE',
      observedAt: new Date('2025-11-02T00:00:00.000Z'),
      derivedAt: new Date('2025-11-02T00:00:00.000Z'),
      createdAt: new Date('2025-11-02T00:00:00.000Z'),
    },
  ];

  await prisma.claimRecord.createMany({ data: claimRows });

  await prisma.opportunity.createMany({
    data: [
      {
        organizationId: organization.id,
        title: 'Cardiology Locums',
        specialty: 'Cardiology',
        hiringType: 'locums',
        state: 'CA',
        payRange: '$350000-$420000',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        organizationId: organization.id,
        title: 'Cardiology Nights',
        specialty: 'Cardiology',
        hiringType: 'perm',
        state: 'CA',
        payRange: '$330000-$400000',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
      },
      {
        organizationId: organization.id,
        title: 'Cardiology Weekend',
        specialty: 'Cardiology',
        hiringType: 'contract',
        state: 'CA',
        payRange: '$340000-$410000',
        status: 'ACTIVE',
        createdAt: new Date('2026-03-12T00:00:00.000Z'),
      },
      {
        organizationId: organization.id,
        title: 'Cardiology Historical',
        specialty: 'Cardiology',
        hiringType: 'perm',
        state: 'CA',
        payRange: '$280000-$320000',
        status: 'CLOSED',
        createdAt: new Date('2025-11-12T00:00:00.000Z'),
      },
    ],
  });

  await seedInvestigatorFinding();
}

describe('prediction routes', () => {
  beforeEach(async () => {
    await resetState();
    await seedPredictionFixture();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('lists normalized FE17-A predictions with filters', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/predictions')
      .query({
        type: 'PROVIDER_TRAJECTORY',
        state: 'rising',
        confidence: '0.5',
      })
      .expect(200);

    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.predictions[0]).toEqual(expect.objectContaining({
      type: 'PROVIDER_TRAJECTORY',
      entityType: 'provider',
      state: 'rising',
      forecast: true,
      entity: expect.objectContaining({
        entityType: 'provider',
        entityId: '1234567890',
      }),
    }));
    expect(response.body.predictions[0].signals.length).toBeGreaterThan(0);
    expect(response.body.predictions[0].drivers.length).toBeGreaterThan(0);
    expect(response.body.predictions[0].last_updated).toEqual(response.body.predictions[0].updatedAt);
  });

  it('returns provider, institution, specialty, and network scoped prediction summaries', async () => {
    const app = buildApp();

    const provider = await request(app)
      .get('/api/predictions/providers/1234567890')
      .expect(200);
    expect(provider.body.provider.predictionSummary.available).toBe(true);
    expect(provider.body.predictions.some((prediction: { type: string }) => prediction.type === 'TRUST_RISK_ACCELERATION')).toBe(true);
    expect(provider.body.intelligence.coverage.coverageScore).toBeGreaterThan(0);
    expect(provider.body.intelligence.signalHistory.length).toBeGreaterThan(0);
    expect(provider.body.intelligence.networkChanges.length).toBeGreaterThan(0);

    const institution = await request(app)
      .get('/api/predictions/institutions/mayo-clinic')
      .expect(200);
    expect(institution.body.institution.predictionSummary.topPrediction).toEqual(expect.objectContaining({
      type: 'INSTITUTION_MOMENTUM',
    }));
    expect(Array.isArray(institution.body.intelligence.networkChanges)).toBe(true);

    const specialty = await request(app)
      .get('/api/predictions/specialties/cardiology')
      .expect(200);
    expect(specialty.body.specialty.predictionSummary.topPrediction).toEqual(expect.objectContaining({
      type: 'SPECIALTY_PRESSURE',
    }));
    expect(Array.isArray(specialty.body.intelligence.signalHistory)).toBe(true);

    const network = await request(app)
      .get('/api/predictions/network/1234567890')
      .expect(200);
    expect(network.body.predictions.some((prediction: { type: string }) => prediction.type === 'NETWORK_SHIFT')).toBe(true);
  });
});
