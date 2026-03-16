import express from 'express';
import request from 'supertest';
import prisma from '../../graphql/prisma_client';
import { registerIntelligenceEngineRoutes } from '../intelligence';
import { registerSearchRoutes } from '../search';
import { registerTrustIntelligenceRoutes } from '../trustIntelligence';
import { recordQueryHistory } from '../../services/intelligence/queryPredictionService';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntelligenceEngineRoutes(app);
  registerSearchRoutes(app);
  registerTrustIntelligenceRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.graphInsight.deleteMany({});
  await prisma.queryHistory.deleteMany({});
  await prisma.suggestionOutcome.deleteMany({});
  await prisma.learningEvent.deleteMany({});
  await prisma.trustScoreHistory.deleteMany({});
  await prisma.sourceReliabilityScore.deleteMany({});
  await prisma.anomalyHistory.deleteMany({});
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.sourceRun.deleteMany({});
  await prisma.searchObjectACL.deleteMany({});
  await prisma.searchObject.deleteMany({});
  await prisma.auditSnapshot.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
}

async function seedTrustFixture(): Promise<void> {
  await prisma.sourceRun.create({
    data: {
      sourceId: 'NPPES_API',
      subjectNpi: '1234567890',
      idempotencyKey: 'source-run-nppes-1',
      status: 'VERIFIED',
    },
  });

  await prisma.verificationArtifact.create({
    data: {
      npi: '1234567890',
      source: 'NPPES_API',
      status: 'VERIFIED',
      trustTier: 'GOLD',
      checksum: 'artifact-nppes-1',
      verifiedAt: new Date('2026-03-15T00:00:00.000Z'),
      rawPayload: {
        specialty: 'Cardiology',
      },
    },
  });
}

async function seedGraphAndSearchFixture(): Promise<void> {
  await prisma.graphNode.createMany({
    data: [
      {
        id: 'clinician:1234567890',
        canonicalKey: 'clinician:1234567890',
        type: 'clinician',
        label: 'Dr. Ada',
        title: 'Dr. Ada Lovelace',
        colorGroup: '#f59e0b',
        groupKey: 'clinician',
        tags: ['cardiology'],
        metadata: {
          specialty: 'Cardiology',
        },
        degree: 2,
        inDegree: 0,
        outDegree: 2,
        sourceRefs: ['artifact-nppes-1'],
      },
      {
        id: 'publication:heart-paper',
        canonicalKey: 'publication:heart-paper',
        type: 'publication',
        label: 'Heart Paper',
        title: 'Heart Paper',
        colorGroup: '#22d3ee',
        groupKey: 'publication',
        tags: ['research'],
        metadata: {},
        degree: 1,
        inDegree: 1,
        outDegree: 0,
        sourceRefs: ['openalex:1'],
      },
      {
        id: 'trial:valve-study',
        canonicalKey: 'trial:valve-study',
        type: 'trial',
        label: 'Valve Study',
        title: 'Valve Study',
        colorGroup: '#06b6d4',
        groupKey: 'trial',
        tags: ['research'],
        metadata: {},
        degree: 1,
        inDegree: 1,
        outDegree: 0,
        sourceRefs: ['clinicaltrials:1'],
      },
    ],
  });

  await prisma.graphEdge.createMany({
    data: [
      {
        id: 'edge:clinician:publication',
        canonicalKey: 'edge:clinician:publication',
        pairKey: 'clinician:1234567890|publication:heart-paper|published_with',
        sourceNodeId: 'clinician:1234567890',
        targetNodeId: 'publication:heart-paper',
        edgeType: 'published_with',
        directed: false,
        reciprocal: true,
        confidence: 0.92,
        status: 'ACTIVE',
        createdBy: 'system',
        provenance: {},
      },
      {
        id: 'edge:clinician:trial',
        canonicalKey: 'edge:clinician:trial',
        pairKey: 'clinician:1234567890|trial:valve-study|related_to',
        sourceNodeId: 'clinician:1234567890',
        targetNodeId: 'trial:valve-study',
        edgeType: 'related_to',
        directed: false,
        reciprocal: true,
        confidence: 0.88,
        status: 'ACTIVE',
        createdBy: 'system',
        provenance: {},
      },
    ],
  });

  await prisma.searchObject.create({
    data: {
      type: 'FAQ_DOC',
      title: 'Cardiologists in Texas',
      body: 'Trusted cardiologists across Texas.',
      embedding: [0.1, 0.2],
      metadata: {
        tags: ['cardiology', 'texas'],
      },
    },
  });

  await recordQueryHistory({ query: 'cardiologists in texas', resultCount: 3 });
  await recordQueryHistory({ query: 'cardiologists with high trust score', resultCount: 2 });
  await recordQueryHistory({ query: 'cardiologists at mayo clinic', resultCount: 2 });
}

describe('intelligence engine routes', () => {
  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('records source feedback and trust score evolution', async () => {
    await seedTrustFixture();
    const app = buildApp();

    const feedback = await request(app)
      .post('/api/intelligence/feedback/source')
      .send({
        sourceId: 'NPPES_API',
        subjectType: 'NPI',
        subjectId: '1234567890',
        status: 'SUCCEEDED',
      })
      .expect(201);

    expect(feedback.body.sourceReliability.sourceId).toBe('NPPES_API');
    expect(feedback.body.sourceReliability.sourceReliabilityScore).toBeGreaterThan(0);

    const reliability = await request(app)
      .get('/api/intelligence/sources/NPPES_API/reliability')
      .expect(200);

    expect(reliability.body.sourceReliabilityScore).toBeGreaterThan(0);

    await request(app)
      .get('/api/trust/score/1234567890')
      .expect(200);

    const history = await request(app)
      .get('/api/intelligence/trust/NPI/1234567890/history')
      .expect(200);

    expect(history.body.count).toBe(1);
    expect(history.body.history[0].triggerEvent).toBe('TRUST_SCORE_COMPUTED');
  });

  it('persists graph insights and predictive query suggestions', async () => {
    await seedGraphAndSearchFixture();
    const app = buildApp();

    const rebuild = await request(app)
      .post('/api/intelligence/graph/insights/rebuild')
      .send({
        nodeId: 'clinician:1234567890',
        graphMode: 'trust',
      })
      .expect(201);

    expect(rebuild.body.count).toBeGreaterThan(0);
    expect(rebuild.body.insights.some((insight: { insightType: string }) => insight.insightType === 'LIKELY_INVESTIGATOR')).toBe(true);

    const stored = await request(app)
      .get('/api/intelligence/graph/insights/clinician:1234567890')
      .expect(200);

    expect(stored.body.insights.some((insight: { insightType: string }) => insight.insightType === 'LIKELY_INVESTIGATOR')).toBe(true);

    const suggestions = await request(app)
      .post('/api/search/suggest')
      .send({ q: 'card', limit: 3 })
      .expect(200);

    expect(suggestions.body.suggestions).toEqual(expect.arrayContaining([
      'cardiologists in texas',
      'cardiologists with high trust score',
    ]));
    expect(Array.isArray(suggestions.body.popularPatterns)).toBe(true);

    await request(app)
      .post('/api/intelligence/query/feedback')
      .send({
        query: 'card',
        suggestion: 'cardiologists in texas',
        accepted: true,
      })
      .expect(201);

    const outcomes = await prisma.suggestionOutcome.findMany({
      where: { suggestionType: 'QUERY_SUGGESTION' },
    });

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.accepted).toBe(true);
  });
});
