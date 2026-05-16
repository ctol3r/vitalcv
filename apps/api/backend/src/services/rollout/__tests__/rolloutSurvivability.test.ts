/**
 * rolloutSurvivability.test.ts — W2-PR84A unit tests
 *
 * Pure-transform coverage for the institutional rollout survivability module.
 * Mirrors the structure of replayCorruptionContainment.test.ts.
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
  classifyRollout,
  computeRolloutBoundary,
  evaluateRollout,
  quarantineRollout,
  rolloutDigest,
  traceFrictionLineage,
  type RolloutSignal,
  type RolloutSurvivabilityRecord,
} from '../rolloutSurvivability';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const POLICY_DIGEST_A = 'a'.repeat(64);
const POLICY_DIGEST_B = 'b'.repeat(64);

function adoptedSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return {
    deploymentApplied: true,
    telemetryObserved: true,
    localPolicyDigest: POLICY_DIGEST_A,
    expectedPolicyDigest: POLICY_DIGEST_A,
    resistanceEvidence: null,
    subunitsAdopted: 4,
    subunitsTotal: 4,
    rollbackIssued: false,
    ...overrides,
  };
}

function partialSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({ subunitsAdopted: 2, subunitsTotal: 4, ...overrides });
}

function policyDriftSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({
    localPolicyDigest: POLICY_DIGEST_A,
    expectedPolicyDigest: POLICY_DIGEST_B,
    ...overrides,
  });
}

function notAdoptedSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({
    deploymentApplied: false,
    telemetryObserved: false,
    subunitsAdopted: 0,
    subunitsTotal: 0,
    ...overrides,
  });
}

function resistantSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({
    deploymentApplied: false,
    telemetryObserved: false,
    resistanceEvidence: 'IT director refused install pending board review.',
    subunitsAdopted: 0,
    subunitsTotal: 4,
    ...overrides,
  });
}

function rollbackSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({
    rollbackIssued: true,
    ...overrides,
  });
}

function telemetryGapSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return adoptedSignal({
    telemetryObserved: false,
    ...overrides,
  });
}

function ambiguousSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  // deployment not applied but telemetry observed → contradictory.
  return adoptedSignal({
    deploymentApplied: false,
    telemetryObserved: true,
    subunitsAdopted: 0,
    subunitsTotal: 4,
    ...overrides,
  });
}

// ── classifyRollout ──────────────────────────────────────────────────────────

describe('classifyRollout', () => {
  it('classifies a fully adopted institution as kind=null, stage=ADOPTED', () => {
    const c = classifyRollout({ signal: adoptedSignal() });
    expect(c.kind).toBeNull();
    expect(c.stage).toBe('ADOPTED');
    expect(c.ambiguous).toBe(false);
    expect(c.subunitAdoptionRatio).toBeCloseTo(1, 5);
  });

  it('classifies partial sub-unit adoption as PARTIAL_DEPLOYMENT/PARTIAL', () => {
    const c = classifyRollout({ signal: partialSignal() });
    expect(c.kind).toBe('PARTIAL_DEPLOYMENT');
    expect(c.stage).toBe('PARTIAL');
    expect(c.ambiguous).toBe(false);
    expect(c.subunitAdoptionRatio).toBeCloseTo(0.5, 5);
  });

  it('classifies policy drift as POLICY_INCONSISTENCY/PARTIAL', () => {
    const c = classifyRollout({ signal: policyDriftSignal() });
    expect(c.kind).toBe('POLICY_INCONSISTENCY');
    expect(c.stage).toBe('PARTIAL');
  });

  it('classifies an institution with no deploy + no telemetry as CONFIG_DRIFT/NOT_ADOPTED', () => {
    const c = classifyRollout({ signal: notAdoptedSignal() });
    expect(c.kind).toBe('CONFIG_DRIFT');
    expect(c.stage).toBe('NOT_ADOPTED');
  });

  it('classifies operator resistance evidence as OPERATIONAL_RESISTANCE for first-time deploy', () => {
    const c = classifyRollout({ signal: resistantSignal() });
    expect(c.kind).toBe('OPERATIONAL_RESISTANCE');
    expect(c.stage).toBe('NOT_ADOPTED');
  });

  it('classifies operator resistance for a previously adopted institution as INSTITUTIONAL_NONCOOPERATION', () => {
    const c = classifyRollout({
      signal: resistantSignal(),
      previouslyAdopted: true,
    });
    expect(c.kind).toBe('INSTITUTIONAL_NONCOOPERATION');
    expect(c.stage).toBe('PILOT_REGRESSION');
  });

  it('classifies a formal rollback as ROLLBACK regardless of other signals', () => {
    const c = classifyRollout({
      signal: rollbackSignal({ telemetryObserved: true }),
      previouslyAdopted: true,
    });
    expect(c.kind).toBe('ROLLBACK');
    expect(c.stage).toBe('PILOT_REGRESSION');
  });

  it('classifies deployment-applied + no-telemetry as TELEMETRY_GAP and AMBIGUOUS', () => {
    const c = classifyRollout({ signal: telemetryGapSignal() });
    expect(c.kind).toBe('TELEMETRY_GAP');
    expect(c.ambiguous).toBe(true);
  });

  it('classifies contradictory not-applied + telemetry as AMBIGUOUS_ADOPTION_SIGNAL', () => {
    const c = classifyRollout({ signal: ambiguousSignal() });
    expect(c.kind).toBe('AMBIGUOUS_ADOPTION_SIGNAL');
    expect(c.ambiguous).toBe(true);
  });
});

// ── quarantineRollout ────────────────────────────────────────────────────────

describe('quarantineRollout', () => {
  it('returns a SURVIVING record for a clean signal', () => {
    const r = quarantineRollout({ institutionId: 'inst-1', signal: adoptedSignal() });
    expect(r.verdict).toBe('SURVIVING');
    expect(r.kind).toBeNull();
    expect(r.stage).toBe('ADOPTED');
    expect(r.ambiguous).toBe(false);
  });

  it('returns a PARTIAL_SURVIVING record for partial sub-unit adoption', () => {
    const r = quarantineRollout({ institutionId: 'inst-2', signal: partialSignal() });
    expect(r.verdict).toBe('PARTIAL_SURVIVING');
    expect(r.kind).toBe('PARTIAL_DEPLOYMENT');
  });

  it('returns an AMBIGUOUS_ADOPTION record when signals contradict', () => {
    const r = quarantineRollout({ institutionId: 'inst-3', signal: ambiguousSignal() });
    expect(r.verdict).toBe('AMBIGUOUS_ADOPTION');
    expect(r.ambiguous).toBe(true);
    expect(r.kind).toBe('AMBIGUOUS_ADOPTION_SIGNAL');
  });

  it('returns a RESISTANT record when operator resistance is reported', () => {
    const r = quarantineRollout({ institutionId: 'inst-4', signal: resistantSignal() });
    expect(r.verdict).toBe('RESISTANT');
    expect(r.kind).toBe('OPERATIONAL_RESISTANCE');
    expect(r.stage).toBe('NOT_ADOPTED');
  });

  it('returns a RESISTANT record with kind=ROLLBACK when rollback is issued', () => {
    const r = quarantineRollout({
      institutionId: 'inst-5',
      signal: rollbackSignal(),
      previouslyAdopted: true,
    });
    expect(r.verdict).toBe('RESISTANT');
    expect(r.kind).toBe('ROLLBACK');
    expect(r.stage).toBe('PILOT_REGRESSION');
  });

  it('returns a CONTAMINATED record when forcedReason indicates lineage contamination', () => {
    const r = quarantineRollout({
      institutionId: 'inst-6',
      signal: adoptedSignal(),
      forcedKind: 'INSTITUTIONAL_NONCOOPERATION',
      forcedReason: 'Institution inst-6 contaminated via lineage from a resistant parent.',
    });
    expect(r.verdict).toBe('CONTAMINATED');
    expect(r.kind).toBe('INSTITUTIONAL_NONCOOPERATION');
    expect(r.stage).toBe('PILOT_REGRESSION');
  });

  it('produces deterministic rolloutDigest values for identical inputs', () => {
    const a = quarantineRollout({ institutionId: 'inst-7', signal: adoptedSignal() });
    const b = quarantineRollout({ institutionId: 'inst-7', signal: adoptedSignal() });
    expect(a.rolloutDigest).toBe(b.rolloutDigest);
  });

  it('produces distinct rolloutDigest values across different verdicts', () => {
    const surviving   = quarantineRollout({ institutionId: 'inst-8', signal: adoptedSignal() });
    const resistant   = quarantineRollout({ institutionId: 'inst-8', signal: resistantSignal() });
    const ambiguous   = quarantineRollout({ institutionId: 'inst-8', signal: ambiguousSignal() });
    const partial     = quarantineRollout({ institutionId: 'inst-8', signal: partialSignal() });
    const digests = [surviving.rolloutDigest, resistant.rolloutDigest, ambiguous.rolloutDigest, partial.rolloutDigest];
    expect(new Set(digests).size).toBe(digests.length);
  });
});

// ── evaluateRollout ──────────────────────────────────────────────────────────

describe('evaluateRollout', () => {
  it('returns the same shape as quarantineRollout on success', () => {
    const r = evaluateRollout({ institutionId: 'inst-eval-1', signal: adoptedSignal() });
    expect(r.schema).toBe('vitalcv.rollout-survivability.v1');
    expect(r.verdict).toBe('SURVIVING');
  });
});

// ── computeRolloutBoundary ───────────────────────────────────────────────────

describe('computeRolloutBoundary', () => {
  function makeRecords(): RolloutSurvivabilityRecord[] {
    return [
      quarantineRollout({ institutionId: 'inst-1', signal: adoptedSignal() }),  // surviving
      quarantineRollout({ institutionId: 'inst-2', signal: partialSignal() }),  // partial
      quarantineRollout({ institutionId: 'inst-3', signal: ambiguousSignal() }),// ambiguous
      quarantineRollout({ institutionId: 'inst-4', signal: resistantSignal() }),// resistant
      quarantineRollout({                                                       // contaminated
        institutionId: 'inst-5',
        signal: adoptedSignal(),
        forcedKind: 'INSTITUTIONAL_NONCOOPERATION',
        forcedReason: 'inst-5 contaminated via lineage from inst-4.',
      }),
    ];
  }

  it('aggregates verdict counts correctly', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({ totalInstitutions: 5, records });
    expect(b.survivingCount).toBe(1);
    expect(b.partialSurvivingCount).toBe(1);
    expect(b.ambiguousCount).toBe(1);
    expect(b.resistantCount).toBe(1);
    expect(b.contaminatedCount).toBe(1);
  });

  it('reports rolloutSurvivabilityRatio as surviving / total', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({ totalInstitutions: 5, records });
    expect(b.rolloutSurvivabilityRatio).toBeCloseTo(1 / 5, 5);
  });

  it('reports partialAdoptionResiliencePct as (surviving+partial+ambiguous)/total *100', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({ totalInstitutions: 5, records });
    expect(b.partialAdoptionResiliencePct).toBeCloseTo(60, 5);
  });

  it('reports institutionalResistancePct as (resistant+contaminated)/total *100', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({ totalInstitutions: 5, records });
    expect(b.institutionalResistancePct).toBeCloseTo(40, 5);
  });

  it('marks the boundary partitioned when no breach and floor is met', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({
      totalInstitutions: 5,
      records,
      minPartialAdoptionResiliencePct: 50,
    });
    expect(b.partitioned).toBe(true);
  });

  it('marks the boundary not-partitioned when floor is not met', () => {
    const records = makeRecords();
    const b = computeRolloutBoundary({
      totalInstitutions: 5,
      records,
      minPartialAdoptionResiliencePct: 80,
    });
    expect(b.partitioned).toBe(false);
    expect(b.rolloutReason).toContain('below floor');
  });

  it('emits a deterministic boundary digest insensitive to record order', () => {
    const records = makeRecords();
    const b1 = computeRolloutBoundary({ totalInstitutions: 5, records });
    const b2 = computeRolloutBoundary({ totalInstitutions: 5, records: records.slice().reverse() });
    expect(b1.boundaryDigest).toBe(b2.boundaryDigest);
  });
});

// ── assertRolloutBoundary ───────────────────────────────────────────────────

describe('assertRolloutBoundary', () => {
  it('does not throw when partitioned', () => {
    const r = quarantineRollout({ institutionId: 'inst-1', signal: adoptedSignal() });
    const b = computeRolloutBoundary({ totalInstitutions: 1, records: [r] });
    expect(() => assertRolloutBoundary(b)).not.toThrow();
  });

  it('throws PARTIAL_ROLLOUT_FLOOR_BREACHED when below floor', () => {
    const records = [
      quarantineRollout({ institutionId: 'inst-1', signal: resistantSignal() }),
      quarantineRollout({ institutionId: 'inst-2', signal: resistantSignal() }),
      quarantineRollout({ institutionId: 'inst-3', signal: resistantSignal() }),
      quarantineRollout({ institutionId: 'inst-4', signal: adoptedSignal() }),
    ];
    const b = computeRolloutBoundary({
      totalInstitutions: 4,
      records,
      minPartialAdoptionResiliencePct: 80,
    });
    let caught: unknown = null;
    try { assertRolloutBoundary(b, { minPartialAdoptionResiliencePct: 80 }); }
    catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RolloutSurvivabilityError);
    expect((caught as RolloutSurvivabilityError).violation).toBe('PARTIAL_ROLLOUT_FLOOR_BREACHED');
  });
});

// ── assertAdoptionAmbiguityPreserved ────────────────────────────────────────

describe('assertAdoptionAmbiguityPreserved', () => {
  it('does not throw on a properly ambiguous record', () => {
    const r = quarantineRollout({ institutionId: 'inst-1', signal: ambiguousSignal() });
    expect(() => assertAdoptionAmbiguityPreserved(r)).not.toThrow();
  });

  it('throws when ambiguous=true but verdict is not AMBIGUOUS_ADOPTION', () => {
    const forged: RolloutSurvivabilityRecord = {
      schema: 'vitalcv.rollout-survivability.v1',
      institutionId: 'inst-x',
      verdict: 'SURVIVING',
      kind: 'AMBIGUOUS_ADOPTION_SIGNAL',
      stage: 'ADOPTED',
      ambiguous: true,
      reason: 'forged',
      rolloutDigest: '0'.repeat(64),
      observedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { parentOrgId: null, policyBundleId: null, deploymentManifestId: null },
      subunitAdoptionRatio: 1,
    };
    expect(() => assertAdoptionAmbiguityPreserved(forged)).toThrow(RolloutSurvivabilityError);
  });

  it('throws when verdict=SURVIVING but kind is not null', () => {
    const forged: RolloutSurvivabilityRecord = {
      schema: 'vitalcv.rollout-survivability.v1',
      institutionId: 'inst-y',
      verdict: 'SURVIVING',
      kind: 'POLICY_INCONSISTENCY',
      stage: 'ADOPTED',
      ambiguous: false,
      reason: 'forged',
      rolloutDigest: '0'.repeat(64),
      observedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { parentOrgId: null, policyBundleId: null, deploymentManifestId: null },
      subunitAdoptionRatio: 1,
    };
    expect(() => assertAdoptionAmbiguityPreserved(forged)).toThrow(RolloutSurvivabilityError);
  });
});

// ── traceFrictionLineage ────────────────────────────────────────────────────

describe('traceFrictionLineage', () => {
  it('emits an edge for every shared lineage hint and is order-independent', () => {
    const a = traceFrictionLineage({
      rootInstitutionId: 'root-1',
      rootHints: { parentOrgId: 'parent-A', policyBundleId: 'pb-1', deploymentManifestId: null },
      candidates: [
        { institutionId: 'cand-A', hints: { parentOrgId: 'parent-A',  policyBundleId: null,   deploymentManifestId: null } },
        { institutionId: 'cand-B', hints: { parentOrgId: null,        policyBundleId: 'pb-1', deploymentManifestId: null } },
        { institutionId: 'cand-C', hints: { parentOrgId: null,        policyBundleId: null,   deploymentManifestId: 'mf-9' } },
      ],
    });
    const b = traceFrictionLineage({
      rootInstitutionId: 'root-1',
      rootHints: { parentOrgId: 'parent-A', policyBundleId: 'pb-1', deploymentManifestId: null },
      candidates: [
        { institutionId: 'cand-C', hints: { parentOrgId: null,        policyBundleId: null,   deploymentManifestId: 'mf-9' } },
        { institutionId: 'cand-B', hints: { parentOrgId: null,        policyBundleId: 'pb-1', deploymentManifestId: null } },
        { institutionId: 'cand-A', hints: { parentOrgId: 'parent-A',  policyBundleId: null,   deploymentManifestId: null } },
      ],
    });
    expect(a.contaminatedInstitutionIds.sort()).toEqual(['cand-A', 'cand-B'].sort());
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });

  it('does not link the root to itself even if hints match', () => {
    const lineage = traceFrictionLineage({
      rootInstitutionId: 'root-1',
      rootHints: { parentOrgId: 'parent-X', policyBundleId: null, deploymentManifestId: null },
      candidates: [
        { institutionId: 'root-1', hints: { parentOrgId: 'parent-X', policyBundleId: null, deploymentManifestId: null } },
      ],
    });
    expect(lineage.contaminatedInstitutionIds).toEqual([]);
    expect(lineage.edges).toEqual([]);
  });
});

// ── rolloutDigest ───────────────────────────────────────────────────────────

describe('rolloutDigest', () => {
  it('is deterministic across calls', () => {
    const a = rolloutDigest({
      institutionId: 'inst-1',
      verdict: 'SURVIVING',
      kind: null,
      stage: 'ADOPTED',
      signal: adoptedSignal(),
    });
    const b = rolloutDigest({
      institutionId: 'inst-1',
      verdict: 'SURVIVING',
      kind: null,
      stage: 'ADOPTED',
      signal: adoptedSignal(),
    });
    expect(a).toBe(b);
  });

  it('changes when any input field changes', () => {
    const base = rolloutDigest({
      institutionId: 'inst-1',
      verdict: 'SURVIVING',
      kind: null,
      stage: 'ADOPTED',
      signal: adoptedSignal(),
    });
    const altInstitution = rolloutDigest({
      institutionId: 'inst-2',
      verdict: 'SURVIVING',
      kind: null,
      stage: 'ADOPTED',
      signal: adoptedSignal(),
    });
    const altVerdict = rolloutDigest({
      institutionId: 'inst-1',
      verdict: 'RESISTANT',
      kind: 'OPERATIONAL_RESISTANCE',
      stage: 'NOT_ADOPTED',
      signal: adoptedSignal(),
    });
    expect(altInstitution).not.toBe(base);
    expect(altVerdict).not.toBe(base);
  });
});

// ── Sentinels exhaustiveness (sanity) ───────────────────────────────────────

describe('exported sentinels', () => {
  it('lists 6 verdicts, 8 friction kinds, 4 violations, 6 stages — all frozen', () => {
    expect(KNOWN_ROLLOUT_VERDICTS).toHaveLength(6);
    expect(KNOWN_ROLLOUT_FRICTION_KINDS).toHaveLength(8);
    expect(KNOWN_ROLLOUT_VIOLATIONS).toHaveLength(4);
    expect(KNOWN_ADOPTION_STAGES).toHaveLength(6);
    expect(Object.isFrozen(KNOWN_ROLLOUT_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ROLLOUT_FRICTION_KINDS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ROLLOUT_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(KNOWN_ADOPTION_STAGES)).toBe(true);
    expect(Object.isFrozen(ROLLOUT_SURVIVABILITY_SENTINELS)).toBe(true);
  });
});
