import type { PrismaClient } from '@prisma/client';
import {
  buildInvestigatorOutputs,
  computeNoveltyScore,
  defaultScheduleJobs,
  nextRunAt,
  type NormalizedInvestigatorSignal,
} from '../../../../../../../services/investigator-engine/src';
import {
  AUTONOMOUS_INVESTIGATOR_SPECS,
  buildAutonomousInvestigatorDefinitions,
  buildAutonomousInvestigatorFindings,
} from '../autonomousInvestigatorEngine';

function buildSignal(overrides: Partial<NormalizedInvestigatorSignal>): NormalizedInvestigatorSignal {
  return {
    sourceId: 'CLINICAL_TRIALS',
    providerId: '1234567890',
    signalType: 'trial',
    detectedAt: '2026-03-15T12:00:00.000Z',
    summary: 'Clinical trial activity changed.',
    evidence: [
      {
        sourceId: 'CLINICAL_TRIALS',
        label: 'trial:investigator',
        snippet: 'Trial NCT123 lists the provider as an investigator.',
        observedAt: '2026-03-15T12:00:00.000Z',
        recordId: 'rec_123',
      },
    ],
    sourceConfidence: 0.78,
    magnitude: 0.72,
    providerLabel: 'Dr Ada Lovelace',
    providerSpecialty: 'Cardiology',
    providerState: 'TX',
    providerCentrality: 0.66,
    peerOccurrenceRate: 0.18,
    recencyDays: 0,
    metadata: {
      providerLabel: 'Dr Ada Lovelace',
      storylineTitle: 'Trial NCT123 investigators',
    },
    eventAnchor: {
      type: 'trial',
      id: 'NCT123',
      label: 'Trial NCT123 investigators',
    },
    trendAnchor: null,
    ...overrides,
  };
}

describe('investigator engine package', () => {
  it('defines the scheduled intelligence jobs and computes the next run window', () => {
    const jobs = defaultScheduleJobs();

    expect(jobs.map((job) => job.id)).toEqual([
      'daily-provider-poll',
      'weekly-research-scan',
      'monthly-diff-job',
      'quarterly-npdb-diff',
      'annual-payment-diff',
    ]);
    expect(jobs[0]?.sources).toEqual(['LEIE', 'NPPES', 'CLINICAL_TRIALS']);
    expect(jobs[1]?.sources).toEqual(['OPENALEX', 'SEMANTIC_SCHOLAR', 'NIH_REPORTER']);
    expect(nextRunAt('weekly', '2026-03-01T00:00:00.000Z')).toBe('2026-03-08T00:00:00.000Z');
  });

  it('scores novelty and groups cross-provider trial findings into one event storyline', () => {
    const novel = computeNoveltyScore({
      firstOccurrence: true,
      magnitude: 0.92,
      peerOccurrenceRate: 0.05,
      recencyDays: 0,
      corroborationCount: 2,
    });
    const stale = computeNoveltyScore({
      firstOccurrence: false,
      magnitude: 0.12,
      peerOccurrenceRate: 0.9,
      recencyDays: 45,
      corroborationCount: 0,
    });

    expect(novel.score).toBeGreaterThan(stale.score);
    expect(novel.score).toBeLessThanOrEqual(100);

    const outputs = buildInvestigatorOutputs({
      signals: [
        buildSignal({ providerId: '1234567890', providerLabel: 'Dr Ada Lovelace' }),
        buildSignal({ providerId: '2234567890', providerLabel: 'Dr Grace Hopper' }),
      ],
    });

    expect(outputs.findings).toHaveLength(2);
    expect(outputs.findings[0]?.storylineAnchorType).toBe('event');
    expect(outputs.storylines).toHaveLength(1);
    expect(outputs.storylines[0]?.anchorType).toBe('event');
    expect(outputs.storylines[0]?.providerIds.sort()).toEqual(['1234567890', '2234567890']);
    expect(outputs.storylines[0]?.title).toBe('Trial NCT123 investigators');
  });

  it('publishes autonomous investigator definitions and skips live execution in test', async () => {
    const definitions = buildAutonomousInvestigatorDefinitions();

    expect(definitions.map((definition) => definition.id)).toEqual(
      AUTONOMOUS_INVESTIGATOR_SPECS.map((spec) => spec.id),
    );
    expect(definitions[0]?.schedule.cadenceMinutes).toBe(1440);
    expect(definitions[1]?.schedule.cadenceMinutes).toBe(10080);

    const coveredEntityIds: string[] = [];
    const findings = await buildAutonomousInvestigatorFindings({
      investigatorId: AUTONOMOUS_INVESTIGATOR_SPECS[0]!.id,
      prisma: {} as PrismaClient,
      sources: ['LEIE', 'NPPES', 'CLINICAL_TRIALS'],
      targetEntityIds: ['1234567890'],
      batchSize: 1,
      now: '2026-03-15T12:00:00.000Z',
      markEntityCovered(entityId) {
        coveredEntityIds.push(entityId);
      },
    });

    expect(findings).toEqual([]);
    expect(coveredEntityIds).toEqual([]);
  });
});
