import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { registerAgentRoutes } from '../agents';
import {
  strategyAgentInsightListResponseSchema,
  strategyAgentListResponseSchema,
  strategyAgentReportListResponseSchema,
  strategyAgentRunResponseSchema,
} from '../../services/strategyAgents/contracts';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerAgentRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.decisionCapsule.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedProviderProfile(): Promise<void> {
  await prisma.user.create({
    data: {
      clerkUserId: 'clerk-strategy-agent-1',
      email: 'strategy-agent-test@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
      personProfile: {
        create: {
          npi: '1558302470',
          firstName: 'Ada',
          lastName: 'Lovelace',
          specialty: 'Cardiology',
          stateOfPractice: 'CA',
        },
      },
    },
  });
}

async function seedPredictions(): Promise<void> {
  await prisma.predictionInsight.createMany({
    data: [
      {
        predictionId: 'pred-provider-1',
        predictionType: 'EMERGING_INVESTIGATOR',
        targetEntityType: 'provider',
        targetEntityId: '1558302470',
        targetEntityLabel: 'Ada Lovelace',
        probability: 0.88,
        confidence: 0.81,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'publication_growth', value: 5, direction: 'UP', source: 'CLAIM_RECORDS' },
          { label: 'recent_grants', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
          { label: 'graph_degree', value: 11, direction: 'UP', source: 'GRAPH_RUNTIME' },
        ] as Prisma.InputJsonValue,
        explanation: 'Ada Lovelace is likely to emerge as a higher-visibility investigator within 90d.',
        metadata: {
          publicationGrowth: 5,
          citationCount: 180,
        } as Prisma.InputJsonValue,
      },
      {
        predictionId: 'pred-specialty-1',
        predictionType: 'WORKFORCE_SHORTAGE_ESCALATION',
        targetEntityType: 'market',
        targetEntityId: 'market:CA:cardiology',
        targetEntityLabel: 'CA Cardiology',
        probability: 0.83,
        confidence: 0.76,
        timeHorizon: '90d',
        evidenceSignals: [
          { label: 'active_demand', value: 4, direction: 'UP', source: 'OPPORTUNITIES' },
          { label: 'mapped_supply', value: 1, direction: 'DOWN', source: 'PERSON_PROFILES' },
          { label: 'pressure_score', value: 82, direction: 'UP', source: 'OPPORTUNITIES' },
        ] as Prisma.InputJsonValue,
        explanation: 'CA Cardiology is likely to face a deeper workforce shortage within 90d.',
        metadata: {
          demand: 4,
          supply: 1,
          pressureScore: 82,
        } as Prisma.InputJsonValue,
      },
      {
        predictionId: 'pred-institution-1',
        predictionType: 'INSTITUTION_RESEARCH_GROWTH',
        targetEntityType: 'institution',
        targetEntityId: 'institution:mayo-clinic',
        targetEntityLabel: 'Mayo Clinic',
        probability: 0.79,
        confidence: 0.74,
        timeHorizon: '180d',
        evidenceSignals: [
          { label: 'research_growth', value: 7, direction: 'UP', source: 'CLAIM_RECORDS' },
          { label: 'contributing_providers', value: 4, direction: 'UP', source: 'CLAIM_RECORDS' },
          { label: 'lead_investigators', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
        ] as Prisma.InputJsonValue,
        explanation: 'Mayo Clinic is likely to keep accelerating research output within 180d.',
        metadata: {
          recentResearchCount: 12,
          researchGrowth: 7,
        } as Prisma.InputJsonValue,
      },
      {
        predictionId: 'pred-network-1',
        predictionType: 'NETWORK_CLUSTER_EXPANSION',
        targetEntityType: 'provider',
        targetEntityId: '1558302470',
        targetEntityLabel: 'Ada Lovelace',
        probability: 0.78,
        confidence: 0.73,
        timeHorizon: '60d',
        evidenceSignals: [
          { label: 'connection_growth', value: 6, direction: 'UP', source: 'GRAPH_RUNTIME' },
          { label: 'peer_growth', value: 3, direction: 'UP', source: 'GRAPH_RUNTIME' },
          { label: 'anchor_count', value: 2, direction: 'UP', source: 'GRAPH_RUNTIME' },
        ] as Prisma.InputJsonValue,
        explanation: 'Ada Lovelace is likely to keep expanding her collaboration cluster within 60d.',
        metadata: {
          recentConnections: 9,
          averageConfidence: 0.84,
        } as Prisma.InputJsonValue,
      },
    ],
  });
}

async function seedInstitutionClaim(): Promise<void> {
  await prisma.claimRecord.create({
    data: {
      claimId: 'claim-strategy-affiliation-1',
      subjectNpi: '1558302470',
      claimType: 'INSTITUTION_AFFILIATION',
      value: {
        institution: 'Mayo Clinic',
      },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.93,
      sourceId: 'PECOS_PUBLIC',
      parserVersion: 'v1.0.0',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-10T00:00:00.000Z'),
      derivedAt: new Date('2026-03-10T00:00:00.000Z'),
    },
  });
}

async function seedDemandSignals(): Promise<void> {
  const data = Array.from({ length: 4 }).map((_, index) => ({
    subjectDid: `did:example:clinician-${index + 1}`,
    subjectNpi: `155830247${index}`,
    decisionType: 'HIRING',
    decisionTimestamp: new Date(`2026-03-${10 + index}T00:00:00.000Z`),
    credentialIds: [`cred-${index + 1}`],
    issuerIds: ['issuer-1'],
    artifactHash: `hash-${index + 1}`,
    metadata: {
      specialty: 'cardiology',
      state: 'CA',
    } as Prisma.InputJsonValue,
  }));

  await prisma.decisionCapsule.createMany({ data });
}

async function seedNetworkFinding(): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId: 'network-finding-1',
      investigatorId: 'network_emergence',
      findingType: 'network_emergence',
      scope: 'provider',
      severity: 'medium',
      status: 'new',
      title: 'Network emergence around Ada Lovelace',
      summary: 'Recent collaboration edges formed a denser-than-usual cluster.',
      explanation: 'Recent collaboration edges formed a denser-than-usual cluster.',
      confidence: 0.82,
      priorityScore: 0.71,
      trustImpact: 0.66,
      freshness: 0.7,
      novelty: 0.78,
      entityImportance: 0.75,
      graphCentrality: 0.8,
      entityIds: ['1558302470'],
      audienceRoles: ['research', 'executive'],
      supportingEvidence: [{
        evidenceId: 'network-finding-1:evidence',
        evidenceType: 'graph',
        sourceId: 'GRAPH_RUNTIME',
        sourceLabel: 'Graph Runtime',
        snippet: 'Connection growth increased by six edges.',
      }] as Prisma.InputJsonValue,
      rankBreakdown: {
        severity: 0.6,
        confidence: 0.82,
        trustImpact: 0.66,
        freshness: 0.7,
        novelty: 0.78,
        entityImportance: 0.75,
        graphCentrality: 0.8,
        total: 0.73,
        weights: {
          severity: 0.2,
          confidence: 0.2,
          trustImpact: 0.15,
          freshness: 0.1,
          novelty: 0.1,
          entityImportance: 0.15,
          graphCentrality: 0.1,
        },
      } as Prisma.InputJsonValue,
      metadata: {} as Prisma.InputJsonValue,
      storylineKey: 'network_emergence:1558302470',
      dedupeKey: 'network-finding-1',
      firstSeenAt: new Date('2026-03-14T00:00:00.000Z'),
      lastSeenAt: new Date('2026-03-15T00:00:00.000Z'),
      occurrenceCount: 1,
      createdAt: new Date('2026-03-14T00:00:00.000Z'),
      updatedAt: new Date('2026-03-15T00:00:00.000Z'),
      entityLinks: {
        create: [{
          entityType: 'provider',
          entityId: '1558302470',
          entityLabel: 'Ada Lovelace',
          relationship: 'subject',
          metadata: {},
        }],
      },
      statusEvents: {
        create: [{
          fromStatus: null,
          toStatus: 'new',
          note: 'Seeded network finding for strategy agent route tests.',
          metadata: {},
        }],
      },
    },
  });
}

async function seedFixture(): Promise<void> {
  await seedProviderProfile();
  await seedPredictions();
  await seedInstitutionClaim();
  await seedDemandSignals();
  await seedNetworkFinding();
}

describe('strategy agent routes', () => {
  beforeEach(async () => {
    await resetState();
    await seedFixture();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('runs strategy agents and exposes report and insight APIs', async () => {
    const app = buildApp();

    const runResponse = await request(app)
      .post('/api/agents/run')
      .send({ refreshPredictions: false })
      .expect(200);

    expect(() => strategyAgentRunResponseSchema.parse(runResponse.body)).not.toThrow();
    expect(runResponse.body.runs).toHaveLength(4);
    expect(runResponse.body.runs.some((run: { publishedFindings: unknown[] }) => run.publishedFindings.length > 0)).toBe(true);

    const reportsResponse = await request(app)
      .get('/api/agents/reports')
      .query({ agentType: 'provider_trajectory' })
      .expect(200);

    expect(() => strategyAgentReportListResponseSchema.parse(reportsResponse.body)).not.toThrow();
    expect(reportsResponse.body.total).toBe(1);
    expect(reportsResponse.body.reports[0].headline).toContain('Ada Lovelace');

    const insightsResponse = await request(app)
      .get('/api/agents/insights')
      .query({ agentType: 'provider_trajectory' })
      .expect(200);

    expect(() => strategyAgentInsightListResponseSchema.parse(insightsResponse.body)).not.toThrow();
    expect(insightsResponse.body.total).toBeGreaterThanOrEqual(1);
    expect(insightsResponse.body.insights[0].predictions.length).toBeGreaterThanOrEqual(1);

    const statusResponse = await request(app)
      .get('/api/agents')
      .expect(200);

    expect(() => strategyAgentListResponseSchema.parse(statusResponse.body)).not.toThrow();
    expect(statusResponse.body.agents).toHaveLength(4);
  });

  it('uses memory snapshots to detect provider trajectory change versus baseline', async () => {
    const app = buildApp();

    await request(app)
      .post('/api/agents/run')
      .send({
        agentType: 'provider_trajectory',
        refreshPredictions: false,
      })
      .expect(200);

    await prisma.predictionInsight.update({
      where: { predictionId: 'pred-provider-1' },
      data: {
        probability: 0.54,
        confidence: 0.69,
      },
    });

    const rerun = await request(app)
      .post('/api/agents/run')
      .send({
        agentType: 'provider_trajectory',
        refreshPredictions: false,
      })
      .expect(200);

    expect(() => strategyAgentRunResponseSchema.parse(rerun.body)).not.toThrow();
    expect(rerun.body.runs[0].insights[0].delta).toBeLessThan(0);
    expect(rerun.body.runs[0].insights[0].headline).toContain('losing research influence');

    const insightList = await request(app)
      .get('/api/agents/insights')
      .query({ agentType: 'provider_trajectory' })
      .expect(200);

    expect(insightList.body.insights[0].delta).toBeLessThan(0);
    expect(insightList.body.insights[0].reasoningLog.some((entry: { detail: string }) => entry.detail.includes('baseline'))).toBe(true);
  });
});
