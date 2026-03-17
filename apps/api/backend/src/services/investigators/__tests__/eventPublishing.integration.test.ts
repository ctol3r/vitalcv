jest.mock('../../predictions/predictionEngineService', () => ({
  getPredictionSummariesForEntityKeys: jest.fn().mockResolvedValue(new Map()),
}));

import prisma from '../../../graphql/prisma_client';
import { listRecentEvents, resetEventBusForTests } from '../../../core/events/eventBus';
import { acknowledgeStoryline, syncPersistedStorylines } from '../../storylines/storylineService';
import { runTargetedInvestigators } from '../investigatorEngineService';

async function resetState(): Promise<void> {
  await prisma.storylineActionEvent.deleteMany({});
  await prisma.storylineStatusEvent.deleteMany({});
  await prisma.storylineEntityLink.deleteMany({});
  await prisma.storylineFindingLink.deleteMany({});
  await prisma.storyline.deleteMany({});
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
      clerkUserId: 'clerk-investigator-events',
      email: 'investigator-events@vitalcv.local',
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
      claimId: 'claim-affiliation-events',
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
      id: 'gn_ada_clinician_events',
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

describe('investigator and storyline event publishing', () => {
  beforeEach(async () => {
    resetEventBusForTests();
    await resetState();
  });

  afterAll(async () => {
    resetEventBusForTests();
    await resetState();
    await prisma.$disconnect();
  });

  it('publishes finding and investigator run completion events for targeted runs', async () => {
    await seedFixture();

    const results = await runTargetedInvestigators({
      entityType: 'NPI',
      targetEntityIds: ['1234567890'],
      investigatorIds: ['trust_decline'],
      trigger: 'targeted',
    });

    const events = listRecentEvents({
      limit: 50,
      types: ['FINDING_CREATED', 'INVESTIGATOR_RUN_COMPLETE'],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'FINDING_CREATED')).toBe(true);
    expect(events.some((event) => event.type === 'INVESTIGATOR_RUN_COMPLETE')).toBe(true);

    const findingEvent = events.find((event) => event.type === 'FINDING_CREATED');
    const runEvent = events.find((event) => event.type === 'INVESTIGATOR_RUN_COMPLETE');

    expect(findingEvent?.type).toBe('FINDING_CREATED');
    expect(findingEvent?.payload.runId).toBeTruthy();
    expect(runEvent?.type).toBe('INVESTIGATOR_RUN_COMPLETE');
    expect(runEvent?.payload.status).toBe('succeeded');
  });

  it('publishes storyline update events during sync and manual action flows', async () => {
    await seedFixture();
    await runTargetedInvestigators({
      entityType: 'NPI',
      targetEntityIds: ['1234567890'],
      investigatorIds: ['trust_decline'],
      trigger: 'targeted',
    });

    resetEventBusForTests();

    await syncPersistedStorylines();

    const syncEvents = listRecentEvents({
      limit: 20,
      types: ['STORYLINE_UPDATED'],
    });

    expect(syncEvents.length).toBeGreaterThan(0);
    expect(syncEvents.some((event) => (
      event.type === 'STORYLINE_UPDATED' && (event.payload.operation === 'created' || event.payload.operation === 'updated')
    ))).toBe(true);

    const storyline = await prisma.storyline.findFirst({
      orderBy: { lastActivityAt: 'desc' },
      select: { storylineId: true },
    });

    expect(storyline?.storylineId).toBeTruthy();

    await acknowledgeStoryline({
      storylineId: storyline!.storylineId,
      actorId: 'trust-ops',
      note: 'Reviewed in integration test',
    });

    const latestStorylineEvent = listRecentEvents({
      limit: 1,
      types: ['STORYLINE_UPDATED'],
    })[0];

    expect(latestStorylineEvent?.type).toBe('STORYLINE_UPDATED');

    if (!latestStorylineEvent || latestStorylineEvent.type !== 'STORYLINE_UPDATED') {
      throw new Error('Expected latest storyline event to be published');
    }

    expect(latestStorylineEvent.payload.operation).toBe('status_changed');
    expect(latestStorylineEvent.payload.storylineId).toBe(storyline!.storylineId);
  });
});
