import { computeDriftSignal } from '../drift';

function passport(overrides: Record<string, unknown> = {}): never {
  return {
    decision: { decision: 'PROCEED', confidence: 90, rationale: [], blockers: [], next_actions: [] },
    readiness: { blockers: [], gaps: [] },
    standing: { exclusionStatus: 'CLEAR', licensureStatus: 'verified' },
    sourceCoverage: { checks: [] },
    ...overrides,
  } as never;
}

const fixedNow = new Date('2026-04-14T12:00:00.000Z');

describe('computeDriftSignal', () => {
  it('returns STABLE with no reasons when everything is clean', () => {
    const result = computeDriftSignal(
      { passport: passport(), reuseSignal: null },
      fixedNow,
    );
    expect(result).toEqual({
      state: 'STABLE',
      reasons: [],
      lastChecked: '2026-04-14T12:00:00.000Z',
    });
  });

  it('escalates to HARD_DRIFT on DO_NOT_PROCEED', () => {
    const result = computeDriftSignal(
      {
        passport: passport({
          decision: { decision: 'DO_NOT_PROCEED', confidence: 10, rationale: [], blockers: ['x'], next_actions: [] },
          readiness: { blockers: ['x'], gaps: [] },
        }),
        reuseSignal: null,
      },
      fixedNow,
    );
    expect(result.state).toBe('HARD_DRIFT');
    expect(result.reasons).toEqual(
      expect.arrayContaining(['Decision is DO_NOT_PROCEED', expect.stringMatching(/Readiness blockers/)]),
    );
  });

  it('flags SOFT_DRIFT for PROCEED_WITH_CAUTION without upgrading to HARD', () => {
    const result = computeDriftSignal(
      {
        passport: passport({
          decision: { decision: 'PROCEED_WITH_CAUTION', confidence: 55, rationale: [], blockers: [], next_actions: [] },
        }),
        reuseSignal: null,
      },
      fixedNow,
    );
    expect(result.state).toBe('SOFT_DRIFT');
    expect(result.reasons).toContain('Decision is PROCEED_WITH_CAUTION');
  });

  it('flags SOFT_DRIFT on stale sources and prior-employer flags', () => {
    const result = computeDriftSignal(
      {
        passport: passport({
          sourceCoverage: { checks: [{ state: 'stale' }, { state: 'checked' }] },
        }),
        reuseSignal: {
          accepted_count: 0,
          flagged_count: 2,
          request_data_count: 0,
          last_action: 'flag',
          last_action_at: '2026-04-13T00:00:00.000Z',
        },
      },
      fixedNow,
    );
    expect(result.state).toBe('SOFT_DRIFT');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Stale source checks/),
        expect.stringMatching(/Flagged by 2/),
      ]),
    );
  });

  it('HARD trumps SOFT when both present (exclusion + stale)', () => {
    const result = computeDriftSignal(
      {
        passport: passport({
          standing: { exclusionStatus: 'EXCLUDED', licensureStatus: 'verified' },
          sourceCoverage: { checks: [{ state: 'stale' }] },
        }),
        reuseSignal: null,
      },
      fixedNow,
    );
    expect(result.state).toBe('HARD_DRIFT');
    expect(result.reasons).toContain('OIG/LEIE exclusion detected');
    // SOFT-only reasons must NOT be collected once state is already HARD.
    expect(result.reasons).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Stale source checks/)]),
    );
  });

  it('handles null passport gracefully (invalid NPI path)', () => {
    const result = computeDriftSignal(
      { passport: null, reuseSignal: null },
      fixedNow,
    );
    expect(result).toEqual({
      state: 'STABLE',
      reasons: [],
      lastChecked: '2026-04-14T12:00:00.000Z',
    });
  });
});
