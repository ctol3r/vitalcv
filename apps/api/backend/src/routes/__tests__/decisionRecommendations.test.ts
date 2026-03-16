import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { registerDecisionRoutes } from '../decisions';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerDecisionRoutes(app);
  return app;
}

type RecommendationLike = {
  actionType: string;
  decisionId: string;
  targetEntity: {
    entityType: string;
    entityId: string;
  };
  rationale?: string;
  state?: string;
  supportingSignals?: unknown[];
};

function bodyRecommendations(body: Record<string, unknown>): RecommendationLike[] {
  return Array.isArray(body.recommendations) ? body.recommendations as RecommendationLike[] : [];
}

function bodyRecommendation(body: Record<string, unknown>): RecommendationLike | null {
  const recommendation = body.recommendation;
  return recommendation && typeof recommendation === 'object' ? recommendation as RecommendationLike : null;
}

async function resetState(): Promise<void> {
  await prisma.actionStatusEvent.deleteMany({});
  await prisma.actionRecommendation.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.storylineEntityLink.deleteMany({});
  await prisma.storyline.deleteMany({});
  await prisma.graphClusterAssignment.deleteMany({});
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedFinding(input: {
  findingId: string;
  findingType: string;
  severity: 'critical' | 'medium';
  title: string;
  summary: string;
  explanation: string;
  metadata: Record<string, unknown>;
  entityLinks: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string;
    relationship: string;
  }>;
}): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId: input.findingId,
      investigatorId: `${input.findingType}_monitor`,
      findingType: input.findingType,
      scope: 'provider',
      severity: input.severity,
      status: 'new',
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      confidence: input.severity === 'critical' ? 0.93 : 0.78,
      priorityScore: input.severity === 'critical' ? 0.96 : 0.61,
      trustImpact: 0.9,
      freshness: 0.82,
      novelty: 0.74,
      entityImportance: 0.79,
      graphCentrality: 0.72,
      entityIds: [...new Set(input.entityLinks.map((entity) => entity.entityId))],
      audienceRoles: ['operations', 'compliance'],
      supportingEvidence: [{
        evidenceId: `${input.findingId}:evidence`,
        sourceId: 'TEST',
        sourceLabel: 'TEST',
        snippet: input.summary,
      }] as Prisma.InputJsonValue,
      rankBreakdown: {} as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue,
      storylineKey: `${input.findingType}:${input.entityLinks[0]!.entityId}`,
      dedupeKey: input.findingId,
      firstSeenAt: new Date('2026-03-14T12:00:00.000Z'),
      lastSeenAt: new Date('2026-03-15T12:00:00.000Z'),
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      updatedAt: new Date('2026-03-15T12:00:00.000Z'),
      occurrenceCount: 1,
      entityLinks: {
        create: input.entityLinks.map((entity) => ({
          entityType: entity.entityType,
          entityId: entity.entityId,
          entityLabel: entity.entityLabel,
          relationship: entity.relationship,
          metadata: {},
        })),
      },
      statusEvents: {
        create: [{
          fromStatus: null,
          toStatus: 'new',
          note: 'Seeded for FE18 decision route test.',
          metadata: {},
        }],
      },
    },
  });
}

async function seedDecisionFixture(): Promise<void> {
  await prisma.user.create({
    data: {
      clerkUserId: 'decision-user-1',
      email: 'decision-test@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
      personProfile: {
        create: {
          npi: '1234567890',
          firstName: 'Ada',
          lastName: 'Lovelace',
          specialty: 'Cardiology',
          stateOfPractice: 'CA',
        },
      },
    },
  });

  await seedFinding({
    findingId: 'finding-trust-decline',
    findingType: 'trust_decline',
    severity: 'critical',
    title: 'Ada Lovelace trust score is deteriorating',
    summary: 'Credential freshness and trust signals are deteriorating for Ada Lovelace.',
    explanation: 'Credential freshness and trust signals are deteriorating for Ada Lovelace.',
    metadata: {
      npi: '1234567890',
      staleDimensions: [{ claimClass: 'licensure' }],
      graphCentrality: 0.72,
    },
    entityLinks: [
      {
        entityType: 'provider',
        entityId: '1234567890',
        entityLabel: 'Ada Lovelace',
        relationship: 'subject',
      },
      {
        entityType: 'institution',
        entityId: 'mayo-clinic',
        entityLabel: 'Mayo Clinic',
        relationship: 'affiliated_with',
      },
    ],
  });

  await seedFinding({
    findingId: 'finding-network-emergence',
    findingType: 'network_emergence',
    severity: 'medium',
    title: 'Ada Lovelace entered an emerging collaboration cluster',
    summary: 'A new collaboration cluster is forming around Ada Lovelace.',
    explanation: 'A new collaboration cluster is forming around Ada Lovelace.',
    metadata: {
      npi: '1234567890',
      graphCentrality: 0.72,
    },
    entityLinks: [{
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Ada Lovelace',
      relationship: 'subject',
    }],
  });

  await prisma.storyline.create({
    data: {
      storylineId: 'storyline-credential-risk',
      fingerprint: 'storyline-credential-risk',
      storylineType: 'TRUST_DECLINE',
      perspective: 'PROVIDER',
      title: 'Credential risk is developing around Ada Lovelace',
      summary: 'Multiple trust and freshness findings are clustering around Ada Lovelace.',
      whyItMatters: 'This storyline may materially lower provider trust and requires investigation.',
      severity: 'HIGH',
      status: 'ACTIVE',
      confidence: 0.81,
      entityIds: ['1234567890'],
      progressionScore: 0.73,
      findingIds: ['finding-trust-decline'],
      supportingEvidence: [
        { source: 'LEIE', note: 'Exclusion source refresh' },
        { source: 'SAM', note: 'Procurement exclusion source refresh' },
      ] as Prisma.InputJsonValue,
      recommendedActions: [] as Prisma.InputJsonValue,
      noveltyScore: 0.69,
      metadata: {
        stage: 'developing',
        noveltyScore: 0.69,
      } as Prisma.InputJsonValue,
      lastActivityAt: new Date('2026-03-15T11:00:00.000Z'),
      entityLinks: {
        create: [{
          entityType: 'PROVIDER',
          entityKey: '1234567890',
          entityLabel: 'Ada Lovelace',
          weight: 1,
          firstSeenAt: new Date('2026-03-14T09:00:00.000Z'),
          lastSeenAt: new Date('2026-03-15T11:00:00.000Z'),
        }],
      },
    },
  });

  await prisma.predictionInsight.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000101',
        predictionId: 'pred-provider-trajectory',
        predictionType: 'PROVIDER_TRAJECTORY',
        targetEntityType: 'provider',
        targetEntityId: '1234567890',
        targetEntityLabel: 'Ada Lovelace',
        probability: 0.89,
        confidence: 0.87,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'publication_growth', value: 2.2, direction: 'UP', source: 'OPENALEX' },
          { label: 'trial_activity', value: 3, direction: 'UP', source: 'CLINICAL_TRIALS' },
        ] as Prisma.InputJsonValue,
        explanation: 'Ada Lovelace is likely to accelerate in influence within 90d.',
        metadata: {
          graphDegree: 10,
        } as Prisma.InputJsonValue,
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        updatedAt: new Date('2026-03-15T10:00:00.000Z'),
      },
      {
        id: '00000000-0000-0000-0000-000000000102',
        predictionId: 'pred-institution-growth',
        predictionType: 'INSTITUTION_MOMENTUM',
        targetEntityType: 'institution',
        targetEntityId: 'mayo-clinic',
        targetEntityLabel: 'Mayo Clinic',
        probability: 0.81,
        confidence: 0.8,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'research_growth', value: 1.7, direction: 'UP', source: 'OPENALEX' },
          { label: 'contributing_providers', value: 5, direction: 'UP', source: 'OPENALEX' },
        ] as Prisma.InputJsonValue,
        explanation: 'Mayo Clinic research activity is likely to accelerate within 90d.',
        metadata: {} as Prisma.InputJsonValue,
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        updatedAt: new Date('2026-03-15T10:00:00.000Z'),
      },
      {
        id: '00000000-0000-0000-0000-000000000103',
        predictionId: 'pred-specialty-pressure',
        predictionType: 'SPECIALTY_PRESSURE',
        targetEntityType: 'specialty',
        targetEntityId: 'market:CA:cardiology',
        targetEntityLabel: 'CA Cardiology',
        probability: 0.84,
        confidence: 0.79,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'active_demand', value: 142, direction: 'UP', source: 'OPPORTUNITIES' },
          { label: 'shortage_ratio', value: 1.82, direction: 'UP', source: 'OPPORTUNITIES' },
          { label: 'pressure_score', value: 86, direction: 'UP', source: 'OPPORTUNITIES' },
        ] as Prisma.InputJsonValue,
        explanation: 'CA Cardiology is likely to face a deeper workforce shortage within 90d.',
        metadata: {} as Prisma.InputJsonValue,
        createdAt: new Date('2026-03-15T10:00:00.000Z'),
        updatedAt: new Date('2026-03-15T10:00:00.000Z'),
      },
    ],
  });

  await prisma.graphNode.create({
    data: {
      id: 'graph-node-ada',
      canonicalKey: 'provider:1234567890',
      type: 'PROVIDER',
      label: 'Ada Lovelace',
      title: 'Ada Lovelace',
      colorGroup: 'provider',
      degree: 12,
      metadata: {
        npi: '1234567890',
      } as Prisma.InputJsonValue,
      sourceRefs: ['OPENALEX', 'CLINICAL_TRIALS'],
    },
  });

  await prisma.graphClusterAssignment.create({
    data: {
      id: 'graph-cluster-ada',
      nodeId: 'graph-node-ada',
      clusterMode: 'provider',
      clusterKey: 'cluster-cardiology-1',
      score: 0.88,
    },
  });

  await prisma.graphEdge.create({
    data: {
      id: 'graph-edge-ada-self',
      canonicalKey: 'graph-edge-ada-self',
      pairKey: 'graph-node-ada::graph-node-ada',
      sourceNodeId: 'graph-node-ada',
      targetNodeId: 'graph-node-ada',
      edgeType: 'COAUTHOR',
      createdBy: 'decision-route-test',
      provenance: {} as Prisma.InputJsonValue,
      createdAt: new Date('2026-03-15T08:00:00.000Z'),
    },
  });
}

describe('decision recommendation routes', () => {
  beforeEach(async () => {
    await resetState();
    await seedDecisionFixture();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('lists FE18 recommendations and serves provider, storyline, institution, and specialty endpoints', async () => {
    const app = buildApp();

    const list = await request(app)
      .get('/api/decisions')
      .expect(200);
    const listRecommendations = bodyRecommendations(list.body as Record<string, unknown>);

    expect(list.body.total).toBeGreaterThanOrEqual(4);
    expect(listRecommendations.map((recommendation) => recommendation.actionType)).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    expect(listRecommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        supportingSignals: expect.any(Array),
      }),
    ]));
    expect(listRecommendations.some((recommendation) =>
      recommendation.targetEntity.entityType === 'provider' && recommendation.targetEntity.entityId === '1234567890',
    )).toBe(true);
    expect(listRecommendations.some((recommendation) => Boolean(recommendation.rationale))).toBe(true);

    const filtered = await request(app)
      .get('/api/decisions')
      .query({
        actionType: 'REVIEW_NOW',
        entityType: 'provider',
      })
      .expect(200);
    const filteredRecommendations = bodyRecommendations(filtered.body as Record<string, unknown>);

    expect(filtered.body.total).toBeGreaterThanOrEqual(1);
    expect(filteredRecommendations.every((recommendation) =>
      recommendation.targetEntity.entityType === 'provider',
    )).toBe(true);
    expect(filteredRecommendations.some((recommendation) => recommendation.actionType === 'REVIEW_NOW')).toBe(true);

    const provider = await request(app)
      .get('/api/decisions/providers/1234567890')
      .expect(200);
    const providerRecommendations = bodyRecommendations(provider.body as Record<string, unknown>);

    expect(provider.body.total).toBeGreaterThanOrEqual(1);
    expect(providerRecommendations.some((recommendation) =>
      recommendation.targetEntity.entityType === 'provider' && recommendation.targetEntity.entityId === '1234567890',
    )).toBe(true);

    const storyline = await request(app)
      .get('/api/decisions/storylines/storyline-credential-risk')
      .expect(200);
    const storylineRecommendations = bodyRecommendations(storyline.body as Record<string, unknown>);

    expect(storyline.body.total).toBeGreaterThanOrEqual(1);
    expect(storylineRecommendations.some((recommendation) =>
      recommendation.targetEntity.entityType === 'storyline'
        && recommendation.targetEntity.entityId === 'storyline-credential-risk',
    )).toBe(true);

    const institution = await request(app)
      .get('/api/decisions/institutions/mayo-clinic')
      .expect(200);
    const institutionRecommendations = bodyRecommendations(institution.body as Record<string, unknown>);

    expect(institution.body.total).toBe(1);
    expect(institutionRecommendations[0]?.targetEntity.entityType).toBe('institution');

    const specialty = await request(app)
      .get('/api/decisions/specialties/ca-cardiology')
      .expect(200);
    const specialtyRecommendations = bodyRecommendations(specialty.body as Record<string, unknown>);

    expect(specialty.body.total).toBe(1);
    expect(specialtyRecommendations[0]?.targetEntity.entityId).toBe('ca-cardiology');
    expect(specialtyRecommendations[0]?.rationale).toBeTruthy();
  });

  it('returns recommendation detail and supports FE18 state transitions', async () => {
    const app = buildApp();
    const provider = await request(app)
      .get('/api/decisions/providers/1234567890')
      .expect(200);
    const providerRecommendations = bodyRecommendations(provider.body as Record<string, unknown>);

    const reviewNow = providerRecommendations.find((recommendation) =>
      recommendation.actionType === 'REVIEW_NOW',
    ) ?? providerRecommendations[0];

    expect(reviewNow).toBeDefined();
    expect(reviewNow?.decisionId).toBeTruthy();

    const detail = await request(app)
      .get(`/api/decisions/recommendations/${reviewNow!.decisionId}`)
      .expect(200);
    const detailRecommendation = bodyRecommendation(detail.body as Record<string, unknown>);

    expect(detailRecommendation).toBeTruthy();
    expect(detailRecommendation?.decisionId).toBe(reviewNow?.decisionId);
    expect(detailRecommendation?.state).toBe('new');
    expect((detailRecommendation?.supportingSignals ?? []).length).toBeGreaterThan(0);

    const accepted = await request(app)
      .patch(`/api/decisions/recommendations/${reviewNow!.decisionId}/state`)
      .send({ state: 'accepted', actorId: 'ops-1', note: 'Queue for immediate credential review.' })
      .expect(200);
    const acceptedRecommendation = bodyRecommendation(accepted.body as Record<string, unknown>);

    expect(acceptedRecommendation?.state).toBe('accepted');

    const completed = await request(app)
      .patch(`/api/decisions/recommendations/${reviewNow!.decisionId}/state`)
      .send({ state: 'completed', actorId: 'ops-2', note: 'Credential review completed.' })
      .expect(200);
    const completedRecommendation = bodyRecommendation(completed.body as Record<string, unknown>);

    expect(completedRecommendation?.state).toBe('completed');

    const updatedDetail = await request(app)
      .get(`/api/decisions/recommendations/${reviewNow!.decisionId}`)
      .expect(200);
    const updatedRecommendation = bodyRecommendation(updatedDetail.body as Record<string, unknown>);

    expect(updatedRecommendation?.state).toBe('completed');
  });
});
