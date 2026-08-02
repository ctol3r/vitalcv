import { describe, expect, it } from 'vitest';
import {
  assertNoLeakedFields,
  buildPublicSourceStates,
  type BackendSourceRuntimeInput,
} from '@/lib/trust/publicEvidenceSourceState';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * Parity matrix for the single public source projection (C5).
 *
 * The cases that matter are the ones where a plausible implementation would
 * report something flattering:
 *
 *   - runtime unreachable            → nothing may default to live
 *   - freshness expired              → STALE, not LIVE
 *   - catalogued but never run       → NOT_CONFIGURED, not LIVE
 *   - unrecognised runtime string    → not LIVE
 *
 * Each asserts the OUTCOME a reader sees, not the internal branch taken.
 */

const COMPUTED_AT = '2026-08-02T12:00:00.000Z';

function runtimeEntry(
  sourceId: string,
  overrides: Partial<BackendSourceRuntimeInput> = {},
): BackendSourceRuntimeInput {
  return {
    sourceId,
    runtimeState: 'live',
    lastSuccessfulAt: '2026-08-02T11:00:00.000Z',
    freshnessStatus: 'current',
    limitation: null,
    isLive: true,
    decisionGradeEligible: true,
    adapterImplemented: true,
    credentialsPresent: true,
    ...overrides,
  };
}

const byId = (states: readonly { sourceId: string }[], id: string) =>
  states.find((s) => s.sourceId === id);

describe('runtime unavailable — nothing defaults to live', () => {
  const states = buildPublicSourceStates({ runtime: null, computedAt: COMPUTED_AT });

  it('emits every catalogued lane rather than dropping them', () => {
    // A source vanishing from a public register reads as "we do not use it",
    // which is a different and worse lie than "we cannot reach it".
    expect(states).toHaveLength(SOURCE_LANE_OPS.length);
  });

  it('marks none of them available', () => {
    expect(states.filter((s) => s.availableToVitalCV)).toEqual([]);
    expect(states.filter((s) => s.runtimeState === 'LIVE')).toEqual([]);
  });

  it('says runtime availability is unavailable, not that the source is available', () => {
    for (const state of states) {
      expect(state.limitation).toBe('Runtime availability unavailable');
      expect(state.publicLabel).toMatch(/runtime availability unavailable/i);
      expect(state.decisionUse).toBe('NOT_USABLE');
    }
  });

  it('never invents a timestamp', () => {
    // A missing observation time renders as absent. Defaulting it to the request
    // clock is how a build time became unfalsifiable once already.
    for (const state of states) {
      expect(state.lastSuccessfulAt).toBeNull();
    }
  });
});

describe('freshness outranks a live runtime claim', () => {
  it('reports STALE when the last successful read aged out, even if runtime says live', () => {
    const states = buildPublicSourceStates({
      runtime: [runtimeEntry('nppes_identity', { runtimeState: 'live', freshnessStatus: 'stale' })],
      computedAt: COMPUTED_AT,
    });
    const nppes = byId(states, 'nppes_identity');
    expect(nppes?.runtimeState).toBe('STALE');
    expect(nppes?.publicLabel).not.toMatch(/read live/i);
  });

  it('reports LIVE only when runtime and freshness agree', () => {
    const states = buildPublicSourceStates({
      runtime: [runtimeEntry('nppes_identity')],
      computedAt: COMPUTED_AT,
    });
    expect(byId(states, 'nppes_identity')?.runtimeState).toBe('LIVE');
  });
});

describe('a catalogued lane with no run is not live', () => {
  it('maps a missing runtime entry to NOT_CONFIGURED', () => {
    const states = buildPublicSourceStates({
      runtime: [runtimeEntry('nppes_identity')],
      computedAt: COMPUTED_AT,
    });
    const others = states.filter((s) => s.sourceId !== 'nppes_identity');
    expect(others.length).toBeGreaterThan(0);
    for (const state of others) {
      expect(['NOT_CONFIGURED', 'NOT_IMPLEMENTED']).toContain(state.runtimeState);
      expect(state.availableToVitalCV).toBe(false);
    }
  });
});

describe('unrecognised runtime vocabulary fails closed', () => {
  it('does not map an unknown state to LIVE', () => {
    const states = buildPublicSourceStates({
      runtime: [runtimeEntry('nppes_identity', { runtimeState: 'something_new_upstream' })],
      computedAt: COMPUTED_AT,
    });
    const nppes = byId(states, 'nppes_identity');
    expect(nppes?.runtimeState).toBe('TEMPORARILY_UNAVAILABLE');
    expect(nppes?.availableToVitalCV).toBe(false);
  });
});

describe('the five unavailable-ish states stay distinct', () => {
  it('does not collapse STALE, BLOCKED_ON_ACCESS, NOT_CHECKED or TEMPORARILY_UNAVAILABLE', () => {
    const mapped = (raw: string) =>
      byId(
        buildPublicSourceStates({
          runtime: [runtimeEntry('nppes_identity', { runtimeState: raw })],
          computedAt: COMPUTED_AT,
        }),
        'nppes_identity',
      )?.runtimeState;

    const results = [
      mapped('stale'),
      mapped('access_required'),
      mapped('not_checked'),
      mapped('failed'),
    ];
    expect(results).toEqual([
      'STALE',
      'BLOCKED_ON_ACCESS',
      'NOT_CHECKED',
      'TEMPORARILY_UNAVAILABLE',
    ]);
    // Four inputs, four distinct outputs — no pair silently merged.
    expect(new Set(results).size).toBe(4);
  });
});

describe('licensure renders scope-aware, not as a bare state board', () => {
  const LICENSURE_LABEL = 'Physician licensure — national source access pending';

  it('uses the licensure package headline for the licensure lane', () => {
    const states = buildPublicSourceStates({
      runtime: [],
      licensureLabel: LICENSURE_LABEL,
      computedAt: COMPUTED_AT,
    });
    const licensure = states.find((s) => s.domain === 'licensure');
    expect(licensure?.publicLabel).toBe(LICENSURE_LABEL);
  });

  it('does not render the broader "State board — access required" for it', () => {
    const states = buildPublicSourceStates({
      runtime: [],
      licensureLabel: LICENSURE_LABEL,
      computedAt: COMPUTED_AT,
    });
    const licensure = states.find((s) => s.domain === 'licensure');
    expect(licensure?.publicLabel).not.toMatch(/^State board/);
  });

  it('still fails closed for licensure when no headline is supplied', () => {
    const states = buildPublicSourceStates({ runtime: [], computedAt: COMPUTED_AT });
    const licensure = states.find((s) => s.domain === 'licensure');
    expect(licensure?.availableToVitalCV).toBe(false);
  });
});

describe('C4 — no clinician or internal data in the public payload', () => {
  it('carries none of the forbidden fields, for any runtime input', () => {
    const states = buildPublicSourceStates({
      runtime: SOURCE_LANE_OPS.map((lane) => runtimeEntry(lane.laneId)),
      computedAt: COMPUTED_AT,
    });
    for (const state of states) {
      expect(() => assertNoLeakedFields(state as unknown as Record<string, unknown>)).not.toThrow();
    }
  });

  it('assertNoLeakedFields actually fires — proven by injecting a leak', () => {
    // A guard that cannot go red is not a guard. `lastArtifactId` is the real
    // risk here: it is present on the backend state this module consumes, so a
    // future `...runtime` spread would publish it.
    expect(() =>
      assertNoLeakedFields({ sourceId: 'nppes_identity', lastArtifactId: 'artifact-123' }),
    ).toThrow(/lastArtifactId/);
    expect(() => assertNoLeakedFields({ npi: '1234567893' })).toThrow(/npi/);
  });
});

describe('determinism', () => {
  it('never reads a clock — computedAt is what the caller passed', () => {
    const states = buildPublicSourceStates({ runtime: null, computedAt: COMPUTED_AT });
    for (const state of states) {
      expect(state.computedAt).toBe(COMPUTED_AT);
    }
  });
});
