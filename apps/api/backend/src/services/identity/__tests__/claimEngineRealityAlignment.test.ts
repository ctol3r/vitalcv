import {
  parseOigResult,
  parsePecosRecord,
} from '../claimEngine';

describe('claimEngine reality alignment', () => {
  it('keeps fuzzy LEIE matches out of verified excluded state', () => {
    const { claims } = parseOigResult(
      '1234567890',
      {
        excluded: false,
        verdict: 'POSSIBLE_MATCH',
        matchType: 'NAME_MATCH',
        matchConfidence: 'MEDIUM',
        matchScore: 0.78,
        exclusionType: '1128(a)(1)',
        exclusionDate: '2025-12-01',
      },
      'artifact-1',
      'checksum-1',
      '2026-03-22T12:00:00.000Z',
    );

    expect(claims).toHaveLength(1);
    expect(claims[0]?.status).toBe('UNVERIFIED');
    expect(claims[0]?.reviewRequired).toBe(true);
    expect((claims[0]?.value as Record<string, unknown>).verdict).toBe('POSSIBLE_MATCH');
    expect((claims[0]?.value as Record<string, unknown>).excluded).toBe(false);
  });

  it('stamps PECOS claims as quarterly point-in-time data', () => {
    const { claims } = parsePecosRecord(
      '1234567890',
      {
        enrolled: true,
        enrollmentType: 'INDIVIDUAL',
        eligibleToOrderRefer: true,
        source: 'PECOS',
        observedAt: '2026-01-15T00:00:00.000Z',
        dataVersion: 'pecos-q1-2026',
        sourceLatency: 'QUARTERLY',
        dataFreshness: 'QUARTERLY',
      },
      'artifact-2',
      'checksum-2',
      '2026-03-22T12:00:00.000Z',
    );

    expect(claims).toHaveLength(1);
    expect((claims[0]?.value as Record<string, unknown>).dataFreshness).toBe('QUARTERLY');
    expect((claims[0]?.value as Record<string, unknown>).dataVersion).toBe('pecos-q1-2026');
    expect((claims[0]?.value as Record<string, unknown>).sourceDisclaimer).toContain('point-in-time');
  });
});
