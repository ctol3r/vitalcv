/**
 * replayReuseIncentives.ts — W2-PR120A
 *
 * Quantifies the operational incentive for a reusing institution to consume
 * a prior VitalCV decision via replay (instead of re-running a PSV cycle).
 * Pure transform — derives every figure from the AdoptionFlywheelReport. No
 * marketing puffery: refusing-to-reuse is preserved as a DENIED signal.
 *
 * Invariants:
 *   1. Every incentive figure is derived from a replay-safe signal. Signals
 *      tied to a containment-breached bundle never contribute.
 *   2. PSV-cycle-avoidance figures are MODELED (cite NCQA CR-3 baseline)
 *      and surface as null when the slice is empty — never as a default 0.
 *   3. Denied reuse is preserved and reported separately. It never silently
 *      collapses into "growth".
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { AdoptionFlywheelReport, AdoptionSignal } from './adoptionFlywheelModel';

/** NCQA CR-3 PSV cycle is commonly cited as ~60 days end-to-end. */
export const PSV_CYCLE_DAYS_DEFAULT = 60;

/**
 * Friction-unit equivalence: legacy paper-binder cycles are modeled at 1000
 * friction units (mirrors STANDARD_BENCHMARK_BASELINES.LEGACY_CREDENTIALING
 * in trustOperationalBenchmark.ts).
 */
export const FRICTION_UNITS_PER_AVOIDED_CYCLE_DEFAULT = 1000;

export interface ReplayReuseIncentive {
  schema: 'vitalcv.replay-reuse-incentive.v1';
  reportId: string;
  generatedAt: string;
  /** Eligible replay-reuse signals — denied/cross-org-promotion excluded. */
  eligibleReuseCount: number;
  /** Denied reuses, preserved separately. */
  deniedReuseCount: number;
  /** Modeled PSV cycles avoided. eligibleReuseCount × 1 cycle per replay. */
  psvCyclesAvoided: number;
  /** Modeled PSV cycles avoided weighted by per-institution distribution. */
  psvCyclesAvoidedPerInstitution: Array<{
    institutionId: string;
    cyclesAvoided: number;
    deniedCount: number;
  }>;
  /** Modeled friction-unit savings. */
  frictionUnitsSaved: number;
  /** Calendar days saved (modeled, NCQA CR-3 floor). */
  calendarDaysSaved: number;
  /**
   * Acceleration multiplier vs. NO_REUSE_BASELINE. Null when slice empty.
   * Equal to (eligible + 1) so an empty slice does not produce a divide-by-
   * zero collapse — caller MUST treat null as "no signal, not zero".
   */
  reuseAcceleration: number | null;
  /** Tamper-evident digest. */
  lineageDigest: string;
}

export interface ReuseIncentiveOverrides {
  psvCycleDays?: number;
  frictionUnitsPerAvoidedCycle?: number;
}

function isEligibleReuse(s: AdoptionSignal): boolean {
  return s.signalType === 'REPLAY_REUSE';
}

export function buildReplayReuseIncentive(
  report: AdoptionFlywheelReport,
  signals: ReadonlyArray<AdoptionSignal>,
  overrides: ReuseIncentiveOverrides = {},
): ReplayReuseIncentive {
  if (report.overallVerdict === 'ADOPTION_BREACH') {
    return {
      schema: 'vitalcv.replay-reuse-incentive.v1',
      reportId: report.reportId,
      generatedAt: report.generatedAt,
      eligibleReuseCount: 0,
      deniedReuseCount: 0,
      psvCyclesAvoided: 0,
      psvCyclesAvoidedPerInstitution: [],
      frictionUnitsSaved: 0,
      calendarDaysSaved: 0,
      reuseAcceleration: null,
      lineageDigest: sha256ForPayload({
        schema: 'vitalcv.replay-reuse-incentive.lineage.v1',
        reportId: report.reportId,
        breach: true,
      }),
    };
  }

  const psvCycleDays = overrides.psvCycleDays ?? PSV_CYCLE_DAYS_DEFAULT;
  const frictionUnitsPerAvoidedCycle =
    overrides.frictionUnitsPerAvoidedCycle ?? FRICTION_UNITS_PER_AVOIDED_CYCLE_DEFAULT;

  const eligible = signals.filter(isEligibleReuse);
  const denied = signals.filter(s => s.signalType === 'DENIED_REUSE');
  const eligibleReuseCount = eligible.length;
  const deniedReuseCount = denied.length;

  const psvCyclesAvoided = eligibleReuseCount;
  const frictionUnitsSaved = eligibleReuseCount * frictionUnitsPerAvoidedCycle;
  const calendarDaysSaved = eligibleReuseCount * psvCycleDays;

  const perInstitution = new Map<string, { cyclesAvoided: number; deniedCount: number }>();
  for (const s of eligible) {
    const slot = perInstitution.get(s.reuserInstitutionId) ?? { cyclesAvoided: 0, deniedCount: 0 };
    slot.cyclesAvoided += 1;
    perInstitution.set(s.reuserInstitutionId, slot);
  }
  for (const s of denied) {
    const slot = perInstitution.get(s.reuserInstitutionId) ?? { cyclesAvoided: 0, deniedCount: 0 };
    slot.deniedCount += 1;
    perInstitution.set(s.reuserInstitutionId, slot);
  }

  const psvCyclesAvoidedPerInstitution = [...perInstitution.entries()]
    .map(([institutionId, v]) => ({ institutionId, ...v }))
    .sort((a, b) => a.institutionId.localeCompare(b.institutionId));

  const reuseAcceleration = eligibleReuseCount === 0 && deniedReuseCount === 0
    ? null
    : eligibleReuseCount + 1; // NO_REUSE_BASELINE = 1 (null seed cycle)

  const lineageDigest = sha256ForPayload({
    schema: 'vitalcv.replay-reuse-incentive.lineage.v1',
    reportId: report.reportId,
    eligibleReuseCount,
    deniedReuseCount,
    psvCyclesAvoided,
    frictionUnitsSaved,
    calendarDaysSaved,
    psvCycleDays,
    frictionUnitsPerAvoidedCycle,
    reuseAcceleration,
    perInstitution: psvCyclesAvoidedPerInstitution,
  });

  return {
    schema: 'vitalcv.replay-reuse-incentive.v1',
    reportId: report.reportId,
    generatedAt: report.generatedAt,
    eligibleReuseCount,
    deniedReuseCount,
    psvCyclesAvoided,
    psvCyclesAvoidedPerInstitution,
    frictionUnitsSaved,
    calendarDaysSaved,
    reuseAcceleration,
    lineageDigest,
  };
}
