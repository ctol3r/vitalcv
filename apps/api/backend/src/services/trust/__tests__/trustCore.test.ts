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

  it('keeps a not-found result out of checked even when an artifact exists', () => {
    // The production shape: an artifact row was stored (checked: true, fresh),
    // but what it recorded was "the registry has no active record for this
    // NPI". Landing on 'checked' is what rendered Source-backed for a
    // non-existent NPI on /verify/[npi].
    expect(
      resolveSourceCoverageState({
        sourceId: 'NPPES_API',
        checked: true,
        fresh: true,
        notFound: true,
      }),
    ).toBe('notFound');

    expect(
      resolveSourceCoverageState({
        sourceId: 'PECOS_PUBLIC',
        checked: true,
        fresh: true,
        notFound: true,
      }),
    ).toBe('notFound');

    // An unread source still outranks it — there we never got an answer at all.
    expect(
      resolveSourceCoverageState({ sourceId: 'NPPES_API', notFound: true, unavailable: true }),
    ).toBe('unavailable');

    // And an affirming read is untouched.
    expect(
      resolveSourceCoverageState({ sourceId: 'NPPES_API', checked: true, fresh: true }),
    ).toBe('checked');
  });

  it('will not certify readiness from lanes that found no record', () => {
    const lane = (sourceId: string) => ({
      sourceCoverage: [{ sourceId, state: 'notFound' as const, reason: 'no active record' }],
    });
    const readiness = computeDeterministicTrustReadiness({
      identity: { dimension: 'identity', status: 'MET', confidence: 0.99, ...lane('NPPES_API') },
      exclusion: { dimension: 'exclusion', status: 'MET', confidence: 0.95, ...lane('OIG_LEIE') },
      licensure: { dimension: 'licensure', status: 'MET', confidence: 0.95, ...lane('STATE_BOARD') },
      enrollment: { dimension: 'enrollment', status: 'MET', confidence: 0.95, ...lane('PECOS_PUBLIC') },
    });

    // Every dimension claims MET; not one source actually found the provider.
    expect(readiness.readinessState).not.toBe('DECISION_GRADE');
    expect(readiness.overallStatus).not.toBe('CLEAR_TO_START');
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
