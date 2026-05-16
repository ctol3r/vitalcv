/**
 * adoptionFlywheel.test.ts — W2-PR120A unit tests
 *
 * Exercises the six adoption-flywheel hard invariants in isolation:
 *   1. adoption replay-safe (every signal must cite a non-breached bundle)
 *   2. ambiguity preserved during growth
 *   3. network effects measurable
 *   4. fail-closed adoption semantics
 *   5. ecosystem trust longitudinally visible
 *   6. institutional acceleration reconstructable
 */
import {
  buildAdoptionFlywheelReport,
  buildReplayReuseIncentive,
  buildCrossOrgTrustAcceleration,
  buildInstitutionalReferralPathways,
  buildEcosystemGrowthTelemetry,
  reproduceFlywheelLineageDigest,
  runAdoptionFlywheelChaos,
} from '../index';
import {
  makeFlywheelInputs,
  makeBundle,
  makeInstitution,
  makeSignal,
} from '../_testFixtures';

describe('adoptionFlywheelModel — invariants (W2-PR120A)', () => {
  it('produces a replay-safe report with deterministic lineageDigest', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 3, signalsPerReuser: 2 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-base',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    expect(report.overallVerdict).toBe('ADOPTION_OBSERVED');
    expect(report.curves.every(c => c.replaySafe)).toBe(true);
    expect(reproduceFlywheelLineageDigest(report)).toBe(report.lineageDigest);
  });

  it('preserves ambiguity when the slice is empty (no default win)', () => {
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-empty',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { signals: [], institutions: [], auditBundles: [] },
    });
    expect(report.overallVerdict).toBe('ADOPTION_AMBIGUOUS');
    expect(report.ambiguous).toBe(true);
    expect(report.profile.flywheelMaturityPct).toBeNull();
    expect(report.profile.crossOrgReusePct).toBeNull();
  });

  it('fails closed when any source bundle has CONTAINMENT_BREACH', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 1, signalsPerReuser: 2 });
    const breachedBundle = makeBundle({ bundleId: 'bundle-breach', capsuleIds: ['cap-breach-1'], breached: true });
    const breachedSignal = makeSignal({
      signalId: 'sig-breach',
      observedAt: '2026-05-09T00:00:00.000Z',
      issuerInstitutionId: 'issuer-0',
      reuserInstitutionId: 'reuser-0',
      sourceBundleId: breachedBundle.bundleId,
      sourceCapsuleId: 'cap-breach-1',
      signalType: 'REPLAY_REUSE',
    });
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-breach',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: {
        ...inputs,
        signals: [...inputs.signals, breachedSignal],
        auditBundles: [...inputs.auditBundles, breachedBundle],
      },
    });
    expect(report.overallVerdict).toBe('ADOPTION_BREACH');
    expect(report.overallReason).toMatch(/containment breach/i);
  });

  it('surfaces network effects with non-null coefficient when cross-org reuse exists', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 3, signalsPerReuser: 2 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'flywheel-network',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    expect(report.profile.networkCoefficient).not.toBeNull();
    expect(report.profile.networkCoefficient!).toBeGreaterThan(0);
    expect(report.profile.uniqueOrgEdgeCount).toBeGreaterThan(0);
    expect(report.profile.crossOrgReusePct).not.toBeNull();
  });

  it('lineageDigest changes when any signal id changes (tamper-evident)', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 2, signalsPerReuser: 1 });
    const baseReport = buildAdoptionFlywheelReport({
      reportId: 'flywheel-tamper',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const tamperedInputs = {
      ...inputs,
      signals: inputs.signals.map((s, idx) => (idx === 0 ? { ...s, signalId: 'tampered' } : s)),
    };
    const tamperedReport = buildAdoptionFlywheelReport({
      reportId: 'flywheel-tamper',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: tamperedInputs,
    });
    expect(tamperedReport.lineageDigest).not.toBe(baseReport.lineageDigest);
  });

  it('per-institution curve fingerprint is deterministic across rebuilds', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 2, signalsPerReuser: 1 });
    const r1 = buildAdoptionFlywheelReport({
      reportId: 'flywheel-curve-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const r2 = buildAdoptionFlywheelReport({
      reportId: 'flywheel-curve-2',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const m1 = new Map(r1.curves.map(c => [c.institutionId, c.curveFingerprint]));
    const m2 = new Map(r2.curves.map(c => [c.institutionId, c.curveFingerprint]));
    for (const [k, v] of m1) expect(m2.get(k)).toBe(v);
  });
});

describe('replayReuseIncentives (W2-PR120A)', () => {
  it('computes PSV-cycles avoided and friction-units saved from eligible reuses', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 3, signalsPerReuser: 2 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'incentive',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const incentive = buildReplayReuseIncentive(report, inputs.signals);
    expect(incentive.eligibleReuseCount).toBe(6);
    expect(incentive.psvCyclesAvoided).toBe(6);
    expect(incentive.frictionUnitsSaved).toBe(6_000);
    expect(incentive.calendarDaysSaved).toBe(360);
    expect(incentive.reuseAcceleration).toBe(7);
  });

  it('preserves denied reuse separately and yields null acceleration when slice empty', () => {
    const report = buildAdoptionFlywheelReport({
      reportId: 'incentive-empty',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs: { signals: [], institutions: [], auditBundles: [] },
    });
    const incentive = buildReplayReuseIncentive(report, []);
    expect(incentive.eligibleReuseCount).toBe(0);
    expect(incentive.reuseAcceleration).toBeNull();
  });
});

describe('crossOrgTrustAcceleration (W2-PR120A)', () => {
  it('counts cross-org reuses separately from intra-org', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 3, signalsPerReuser: 2 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'cross-org',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const acceleration = buildCrossOrgTrustAcceleration(report, inputs.signals);
    expect(acceleration.crossOrgReuseCount).toBeGreaterThan(0);
    expect(acceleration.intraOrgReuseCount).toBe(0);
    expect(acceleration.accelerationCoefficient).not.toBeNull();
  });
});

describe('institutionalReferralPathways (W2-PR120A)', () => {
  it('enumerates pathways and exposes pathwayDepth when no cycles exist', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 2, signalsPerReuser: 1, referralsPerReuser: 1 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'pathways',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const pathways = buildInstitutionalReferralPathways(report, inputs.signals);
    expect(pathways.referralEdgeCount).toBeGreaterThan(0);
    expect(pathways.pathwayDepth).not.toBeNull();
    expect(pathways.cycleCount).toBe(0);
  });
});

describe('ecosystemGrowthTelemetry (W2-PR120A)', () => {
  it('bins signals by day and produces deterministic snapshotDigest', () => {
    const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 2, signalsPerReuser: 2 });
    const report = buildAdoptionFlywheelReport({
      reportId: 'telemetry',
      generatedAt: '2026-05-09T00:00:00.000Z',
      inputs,
    });
    const t1 = buildEcosystemGrowthTelemetry(report, inputs.signals);
    const t2 = buildEcosystemGrowthTelemetry(report, inputs.signals);
    expect(t1.snapshotDigest).toBe(t2.snapshotDigest);
    expect(t1.bins.length).toBeGreaterThan(0);
    expect(t1.bins.every(b => b.replaySafe)).toBe(true);
  });
});

describe('adoptionFlywheelChaos — every mode meets its expectation (W2-PR120A)', () => {
  const inputs = makeFlywheelInputs({ issuerCount: 1, reuserCount: 3, signalsPerReuser: 2, referralsPerReuser: 1 });
  const modes = [
    'INJECT_CONTAINMENT_BREACH',
    'EMPTY_SIGNALS',
    'AMBIGUITY_FLOOD',
    'CROSS_ORG_STARVATION',
    'REFERRAL_CYCLE_INJECTION',
    'FINGERPRINT_COLLISION',
    'NO_CHAOS',
  ] as const;

  for (const mode of modes) {
    it(`chaos mode ${mode} meets expectation`, () => {
      const result = runAdoptionFlywheelChaos({
        reportId: `chaos-${mode}`,
        generatedAt: '2026-05-09T00:00:00.000Z',
        mode,
        inputs,
      });
      if (!result.expectationMet) {
        // eslint-disable-next-line no-console
        console.log(`chaos ${mode} FAILED — expected: ${result.expectedSummary} observed: ${result.observedSummary}`);
      }
      expect(result.expectationMet).toBe(true);
    });
  }
});
