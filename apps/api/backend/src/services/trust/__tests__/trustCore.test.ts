import {
  computeDeterministicTrustReadiness,
  defaultCoverageStateForSource,
  resolveSourceCoverageState,
} from '../trustCore';

describe('trust core readiness', () => {
  it('maps source coverage into explicit state-machine outputs', () => {
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: true })).toBe('CHECKED');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: false })).toBe('PENDING');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', unavailable: true })).toBe('UNAVAILABLE');
    expect(defaultCoverageStateForSource('NURSYS_ENOTIFY')).toBe('GATED');
  });

  it('computes readiness from the four deterministic dimensions only', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'CHECKED', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'REVIEW_REQUIRED',
        confidence: 0.78,
        blocker: 'OIG/LEIE possible match requires review',
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'HUMAN_REQUIRED', reason: 'possible match' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'CHECKED', reason: 'checked' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'CHECKED', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('PENDING_VERIFICATION');
    expect(readiness.readinessScore).toBe(67);
    expect(readiness.blockers).toContain('OIG/LEIE possible match requires review');
    expect(readiness.nextActions).toContain('Resolve LEIE review');
    expect(readiness.confidenceWeighting.identity).toBe(0.99);
  });

  it('treats gated licensure sources as unresolved coverage, not verified truth', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'CHECKED', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'CHECKED', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'UNMET',
        confidence: 0.25,
        gap: 'State license artifact missing',
        sourceCoverage: [{ sourceId: 'NURSYS', state: 'GATED', reason: 'institutional access required' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'UNMET',
        confidence: 0.25,
        gap: 'PECOS enrollment artifact missing',
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'PENDING', reason: 'not checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.readinessScore).toBe(48);
    expect(readiness.nextActions).toContain('Refresh licensure proof');
    expect(readiness.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'NURSYS', state: 'GATED' }),
      ]),
    );
  });
});
