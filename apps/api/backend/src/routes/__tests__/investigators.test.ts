import express from 'express';
import request from 'supertest';
import prisma from '../../graphql/prisma_client';
import { registerInvestigatorRoutes } from '../investigators';
import { runTargetedInvestigators } from '../../services/investigators/investigatorEngineService';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerInvestigatorRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.investigatorRunLog.deleteMany({});
  await prisma.trustScoreHistory.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedFixture(): Promise<void> {
  await prisma.user.create({
    data: {
      clerkUserId: 'clerk-investigator-1',
      email: 'investigator-test@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
      personProfile: {
        create: {
          npi: '1234567890',
          firstName: 'Ada',
          lastName: 'Lovelace',
          specialty: 'Cardiology',
          stateOfPractice: 'TX',
        },
      },
    },
  });

  await prisma.claimRecord.create({
    data: {
      claimId: 'claim-affiliation-1',
      subjectNpi: '1234567890',
      claimType: 'INSTITUTION_AFFILIATION',
      value: {
        institution: 'Mayo Clinic',
      },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.95,
      sourceId: 'PECOS_PUBLIC',
      parserVersion: 'v1.0.0',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-01T00:00:00.000Z'),
      derivedAt: new Date('2026-03-01T00:00:00.000Z'),
    },
  });

  await prisma.graphNode.create({
    data: {
      id: 'gn_ada_clinician',
      canonicalKey: 'clinician:npi:1234567890',
      type: 'clinician',
      label: 'Ada Lovelace',
      title: 'Ada Lovelace',
      colorGroup: '#14b8a6',
      groupKey: 'Cardiology',
      tags: ['Cardiology', 'TX'],
      metadata: {
        npi: '1234567890',
      },
      degree: 9,
      inDegree: 4,
      outDegree: 5,
      sourceRefs: [],
    },
  });

  await prisma.trustScoreHistory.createMany({
    data: [
      {
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 90,
        newScore: 90,
        scoreDelta: 0,
        triggerEvent: 'BASELINE',
        confidence: 0.95,
        band: 'L3',
        methodologyVersion: 'trust-score/v1.0',
        metadata: {
          dimensionScores: {
            licensure: { score: 25, max: 25, status: 'ACTIVE', pct: 100 },
            freshness: { score: 7, max: 7, status: 'FRESH', pct: 100 },
            exclusion: { score: 20, max: 20, status: 'CLEAR', pct: 100 },
          },
        },
        recordedAt: new Date('2026-03-10T00:00:00.000Z'),
      },
      {
        subjectType: 'NPI',
        subjectId: '1234567890',
        previousScore: 90,
        newScore: 74,
        scoreDelta: -16,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: 0.91,
        band: 'L2',
        methodologyVersion: 'trust-score/v1.0',
        metadata: {
          dimensionScores: {
            licensure: { score: 18, max: 25, status: 'AGING', pct: 72 },
            freshness: { score: 3, max: 7, status: 'STALE', pct: 42 },
            exclusion: { score: 17, max: 20, status: 'CLEAR', pct: 85 },
          },
        },
        recordedAt: new Date('2026-03-14T00:00:00.000Z'),
      },
    ],
  });
}

describe('investigator routes', () => {
  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('lists findings, returns detail, and supports status transitions', async () => {
    await seedFixture();
    await runTargetedInvestigators({
      entityType: 'NPI',
      targetEntityIds: ['1234567890'],
      trigger: 'targeted',
    });

    const app = buildApp();

    const list = await request(app)
      .get('/api/investigators/findings')
      .query({
        provider: '1234567890',
        investigatorId: 'trust_decline',
        severity: 'high,critical',
      })
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(list.body.findings[0].findingType).toBe('trust_decline');
    expect(list.body.findings[0].status).toBe('new');

    const findingId = list.body.findings[0].findingId as string;

    const detail = await request(app)
      .get(`/api/investigators/findings/${findingId}`)
      .expect(200);

    expect(detail.body.finding.entities.some((entity: { entityType: string; entityLabel?: string }) => (
      entity.entityType === 'institution' && entity.entityLabel === 'Mayo Clinic'
    ))).toBe(true);

    const acknowledged = await request(app)
      .post(`/api/investigators/findings/${findingId}/acknowledge`)
      .send({ actorId: 'operator-1', note: 'Review started' })
      .expect(200);

    expect(acknowledged.body.finding.status).toBe('acknowledged');

    const escalated = await request(app)
      .post(`/api/investigators/findings/${findingId}/escalate`)
      .send({ actorId: 'operator-2', note: 'Escalating to compliance' })
      .expect(200);

    expect(escalated.body.finding.status).toBe('escalated');

    const dismissed = await request(app)
      .post(`/api/investigators/findings/${findingId}/dismiss`)
      .send({ actorId: 'operator-3', note: 'False alarm for this cycle' })
      .expect(200);

    expect(dismissed.body.finding.status).toBe('dismissed');

    const filtered = await request(app)
      .get('/api/investigators/findings')
      .query({
        status: 'dismissed',
        institution: 'Mayo Clinic',
      })
      .expect(200);

    expect(filtered.body.total).toBe(1);
    expect(filtered.body.findings[0].findingId).toBe(findingId);

    const refreshedDetail = await request(app)
      .get(`/api/investigators/findings/${findingId}`)
      .expect(200);

    expect(refreshedDetail.body.finding.statusEvents.length).toBeGreaterThanOrEqual(4);
    expect(refreshedDetail.body.finding.statusEvents[0].toStatus).toBe('dismissed');
  });
});
