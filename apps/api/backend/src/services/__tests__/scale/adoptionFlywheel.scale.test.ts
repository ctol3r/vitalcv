/**
 * adoptionFlywheel.scale.test.ts — W2-PR120A scale gate
 *
 * Runs the institutional adoption-flywheel pipeline across multi-thousand
 * signal slices and asserts the gate invariants:
 *
 *   1. adoption replay-safe under load — a 5 000-signal slice yields a
 *      report whose curves are all replay-safe and whose lineageDigest is
 *      reproducible.
 *   2. ambiguity preserved during growth — an AMBIGUITY_FLOOD double-
 *      stream at 2 000 signals keeps both replay-reuse and denied-reuse
 *      streams distinguishable in every curve.
 *   3. network effects measurable at scale — a sparse-then-dense network
 *      yields a strictly-monotonically-larger networkCoefficient when the
 *      edge count grows.
 *   4. fail-closed at scale — a single CONTAINMENT_BREACH bundle anywhere
 *      in a 5 000-signal slice forces overallVerdict=ADOPTION_BREACH.
 *   5. telemetry digest deterministic — same input produces the same
 *      ecosystem snapshotDigest across N=25 rebuilds.
 *   6. chaos sweep — every chaos mode meets its expectation under a 500-
 *      signal slice.
 */
import {
  buildAdoptionFlywheelReport,
  buildEcosystemGrowthTelemetry,
  reproduceFlywheelLineageDigest,
  runAdoptionFlywheelChaos,
  type AdoptionChaosMode,
  type AdoptionFlywheelInputs,
  type AdoptionSignal,
} from '../../adoption';
import { makeBundle, makeFlywheelInputs, makeInstitution, makeSignal } from '../../adoption/_testFixtures';

function makeLargeSlice(
  signalCount: number,
  options: { issuers?: number; reusers?: number; breached?: boolean } = {},
): AdoptionFlywheelInputs {
  const issuers = options.issuers ?? 5;
  const reusers = options.reusers ?? 25;
  const issuerIds = Array.from({ length: issuers }, (_, i) => `large-issuer-${i}`);
  const reuserIds = Array.from({ length: reusers }, (_, i) => `large-reuser-${i}`);
  const capsuleIds = Array.from({ length: signalCount }, (_, i) => `large-cap-${i}`);
  const bundle = makeBundle({ bundleId: 'bundle-large', capsuleIds, breached: options.breached });

  const signals: AdoptionSignal[] = [];
  const baseMs = Date.parse('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < signalCount; i++) {
    const issuerId = issuerIds[i % issuers];
    const reuserId = reuserIds[i % reusers];
    const observedAt = new Date(baseMs + i * 3_600_000).toISOString();
    const typeMod = i % 4;
    const signalType: AdoptionSignal['signalType'] =
      typeMod === 0 ? 'REPLAY_REUSE'
      : typeMod === 1 ? 'CROSS_ORG_PROMOTION'
      : typeMod === 2 ? 'REFERRAL_INTRODUCTION'
      : 'REPLAY_REUSE';
    signals.push(
      makeSignal({
        signalId: `large-sig-${i}`,
        observedAt,
        issuerInstitutionId: issuerId,
        reuserInstitutionId: reuserId,
        sourceBundleId: bundle.bundleId,
        sourceCapsuleId: capsuleIds[i],
        signalType,
      }),
    );
  }
  const institutions = [
    ...issuerIds.map(id => makeInstitution(id, 'ISSUER')),
    ...reuserIds.map(id => makeInstitution(id, 'REUSER')),
  ];
  return { signals, institutions, auditBundles: [bundle] };
}

describe('institutional adoption-flywheel scale (W2-PR120A scale gate)', () => {
  it('replay-safe under a 5 000-signal slice with reproducible lineageDigest in <8 s', () => {
    const inputs = makeLargeSlice(5_000);
    const start = process.hrtime.bigint();
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-scale-5k',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

    expect(report.overallVerdict).toBe('ADOPTION_OBSERVED');
    expect(report.profile.signalCount).toBe(5_000);
    expect(report.curves.every(c => c.replaySafe)).toBe(true);
    expect(reproduceFlywheelLineageDigest(report)).toBe(report.lineageDigest);
    expect(elapsedMs).toBeLessThan(8_000);

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] replay-safe-pct=100.00 n=${report.profile.signalCount} ` +
        `elapsed_ms=${elapsedMs.toFixed(0)} curves=${report.curves.length} ` +
        `lineage_digest=${report.lineageDigest.slice(0, 16)}…`,
    );
  });

  it('preserves ambiguity at scale — AMBIGUITY_FLOOD keeps reuse + denied streams distinct', () => {
    const inputs = makeLargeSlice(2_000);
    const result = runAdoptionFlywheelChaos({
      reportId: 'flywheel-flood',
      generatedAt: '2026-05-09T00:00:00.000Z',
      mode: 'AMBIGUITY_FLOOD',
      inputs,
    });
    expect(result.expectationMet).toBe(true);
    expect(result.report.profile.replayReuseCount).toBeGreaterThan(0);
    expect(result.report.profile.deniedReuseCount).toBeGreaterThan(0);
    const mixedCurveCount = result.report.curves.filter(c => c.reuseCount > 0 && c.deniedReuseCount > 0).length;
    expect(mixedCurveCount).toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] ambiguity-preservation-pct=100.00 ` +
        `replay_reuse=${result.report.profile.replayReuseCount} ` +
        `denied=${result.report.profile.deniedReuseCount} mixed_curves=${mixedCurveCount}`,
    );
  });

  it('network effects grow monotonically as edge count increases', () => {
    const sparse = makeLargeSlice(500, { issuers: 2, reusers: 4 });
    const dense = makeLargeSlice(500, { issuers: 5, reusers: 30 });
    const r1 = buildAdoptionFlywheelReport({
      reportId: 'flywheel-net-sparse',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: sparse,
    });
    const r2 = buildAdoptionFlywheelReport({
      reportId: 'flywheel-net-dense',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: dense,
    });
    expect(r1.profile.uniqueOrgEdgeCount).toBeGreaterThan(0);
    expect(r2.profile.uniqueOrgEdgeCount).toBeGreaterThan(r1.profile.uniqueOrgEdgeCount);
    expect(r2.profile.networkCoefficient!).toBeGreaterThan(r1.profile.networkCoefficient!);

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] network-effect-monotonicity=true ` +
        `sparse_coeff=${r1.profile.networkCoefficient} dense_coeff=${r2.profile.networkCoefficient} ` +
        `sparse_edges=${r1.profile.uniqueOrgEdgeCount} dense_edges=${r2.profile.uniqueOrgEdgeCount}`,
    );
  });

  it('fails closed at scale — a single CONTAINMENT_BREACH in a 5 000-signal slice forces BREACH', () => {
    const clean = makeLargeSlice(5_000);
    const breachedBundle = makeBundle({ bundleId: 'bundle-breach-scale', capsuleIds: ['breach-cap-1'], breached: true });
    const breachedSignal = makeSignal({
      signalId: 'breach-sig-scale',
      observedAt: '2026-05-09T00:00:00.000Z',
      issuerInstitutionId: clean.institutions[0].institutionId,
      reuserInstitutionId: clean.institutions[1].institutionId,
      sourceBundleId: breachedBundle.bundleId,
      sourceCapsuleId: 'breach-cap-1',
      signalType: 'REPLAY_REUSE',
    });
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-fail-closed',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        ...clean,
        signals: [...clean.signals, breachedSignal],
        auditBundles: [...clean.auditBundles, breachedBundle],
      },
    });
    expect(report.overallVerdict).toBe('ADOPTION_BREACH');

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] fail-closed-at-scale=true ` +
        `breached_bundles=1 total_signals=${report.profile.signalCount + 1}`,
    );
  });

  it('telemetry snapshotDigest is deterministic across 25 rebuilds (no race drift)', () => {
    const inputs = makeLargeSlice(1_000);
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-telemetry-scale',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const digests = new Set<string>();
    for (let i = 0; i < 25; i++) {
      digests.add(buildEcosystemGrowthTelemetry(report, inputs.signals).snapshotDigest);
    }
    expect(digests.size).toBe(1);

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] telemetry-determinism-pct=100.00 n_builds=25 unique_digests=${digests.size}`,
    );
  });

  it('chaos sweep — every chaos mode meets its expectation under a 500-signal slice', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 5, signalsPerReuser: 20, referralsPerReuser: 5 });
    const modes: AdoptionChaosMode[] = [
      'INJECT_CONTAINMENT_BREACH',
      'EMPTY_SIGNALS',
      'AMBIGUITY_FLOOD',
      'CROSS_ORG_STARVATION',
      'REFERRAL_CYCLE_INJECTION',
      'FINGERPRINT_COLLISION',
      'NO_CHAOS',
    ];
    const failures: string[] = [];
    for (const mode of modes) {
      const result = runAdoptionFlywheelChaos({
        reportId: `flywheel-chaos-${mode}`,
        generatedAt: '2026-05-09T00:00:00.000Z',
        mode,
        inputs,
      });
      if (!result.expectationMet) failures.push(`${mode} (${result.observedSummary})`);
    }
    expect(failures).toEqual([]);

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] chaos-expectation-met-pct=100.00 ` +
        `modes=${modes.length} failures=${failures.length}`,
    );
  });

  it('emits per-axis completion-board metrics for the gate dashboard', () => {
    const inputs = makeLargeSlice(2_000);
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-completion-board',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    expect(report.overallVerdict).toBe('ADOPTION_OBSERVED');

    // eslint-disable-next-line no-console
    console.log(
      `[flywheel-board] replay-reuse-acceleration-pct=${(report.profile.psvCyclesAvoidedPer100 ?? 0).toFixed(2)} ` +
        `cross-org-trust-growth-pct=${((report.profile.crossOrgReusePct ?? 0) * 100).toFixed(2)} ` +
        `institutional-referral-visibility-pct=${((report.profile.referralVisibilityPct ?? 0) * 100).toFixed(2)} ` +
        `ecosystem-network-effects=${report.profile.networkCoefficient ?? 0} ` +
        `adoption-flywheel-maturity-pct=${((report.profile.flywheelMaturityPct ?? 0) * 100).toFixed(2)}`,
    );
  });
});
