/**
 * Rollout Survivability — CI Gate (W2-PR84A)
 *
 * Canary suite. Every public primitive must:
 *   - throw RolloutSurvivabilityError on boundary breaches (not silently allow);
 *   - export an enumerated `violation` field;
 *   - never coerce AMBIGUOUS_ADOPTION verdicts to SURVIVING (the silent-collapse anti-pattern);
 *   - produce a deterministic, salted rolloutDigest (not collide across inputs);
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  KNOWN_ADOPTION_STAGES,
  KNOWN_ROLLOUT_FRICTION_KINDS,
  KNOWN_ROLLOUT_VERDICTS,
  KNOWN_ROLLOUT_VIOLATIONS,
  ROLLOUT_SURVIVABILITY_SENTINELS,
  RolloutSurvivabilityError,
  assertAdoptionAmbiguityPreserved,
  assertRolloutBoundary,
  computeRolloutBoundary,
  quarantineRollout,
  rolloutDigest,
  traceFrictionLineage,
  type AdoptionStage,
  type RolloutFrictionKind,
  type RolloutSignal,
  type RolloutSurvivabilityVerdict,
} from '../rolloutSurvivability';

const KNOWN_VIOLATIONS = [
  'AMBIGUOUS_ADOPTION_FORCED_SURVIVING',
  'BOUNDARY_BREACH',
  'PARTIAL_ROLLOUT_FLOOR_BREACHED',
  'RESISTANCE_OPEN_FAILURE',
] as const;

const KNOWN_VERDICTS: RolloutSurvivabilityVerdict[] = [
  'SURVIVING',
  'PARTIAL_SURVIVING',
  'AMBIGUOUS_ADOPTION',
  'RESISTANT',
  'CONTAMINATED',
  'ROLLOUT_BREACH',
];

const KNOWN_KINDS: RolloutFrictionKind[] = [
  'CONFIG_DRIFT',
  'POLICY_INCONSISTENCY',
  'OPERATIONAL_RESISTANCE',
  'PARTIAL_DEPLOYMENT',
  'INSTITUTIONAL_NONCOOPERATION',
  'ROLLBACK',
  'TELEMETRY_GAP',
  'AMBIGUOUS_ADOPTION_SIGNAL',
];

const KNOWN_STAGES: AdoptionStage[] = [
  'NOT_ADOPTED',
  'PILOT',
  'PARTIAL',
  'ADOPTED',
  'PILOT_REGRESSION',
  'ABANDONED',
];

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported verdict is in the runtime KNOWN_ROLLOUT_VERDICTS list', () => {
    for (const v of KNOWN_VERDICTS) {
      expect(KNOWN_ROLLOUT_VERDICTS).toContain(v);
    }
    expect(KNOWN_ROLLOUT_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported friction kind is in the runtime KNOWN_ROLLOUT_FRICTION_KINDS list', () => {
    for (const k of KNOWN_KINDS) {
      expect(KNOWN_ROLLOUT_FRICTION_KINDS).toContain(k);
    }
    expect(KNOWN_ROLLOUT_FRICTION_KINDS).toHaveLength(KNOWN_KINDS.length);
  });

  it('every exported violation is in the runtime KNOWN_ROLLOUT_VIOLATIONS list', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_ROLLOUT_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_ROLLOUT_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('every exported stage is in the runtime KNOWN_ADOPTION_STAGES list', () => {
    for (const s of KNOWN_STAGES) {
      expect(KNOWN_ADOPTION_STAGES).toContain(s);
    }
    expect(KNOWN_ADOPTION_STAGES).toHaveLength(KNOWN_STAGES.length);
  });

  it('verdict / kind / violation / stage / sentinel objects are frozen', () => {
    expect(Object.isFrozen(KNOWN_ROLLOUT_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ROLLOUT_FRICTION_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ROLLOUT_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ADOPTION_STAGES)).toBe(true);
    expect(Object.isFrozen(ROLLOUT_SURVIVABILITY_SENTINELS)).toBe(true);
  });
});

describe('CI gate — RolloutSurvivabilityError contract', () => {
  it('every breach primitive throws a RolloutSurvivabilityError with a known violation', () => {
    const cases: Array<{ name: string; run: () => void; expected: string }> = [
      {
        name: 'assertAdoptionAmbiguityPreserved discards ambiguity',
        expected: 'AMBIGUOUS_ADOPTION_FORCED_SURVIVING',
        run: () => assertAdoptionAmbiguityPreserved({
          schema: 'vitalcv.rollout-survivability.v1',
          institutionId: 'inst-x',
          verdict: 'SURVIVING',
          kind: 'POLICY_INCONSISTENCY', // contradiction
          stage: 'ADOPTED',
          ambiguous: false,
          reason: 'forced',
          rolloutDigest: '0'.repeat(64),
          observedAt: '2026-05-09T00:00:00.000Z',
          lineageHints: { parentOrgId: null, policyBundleId: null, deploymentManifestId: null },
          subunitAdoptionRatio: 1,
        }),
      },
      {
        name: 'assertRolloutBoundary partial-rollout floor breach',
        expected: 'PARTIAL_ROLLOUT_FLOOR_BREACHED',
        run: () => {
          const boundary = computeRolloutBoundary({
            totalInstitutions: 10,
            records: [
              quarantineRollout({
                institutionId: 'only-survivor',
                signal: cleanSignal(),
              }),
            ],
            minPartialAdoptionResiliencePct: 80,
          });
          assertRolloutBoundary(boundary, { minPartialAdoptionResiliencePct: 80 });
        },
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try { c.run(); } catch (e) { caught = e; }
      expect(caught).toBeInstanceOf(RolloutSurvivabilityError);
      const err = caught as RolloutSurvivabilityError;
      expect(err.code).toBe('ROLLOUT_SURVIVABILITY_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

describe('CI gate — rolloutDigest is deterministic and unique', () => {
  it('produces unique digests for distinct (institutionId, verdict, kind, stage, signal) tuples', () => {
    const inputs = [
      { institutionId: 'inst-1', verdict: 'SURVIVING'        as const, kind: null,                                stage: 'ADOPTED'          as const, signal: cleanSignal() },
      { institutionId: 'inst-1', verdict: 'PARTIAL_SURVIVING' as const, kind: 'PARTIAL_DEPLOYMENT'         as const, stage: 'PARTIAL'          as const, signal: partialSignal() },
      { institutionId: 'inst-2', verdict: 'SURVIVING'        as const, kind: null,                                stage: 'ADOPTED'          as const, signal: cleanSignal() },
      { institutionId: 'inst-1', verdict: 'AMBIGUOUS_ADOPTION' as const, kind: 'AMBIGUOUS_ADOPTION_SIGNAL' as const, stage: 'NOT_ADOPTED'      as const, signal: ambiguousSignal() },
      { institutionId: 'inst-1', verdict: 'RESISTANT'        as const, kind: 'INSTITUTIONAL_NONCOOPERATION' as const, stage: 'PILOT_REGRESSION' as const, signal: cleanSignal() },
    ];
    const digests = inputs.map(rolloutDigest);
    expect(new Set(digests).size).toBe(inputs.length);

    // Reproducibility — same input twice yields same digest.
    expect(rolloutDigest(inputs[0])).toBe(digests[0]);
  });
});

describe('CI gate — rollout record never silently collapses', () => {
  it('an AMBIGUOUS-input quarantine round-trip preserves verdict=AMBIGUOUS_ADOPTION', () => {
    const r = quarantineRollout({ institutionId: 'inst-1', signal: ambiguousSignal() });
    expect(r.verdict).toBe('AMBIGUOUS_ADOPTION');
    expect(r.ambiguous).toBe(true);
    expect(() => assertAdoptionAmbiguityPreserved(r)).not.toThrow();
  });

  it('a clean quarantine round-trip never carries a non-null kind', () => {
    const r = quarantineRollout({ institutionId: 'inst-1', signal: cleanSignal() });
    expect(r.verdict).toBe('SURVIVING');
    expect(r.kind).toBeNull();
  });

  it('a telemetry-gap signal preserves AMBIGUOUS_ADOPTION (no silent SURVIVING dressing)', () => {
    const r = quarantineRollout({
      institutionId: 'inst-1',
      signal: { ...cleanSignal(), telemetryObserved: false },
    });
    expect(r.verdict).toBe('AMBIGUOUS_ADOPTION');
    expect(r.kind).toBe('TELEMETRY_GAP');
  });
});

describe('CI gate — friction lineage reconstruction is order-independent and deterministic', () => {
  it('reconstructionDigest matches across reorderings of the same candidate set', () => {
    const a = traceFrictionLineage({
      rootInstitutionId: 'root-1',
      rootHints: { parentOrgId: 'parent-A', policyBundleId: 'pb-1', deploymentManifestId: null },
      candidates: [
        { institutionId: 'cand-A', hints: { parentOrgId: 'parent-A', policyBundleId: null,   deploymentManifestId: null } },
        { institutionId: 'cand-B', hints: { parentOrgId: null,        policyBundleId: 'pb-1', deploymentManifestId: null } },
      ],
    });
    const b = traceFrictionLineage({
      rootInstitutionId: 'root-1',
      rootHints: { parentOrgId: 'parent-A', policyBundleId: 'pb-1', deploymentManifestId: null },
      candidates: [
        { institutionId: 'cand-B', hints: { parentOrgId: null,        policyBundleId: 'pb-1', deploymentManifestId: null } },
        { institutionId: 'cand-A', hints: { parentOrgId: 'parent-A', policyBundleId: null,   deploymentManifestId: null } },
      ],
    });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanSignal(): RolloutSignal {
  return {
    deploymentApplied: true,
    telemetryObserved: true,
    localPolicyDigest: 'a'.repeat(64),
    expectedPolicyDigest: 'a'.repeat(64),
    resistanceEvidence: null,
    subunitsAdopted: 4,
    subunitsTotal: 4,
    rollbackIssued: false,
  };
}

function partialSignal(): RolloutSignal {
  return { ...cleanSignal(), subunitsAdopted: 2, subunitsTotal: 4 };
}

function ambiguousSignal(): RolloutSignal {
  return { ...cleanSignal(), deploymentApplied: false, telemetryObserved: true, subunitsAdopted: 0, subunitsTotal: 4 };
}
