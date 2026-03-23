import {
  computeDeterministicTrustReadiness,
  defaultCoverageStateForSource,
  resolveSourceCoverageState,
} from '../trustCore';

describe('trust core readiness', () => {
  it('maps source coverage into explicit state-machine outputs', () => {
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: true })).toBe('live');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: false })).toBe('stale');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', unavailable: true })).toBe('unavailable');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', humanRequired: true })).toBe('reviewRequired');
    expect(defaultCoverageStateForSource('NURSYS_ENOTIFY')).toBe('gated');
  });

  it('computes readiness from live-only source results', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'live', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'live', reason: 'clear' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'live', reason: 'checked' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'live', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('CLEAR_TO_START');
    expect(readiness.readinessScore).toBe(96);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.gaps).toEqual([]);
    expect(readiness.confidenceWeighting.identity).toBe(0.99);
  });

  it('downgrades stale source coverage out of decision-grade readiness', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'live', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'live', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'stale', reason: 'licensure stale' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'live', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.readinessScore).toBe(67);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.gaps).toContain('licensure stale');
  });

  it('treats gated licensure sources as unresolved coverage, not verified truth', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'live', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'live', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        gap: 'State license artifact missing',
        sourceCoverage: [{ sourceId: 'NURSYS', state: 'gated', reason: 'institutional access required' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'UNMET',
        confidence: 0.25,
        gap: 'PECOS enrollment artifact missing',
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'notChecked', reason: 'not checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.readinessScore).toBe(48);
    expect(readiness.nextActions).toContain('Refresh licensure proof');
    expect(readiness.sourceCoverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: 'NURSYS', state: 'gated' }),
      ]),
    );
  });

  it('excludes notDecisionGrade source coverage from decision-grade trust', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'live', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'live', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'live', reason: 'checked' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'BLOCKED',
        confidence: 0.95,
        blocker: 'PECOS quarterly enrollment not found',
        gap: 'PECOS evidence is not decision-grade and excluded from decision-grade trust',
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'notDecisionGrade', reason: 'PECOS evidence is not decision-grade and excluded from decision-grade trust' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.blockers).not.toContain('PECOS quarterly enrollment not found');
    expect(readiness.gaps).toContain('PECOS evidence is not decision-grade and excluded from decision-grade trust');
    expect(readiness.nextActions).toContain('Verify Medicare enrollment status');
  });

  it('excludes unsupported sources from readiness by assigning notDecisionGrade', () => {
    expect(resolveSourceCoverageState({ sourceId: 'SOME_RANDOM_UNSUPPORTED_SOURCE', checked: true, fresh: true })).toBe('notDecisionGrade');
  });
});
