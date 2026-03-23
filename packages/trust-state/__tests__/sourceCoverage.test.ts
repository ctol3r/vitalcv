import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '../sourceCoverage';

describe('Canonical Source Coverage Contracts', () => {
  it('serializes coverage immutably without trailing whitespace or empty arrays', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: '  OIG_LEIE  ',
      state: 'live',
      reason: '  checked  ',
      checkedAt: '2026-03-23T12:00:00Z',
      artifactId: '  art-123  ',
      proof: {
        artifactIds: [' art-123 '],
        receiptIds: [],
      },
    });

    expect(coverage.sourceId).toBe('OIG_LEIE');
    expect(coverage.reason).toBe('checked');
    expect(coverage.artifactId).toBe('art-123');
    expect(coverage.proof).toEqual({
      artifactIds: ['art-123'],
      receiptIds: [],
    });
    expect(Object.isFrozen(coverage)).toBe(true);
    expect(Object.isFrozen(coverage.proof)).toBe(true);
  });

  it('omits proof entirely if both artifactIds and receiptIds are empty', () => {
    const coverage = createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'notDecisionGrade',
      reason: 'unsupported source',
      proof: {
        artifactIds: [],
        receiptIds: [],
      },
    });

    expect(coverage).not.toHaveProperty('proof');
  });

  it('summarizes canonically across all exact statuses', () => {
    const checks = [
      createCanonicalSourceCoverage({ sourceId: 'A', state: 'live', reason: 'A' }),
      createCanonicalSourceCoverage({ sourceId: 'B', state: 'live', reason: 'B' }),
      createCanonicalSourceCoverage({ sourceId: 'C', state: 'stale', reason: 'C' }),
      createCanonicalSourceCoverage({ sourceId: 'D', state: 'notDecisionGrade', reason: 'D' }),
      createCanonicalSourceCoverage({ sourceId: 'E', state: 'accessRequired', reason: 'E' }),
    ];

    const summary = summarizeCanonicalSourceCoverage(checks);

    expect(summary.live).toEqual(['A', 'B']);
    expect(summary.stale).toEqual(['C']);
    expect(summary.notDecisionGrade).toEqual(['D']);
    expect(summary.accessRequired).toEqual(['E']);
    expect(summary.unavailable).toEqual([]);
    expect(Object.isFrozen(summary)).toBe(true);
  });
});
