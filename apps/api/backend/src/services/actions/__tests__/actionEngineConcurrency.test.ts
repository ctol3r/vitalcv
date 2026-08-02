import { Prisma } from '@prisma/client';
import prisma from '../../../graphql/prisma_client';
import { refreshActionRecommendations } from '../actionEngineService';

/**
 * Concurrency regression — `action_id` unique violation on overlapping refresh.
 *
 * THE DEFECT
 *
 * `persistActionRecommendations` used to read the whole batch with `findMany`,
 * then branch per action: `create` on a miss, `update` on a hit. Between the read
 * and the write there is a window. Two refreshes that overlap inside it both miss,
 * both call `create`, and the loser hits a P2002 unique violation on `action_id`
 * and throws — failing the entire refresh, not just the one action.
 *
 * This is not a rare interleaving. The action engine refreshes on a schedule AND
 * on demand from the actions route, so overlap is the ordinary case.
 *
 * WHY THIS TEST DRIVES `refreshActionRecommendations` AND NOT THE PRIVATE HELPER
 *
 * The helper is not exported, and exporting it purely for a test would let the
 * test pass while the real entry point still raced. Driving the public function is
 * also the honest reproduction: it is the thing that actually runs twice at once.
 *
 * WHAT IT ASSERTS
 *
 * The outcome, not the mechanism: two concurrent refreshes both resolve, and the
 * table holds exactly one row per `action_id`. It does not assert that the code
 * calls `upsert` — a future fix using a transaction or an advisory lock should
 * keep this test green.
 */

const NOW = '2026-03-15T12:00:00.000Z';

async function resetState(): Promise<void> {
  await prisma.actionStatusEvent.deleteMany({});
  await prisma.actionRecommendation.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
}

/**
 * An action needs BOTH an investigator finding and a matching prediction insight —
 * the engine derives decisions from the pair. Seeding only a finding produces zero
 * actions, which makes a concurrency test vacuously green: there is nothing to
 * race over. The first version of this test did exactly that.
 *
 * NPI here is `1234567893`, which passes the CMS 80840 + Luhn check digit. The
 * neighbouring route suite uses `1234567890`, whose check digit is invalid; a
 * fixture NPI that could never exist is fine for a row id but is a bad habit in
 * anything that might later be asserted against real validation.
 */
const SUBJECT_NPI = '1234567893';

async function seedFinding(findingId: string): Promise<void> {
  await prisma.investigatorFinding.create({
    data: {
      findingId,
      investigatorId: 'trust_decline_monitor',
      findingType: 'trust_decline',
      scope: 'provider',
      severity: 'critical',
      status: 'new',
      title: 'Concurrency fixture',
      summary: 'Concurrency fixture',
      explanation: 'Concurrency fixture',
      confidence: 0.93,
      priorityScore: 0.95,
      trustImpact: 0.9,
      freshness: 0.81,
      novelty: 0.75,
      entityImportance: 0.8,
      graphCentrality: 0.71,
      entityIds: [SUBJECT_NPI],
      audienceRoles: ['operations', 'compliance'],
      supportingEvidence: [{
        evidenceId: `${findingId}:evidence`,
        sourceId: 'TEST',
        sourceLabel: 'TEST',
        snippet: 'Concurrency fixture',
      }] as Prisma.InputJsonValue,
      rankBreakdown: {} as Prisma.InputJsonValue,
      metadata: {
        npi: SUBJECT_NPI,
        staleDimensions: [{ claimClass: 'licensure' }],
        graphCentrality: 0.71,
      } as Prisma.InputJsonValue,
      storylineKey: `trust_decline:${SUBJECT_NPI}`,
      dedupeKey: findingId,
      firstSeenAt: new Date('2026-03-14T12:00:00.000Z'),
      lastSeenAt: new Date('2026-03-15T12:00:00.000Z'),
      createdAt: new Date('2026-03-14T12:00:00.000Z'),
      updatedAt: new Date('2026-03-15T12:00:00.000Z'),
      occurrenceCount: 1,
      entityLinks: {
        create: [{
          entityType: 'provider',
          entityId: SUBJECT_NPI,
          entityLabel: 'Concurrency Provider',
          relationship: 'subject',
          metadata: {},
        }],
      },
      statusEvents: {
        create: [{
          fromStatus: null,
          toStatus: 'new',
          note: 'Seeded for action-engine concurrency regression.',
          metadata: {},
        }],
      },
    },
  });

  await prisma.predictionInsight.create({
    data: {
      predictionId: 'pred-concurrency-trust-decline',
      predictionType: 'TRUST_SCORE_DECLINE',
      targetEntityType: 'provider',
      targetEntityId: SUBJECT_NPI,
      targetEntityLabel: 'Concurrency Provider',
      probability: 0.88,
      confidence: 0.86,
      timeHorizon: '90d',
      evidenceSignals: [
        { label: 'stale_sources', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
        { label: 'divergence_signals', value: 1, direction: 'UP', source: 'INVESTIGATOR_FINDINGS' },
        { label: 'trust_score_delta', value: -12, direction: 'DOWN', source: 'TRUST_SCORE' },
      ] as Prisma.InputJsonValue,
      explanation: 'Concurrency fixture prediction.',
      metadata: { graphDegree: 9 } as Prisma.InputJsonValue,
      createdAt: new Date('2026-03-15T10:00:00.000Z'),
      updatedAt: new Date('2026-03-15T10:00:00.000Z'),
    },
  });
}

describe('action engine — overlapping refresh', () => {
  beforeEach(async () => {
    await resetState();
    await seedFinding('finding-concurrency-1');
  });

  afterAll(async () => {
    await resetState();
  });

  it('two concurrent refreshes both resolve without a unique violation', async () => {
    const [first, second] = await Promise.all([
      refreshActionRecommendations(NOW, prisma),
      refreshActionRecommendations(NOW, prisma),
    ]);

    // Before the fix this rejected with
    //   PrismaClientKnownRequestError P2002 … Unique constraint failed on `action_id`
    // for whichever call lost the race.
    expect(Array.isArray(first)).toBe(true);
    expect(Array.isArray(second)).toBe(true);
    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBe(first.length);
  });

  it('leaves exactly one row per action_id', async () => {
    await Promise.all([
      refreshActionRecommendations(NOW, prisma),
      refreshActionRecommendations(NOW, prisma),
      refreshActionRecommendations(NOW, prisma),
    ]);

    const rows = await prisma.actionRecommendation.findMany({ select: { actionId: true } });
    const ids = rows.map((row) => row.actionId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves the metadata merge that the pre-read exists to supply', async () => {
    // The `findMany` is no longer an existence check, but it still carries
    // `existing.metadata` into the update branch. A fix that dropped the read
    // would silently discard accumulated metadata on every refresh, so this
    // guards the behaviour the race fix had to preserve.
    const [initial] = await refreshActionRecommendations(NOW, prisma);
    expect(initial).toBeDefined();

    await prisma.actionRecommendation.update({
      where: { actionId: initial!.actionId },
      data: { metadata: { carriedThrough: 'yes' } as Prisma.InputJsonValue },
    });

    await refreshActionRecommendations(NOW, prisma);

    const row = await prisma.actionRecommendation.findUnique({
      where: { actionId: initial!.actionId },
      select: { metadata: true },
    });
    expect((row?.metadata as Record<string, unknown> | null)?.carriedThrough).toBe('yes');
  });
});
