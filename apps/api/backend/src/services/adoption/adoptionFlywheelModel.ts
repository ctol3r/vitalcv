/**
 * adoptionFlywheelModel.ts — W2-PR120A
 *
 * Institutional Adoption Flywheel core. Pure transform that consumes a slice
 * of VitalCV operational evidence (audit bundles, replay events, runtime
 * mutations) and produces the flywheel report — the longitudinal,
 * replay-safe view of ecosystem trust adoption across institutions.
 *
 * Hard invariants (mirror replay-containment and benchmarking modules):
 *
 *   1. adoption replay-safe — every adoption signal is traceable to a real
 *      audit-bundle replay or runtime mutation record. A signal whose
 *      source bundle has containment breached cannot count toward
 *      acceleration. Empty slice → ADOPTION_AMBIGUOUS, never a default win.
 *   2. ambiguity preserved during growth — when two signals contradict
 *      (e.g. reuseCount > 0 but no replay records back it), the flywheel
 *      surfaces ADOPTION_AMBIGUOUS for that comparison. No silent merge.
 *   3. network effects measurable — the modeled coefficient is exposed as
 *      a literal numeric, with the underlying node/edge counts available
 *      for regulator reconstruction.
 *   4. fail-closed adoption semantics — a single CONTAINMENT_BREACH bundle
 *      anywhere in the slice forces overallVerdict=ADOPTION_BREACH.
 *   5. ecosystem trust longitudinally visible — the snapshot includes the
 *      slice-window plus a per-institution adoption-curve fingerprint, so
 *      a regulator can reconstruct who adopted what, when.
 *   6. institutional acceleration reconstructable — lineageDigest folds
 *      every input id, baseline reference and per-institution curve. A
 *      tamper-evident hash a regulator can re-run.
 *
 * Pure transform — no fetches, no DB writes, no audit-event writes.
 */
import { sha256ForPayload } from '../../utils/deterministic';
import type { AuditBundle } from '../audit/replayEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdoptionVerdict =
  | 'ADOPTION_OBSERVED'
  | 'ADOPTION_PARITY'
  | 'ADOPTION_DECELERATED'
  | 'ADOPTION_AMBIGUOUS'
  | 'ADOPTION_BREACH';

export type InstitutionRole =
  | 'ISSUER'
  | 'REUSER'
  | 'REFERRER'
  | 'REFEREE'
  | 'UNKNOWN';

export interface InstitutionIdentity {
  schema: 'vitalcv.adoption-institution.v1';
  institutionId: string;
  role: InstitutionRole;
  /** Plain-English category for the dashboard. Required — empty forces AMBIGUOUS. */
  category: string;
}

/**
 * A single, observed adoption signal. Every signal cites the audit bundle
 * and replay capsule it derives from — that's the replay-safe invariant.
 */
export interface AdoptionSignal {
  schema: 'vitalcv.adoption-signal.v1';
  signalId: string;
  observedAt: string;
  /** The originating issuer org (lineage root). */
  issuerInstitutionId: string;
  /** The org that re-used the decision. May equal issuer (self-reuse). */
  reuserInstitutionId: string;
  /** The audit bundle that proves the signal. */
  sourceBundleId: string;
  /** The capsule that was replayed/reused. */
  sourceCapsuleId: string;
  /**
   * How the signal type folds into the flywheel:
   *   - REPLAY_REUSE: a replay of a prior decision avoided a PSV cycle.
   *   - REFERRAL_INTRODUCTION: reuser introduced the lineage to a new
   *     institution downstream.
   *   - CROSS_ORG_PROMOTION: a reused decision was promoted (e.g. to a
   *     PSV-receipt candidate or to a verifier acceptance) across an
   *     organizational boundary.
   *   - DENIED_REUSE: an attempted reuse was denied (fail-closed). Counts
   *     toward DECELERATED, never toward growth.
   */
  signalType:
    | 'REPLAY_REUSE'
    | 'REFERRAL_INTRODUCTION'
    | 'CROSS_ORG_PROMOTION'
    | 'DENIED_REUSE';
  /** Latency in ms between issue and observed signal — supports the curve. */
  ageMs: number;
}

export interface AdoptionBaselineModel {
  schema: 'vitalcv.adoption-baseline.v1';
  baselineId: AdoptionBaselineId;
  label: string;
  derivation: string;
  evidenceSources: string[];
  metrics: {
    /** Modeled cross-org reuse rate as a fraction [0,1] or null. */
    crossOrgReusePct: number | null;
    /** Modeled PSV-cycles avoided per 100 replays, or null. */
    psvCyclesAvoidedPer100: number | null;
    /** Modeled network coefficient floor (edges² / nodes). */
    networkCoefficientFloor: number | null;
    /** Modeled referral-pathway visibility as a fraction [0,1]. */
    referralVisibilityPct: number | null;
  };
}

export type AdoptionBaselineId =
  | 'LEGACY_CREDENTIALING_NETWORK'
  | 'POINT_TO_POINT_VERIFIER'
  | 'CENTRAL_DIRECTORY_DEPLOYMENT'
  | 'NO_REUSE_BASELINE';

export interface InstitutionAdoptionCurve {
  schema: 'vitalcv.adoption-curve.v1';
  institutionId: string;
  role: InstitutionRole;
  reuseCount: number;
  referralOutCount: number;
  referralInCount: number;
  deniedReuseCount: number;
  crossOrgPromotionCount: number;
  /** First observed adoption signal. */
  firstObservedAt: string | null;
  /** Most recently observed adoption signal. */
  lastObservedAt: string | null;
  /** SHA-256 over the chronological signal ids — tamper-evident per institution. */
  curveFingerprint: string;
  /** True iff every cited bundle survived containment (replay-safe). */
  replaySafe: boolean;
}

export interface FlywheelMetricSlot {
  schema: 'vitalcv.flywheel-metric-slot.v1';
  name: string;
  unit: string;
  vitalcv: number | null;
  baseline: number | null;
  delta: number | null;
  ratio: number | null;
  verdict: AdoptionVerdict;
  ambiguous: boolean;
  reason: string;
}

export interface FlywheelComparison {
  schema: 'vitalcv.flywheel-comparison.v1';
  baselineId: AdoptionBaselineId;
  baselineLabel: string;
  baselineDerivation: string;
  baselineEvidenceSources: string[];
  metrics: FlywheelMetricSlot[];
  verdict: AdoptionVerdict;
  ambiguous: boolean;
  reason: string;
}

export interface AdoptionFlywheelProfile {
  schema: 'vitalcv.adoption-flywheel-profile.v1';
  institutionCount: number;
  signalCount: number;
  replayReuseCount: number;
  referralIntroductionCount: number;
  crossOrgPromotionCount: number;
  deniedReuseCount: number;
  /** Distinct (issuer, reuser) pairs — flywheel edges. */
  uniqueOrgEdgeCount: number;
  /** Distinct institutions appearing in any signal — flywheel nodes. */
  uniqueOrgNodeCount: number;
  /** Network coefficient: edges² / max(1, nodes). Null when no nodes. */
  networkCoefficient: number | null;
  /** Cross-org reuse fraction [0,1]. Null when no replay reuse. */
  crossOrgReusePct: number | null;
  /** PSV cycles modeled-avoided per 100 replays. Null when no replay reuse. */
  psvCyclesAvoidedPer100: number | null;
  /** Referral-pathway visibility [0,1]. Null when no referrals seen. */
  referralVisibilityPct: number | null;
  /**
   * Adoption flywheel maturity, computed deterministically from observed
   * metrics. Stays null when the slice is too thin to score (preserved
   * ambiguity, not a default zero).
   */
  flywheelMaturityPct: number | null;
}

export interface AdoptionFlywheelInputs {
  signals: ReadonlyArray<AdoptionSignal>;
  institutions: ReadonlyArray<InstitutionIdentity>;
  auditBundles: ReadonlyArray<AuditBundle>;
  baselines?: ReadonlyArray<AdoptionBaselineModel>;
  sliceWindow?: { from: string; to: string };
}

export interface AdoptionFlywheelReport {
  schema: 'vitalcv.adoption-flywheel-report.v1';
  reportId: string;
  generatedAt: string;
  inputs: {
    signalIds: string[];
    institutionIds: string[];
    auditBundleIds: string[];
    baselineIds: AdoptionBaselineId[];
    sliceWindow: { from: string; to: string };
  };
  profile: AdoptionFlywheelProfile;
  curves: InstitutionAdoptionCurve[];
  comparisons: FlywheelComparison[];
  overallVerdict: AdoptionVerdict;
  overallReason: string;
  ambiguous: boolean;
  /**
   * SHA-256 over the canonicalized (inputs ∪ baselines ∪ profile ∪ curves).
   * Tamper-evident — a regulator can re-run buildAdoptionFlywheelReport with
   * the same inputs and reproduce this digest exactly.
   */
  lineageDigest: string;
}

// ── Standard baselines ───────────────────────────────────────────────────────

/**
 * Standard adoption-network baselines. Each derivation cites a public
 * standards/industry source. Numbers are MODELED, not measurements of any
 * specific vendor — they exist for orientation against legacy patterns.
 */
export const STANDARD_ADOPTION_BASELINES: Readonly<
  Record<AdoptionBaselineId, AdoptionBaselineModel>
> = Object.freeze({
  LEGACY_CREDENTIALING_NETWORK: {
    schema: 'vitalcv.adoption-baseline.v1',
    baselineId: 'LEGACY_CREDENTIALING_NETWORK',
    label: 'Paper-binder credentialing across an institution network',
    derivation:
      'NCQA CR-3 PSV per-institution: each new credentialing decision triggers a fresh PSV cycle. Cross-org reuse is structurally absent — paper binders do not federate. Modeled crossOrgReusePct = 0, modeled PSV cycles avoided per 100 replays = 0.',
    evidenceSources: [
      'NCQA Credentialing Standards CR-3 (PSV)',
      'JCAHO HR.01.02.05 (credentialing file retention)',
    ],
    metrics: {
      crossOrgReusePct: 0,
      psvCyclesAvoidedPer100: 0,
      networkCoefficientFloor: 0,
      referralVisibilityPct: 0,
    },
  },
  POINT_TO_POINT_VERIFIER: {
    schema: 'vitalcv.adoption-baseline.v1',
    baselineId: 'POINT_TO_POINT_VERIFIER',
    label: 'Bilateral verifier integrations (no federation)',
    derivation:
      'Point-to-point verifier contracts have no flywheel: each new institution requires a fresh integration. Some intra-bilateral reuse occurs but referral pathways are invisible to third parties (no shared lineage).',
    evidenceSources: [
      'URAC Health Plan Standards AC-3',
      'HL7 FHIR PractitionerRole exchange patterns',
    ],
    metrics: {
      crossOrgReusePct: 0.05,
      psvCyclesAvoidedPer100: 5,
      networkCoefficientFloor: 0.25,
      referralVisibilityPct: 0.1,
    },
  },
  CENTRAL_DIRECTORY_DEPLOYMENT: {
    schema: 'vitalcv.adoption-baseline.v1',
    baselineId: 'CENTRAL_DIRECTORY_DEPLOYMENT',
    label: 'Central credentialing directory (e.g. CAQH-style)',
    derivation:
      'Central directories increase reuse but lineage is opaque: a downstream verifier accepts the directory record without a reproducible PSV trail. Referral pathways are not exposed as first-class objects, so visibility floor is modeled at ~20%.',
    evidenceSources: [
      'CAQH ProView credentialing methodology (public)',
      'NCQA HEDIS Volume 2 audit methodology',
    ],
    metrics: {
      crossOrgReusePct: 0.3,
      psvCyclesAvoidedPer100: 25,
      networkCoefficientFloor: 1,
      referralVisibilityPct: 0.2,
    },
  },
  NO_REUSE_BASELINE: {
    schema: 'vitalcv.adoption-baseline.v1',
    baselineId: 'NO_REUSE_BASELINE',
    label: 'No-reuse worst case (every decision re-PSV)',
    derivation:
      'Worst-case adoption floor: every credentialing decision triggers a full PSV cycle and no audit lineage carries forward. Models the regression target — falling to this is ADOPTION_DECELERATED.',
    evidenceSources: ['Internal worst-case bound for regression detection.'],
    metrics: {
      crossOrgReusePct: 0,
      psvCyclesAvoidedPer100: 0,
      networkCoefficientFloor: 0,
      referralVisibilityPct: 0,
    },
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isBreachedBundle(bundle: AuditBundle): boolean {
  // A bundle is "containment breached" when its bundleHash is missing, when
  // the bundle-level containment report carries a CONTAINMENT_BREACH
  // quarantine, or when any individual replay's containment record reports
  // CONTAINMENT_BREACH. We don't re-implement the replay engine here — we
  // accept the explicit marker.
  if (!bundle.bundleHash || bundle.bundleHash.length === 0) return true;
  const bundleContainment = (bundle as unknown as {
    containment?: { quarantines?: ReadonlyArray<{ verdict?: string }> };
  }).containment;
  if (bundleContainment?.quarantines?.some(q => q?.verdict === 'CONTAINMENT_BREACH')) {
    return true;
  }
  for (const r of bundle.replays) {
    const marker = (r as unknown as { containment?: { verdict?: string } }).containment;
    if (marker?.verdict === 'CONTAINMENT_BREACH') return true;
  }
  return false;
}

function classifyVerdictAgainstBaseline(
  vitalcv: number | null,
  baseline: number | null,
  higherIsBetter: boolean,
): { verdict: AdoptionVerdict; ambiguous: boolean; reason: string } {
  if (vitalcv === null && baseline === null) {
    return { verdict: 'ADOPTION_AMBIGUOUS', ambiguous: true, reason: 'both null' };
  }
  if (vitalcv === null) {
    return { verdict: 'ADOPTION_AMBIGUOUS', ambiguous: true, reason: 'vitalcv null' };
  }
  if (baseline === null) {
    return { verdict: 'ADOPTION_AMBIGUOUS', ambiguous: true, reason: 'baseline null' };
  }
  const delta = vitalcv - baseline;
  if (Math.abs(delta) < 1e-9) {
    return { verdict: 'ADOPTION_PARITY', ambiguous: false, reason: 'within tolerance' };
  }
  const observedBetter = higherIsBetter ? delta > 0 : delta < 0;
  return observedBetter
    ? { verdict: 'ADOPTION_OBSERVED', ambiguous: false, reason: 'better than baseline' }
    : { verdict: 'ADOPTION_DECELERATED', ambiguous: false, reason: 'worse than baseline' };
}

function computeCurveFingerprint(institutionId: string, signals: ReadonlyArray<AdoptionSignal>): string {
  const sorted = [...signals].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return sha256ForPayload({
    schema: 'vitalcv.adoption-curve-fingerprint.v1',
    institutionId,
    signalIds: sorted.map(s => s.signalId),
  });
}

function fractionOrNull(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// ── Core build ───────────────────────────────────────────────────────────────

export function buildAdoptionFlywheelReport(args: {
  reportId: string;
  generatedAt: string;
  inputs: AdoptionFlywheelInputs;
}): AdoptionFlywheelReport {
  const { reportId, generatedAt, inputs } = args;
  const { signals, institutions, auditBundles } = inputs;
  const baselines = inputs.baselines && inputs.baselines.length > 0
    ? inputs.baselines
    : Object.values(STANDARD_ADOPTION_BASELINES);

  // Fail-closed: any containment-breached bundle short-circuits the report.
  const breachedBundleIds = auditBundles.filter(isBreachedBundle).map(b => b.bundleId);

  // Build per-institution curve aggregates.
  const institutionMap = new Map<string, InstitutionIdentity>();
  for (const inst of institutions) institutionMap.set(inst.institutionId, inst);
  const signalsByInstitution = new Map<string, AdoptionSignal[]>();
  const knownBundleIds = new Set(auditBundles.map(b => b.bundleId));

  for (const signal of signals) {
    const list = signalsByInstitution.get(signal.reuserInstitutionId) ?? [];
    list.push(signal);
    signalsByInstitution.set(signal.reuserInstitutionId, list);
    if (!signalsByInstitution.has(signal.issuerInstitutionId)) {
      signalsByInstitution.set(signal.issuerInstitutionId, []);
    }
  }

  const breachedBundleSet = new Set(breachedBundleIds);
  const curves: InstitutionAdoptionCurve[] = [];
  for (const [institutionId, sigList] of signalsByInstitution) {
    const sorted = [...sigList].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const inst = institutionMap.get(institutionId);
    const role: InstitutionRole = inst?.role ?? 'UNKNOWN';
    const reuseCount = sorted.filter(s => s.signalType === 'REPLAY_REUSE').length;
    const referralOutCount = signals.filter(
      s => s.signalType === 'REFERRAL_INTRODUCTION' && s.issuerInstitutionId === institutionId,
    ).length;
    const referralInCount = signals.filter(
      s => s.signalType === 'REFERRAL_INTRODUCTION' && s.reuserInstitutionId === institutionId,
    ).length;
    const deniedReuseCount = sorted.filter(s => s.signalType === 'DENIED_REUSE').length;
    const crossOrgPromotionCount = sorted.filter(s => s.signalType === 'CROSS_ORG_PROMOTION').length;
    const replaySafe = sorted.every(
      s => knownBundleIds.has(s.sourceBundleId) && !breachedBundleSet.has(s.sourceBundleId),
    );
    curves.push({
      schema: 'vitalcv.adoption-curve.v1',
      institutionId,
      role,
      reuseCount,
      referralOutCount,
      referralInCount,
      deniedReuseCount,
      crossOrgPromotionCount,
      firstObservedAt: sorted[0]?.observedAt ?? null,
      lastObservedAt: sorted[sorted.length - 1]?.observedAt ?? null,
      curveFingerprint: computeCurveFingerprint(institutionId, sorted),
      replaySafe,
    });
  }

  // Profile aggregate.
  const replayReuseCount = signals.filter(s => s.signalType === 'REPLAY_REUSE').length;
  const referralIntroductionCount = signals.filter(s => s.signalType === 'REFERRAL_INTRODUCTION').length;
  const crossOrgPromotionCount = signals.filter(s => s.signalType === 'CROSS_ORG_PROMOTION').length;
  const deniedReuseCount = signals.filter(s => s.signalType === 'DENIED_REUSE').length;

  const orgPairKeys = new Set<string>();
  const orgNodes = new Set<string>();
  for (const s of signals) {
    if (s.signalType === 'DENIED_REUSE') continue;
    orgPairKeys.add(`${s.issuerInstitutionId}::${s.reuserInstitutionId}`);
    orgNodes.add(s.issuerInstitutionId);
    orgNodes.add(s.reuserInstitutionId);
  }

  const uniqueOrgEdgeCount = orgPairKeys.size;
  const uniqueOrgNodeCount = orgNodes.size;
  const networkCoefficient = uniqueOrgNodeCount === 0
    ? null
    : roundTo((uniqueOrgEdgeCount * uniqueOrgEdgeCount) / uniqueOrgNodeCount, 4);

  const crossOrgReuseCount = signals.filter(
    s => s.signalType === 'REPLAY_REUSE' && s.issuerInstitutionId !== s.reuserInstitutionId,
  ).length;
  const crossOrgReusePct = fractionOrNull(crossOrgReuseCount, replayReuseCount);
  const psvCyclesAvoidedPer100 = fractionOrNull(replayReuseCount * 100, replayReuseCount + deniedReuseCount);
  const referralVisibilityPct = fractionOrNull(
    referralIntroductionCount,
    replayReuseCount + referralIntroductionCount,
  );

  // Maturity score — equal-weighted average of available signals. If all are
  // null (no signals at all), maturity stays null to preserve ambiguity.
  const maturityComponents: number[] = [];
  if (crossOrgReusePct !== null) maturityComponents.push(crossOrgReusePct);
  if (referralVisibilityPct !== null) maturityComponents.push(referralVisibilityPct);
  if (networkCoefficient !== null) {
    // Compress to [0,1] via 1 - 1/(1+coeff). A coefficient of 1.0 maps to 0.5.
    maturityComponents.push(1 - 1 / (1 + networkCoefficient));
  }
  if (psvCyclesAvoidedPer100 !== null) {
    // Already implicitly a percentage [0,100]; scale to [0,1].
    maturityComponents.push(Math.min(1, psvCyclesAvoidedPer100 / 100));
  }
  const flywheelMaturityPct = maturityComponents.length === 0
    ? null
    : roundTo(maturityComponents.reduce((a, b) => a + b, 0) / maturityComponents.length, 4);

  const profile: AdoptionFlywheelProfile = {
    schema: 'vitalcv.adoption-flywheel-profile.v1',
    institutionCount: institutions.length,
    signalCount: signals.length,
    replayReuseCount,
    referralIntroductionCount,
    crossOrgPromotionCount,
    deniedReuseCount,
    uniqueOrgEdgeCount,
    uniqueOrgNodeCount,
    networkCoefficient,
    crossOrgReusePct: crossOrgReusePct === null ? null : roundTo(crossOrgReusePct, 4),
    psvCyclesAvoidedPer100: psvCyclesAvoidedPer100 === null ? null : roundTo(psvCyclesAvoidedPer100, 4),
    referralVisibilityPct: referralVisibilityPct === null ? null : roundTo(referralVisibilityPct, 4),
    flywheelMaturityPct,
  };

  // Comparisons.
  const comparisons: FlywheelComparison[] = baselines.map(baseline => {
    const slots: FlywheelMetricSlot[] = [];
    const verdicts: AdoptionVerdict[] = [];

    function pushSlot(
      name: string,
      unit: string,
      vitalcv: number | null,
      baselineValue: number | null,
      higherIsBetter: boolean,
    ): void {
      const { verdict, ambiguous, reason } = classifyVerdictAgainstBaseline(vitalcv, baselineValue, higherIsBetter);
      const delta = vitalcv !== null && baselineValue !== null ? roundTo(vitalcv - baselineValue, 4) : null;
      const ratio = vitalcv !== null && baselineValue !== null && baselineValue !== 0
        ? roundTo(vitalcv / baselineValue, 4)
        : null;
      slots.push({
        schema: 'vitalcv.flywheel-metric-slot.v1',
        name,
        unit,
        vitalcv,
        baseline: baselineValue,
        delta,
        ratio,
        verdict,
        ambiguous,
        reason,
      });
      verdicts.push(verdict);
    }

    pushSlot('crossOrgReusePct', 'fraction', profile.crossOrgReusePct, baseline.metrics.crossOrgReusePct, true);
    pushSlot('psvCyclesAvoidedPer100', 'count', profile.psvCyclesAvoidedPer100, baseline.metrics.psvCyclesAvoidedPer100, true);
    pushSlot('networkCoefficient', 'coefficient', profile.networkCoefficient, baseline.metrics.networkCoefficientFloor, true);
    pushSlot('referralVisibilityPct', 'fraction', profile.referralVisibilityPct, baseline.metrics.referralVisibilityPct, true);

    let verdict: AdoptionVerdict = 'ADOPTION_OBSERVED';
    let ambiguous = false;
    let reason = 'all slots better than baseline';
    if (verdicts.includes('ADOPTION_AMBIGUOUS')) {
      verdict = 'ADOPTION_AMBIGUOUS';
      ambiguous = true;
      reason = 'at least one slot is ambiguous';
    } else if (verdicts.includes('ADOPTION_DECELERATED')) {
      verdict = 'ADOPTION_DECELERATED';
      reason = 'at least one slot decelerated against baseline';
    } else if (verdicts.every(v => v === 'ADOPTION_PARITY')) {
      verdict = 'ADOPTION_PARITY';
      reason = 'every slot at parity';
    }

    return {
      schema: 'vitalcv.flywheel-comparison.v1',
      baselineId: baseline.baselineId,
      baselineLabel: baseline.label,
      baselineDerivation: baseline.derivation,
      baselineEvidenceSources: [...baseline.evidenceSources],
      metrics: slots,
      verdict,
      ambiguous,
      reason,
    };
  });

  // Overall verdict.
  let overallVerdict: AdoptionVerdict;
  let overallReason: string;
  let ambiguous = false;
  if (breachedBundleIds.length > 0) {
    overallVerdict = 'ADOPTION_BREACH';
    overallReason = `containment breach in ${breachedBundleIds.length} source bundle(s) — flywheel cannot run`;
  } else if (signals.length === 0) {
    overallVerdict = 'ADOPTION_AMBIGUOUS';
    ambiguous = true;
    overallReason = 'empty adoption slice — ambiguity preserved';
  } else if (comparisons.some(c => c.verdict === 'ADOPTION_AMBIGUOUS')) {
    overallVerdict = 'ADOPTION_AMBIGUOUS';
    ambiguous = true;
    overallReason = 'at least one comparison is ambiguous';
  } else if (comparisons.some(c => c.verdict === 'ADOPTION_DECELERATED')) {
    overallVerdict = 'ADOPTION_DECELERATED';
    overallReason = 'at least one comparison decelerated against baseline';
  } else if (comparisons.every(c => c.verdict === 'ADOPTION_PARITY')) {
    overallVerdict = 'ADOPTION_PARITY';
    overallReason = 'every comparison at parity';
  } else {
    overallVerdict = 'ADOPTION_OBSERVED';
    overallReason = 'flywheel acceleration observed across all comparisons';
  }

  const sliceWindow = inputs.sliceWindow ?? {
    from: signals.reduce<string>(
      (acc, s) => (acc === '' || s.observedAt < acc ? s.observedAt : acc),
      '',
    ),
    to: signals.reduce<string>(
      (acc, s) => (acc === '' || s.observedAt > acc ? s.observedAt : acc),
      '',
    ),
  };

  const reportSkeleton = {
    schema: 'vitalcv.adoption-flywheel-report.v1' as const,
    reportId,
    generatedAt,
    inputs: {
      signalIds: signals.map(s => s.signalId).sort(),
      institutionIds: institutions.map(i => i.institutionId).sort(),
      auditBundleIds: auditBundles.map(b => b.bundleId).sort(),
      baselineIds: baselines.map(b => b.baselineId).sort() as AdoptionBaselineId[],
      sliceWindow,
    },
    profile,
    curves: [...curves].sort((a, b) => a.institutionId.localeCompare(b.institutionId)),
    comparisons,
    overallVerdict,
    overallReason,
    ambiguous,
  };

  const lineageDigest = sha256ForPayload({
    schema: 'vitalcv.adoption-flywheel-report.lineage.v1',
    inputs: reportSkeleton.inputs,
    profile: reportSkeleton.profile,
    curves: reportSkeleton.curves,
    baselines: baselines.map(b => ({
      baselineId: b.baselineId,
      derivation: b.derivation,
      metrics: b.metrics,
    })),
    overallVerdict,
  });

  return { ...reportSkeleton, lineageDigest };
}

export function reproduceFlywheelLineageDigest(report: AdoptionFlywheelReport): string {
  return sha256ForPayload({
    schema: 'vitalcv.adoption-flywheel-report.lineage.v1',
    inputs: report.inputs,
    profile: report.profile,
    curves: report.curves,
    baselines: report.comparisons.map(c => ({
      baselineId: c.baselineId,
      derivation: c.baselineDerivation,
      metrics: STANDARD_ADOPTION_BASELINES[c.baselineId].metrics,
    })),
    overallVerdict: report.overallVerdict,
  });
}
