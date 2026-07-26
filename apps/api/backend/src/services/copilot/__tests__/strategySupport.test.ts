import prisma from '../../../graphql/prisma_client';
import { prepareCopilotQuery } from '../../../../../../../core/copilot/copilotEngine';
import { augmentWithStrategySupport } from '../copilotQueryService';
import { runStrategyAgents } from '../../strategyAgents/strategyAgentService';

async function resetState(): Promise<void> {
  await prisma.findingStatusEvent.deleteMany({});
  await prisma.findingEntityLink.deleteMany({});
  await prisma.findingEvidenceLink.deleteMany({});
  await prisma.investigatorFinding.deleteMany({});
  await prisma.auditEvent.deleteMany({});
  await prisma.predictionInsight.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
}

async function seedInstitutionFixture(): Promise<void> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: 'clerk-copilot-strategy-1',
      email: 'copilot-strategy-test@vitalcv.local',
      role: 'CLINICIAN',
      status: 'ACTIVE',
    },
  });
  await prisma.personProfile.create({
    data: {
      userId: user.id,
      npi: '1881234567',
      firstName: 'Grace',
      lastName: 'Hopper',
      specialty: 'Neurology',
      stateOfPractice: 'MN',
    },
  });

  await prisma.claimRecord.create({
    data: {
      claimId: 'claim-copilot-strategy-1',
      subjectNpi: '1881234567',
      claimType: 'INSTITUTION_AFFILIATION',
      value: {
        institution: 'Mayo Clinic',
      },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.92,
      sourceId: 'PECOS_PUBLIC',
      parserVersion: 'v1.0.0',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-10T00:00:00.000Z'),
      derivedAt: new Date('2026-03-10T00:00:00.000Z'),
    },
  });

  await prisma.predictionInsight.create({
    data: {
      predictionId: 'pred-copilot-institution-1',
      predictionType: 'INSTITUTION_RESEARCH_GROWTH',
      targetEntityType: 'institution',
      targetEntityId: 'institution:mayo-clinic',
      targetEntityLabel: 'Mayo Clinic',
      probability: 0.81,
      confidence: 0.77,
      timeHorizon: '180d',
      evidenceSignals: [
        { label: 'research_growth', value: 6, direction: 'UP', source: 'CLAIM_RECORDS' },
        { label: 'contributing_providers', value: 3, direction: 'UP', source: 'CLAIM_RECORDS' },
        { label: 'lead_investigators', value: 2, direction: 'UP', source: 'CLAIM_RECORDS' },
      ],
      explanation: 'Mayo Clinic is likely to keep accelerating research output within 180d.',
      metadata: {
        recentResearchCount: 11,
        researchGrowth: 6,
      },
    },
  });
}

describe('copilot strategy agent support', () => {
  beforeEach(async () => {
    await resetState();
    await seedInstitutionFixture();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('adds persisted strategy agent outputs as copilot results', async () => {
    await runStrategyAgents({
      agentTypes: ['INSTITUTION_MOMENTUM'],
      refreshPredictions: false,
    });

    const prepared = prepareCopilotQuery({
      query: 'Which institutions gained the most momentum this quarter?',
      limit: 5,
    });

    const enriched = await augmentWithStrategySupport({
      parsedQuery: prepared.parsedQuery,
      results: [],
      explanations: [],
      graphInsights: [],
    }, prepared.parsedQuery.rawQuery);

    expect(enriched.results.some((result) => result.id.startsWith('strategy-agent:'))).toBe(true);
    expect(enriched.explanations.some((explanation) => explanation.resultId.startsWith('strategy-agent:'))).toBe(true);
    expect(enriched.graphInsights.some((insight) => (
      insight.resultId?.startsWith('strategy-agent:') ?? false
    ))).toBe(true);
  });
});
