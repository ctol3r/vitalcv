import { ReadinessPosture } from '../../../../../../../packages/trust-contract/src/index';
import { generateNextBestAction, RecommendedAction } from '../nbaEngine';

describe('nbaEngine', () => {
  test('ranks explicit adverse evidence above stale-data reverify prompts', () => {
    const recommendation = generateNextBestAction({
      recognitionBlockers: [],
      acceptanceBlockers: [],
      activationBlockers: [],
      recognitionMissing: [],
      acceptanceMissing: [],
      activationMissing: [],
      readinessPosture: ReadinessPosture.BLOCKED,
      hasAdverseSignals: true,
      employerAction: 'NONE',
      isStale: true,
    });

    expect(recommendation.action).toBe(RecommendedAction.ESCALATE);
    expect(recommendation.domain).toBe('recognition');
  });

  test('returns request-data guidance instead of an empty output for partial readiness', () => {
    const recommendation = generateNextBestAction({
      recognitionBlockers: [],
      acceptanceBlockers: [],
      activationBlockers: [],
      recognitionMissing: ['State license source has not been verified yet'],
      acceptanceMissing: [],
      activationMissing: [],
      readinessPosture: ReadinessPosture.PARTIAL,
      hasAdverseSignals: false,
      employerAction: 'NONE',
      isStale: false,
    });

    expect(recommendation.action).toBe(RecommendedAction.REQUEST_DATA);
    expect(recommendation.reasoning).toMatch(/missing base credential/i);
  });

  test('falls back to hold instead of proceed when no safe recommendation is proven', () => {
    const recommendation = generateNextBestAction({
      recognitionBlockers: [],
      acceptanceBlockers: [],
      activationBlockers: [],
      recognitionMissing: [],
      acceptanceMissing: [],
      activationMissing: [],
      readinessPosture: ReadinessPosture.DEGRADED,
      hasAdverseSignals: false,
      employerAction: 'NONE',
      isStale: false,
    });

    expect(recommendation.action).toBe(RecommendedAction.REVERIFY);
    expect(recommendation.reasoning).toMatch(/refreshed/i);
  });
});
