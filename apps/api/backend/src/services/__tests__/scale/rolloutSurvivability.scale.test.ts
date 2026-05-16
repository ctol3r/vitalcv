/**
 * W2-PR84A — Institutional Rollout Survivability (scale gate)
 *
 * Drives the rollout survivability surface under sustained institutional
 * deployment bursts and asserts that the rollout boundary survives
 * saturation without silent collapse.
 *
 * Invariants the gate exists to protect:
 *
 *   1. burst survivability — 5 000 institutions classified back-to-back
 *      complete within the CI budget AND every record carries a distinct
 *      rolloutDigest (no record lost to hash collision).
 *   2. mixed-friction survivability — a 1 000-institution cohort with a
 *      realistic 3:1:1:1:1 split (surviving:partial:ambiguous:resistant:contaminated)
 *      preserves verdict counts exactly. No silent reclassification.
 *   3. lineage scale survivability — a parent-org with 1 000 children +
 *      4 000 unrelated institutions reconstructs a lineage of exactly
 *      1 000 contaminated edges within the CI budget. No false positives.
 *   4. partial-adoption resilience floor — at the configured 60% floor, a
 *      cohort with 65% surviving + partial + ambiguous remains partitioned;
 *      a cohort with 55% trips the boundary.
 *   5. ambiguity preservation under load — every TELEMETRY_GAP signal
 *      across the burst stays AMBIGUOUS_ADOPTION (zero coercion to SURVIVING).
 *
 * Pure mock-free test — exercises the real rollout survivability module.
 *
 * Lives under `__tests__/scale/` so the existing W2-PR38A scale-gate.yml
 * workflow picks it up via its `__tests__/scale/.+\.scale\.test\.ts$` filter
 * — no workflow change required.
 */

import {
  RolloutSurvivabilityError,
  assertRolloutBoundary,
  computeRolloutBoundary,
  quarantineRollout,
  traceFrictionLineage,
  type RolloutSignal,
} from '../../rollout/rolloutSurvivability';

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

describe('institutional rollout survivability scale (W2-PR84A scale gate)', () => {
  it('survives a 5 000-institution rollout burst without rolloutDigest collapse', () => {
    const N = 5_000;
    const digests = new Set<string>();
    const start = process.hrtime.bigint();

    for (let i = 0; i < N; i++) {
      // Every institution gets a unique signal (rotating modes) so digests
      // SHOULD be distinct — the gate exists to catch silent collapse.
      const mode = i % 5;
      let signal: RolloutSignal;
      switch (mode) {
        case 0: signal = adoptedSignal(); break;
        case 1: signal = adoptedSignal({ subunitsAdopted: 2, subunitsTotal: 4 }); break;
        case 2: signal = adoptedSignal({ telemetryObserved: false }); break;
        case 3: signal = adoptedSignal({
          localPolicyDigest: POLICY_DRIFTED,
          expectedPolicyDigest: POLICY_CANONICAL,
        }); break;
        default: signal = adoptedSignal({
          deploymentApplied: false,
          telemetryObserved: false,
          resistanceEvidence: `Refused install — facility ${i}.`,
          subunitsAdopted: 0,
        }); break;
      }
      const r = quarantineRollout({
        institutionId: `inst-${i}`,
        signal,
      });
      digests.add(r.rolloutDigest);
    }

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const eventsPerSec = (N / elapsedMs) * 1000;
    const survivabilityPct = (digests.size / N) * 100;

    // Every distinct institutionId/signal yields a distinct rolloutDigest.
    expect(digests.size).toBe(N);
    // Generous CI budget; the gate exists to catch silent collapse, not flake.
    expect(elapsedMs).toBeLessThan(8_000);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] rollout-survivability-pct=${survivabilityPct.toFixed(2)} ` +
        `n=${N} institutions_per_sec=${eventsPerSec.toFixed(0)} elapsed_ms=${elapsedMs.toFixed(0)}`,
    );
  });

  it('preserves verdict counts under a realistic 1 000-institution mixed-friction cohort', () => {
    // Realistic 3:1:1:1:1 mix → surviving:partial:ambiguous:resistant:contaminated
    const N = 1_000;
    const survivingTarget    = Math.round(N * 0.43);
    const partialTarget      = Math.round(N * 0.14);
    const ambiguousTarget    = Math.round(N * 0.14);
    const resistantTarget    = Math.round(N * 0.14);
    const contaminatedTarget = N - (survivingTarget + partialTarget + ambiguousTarget + resistantTarget);

    const records = [];
    let idx = 0;
    for (let i = 0; i < survivingTarget; i++, idx++) {
      records.push(quarantineRollout({ institutionId: `inst-${idx}`, signal: adoptedSignal() }));
    }
    for (let i = 0; i < partialTarget; i++, idx++) {
      records.push(quarantineRollout({
        institutionId: `inst-${idx}`,
        signal: adoptedSignal({ subunitsAdopted: 2, subunitsTotal: 4 }),
      }));
    }
    for (let i = 0; i < ambiguousTarget; i++, idx++) {
      records.push(quarantineRollout({
        institutionId: `inst-${idx}`,
        signal: adoptedSignal({ telemetryObserved: false }),
      }));
    }
    for (let i = 0; i < resistantTarget; i++, idx++) {
      records.push(quarantineRollout({
        institutionId: `inst-${idx}`,
        signal: adoptedSignal({
          deploymentApplied: false,
          telemetryObserved: false,
          resistanceEvidence: `Refused — ${idx}.`,
          subunitsAdopted: 0,
        }),
      }));
    }
    for (let i = 0; i < contaminatedTarget; i++, idx++) {
      records.push(quarantineRollout({
        institutionId: `inst-${idx}`,
        signal: adoptedSignal(),
        forcedKind: 'INSTITUTIONAL_NONCOOPERATION',
        forcedReason: `inst-${idx} contaminated via lineage from a resistant peer.`,
      }));
    }

    const b = computeRolloutBoundary({
      totalInstitutions: N,
      records,
      minPartialAdoptionResiliencePct: 60,
    });

    expect(b.survivingCount).toBe(survivingTarget);
    expect(b.partialSurvivingCount).toBe(partialTarget);
    expect(b.ambiguousCount).toBe(ambiguousTarget);
    expect(b.resistantCount).toBe(resistantTarget);
    expect(b.contaminatedCount).toBe(contaminatedTarget);

    // (43+14+14)/100 = 71% ≥ 60% floor.
    expect(b.partitioned).toBe(true);
    expect(b.partialAdoptionResiliencePct).toBeGreaterThanOrEqual(60);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] rollout-mix-survivability ` +
        `surviving=${b.survivingCount} partial=${b.partialSurvivingCount} ` +
        `ambiguous=${b.ambiguousCount} resistant=${b.resistantCount} contaminated=${b.contaminatedCount} ` +
        `resilience-pct=${b.partialAdoptionResiliencePct.toFixed(2)} ` +
        `resistance-pct=${b.institutionalResistancePct.toFixed(2)} ` +
        `friction-visibility-pct=${b.deploymentFrictionVisibilityPct.toFixed(2)}`,
    );
  });

  it('reconstructs a lineage of exactly 1 000 contaminated children among 5 000 candidates', () => {
    const ROOT = 'root-x';
    const PARENT_ORG = 'parent-mega-A';
    const CHILDREN = 1_000;
    const NOISE = 4_000;

    const candidates = [
      ...Array.from({ length: CHILDREN }, (_, i) => ({
        institutionId: `child-${i}`,
        hints: { parentOrgId: PARENT_ORG, policyBundleId: null, deploymentManifestId: null },
      })),
      ...Array.from({ length: NOISE }, (_, i) => ({
        institutionId: `noise-${i}`,
        hints: { parentOrgId: `parent-noise-${i % 50}`, policyBundleId: null, deploymentManifestId: null },
      })),
    ];

    const start = process.hrtime.bigint();
    const lineage = traceFrictionLineage({
      rootInstitutionId: ROOT,
      rootHints: { parentOrgId: PARENT_ORG, policyBundleId: null, deploymentManifestId: null },
      candidates,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(lineage.contaminatedInstitutionIds).toHaveLength(CHILDREN);
    expect(lineage.edges).toHaveLength(CHILDREN);
    expect(lineage.contaminatedInstitutionIds).not.toContain(ROOT);
    expect(elapsedMs).toBeLessThan(2_000);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] rollout-lineage-scale ` +
        `contaminated=${lineage.contaminatedInstitutionIds.length}/${CHILDREN} ` +
        `noise-rejected=${NOISE} ` +
        `elapsed_ms=${elapsedMs.toFixed(0)} ` +
        `digest=${lineage.reconstructionDigest.slice(0, 12)}`,
    );
  });

  it('resilience floor: 65% survives at floor=60, 55% trips it (fail-closed under load)', () => {
    const N = 1_000;

    // 65% surviving cohort → resilience = 65%, > 60% floor → partitioned.
    const cohortHigh = [];
    for (let i = 0; i < N; i++) {
      const isResistant = i >= Math.floor(N * 0.65);
      cohortHigh.push(quarantineRollout({
        institutionId: `hi-${i}`,
        signal: isResistant
          ? adoptedSignal({
              deploymentApplied: false,
              telemetryObserved: false,
              resistanceEvidence: 'refused',
              subunitsAdopted: 0,
            })
          : adoptedSignal(),
      }));
    }
    const bHigh = computeRolloutBoundary({
      totalInstitutions: N,
      records: cohortHigh,
      minPartialAdoptionResiliencePct: 60,
    });
    expect(bHigh.partitioned).toBe(true);
    expect(() => assertRolloutBoundary(bHigh, { minPartialAdoptionResiliencePct: 60 })).not.toThrow();

    // 55% surviving cohort → resilience = 55%, < 60% floor → boundary breach.
    const cohortLow = [];
    for (let i = 0; i < N; i++) {
      const isResistant = i >= Math.floor(N * 0.55);
      cohortLow.push(quarantineRollout({
        institutionId: `lo-${i}`,
        signal: isResistant
          ? adoptedSignal({
              deploymentApplied: false,
              telemetryObserved: false,
              resistanceEvidence: 'refused',
              subunitsAdopted: 0,
            })
          : adoptedSignal(),
      }));
    }
    const bLow = computeRolloutBoundary({
      totalInstitutions: N,
      records: cohortLow,
      minPartialAdoptionResiliencePct: 60,
    });
    expect(bLow.partitioned).toBe(false);
    let caught: unknown = null;
    try { assertRolloutBoundary(bLow, { minPartialAdoptionResiliencePct: 60 }); }
    catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(RolloutSurvivabilityError);
    expect((caught as RolloutSurvivabilityError).violation).toBe('PARTIAL_ROLLOUT_FLOOR_BREACHED');

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] rollout-resilience-floor ` +
        `high-cohort-resilience-pct=${bHigh.partialAdoptionResiliencePct.toFixed(2)} ` +
        `low-cohort-resilience-pct=${bLow.partialAdoptionResiliencePct.toFixed(2)} ` +
        `floor=60 high-partitioned=true low-trips=true`,
    );
  });

  it('preserves AMBIGUOUS_ADOPTION across a 2 000-institution telemetry-gap burst (no silent SURVIVING coercion)', () => {
    const N = 2_000;
    let ambiguityIntact = 0;

    for (let i = 0; i < N; i++) {
      const r = quarantineRollout({
        institutionId: `amb-${i}`,
        signal: adoptedSignal({ telemetryObserved: false }),
      });
      if (
        r.verdict === 'AMBIGUOUS_ADOPTION' &&
        r.kind === 'TELEMETRY_GAP' &&
        r.ambiguous === true
      ) {
        ambiguityIntact++;
      }
    }

    expect(ambiguityIntact).toBe(N);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] rollout-ambiguity-intact-pct=100.00 ` +
        `intact=${ambiguityIntact}/${N}`,
    );
  });
});
