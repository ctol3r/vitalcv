jest.mock('../investigatorEngineService', () => ({
  getInvestigatorFinding: jest.fn(),
}));

jest.mock('../framework', () => ({
  getFindingById: jest.fn(),
  getSuppressionScore: jest.fn(),
}));

import { getInvestigatorFinding } from '../investigatorEngineService';
import {
  getCalibrationStats,
  getLearningLoopStats,
  getOutcomeHistory,
  recordOutcome,
  resetLearningLoopForTests,
} from '../learningLoopService';

const getInvestigatorFindingMock = getInvestigatorFinding as jest.MockedFunction<typeof getInvestigatorFinding>;

describe('learningLoopService', () => {
  beforeEach(() => {
    resetLearningLoopForTests();
    getInvestigatorFindingMock.mockReset();
  });

  it('does not double count the same finding outcome submission', async () => {
    getInvestigatorFindingMock.mockResolvedValue({
      findingId: 'finding-1',
      investigatorId: 'investigator-a',
      findingType: 'TRUST_DECLINE',
      severity: 'high',
    } as never);

    const first = await recordOutcome(
      'finding-1',
      'RESOLVED_TRUE_POSITIVE',
      'STRONG',
      { resolvedAt: '2026-04-01T12:00:00.000Z' },
    );
    const duplicate = await recordOutcome('finding-1', 'RESOLVED_TRUE_POSITIVE', 'STRONG');

    expect(duplicate?.outcomeId).toBe(first?.outcomeId);

    const stats = getCalibrationStats('investigator-a');
    expect(stats[0]).toEqual(expect.objectContaining({
      totalResolved: 1,
      truePositiveCount: 1,
      falsePositiveCount: 0,
      truePositiveRate: 1,
      lastUpdatedAt: '2026-04-01T12:00:00.000Z',
    }));
  });

  it('updates the recorded outcome in place and keeps calibration stable across reads', async () => {
    getInvestigatorFindingMock.mockResolvedValue({
      findingId: 'finding-2',
      investigatorId: 'investigator-b',
      findingType: 'EXCLUSION',
      severity: 'critical',
    } as never);

    await recordOutcome(
      'finding-2',
      'RESOLVED_FALSE_POSITIVE',
      'WEAK',
      {
        falsePositiveReason: 'secondary-only',
        resolvedAt: '2026-04-02T10:00:00.000Z',
      },
    );

    const updated = await recordOutcome(
      'finding-2',
      'ESCALATED',
      'ADEQUATE',
      {
        analystNote: 'needs committee review',
        resolvedAt: '2026-04-03T08:30:00.000Z',
      },
    );

    const firstRead = getCalibrationStats('investigator-b');
    const secondRead = getCalibrationStats('investigator-b');

    expect(updated).toEqual(expect.objectContaining({
      outcome: 'ESCALATED',
      evidenceQuality: 'ADEQUATE',
      resolvedAt: '2026-04-03T08:30:00.000Z',
    }));
    expect(firstRead).toEqual(secondRead);
    expect(firstRead[0]).toEqual(expect.objectContaining({
      totalResolved: 1,
      truePositiveCount: 0,
      escalatedCount: 1,
      truePositiveRate: 1,
      falsePositiveRate: 0,
      lastUpdatedAt: '2026-04-03T08:30:00.000Z',
    }));
  });

  it('orders aggregate rankings deterministically when calibration scores tie', async () => {
    getInvestigatorFindingMock
      .mockResolvedValueOnce({
        findingId: 'finding-3',
        investigatorId: 'investigator-z',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never)
      .mockResolvedValueOnce({
        findingId: 'finding-4',
        investigatorId: 'investigator-a',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never)
      .mockResolvedValueOnce({
        findingId: 'finding-5',
        investigatorId: 'investigator-z',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never)
      .mockResolvedValueOnce({
        findingId: 'finding-6',
        investigatorId: 'investigator-a',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never)
      .mockResolvedValueOnce({
        findingId: 'finding-7',
        investigatorId: 'investigator-z',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never)
      .mockResolvedValueOnce({
        findingId: 'finding-8',
        investigatorId: 'investigator-a',
        findingType: 'TRUST_DECLINE',
        severity: 'medium',
      } as never);

    for (const findingId of ['finding-3', 'finding-4', 'finding-5', 'finding-6', 'finding-7', 'finding-8']) {
      await recordOutcome(findingId, 'RESOLVED_TRUE_POSITIVE', 'STRONG', {
        resolvedAt: `2026-04-04T0${Number(findingId.slice(-1))}:00:00.000Z`,
      });
    }

    const summary = getLearningLoopStats();
    const history = getOutcomeHistory(6);

    expect(summary.bestPerformingInvestigators).toEqual(['investigator-a', 'investigator-z']);
    expect(summary.worstPerformingInvestigators).toEqual(['investigator-a', 'investigator-z']);
    expect(history.map((record) => record.findingId)).toEqual([
      'finding-8',
      'finding-7',
      'finding-6',
      'finding-5',
      'finding-4',
      'finding-3',
    ]);
  });
});
