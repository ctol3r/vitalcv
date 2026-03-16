import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { registerActionsRoutes } from '../actions';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerActionsRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.actionStatusEvent.deleteMany({});
  await prisma.actionRecommendation.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.trustScoreHistory.deleteMany({});
}

async function seedInvestigatorFinding(input: {
  findingId: string;
  findingType: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  summary: string;
  explanation: string;
  storylineKey: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId: input.findingId,
      investigatorId: input.findingType,
      findingType: input.findingType,
      scope: 'provider',
      severity: input.severity,
      status: 'new',
      title: input.title,
      summary: input.summary,
      explanation: input.explanation,
      confidence: 0.91,
      priorityScore: input.severity === 'critical' ? 0.95 : input.severity === 'high' ? 0.82 : 0.63,
      trustImpact: 0.88,
      freshness: 0.77,
      novelty: 0.81,
      entityImportance: 0.8,
      graphCentrality: 0.71,
      entityIds: ['1234567890'],
      audienceRoles: ['operations', 'compliance'],
      supportingEvidence: [{
        evidenceId: `${input.findingId}:evidence`,
        evidenceType: 'test',
        sourceId: 'TEST',
        sourceLabel: 'TEST',
        snippet: input.summary,
      }] as Prisma.InputJsonValue,
      rankBreakdown: {
        severity: 0.9,
        confidence: 0.91,
        trustImpact: 0.88,
        freshness: 0.77,
        novelty: 0.81,
        entityImportance: 0.8,
        graphCentrality: 0.71,
        total: 0.84,
        weights: {
          severity: 0.2,
          confidence: 0.15,
          trustImpact: 0.2,
          freshness: 0.1,
          novelty: 0.1,
          entityImportance: 0.15,
          graphCentrality: 0.1,
        },
      } as Prisma.InputJsonValue,
      metadata: input.metadata as Prisma.InputJsonValue,
      storylineKey: input.storylineKey,
      dedupeKey: input.findingId,
      firstSeenAt: new Date('2026-03-14T12:00:00.000Z'),
      lastSeenAt: new Date('2026-03-15T12:00:00.000Z'),
      occurrenceCount: 1,
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      updatedAt: new Date('2026-03-15T12:00:00.000Z'),
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
          note: 'Seeded for route test.',
          metadata: {},
        }],
      },
    },
  });
}

async function seedActionFixtures(): Promise<void> {
  await prisma.trustScoreHistory.createMany({
    data: [
      {
        id: '10000000-0000-0000-0000-000000000001',
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 90,
        newScore: 88,
        scoreDelta: -2,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: 0.92,
        band: 'L3',
        methodologyVersion: 'TRUST_V1',
        metadata: {},
        recordedAt: new Date('2026-03-10T10:00:00.000Z'),
        createdAt: new Date('2026-03-10T10:00:00.000Z'),
      },
      {
        id: '10000000-0000-0000-0000-000000000002',
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 88,
        newScore: 76,
        scoreDelta: -12,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: 0.94,
        band: 'L2',
        methodologyVersion: 'TRUST_V1',
        metadata: {},
        recordedAt: new Date('2026-03-15T09:00:00.000Z'),
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
      },
    ],
  });

  await seedInvestigatorFinding({
    findingId: 'finding-trust-decline',
    findingType: 'trust_decline',
    severity: 'critical',
    title: 'Dr. Ada Lovelace trust score dropped 12 points',
    summary: 'Licensure verification is stale and the trust score dropped 12 points.',
    explanation: 'Licensure verification is stale and the trust score dropped 12 points.',
    storylineKey: 'trust_decline:1234567890',
    metadata: {
      npi: '1234567890',
      scoreDelta: -12,
      staleDimensions: [{ claimClass: 'licensure' }],
      graphCentrality: 0.71,
      entityImportance: 0.8,
    },
  });

  await seedInvestigatorFinding({
    findingId: 'finding-workforce-pressure',
    findingType: 'workforce_pressure',
    severity: 'high',
    title: 'Dr. Ada Lovelace matches a high-pressure workforce gap',
    summary: 'CA Cardiology demand materially exceeds mapped provider supply.',
    explanation: 'CA Cardiology demand materially exceeds mapped provider supply.',
    storylineKey: 'workforce_pressure:1234567890',
    metadata: {
      npi: '1234567890',
      state: 'CA',
      specialty: 'Cardiology',
      pressureScore: 82,
      graphCentrality: 0.71,
      entityImportance: 0.8,
    },
  });

  await seedInvestigatorFinding({
    findingId: 'finding-network-emergence',
    findingType: 'network_emergence',
    severity: 'medium',
    title: 'Dr. Ada Lovelace sits inside a newly dense collaboration cluster',
    summary: 'Recent collaboration edges formed a denser-than-usual cluster.',
    explanation: 'Recent collaboration edges formed a denser-than-usual cluster.',
    storylineKey: 'network_emergence:1234567890',
    metadata: {
      npi: '1234567890',
      graphCentrality: 0.71,
      entityImportance: 0.8,
    },
  });
}

describe('action routes', () => {
  beforeEach(async () => {
    await resetState();
    await seedActionFixtures();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('lists generated actions and supports filters', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/actions')
      .expect(200);

    expect(response.body.total).toBe(7);
    expect(response.body.actions.map((action: { actionType: string }) => action.actionType)).toEqual(expect.arrayContaining([
      'RUN_VERIFICATION',
      'INVESTIGATE_PROVIDER',
      'COMPARE_WITH_PEERS',
      'ALERT_TEAM',
      'EXPORT_REPORT',
      'MONITOR_PROVIDER',
      'ESCALATE_RISK',
    ]));

    const runVerification = response.body.actions.find((action: { actionType: string }) => action.actionType === 'RUN_VERIFICATION');
    expect(runVerification.explanation).toContain('trust score dropped 12.0 points');
    expect(runVerification.explanation).toContain('verification data is stale');

    const filtered = await request(app)
      .get('/api/actions')
      .query({
        actionType: 'RUN_VERIFICATION',
        entity: '1234567890',
        priority: 'HIGH,CRITICAL',
      })
      .expect(200);

    expect(filtered.body.total).toBe(1);
    expect(filtered.body.actions[0].actionType).toBe('RUN_VERIFICATION');
    expect(filtered.body.actions[0].targetEntity.entityId).toBe('1234567890');
  });

  it('returns action detail with linked predictions and tracks status updates', async () => {
    const app = buildApp();
    const list = await request(app).get('/api/actions').expect(200);

    const runVerification = list.body.actions.find((action: { actionType: string }) => action.actionType === 'RUN_VERIFICATION');
    const exportReport = list.body.actions.find((action: { actionType: string }) => action.actionType === 'EXPORT_REPORT');
    const monitorProvider = list.body.actions.find((action: { actionType: string }) => action.actionType === 'MONITOR_PROVIDER');

    expect(runVerification).toBeDefined();
    expect(exportReport).toBeDefined();
    expect(monitorProvider).toBeDefined();

    const detail = await request(app)
      .get(`/api/actions/${runVerification.actionId}`)
      .expect(200);

    expect(detail.body.action.linkedPredictions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predictionType: 'TRUST_SCORE_DECLINE',
      }),
    ]));

    const saved = await request(app)
      .post(`/api/actions/${exportReport.actionId}/save`)
      .send({ actorId: 'ops-user', note: 'Keep for staffing review.' })
      .expect(200);
    expect(saved.body.action.status).toBe('in_progress');

    const executed = await request(app)
      .post(`/api/actions/${runVerification.actionId}/execute`)
      .send({ actorId: 'ops-user', note: 'Verification requested.' })
      .expect(200);
    expect(executed.body.action.status).toBe('completed');

    const dismissed = await request(app)
      .post(`/api/actions/${monitorProvider.actionId}/dismiss`)
      .send({ actorId: 'ops-user', note: 'No longer needed.' })
      .expect(200);
    expect(dismissed.body.action.status).toBe('skipped');

    const reprioritized = await request(app)
      .patch(`/api/actions/${exportReport.actionId}/status`)
      .send({ status: 'pending', actorId: 'ops-user', note: 'Return to backlog.' })
      .expect(200);
    expect(reprioritized.body.action.status).toBe('pending');

    const updatedDetail = await request(app)
      .get(`/api/actions/${runVerification.actionId}`)
      .expect(200);

    expect(updatedDetail.body.action.status).toBe('completed');
    expect(updatedDetail.body.action.statusEvents.length).toBeGreaterThanOrEqual(2);
  });
});
