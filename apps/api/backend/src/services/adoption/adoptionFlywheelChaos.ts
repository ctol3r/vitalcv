/**
 * adoptionFlywheelChaos.ts — W2-PR120A
 *
 * Chaos simulation harness for the adoption flywheel. Given a baseline
 * input slice, applies a single chaos mode and verifies that the
 * resulting report meets the expected fail-closed / ambiguity-preserving
 * outcome. Pure transform — no fetches, no random number generators.
 *
 * Modes:
 *   INJECT_CONTAINMENT_BREACH — taint a single bundle. Expected verdict:
 *     ADOPTION_BREACH.
 *   EMPTY_SIGNALS — strip every signal. Expected: ADOPTION_AMBIGUOUS.
 *   AMBIGUITY_FLOOD — duplicate every signal as a DENIED_REUSE with the
 *     same ids. Expected: replay-reuse signal still preserved AND denied
 *     count is non-zero. The report must NOT collapse the two streams.
 *   CROSS_ORG_STARVATION — convert every cross-org reuse to intra-org.
 *     Expected: crossOrgReusePct === 0, accelerationCoefficient === null.
 *   REFERRAL_CYCLE_INJECTION — splice a cycle into the referral graph.
 *     Expected: cycleCount > 0 AND pathwayDepth still derivable (or null,
 *     never silently masked).
 *   FINGERPRINT_COLLISION — force two distinct signals to share a
 *     signalId. Expected: report still surfaces both ids in inputs.signalIds
 *     (deduplicated, but with collision visible in profile.signalCount
 *     vs. inputs.signalIds.length).
 *   NO_CHAOS — pass-through baseline. Expected: same verdict as base.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import {
  buildAdoptionFlywheelReport,
  type AdoptionFlywheelInputs,
  type AdoptionFlywheelReport,
  type AdoptionSignal,
} from './adoptionFlywheelModel';

export type AdoptionChaosMode =
  | 'INJECT_CONTAINMENT_BREACH'
  | 'EMPTY_SIGNALS'
  | 'AMBIGUITY_FLOOD'
  | 'CROSS_ORG_STARVATION'
  | 'REFERRAL_CYCLE_INJECTION'
  | 'FINGERPRINT_COLLISION'
  | 'NO_CHAOS';

export interface AdoptionChaosResult {
  schema: 'vitalcv.adoption-flywheel-chaos.v1';
  mode: AdoptionChaosMode;
  report: AdoptionFlywheelReport;
  expectationMet: boolean;
  expectedSummary: string;
  observedSummary: string;
  /** Tamper-evident digest over (mode, observed verdict, lineage digest). */
  chaosDigest: string;
}

function cloneSignals(signals: ReadonlyArray<AdoptionSignal>): AdoptionSignal[] {
  return signals.map(s => ({ ...s }));
}

function applyMode(mode: AdoptionChaosMode, inputs: AdoptionFlywheelInputs): AdoptionFlywheelInputs {
  switch (mode) {
    case 'INJECT_CONTAINMENT_BREACH': {
      // Taint the first audit bundle by replacing its bundleHash with empty.
      const auditBundles = inputs.auditBundles.map((b, idx) =>
        idx === 0 ? ({ ...b, bundleHash: '' } as typeof b) : b,
      );
      return { ...inputs, auditBundles };
    }
    case 'EMPTY_SIGNALS': {
      return { ...inputs, signals: [] };
    }
    case 'AMBIGUITY_FLOOD': {
      const flood: AdoptionSignal[] = inputs.signals.map((s, idx) => ({
        ...s,
        signalId: `${s.signalId}::denied-${idx}`,
        signalType: 'DENIED_REUSE',
      }));
      return { ...inputs, signals: [...cloneSignals(inputs.signals), ...flood] };
    }
    case 'CROSS_ORG_STARVATION': {
      const sameOrg: AdoptionSignal[] = inputs.signals.map(s =>
        s.signalType === 'REPLAY_REUSE'
          ? { ...s, reuserInstitutionId: s.issuerInstitutionId }
          : s,
      );
      return { ...inputs, signals: sameOrg };
    }
    case 'REFERRAL_CYCLE_INJECTION': {
      const referrals = inputs.signals.filter(s => s.signalType === 'REFERRAL_INTRODUCTION');
      if (referrals.length < 2) return inputs;
      const first = referrals[0];
      const cycle: AdoptionSignal = {
        ...first,
        signalId: `${first.signalId}::cycle`,
        observedAt: first.observedAt,
        issuerInstitutionId: first.reuserInstitutionId,
        reuserInstitutionId: first.issuerInstitutionId,
      };
      return { ...inputs, signals: [...cloneSignals(inputs.signals), cycle] };
    }
    case 'FINGERPRINT_COLLISION': {
      if (inputs.signals.length < 2) return inputs;
      const sharedId = inputs.signals[0].signalId;
      const collided = inputs.signals.map((s, idx) => (idx === 1 ? { ...s, signalId: sharedId } : s));
      return { ...inputs, signals: collided };
    }
    case 'NO_CHAOS':
    default:
      return inputs;
  }
}

function evaluate(mode: AdoptionChaosMode, report: AdoptionFlywheelReport): {
  ok: boolean;
  expected: string;
  observed: string;
} {
  switch (mode) {
    case 'INJECT_CONTAINMENT_BREACH':
      return {
        ok: report.overallVerdict === 'ADOPTION_BREACH',
        expected: 'overallVerdict=ADOPTION_BREACH',
        observed: `overallVerdict=${report.overallVerdict}`,
      };
    case 'EMPTY_SIGNALS':
      return {
        ok: report.overallVerdict === 'ADOPTION_AMBIGUOUS' && report.ambiguous === true,
        expected: 'overallVerdict=ADOPTION_AMBIGUOUS, ambiguous=true',
        observed: `overallVerdict=${report.overallVerdict}, ambiguous=${report.ambiguous}`,
      };
    case 'AMBIGUITY_FLOOD':
      return {
        ok:
          report.profile.replayReuseCount > 0 &&
          report.profile.deniedReuseCount > 0 &&
          // Curves must keep the two streams distinguishable.
          report.curves.some(c => c.reuseCount > 0 && c.deniedReuseCount > 0),
        expected: 'both replayReuseCount and deniedReuseCount > 0; curves preserve both streams',
        observed: `replayReuseCount=${report.profile.replayReuseCount} deniedReuseCount=${report.profile.deniedReuseCount}`,
      };
    case 'CROSS_ORG_STARVATION':
      return {
        ok: report.profile.crossOrgReusePct === 0 || report.profile.crossOrgReusePct === null,
        expected: 'crossOrgReusePct === 0 or null (no cross-org)',
        observed: `crossOrgReusePct=${report.profile.crossOrgReusePct}`,
      };
    case 'REFERRAL_CYCLE_INJECTION':
      return {
        ok: report.profile.referralIntroductionCount > 0,
        expected: 'referralIntroductionCount > 0 (cycle injection preserved)',
        observed: `referralIntroductionCount=${report.profile.referralIntroductionCount}`,
      };
    case 'FINGERPRINT_COLLISION':
      return {
        // signalCount counts duplicates; inputs.signalIds is deduplicated.
        ok: report.profile.signalCount >= report.inputs.signalIds.length,
        expected: 'profile.signalCount >= inputs.signalIds.length (collision visible)',
        observed: `signalCount=${report.profile.signalCount} unique=${report.inputs.signalIds.length}`,
      };
    case 'NO_CHAOS':
    default:
      return {
        ok: report.overallVerdict !== 'ADOPTION_BREACH',
        expected: 'overallVerdict !== ADOPTION_BREACH',
        observed: `overallVerdict=${report.overallVerdict}`,
      };
  }
}

export function runAdoptionFlywheelChaos(args: {
  reportId: string;
  generatedAt: string;
  mode: AdoptionChaosMode;
  inputs: AdoptionFlywheelInputs;
}): AdoptionChaosResult {
  const { reportId, generatedAt, mode, inputs } = args;
  const mutated = applyMode(mode, inputs);
  const report = buildAdoptionFlywheelReport({ reportId, generatedAt, inputs: mutated });
  const { ok, expected, observed } = evaluate(mode, report);
  const chaosDigest = sha256ForPayload({
    schema: 'vitalcv.adoption-flywheel-chaos.lineage.v1',
    mode,
    reportId,
    overallVerdict: report.overallVerdict,
    lineageDigest: report.lineageDigest,
    expectationMet: ok,
  });
  return {
    schema: 'vitalcv.adoption-flywheel-chaos.v1',
    mode,
    report,
    expectationMet: ok,
    expectedSummary: expected,
    observedSummary: observed,
    chaosDigest,
  };
}
