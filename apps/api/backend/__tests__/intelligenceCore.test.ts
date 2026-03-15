import {
  computeSourceReliability,
} from '../../../../core/intelligence/sourceReliability';
import {
  buildTrustEvolution,
  shouldPersistTrustEvolution,
} from '../../../../core/intelligence/trustEvolution';
import {
  deriveGraphInsights,
} from '../../../../core/intelligence/graphInsights';
import {
  predictQuerySuggestions,
} from '../../../../core/intelligence/queryPrediction';

describe('intelligence core', () => {
  it('computes weighted source reliability from contradictions, freshness, coverage, and accuracy', () => {
    const result = computeSourceReliability({
      sourceId: 'NPPES_API',
      contradictionCount: 1,
      totalObservations: 10,
      freshRecordCount: 6,
      agingRecordCount: 2,
      staleRecordCount: 2,
      successfulRuns: 8,
      partialRuns: 1,
      failedRuns: 1,
      accurateOutcomes: 9,
      inaccurateOutcomes: 1,
    });

    expect(result.sourceId).toBe('NPPES_API');
    expect(result.contradictionFrequency).toBe(0.1);
    expect(result.freshnessConsistency).toBe(0.7);
    expect(result.coverageReliability).toBe(0.85);
    expect(result.verificationAccuracy).toBe(0.9);
    expect(result.sourceReliabilityScore).toBeGreaterThan(0.8);
  });

  it('tracks trust score deltas and suppresses duplicate history entries', () => {
    const candidate = buildTrustEvolution({
      subjectType: 'NPI',
      subjectId: '1234567890',
      previousScore: 61,
      newScore: 74,
      triggerEvent: 'TRUST_SCORE_COMPUTED',
      band: 'L2',
      confidence: 0.88,
    });

    expect(candidate.scoreDelta).toBe(13);
    expect(shouldPersistTrustEvolution(null, candidate)).toBe(true);
    expect(shouldPersistTrustEvolution({
      newScore: 74,
      triggerEvent: 'TRUST_SCORE_COMPUTED',
      band: 'L2',
    }, candidate)).toBe(false);
  });

  it('produces graph insights and predictive suggestions from history', () => {
    const insights = deriveGraphInsights(
      [
        {
          id: 'clinician:1',
          type: 'clinician',
          label: 'Dr. Ada',
          metadata: { specialty: 'Cardiology' },
          tags: ['cardiology'],
        },
        {
          id: 'publication:1',
          type: 'publication',
          label: 'Cardiology Paper',
          metadata: {},
          tags: ['research'],
        },
        {
          id: 'trial:1',
          type: 'trial',
          label: 'Valve Trial',
          metadata: {},
          tags: ['research'],
        },
      ],
      [
        { source: 'clinician:1', target: 'publication:1', type: 'published_with', confidence: 0.9 },
        { source: 'clinician:1', target: 'trial:1', type: 'related_to', confidence: 0.85 },
      ],
    );

    expect(insights.some((insight) => insight.insightType === 'LIKELY_INVESTIGATOR')).toBe(true);

    const suggestions = predictQuerySuggestions({
      query: 'card',
      baseSuggestions: ['cardiology faq'],
      history: [
        {
          normalizedQuery: 'cardiologists in texas',
          queryTemplate: 'cardiologists in REGION',
          createdAt: '2026-03-15T00:00:00.000Z',
          resultCount: 3,
          metadata: { regionTerm: 'texas' },
        },
        {
          normalizedQuery: 'cardiologists with high trust score',
          queryTemplate: 'cardiologists with HIGH_TRUST',
          createdAt: '2026-03-14T00:00:00.000Z',
          resultCount: 2,
          metadata: { requiresHighTrust: true },
        },
      ],
      feedback: [
        {
          suggestionKey: 'cardiologists in texas',
          accepted: true,
          createdAt: '2026-03-15T01:00:00.000Z',
        },
      ],
      limit: 3,
    });

    expect(suggestions.suggestions).toContain('cardiologists in texas');
    expect(suggestions.rankedSuggestions[0]?.text).toBe('cardiologists in texas');
  });
});
