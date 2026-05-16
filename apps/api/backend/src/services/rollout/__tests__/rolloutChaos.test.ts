/**
 * rolloutChaos.test.ts — W2-PR84A: Rollout Chaos Simulations
 *
 * Mock-free chaos exercises for the institutional rollout boundary. Each
 * scenario stress-tests a single failure mode and asserts the survivability
 * boundary fails closed when expected and stays partitioned when chaos is
 * within configured tolerance.
 *
 * Modes (six, mirroring the deploy-layer chaos.mjs five-mode layout):
 *
 *   C-ROLL-1  Mass operator resistance      — 50 % of facilities refuse install
 *   C-ROLL-2  Cascading parent-org collapse  — root resistant + lineage contaminates children
 *   C-ROLL-3  Policy bundle drift cohort     — entire cohort drifts from canonical
 *   C-ROLL-4  Telemetry blackout             — all facilities deployed, none emit
 *   C-ROLL-5  Rollback contagion             — manifest-level rollback hits cohort
 *   C-ROLL-6  Mixed friction storm           — every kind in one cohort
 *
 * The board metrics are emitted as `[rollout-board]` lines so the CI gate
 * surface step can grep them out — same pattern as scale-gate.yml's
 * `[scale-board]` markers.
 */

import {
  RolloutSurvivabilityError,
  assertRolloutBoundary,
  computeRolloutBoundary,
  quarantineRollout,
  traceFrictionLineage,
  type RolloutSignal,
} from '../rolloutSurvivability';

const POLICY_CANONICAL = 'a'.repeat(64);
const POLICY_DRIFTED = 'b'.repeat(64);

function adoptedSignal(overrides: Partial<RolloutSignal> = {}): RolloutSignal {
  return {
    deploymentApplied: true,
    telemetryObserved: true,
    localPolicyDigest: POLICY_CANONICAL,
    expectedPolicyDigest: POLICY_CANONICAL,
    resistanceEvidence: null,
    subunitsAdopted: 4,
    subunitsTotal: 4,
    rollbackIssued: false,
    ...overrides,
  };
}

describe('rollout chaos simulations (W2-PR84A)', () => {
  // ── C-ROLL-1 ──────────────────────────────────────────────────────────────
  it('C-ROLL-1: 50% mass operator resistance — boundary trips at 80% floor, holds at 50% floor', () => {
    const N = 200;
    const records = [];
    for (let i = 0; i < N; i++) {
      const isResistant = i % 2 === 0;
      records.push(
        quarantineRollout({
          institutionId: `inst-${i}`,
          signal: isResistant
            ? adoptedSignal({
                deploymentApplied: false,
                telemetryObserved: false,
                resistanceEvidence: 'IT director refused install pending board review.',
                subunitsAdopted: 0,
              })
            : adoptedSignal(),
          previouslyAdopted: false,
        }),
      );
    }
    const b80 = computeRolloutBoundary({
      totalInstitutions: N,
      records,
      minPartialAdoptionResiliencePct: 80,
    });
    const b50 = computeRolloutBoundary({
      totalInstitutions: N,
      records,
      minPartialAdoptionResiliencePct: 50,
    });

    expect(b80.partitioned).toBe(false);
    expect(() => assertRolloutBoundary(b80, { minPartialAdoptionResiliencePct: 80 }))
      .toThrow(RolloutSurvivabilityError);
    expect(b50.partitioned).toBe(true);

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-1 mass-resistance ` +
        `surviving=${b50.survivingCount}/${N} ` +
        `resistant=${b50.resistantCount}/${N} ` +
        `resilience-pct=${b50.partialAdoptionResiliencePct.toFixed(2)} ` +
        `resistance-pct=${b50.institutionalResistancePct.toFixed(2)}`,
    );
  });

  // ── C-ROLL-2 ──────────────────────────────────────────────────────────────
  it('C-ROLL-2: cascading parent-org collapse — lineage contaminates 100% of children', () => {
    const ROOT = 'root-1';
    const CHILD_COUNT = 50;
    const PARENT_ORG = 'parent-coop-A';

    // Root institution refuses adoption.
    const rootRecord = quarantineRollout({
      institutionId: ROOT,
      signal: adoptedSignal({
        deploymentApplied: false,
        telemetryObserved: false,
        resistanceEvidence: 'Parent co-op resolution: pause rollout.',
        subunitsAdopted: 0,
      }),
      lineageHints: { parentOrgId: PARENT_ORG, policyBundleId: null, deploymentManifestId: null },
    });

    // Children all share parent. Walk the lineage to mark them contaminated.
    const candidates = Array.from({ length: CHILD_COUNT }, (_, i) => ({
      institutionId: `child-${i}`,
      hints: { parentOrgId: PARENT_ORG, policyBundleId: null, deploymentManifestId: null },
    }));
    const lineage = traceFrictionLineage({
      rootInstitutionId: ROOT,
      rootHints: { parentOrgId: PARENT_ORG, policyBundleId: null, deploymentManifestId: null },
      candidates,
    });
    expect(lineage.contaminatedInstitutionIds).toHaveLength(CHILD_COUNT);

    const childRecords = candidates.map(c =>
      quarantineRollout({
        institutionId: c.institutionId,
        signal: adoptedSignal(),
        lineageHints: c.hints,
        forcedKind: 'INSTITUTIONAL_NONCOOPERATION',
        forcedReason: `${c.institutionId} contaminated via lineage from ${ROOT}.`,
      }),
    );
    const allRecords = [rootRecord, ...childRecords];
    const b = computeRolloutBoundary({
      totalInstitutions: allRecords.length,
      records: allRecords,
      minPartialAdoptionResiliencePct: 50,
    });

    expect(b.contaminatedCount).toBe(CHILD_COUNT);
    expect(b.resistantCount).toBe(1);
    expect(b.survivingCount).toBe(0);
    expect(b.partitioned).toBe(false);

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-2 cascading-parent-collapse ` +
        `root-resistant=1 children-contaminated=${b.contaminatedCount}/${CHILD_COUNT} ` +
        `lineage-edges=${lineage.edges.length} ` +
        `digest=${lineage.reconstructionDigest.slice(0, 12)}`,
    );
  });

  // ── C-ROLL-3 ──────────────────────────────────────────────────────────────
  it('C-ROLL-3: policy bundle drift across cohort — boundary records POLICY_INCONSISTENCY uniformly', () => {
    const N = 100;
    const records = Array.from({ length: N }, (_, i) =>
      quarantineRollout({
        institutionId: `drift-${i}`,
        signal: adoptedSignal({
          localPolicyDigest: POLICY_DRIFTED,
          expectedPolicyDigest: POLICY_CANONICAL,
        }),
      }),
    );
    const b = computeRolloutBoundary({ totalInstitutions: N, records });
    expect(b.partialSurvivingCount).toBe(N);
    expect(b.survivingCount).toBe(0);
    expect(b.partitioned).toBe(true); // partial counts toward resilience floor (default 60)
    expect(b.partialAdoptionResiliencePct).toBeCloseTo(100, 5);
    expect(b.deploymentFrictionVisibilityPct).toBeCloseTo(100, 5);
    for (const r of records) expect(r.kind).toBe('POLICY_INCONSISTENCY');

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-3 policy-drift-cohort ` +
        `partial-surviving=${b.partialSurvivingCount}/${N} ` +
        `friction-visibility-pct=${b.deploymentFrictionVisibilityPct.toFixed(2)}`,
    );
  });

  // ── C-ROLL-4 ──────────────────────────────────────────────────────────────
  it('C-ROLL-4: telemetry blackout — every record AMBIGUOUS_ADOPTION, ambiguity preserved', () => {
    const N = 100;
    const records = Array.from({ length: N }, (_, i) =>
      quarantineRollout({
        institutionId: `silent-${i}`,
        signal: adoptedSignal({ telemetryObserved: false }),
      }),
    );
    const b = computeRolloutBoundary({ totalInstitutions: N, records });
    expect(b.ambiguousCount).toBe(N);
    expect(b.survivingCount).toBe(0);
    expect(b.partitioned).toBe(true); // ambiguous counts toward resilience
    for (const r of records) {
      expect(r.verdict).toBe('AMBIGUOUS_ADOPTION');
      expect(r.kind).toBe('TELEMETRY_GAP');
      expect(r.ambiguous).toBe(true);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-4 telemetry-blackout ` +
        `ambiguous=${b.ambiguousCount}/${N} ` +
        `ambiguity-preserved=true`,
    );
  });

  // ── C-ROLL-5 ──────────────────────────────────────────────────────────────
  it('C-ROLL-5: rollback contagion — manifest-level rollback marks every cohort member RESISTANT/ROLLBACK', () => {
    const N = 75;
    const records = Array.from({ length: N }, (_, i) =>
      quarantineRollout({
        institutionId: `rb-${i}`,
        signal: adoptedSignal({ rollbackIssued: true }),
        previouslyAdopted: true,
      }),
    );
    const b = computeRolloutBoundary({
      totalInstitutions: N,
      records,
      minPartialAdoptionResiliencePct: 60,
    });
    expect(b.resistantCount).toBe(N);
    expect(b.partitioned).toBe(false);
    expect(() => assertRolloutBoundary(b, { minPartialAdoptionResiliencePct: 60 }))
      .toThrow(RolloutSurvivabilityError);
    for (const r of records) {
      expect(r.kind).toBe('ROLLBACK');
      expect(r.stage).toBe('PILOT_REGRESSION');
    }

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-5 rollback-contagion ` +
        `resistant=${b.resistantCount}/${N} ` +
        `resistance-pct=${b.institutionalResistancePct.toFixed(2)}`,
    );
  });

  // ── C-ROLL-6 ──────────────────────────────────────────────────────────────
  it('C-ROLL-6: mixed friction storm — every kind appears in one cohort, board surfaces all', () => {
    const records = [
      // 4 surviving
      ...['s1', 's2', 's3', 's4'].map(id =>
        quarantineRollout({ institutionId: id, signal: adoptedSignal() }),
      ),
      // 2 partial deployments
      ...['p1', 'p2'].map(id =>
        quarantineRollout({
          institutionId: id,
          signal: adoptedSignal({ subunitsAdopted: 2, subunitsTotal: 4 }),
        }),
      ),
      // 2 policy drift
      ...['d1', 'd2'].map(id =>
        quarantineRollout({
          institutionId: id,
          signal: adoptedSignal({
            localPolicyDigest: POLICY_DRIFTED,
            expectedPolicyDigest: POLICY_CANONICAL,
          }),
        }),
      ),
      // 2 telemetry blackouts
      ...['t1', 't2'].map(id =>
        quarantineRollout({
          institutionId: id,
          signal: adoptedSignal({ telemetryObserved: false }),
        }),
      ),
      // 2 contradictory ambiguous
      ...['a1', 'a2'].map(id =>
        quarantineRollout({
          institutionId: id,
          signal: adoptedSignal({
            deploymentApplied: false,
            telemetryObserved: true,
            subunitsAdopted: 0,
          }),
        }),
      ),
      // 2 operator resistance
      ...['r1', 'r2'].map(id =>
        quarantineRollout({
          institutionId: id,
          signal: adoptedSignal({
            deploymentApplied: false,
            telemetryObserved: false,
            resistanceEvidence: 'Refused install.',
            subunitsAdopted: 0,
          }),
        }),
      ),
      // 1 rollback
      quarantineRollout({
        institutionId: 'rb1',
        signal: adoptedSignal({ rollbackIssued: true }),
        previouslyAdopted: true,
      }),
      // 1 contaminated via lineage
      quarantineRollout({
        institutionId: 'c1',
        signal: adoptedSignal(),
        forcedKind: 'INSTITUTIONAL_NONCOOPERATION',
        forcedReason: 'c1 contaminated via lineage from r1.',
      }),
    ];
    const total = records.length;
    const b = computeRolloutBoundary({
      totalInstitutions: total,
      records,
      minPartialAdoptionResiliencePct: 50,
    });

    expect(b.survivingCount).toBe(4);
    expect(b.partialSurvivingCount).toBe(4); // 2 partial + 2 policy drift
    expect(b.ambiguousCount).toBe(4);        // 2 telemetry + 2 contradictory
    expect(b.resistantCount).toBe(3);        // 2 op-resistance + 1 rollback
    expect(b.contaminatedCount).toBe(1);
    expect(b.totalInstitutions).toBe(total);
    expect(b.partitioned).toBe(true); // (4+4+4)/16 = 75% ≥ 50%

    // eslint-disable-next-line no-console
    console.log(
      `[rollout-board] C-ROLL-6 mixed-friction-storm ` +
        `surviving=${b.survivingCount} partial=${b.partialSurvivingCount} ` +
        `ambiguous=${b.ambiguousCount} resistant=${b.resistantCount} contaminated=${b.contaminatedCount} ` +
        `resilience-pct=${b.partialAdoptionResiliencePct.toFixed(2)} ` +
        `friction-visibility-pct=${b.deploymentFrictionVisibilityPct.toFixed(2)} ` +
        `boundary-digest=${b.boundaryDigest.slice(0, 12)}`,
    );
  });
});
