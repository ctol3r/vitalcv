import {
  classifyFreshness,
  classifySourceQuality,
  summarizeTrustSignals,
} from '@/lib/intelligence/trust-signals';

describe('trust signal helpers', () => {
  it('summarizes corroborated authoritative evidence as strong', () => {
    const summary = summarizeTrustSignals([
      {
        source: 'State Board',
        observedAt: '2026-03-15T10:00:00.000Z',
        confidence: 0.91,
      },
      {
        source: 'ABMS',
        observedAt: '2026-03-15T11:00:00.000Z',
        confidence: 0.87,
      },
    ], 0.9);

    expect(summary.confidenceBand).toBe('HIGH');
    expect(summary.evidenceQuality).toBe('STRONG');
    expect(summary.corroborationCount).toBe(1);
    expect(summary.uniqueSourceCount).toBe(2);
    expect(summary.sourceQuality).toBe('AUTHORITATIVE');
  });

  it('classifies derived sources and stale timestamps', () => {
    expect(classifySourceQuality('Graph Runtime')).toBe('DERIVED');
    expect(classifyFreshness('2026-01-01T00:00:00.000Z', Date.parse('2026-03-15T00:00:00.000Z'))).toBe('STALE');
  });
});
