import {
  computeDeterministicTrustReadiness,
  defaultCoverageStateForSource,
  resolveSourceCoverageState,
} from '../trustCore';

describe('trust core readiness', () => {
  it('maps source coverage into explicit state-machine outputs', () => {
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: true })).toBe('checked');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', checked: true, fresh: false })).toBe('stale');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', unavailable: true })).toBe('unavailable');
    expect(resolveSourceCoverageState({ sourceId: 'OIG_LEIE', humanRequired: true })).toBe('reviewRequired');
    expect(resolveSourceCoverageState({ sourceId: 'STATE_BOARD', accessRequired: true })).toBe('accessRequired');
    expect(defaultCoverageStateForSource('NURSYS_ENOTIFY')).toBe('gated');
  });

  it('computes readiness from checked decision-grade source results', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'checked', reason: 'clear' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'checked', reason: 'checked' }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('CLEAR_TO_START');
    expect(readiness.readinessState).toBe('DECISION_GRADE');
    // Canonical score (trust-convergence migration): 4 launch-spine sources
    // checked × 25 = 100, no blocker/gap cap. Previously 96 under the
    // weighted-confidence formula in trustCore. Score now matches what
    // `derivePassportReadiness` returns for the same coverage.
    expect(readiness.readinessScore).toBe(100);
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
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'checked', reason: 'checked' }],
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
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.readinessState).toBe('PARTIAL');
    // Canonical: 3 of 4 spine sources checked × 25 = 75; gap-only caps at
    // 75 (no-op here). Previously 67 under the weighted formula.
    expect(readiness.readinessScore).toBe(75);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.gaps).toContain('licensure stale');
  });

  it('treats gated licensure sources as unresolved coverage, not verified truth', () => {
    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'checked', reason: 'checked' }],
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
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'pending', reason: 'not checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.readinessState).toBe('PARTIAL');
    // Canonical: 2 of 4 spine sources checked × 25 = 50; gaps present
    // (cap at 75) does not lower 50. Previously 48 under weighted formula.
    expect(readiness.readinessScore).toBe(50);
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
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'checked', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'STATE_BOARD', state: 'checked', reason: 'checked' }],
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
    expect(readiness.nextActions.length).toBeGreaterThan(0);
  });

  it('excludes unsupported sources from readiness instead of treating them as decision-grade proof', () => {
    const unsupportedState = resolveSourceCoverageState({
      sourceId: 'SOME_RANDOM_UNSUPPORTED_SOURCE',
      checked: true,
      fresh: true,
    });

    expect(unsupportedState).toBe('notDecisionGrade');

    const readiness = computeDeterministicTrustReadiness({
      identity: {
        dimension: 'identity',
        status: 'MET',
        confidence: 0.99,
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'checked' }],
      },
      exclusion: {
        dimension: 'exclusion',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'OIG_LEIE', state: 'checked', reason: 'checked' }],
      },
      licensure: {
        dimension: 'licensure',
        status: 'UNMET',
        confidence: 0.95,
        gap: 'Unsupported source excluded from readiness',
        sourceCoverage: [{
          sourceId: 'SOME_RANDOM_UNSUPPORTED_SOURCE',
          state: unsupportedState,
          reason: 'Unsupported source excluded from readiness',
        }],
      },
      enrollment: {
        dimension: 'enrollment',
        status: 'MET',
        confidence: 0.95,
        sourceCoverage: [{ sourceId: 'PECOS_PUBLIC', state: 'checked', reason: 'checked' }],
      },
    });

    expect(readiness.overallStatus).toBe('MISSING_CREDENTIALS');
    expect(readiness.gaps).toContain('Unsupported source excluded from readiness');
    expect(readiness.readinessScore).toBeLessThan(90);
  });
});
