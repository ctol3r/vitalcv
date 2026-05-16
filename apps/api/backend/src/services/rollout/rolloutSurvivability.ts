/**
 * rolloutSurvivability.ts — W2-PR84A: Institutional Rollout Survivability
 *
 * Pure transforms enforcing the rollout boundary across institutional
 * deployments. Goal: ensure real-world institutional rollout survives partial
 * adoption, policy inconsistency, operational resistance, and deployment
 * friction — without silently dressing a stalled rollout as "live".
 *
 * Companion module to:
 *   - replayCorruptionContainment.ts (replay axis)
 *   - multi-tenant/tenantIsolation.ts (tenant axis)
 *   - runtimeTrustCohesion.ts        (mutation axis)
 *
 * Same shape, same fail-closed contract, different axis: institutional
 * adoption + deployment friction.
 *
 * Hard invariants (fail-closed):
 *   - A facility that opted out, regressed, or never adopted is QUARANTINED
 *     — never silently merged into the "rolled out" cohort.
 *   - Ambiguous adoption signals (partial install, conflicting policy,
 *     missing telemetry) are preserved as AMBIGUOUS, never coerced to
 *     SURVIVING.
 *   - When the surviving population falls below the configured floor, the
 *     boundary raises ROLLOUT_BREACH so the operator sees the breach, never
 *     a partial bundle dressed as a clean rollout.
 *   - Resistance and friction records carry deterministic, tamper-evident
 *     digests so a forged "adopted" record cannot replace a real
 *     resistance signal.
 *   - Friction lineage is reconstructable: every quarantine record carries
 *     the hints needed to walk back to the institutional source (parent
 *     org, policy bundle id, deployment manifest id).
 *
 * No fetches, no DB writes, no audit-event writes. This module is the
 * boundary checker; rollout dashboards + the W2-PR84A CI gate call it.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Where a single institution sits in the rollout lifecycle. */
export type AdoptionStage =
  | 'NOT_ADOPTED'           // never deployed, never produced telemetry
  | 'PILOT'                 // deployed in pilot only, not enterprise-wide
  | 'PARTIAL'               // some sub-units adopted, others have not
  | 'ADOPTED'               // fully deployed and producing telemetry
  | 'PILOT_REGRESSION'      // adopted then regressed back to pilot/partial
  | 'ABANDONED';            // adopted then explicitly abandoned

/** What kind of friction the rollout signal is reporting. */
export type RolloutFrictionKind =
  | 'CONFIG_DRIFT'                  // deployed config diverges from canonical bundle
  | 'POLICY_INCONSISTENCY'          // local policy conflicts with platform policy
  | 'OPERATIONAL_RESISTANCE'        // operators block / refuse / silently disable
  | 'PARTIAL_DEPLOYMENT'            // sub-units adopted while others have not
  | 'INSTITUTIONAL_NONCOOPERATION'  // institution refuses required cooperation
  | 'ROLLBACK'                      // formal rollback issued
  | 'TELEMETRY_GAP'                 // expected telemetry never arrived
  | 'AMBIGUOUS_ADOPTION_SIGNAL';    // signals contradict — preserve uncertainty

/** Survivability verdict for a single institution. */
export type RolloutSurvivabilityVerdict =
  | 'SURVIVING'             // fully adopted, no friction surfaced
  | 'PARTIAL_SURVIVING'     // partial adoption but operator-visible
  | 'AMBIGUOUS_ADOPTION'    // signals contradictory — quarantine + flag
  | 'RESISTANT'             // active resistance / refusal / abandonment
  | 'CONTAMINATED'          // dragged down by parent-org or shared-policy peer
  | 'ROLLOUT_BREACH';       // boundary breached — operator-visible failure

export type RolloutSurvivabilityViolationKind =
  | 'AMBIGUOUS_ADOPTION_FORCED_SURVIVING'
  | 'BOUNDARY_BREACH'
  | 'PARTIAL_ROLLOUT_FLOOR_BREACHED'
  | 'RESISTANCE_OPEN_FAILURE';

export class RolloutSurvivabilityError extends Error {
  readonly code = 'ROLLOUT_SURVIVABILITY_VIOLATION' as const;
  readonly violation: RolloutSurvivabilityViolationKind;
  readonly institutionId: string | null;
  readonly kind: RolloutFrictionKind | null;
  readonly survivingPct: number | null;

  constructor(args: {
    violation: RolloutSurvivabilityViolationKind;
    message: string;
    institutionId?: string | null;
    kind?: RolloutFrictionKind | null;
    survivingPct?: number | null;
  }) {
    super(args.message);
    this.name = 'RolloutSurvivabilityError';
    this.violation = args.violation;
    this.institutionId = args.institutionId ?? null;
    this.kind = args.kind ?? null;
    this.survivingPct = args.survivingPct ?? null;
  }
}

/**
 * The rollout signal a survivability classifier consumes. Mirrors the shape
 * of replayEngine's IntegrityCheck — a small, narrow contract so this module
 * never reaches into telemetry storage or HTTP layers.
 */
export interface RolloutSignal {
  /** Did the latest deployment manifest install cleanly? */
  deploymentApplied: boolean;
  /** Has the institution emitted at least one trust event in the observation window? */
  telemetryObserved: boolean;
  /** Local policy bundle digest (hash of bundle file contents). */
  localPolicyDigest: string;
  /** Canonical/expected policy bundle digest the platform shipped. */
  expectedPolicyDigest: string;
  /** Operator-observed friction notes, e.g. "facility refused install". */
  resistanceEvidence: string | null;
  /** Sub-units (sites/clinics) that adopted vs total tracked sub-units. */
  subunitsAdopted: number;
  subunitsTotal: number;
  /** True iff a formal rollback request was issued for this institution. */
  rollbackIssued: boolean;
}

export interface RolloutLineageHints {
  parentOrgId: string | null;
  /** Shared policy bundle id (institutions inheriting same policy share friction). */
  policyBundleId: string | null;
  /** Deployment manifest id this rollout descends from. */
  deploymentManifestId: string | null;
}

export interface RolloutSurvivabilityRecord {
  schema: 'vitalcv.rollout-survivability.v1';
  institutionId: string;
  verdict: RolloutSurvivabilityVerdict;
  /** Null when verdict === 'SURVIVING'. */
  kind: RolloutFrictionKind | null;
  stage: AdoptionStage;
  /** True iff verdict === 'AMBIGUOUS_ADOPTION'. Mirrored for fast filtering. */
  ambiguous: boolean;
  reason: string;
  /** SHA-256 over (institutionId, verdict, kind, stage, signal). Tamper-evident. */
  rolloutDigest: string;
  observedAt: string;
  lineageHints: RolloutLineageHints;
  /** Numeric 0..1 — fraction of sub-units that adopted. */
  subunitAdoptionRatio: number;
}

export interface RolloutBoundary {
  schema: 'vitalcv.rollout-boundary.v1';
  /** True iff rollout is intact — no breach, ambiguity preserved as flag. */
  partitioned: boolean;
  totalInstitutions: number;
  survivingCount: number;
  partialSurvivingCount: number;
  ambiguousCount: number;
  resistantCount: number;
  contaminatedCount: number;
  /** surviving / total — 1.0 when every institution is fully rolled out. */
  rolloutSurvivabilityRatio: number;
  /**
   * (surviving + partial-surviving + ambiguous) / total * 100 — what survived
   * in some operator-actionable form. Resistant + contaminated do NOT count.
   */
  partialAdoptionResiliencePct: number;
  /** (resistant + contaminated) / total * 100 — who actively pushed back. */
  institutionalResistancePct: number;
  /** (ambiguous + partial + telemetry-gap) / total * 100. */
  deploymentFrictionVisibilityPct: number;
  rolloutReason: string;
  boundaryDigest: string;
  partitionedAt: string;
}

export interface RolloutFrictionEdge {
  fromInstitutionId: string;
  toInstitutionId: string;
  reason: 'SHARED_PARENT_ORG' | 'SHARED_POLICY_BUNDLE' | 'SHARED_DEPLOYMENT_MANIFEST';
}

export interface RolloutFrictionLineage {
  schema: 'vitalcv.rollout-friction-lineage.v1';
  rootInstitutionId: string;
  /** Institutions whose rollout was contaminated via the root's hints. Excludes the root. */
  contaminatedInstitutionIds: string[];
  edges: RolloutFrictionEdge[];
  /** SHA-256 over (rootInstitutionId, sorted contaminated ids, sorted edges). */
  reconstructionDigest: string;
  reconstructedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCHEMA_RECORD   = 'vitalcv.rollout-survivability.v1' as const;
const SCHEMA_BOUNDARY = 'vitalcv.rollout-boundary.v1' as const;
const SCHEMA_LINEAGE  = 'vitalcv.rollout-friction-lineage.v1' as const;

const DEFAULT_MIN_PARTIAL_ADOPTION_RESILIENCE_PCT = 60;

function normalizeHints(
  hints: Partial<RolloutLineageHints> | undefined | null,
): RolloutLineageHints {
  return {
    parentOrgId:
      typeof hints?.parentOrgId === 'string' && hints.parentOrgId.trim().length > 0
        ? hints.parentOrgId.trim()
        : null,
    policyBundleId:
      typeof hints?.policyBundleId === 'string' && hints.policyBundleId.trim().length > 0
        ? hints.policyBundleId.trim()
        : null,
    deploymentManifestId:
      typeof hints?.deploymentManifestId === 'string' && hints.deploymentManifestId.trim().length > 0
        ? hints.deploymentManifestId.trim()
        : null,
  };
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function rolloutDigest(input: {
  institutionId: string;
  verdict: RolloutSurvivabilityVerdict;
  kind: RolloutFrictionKind | null;
  stage: AdoptionStage;
  signal: RolloutSignal;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.rollout-digest.v1',
    institutionId: input.institutionId,
    verdict: input.verdict,
    kind: input.kind,
    stage: input.stage,
    signal: {
      deploymentApplied: input.signal.deploymentApplied,
      telemetryObserved: input.signal.telemetryObserved,
      localPolicyDigest: input.signal.localPolicyDigest,
      expectedPolicyDigest: input.signal.expectedPolicyDigest,
      resistanceEvidence: input.signal.resistanceEvidence ?? null,
      subunitsAdopted: input.signal.subunitsAdopted,
      subunitsTotal: input.signal.subunitsTotal,
      rollbackIssued: input.signal.rollbackIssued,
    },
  });
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Pure classifier — given a rollout signal, return the friction kind, the
 * adoption stage, an ambiguity flag, and a human-readable reason.
 *
 * Fail-closed table (fields abbreviated):
 *
 *   applied | telem | policy | rollback | adopted/total | result
 *   --------+-------+--------+----------+---------------+----------------------------
 *   true    | true  | match  | false    | A==T (>0)     | SURVIVING (kind null)
 *   true    | true  | match  | false    | 0<A<T         | PARTIAL_DEPLOYMENT
 *   true    | true  | drift  | false    | n/a           | POLICY_INCONSISTENCY
 *   true    | false | match  | false    | n/a           | TELEMETRY_GAP (ambiguous)
 *   true    | true  | drift  | true     | n/a           | AMBIGUOUS (contradictory)
 *   false   | true  | n/a    | n/a      | n/a           | AMBIGUOUS (contradictory)
 *   false   | false | n/a    | false    | 0/0           | NOT_ADOPTED → CONFIG_DRIFT
 *   any     | any   | any    | true     | n/a           | ROLLBACK
 *   any     | any   | any    | any      | n/a + resist  | OPERATIONAL_RESISTANCE
 */
export function classifyRollout(input: {
  signal: RolloutSignal;
  /** True if the institution was previously fully adopted. */
  previouslyAdopted?: boolean;
}): {
  kind: RolloutFrictionKind | null;
  stage: AdoptionStage;
  ambiguous: boolean;
  reason: string;
  subunitAdoptionRatio: number;
} {
  const s = input.signal;
  const previouslyAdopted = input.previouslyAdopted === true;
  const subunitAdoptionRatio = s.subunitsTotal > 0
    ? clampRatio(s.subunitsAdopted / s.subunitsTotal)
    : (s.deploymentApplied ? 1 : 0);
  const policyMatches = s.localPolicyDigest === s.expectedPolicyDigest;

  // Rollback issued: explicit terminal stage. Highest priority.
  if (s.rollbackIssued) {
    return {
      kind: 'ROLLBACK',
      stage: previouslyAdopted ? 'PILOT_REGRESSION' : 'ABANDONED',
      ambiguous: false,
      reason: 'Formal rollback request issued for this institution.',
      subunitAdoptionRatio,
    };
  }

  // Operational resistance evidence — operator-observed refusal.
  if (
    typeof s.resistanceEvidence === 'string' &&
    s.resistanceEvidence.trim().length > 0
  ) {
    // Resistance + previously adopted = institutional non-cooperation
    // (the institution cooperated once and now refuses).
    if (previouslyAdopted) {
      return {
        kind: 'INSTITUTIONAL_NONCOOPERATION',
        stage: 'PILOT_REGRESSION',
        ambiguous: false,
        reason: s.resistanceEvidence,
        subunitAdoptionRatio,
      };
    }
    return {
      kind: 'OPERATIONAL_RESISTANCE',
      stage: 'NOT_ADOPTED',
      ambiguous: false,
      reason: s.resistanceEvidence,
      subunitAdoptionRatio,
    };
  }

  // Contradictory: deployment not applied but telemetry observed (or vice versa
  // beyond what telemetry alone can satisfy).
  if (!s.deploymentApplied && s.telemetryObserved) {
    return {
      kind: 'AMBIGUOUS_ADOPTION_SIGNAL',
      stage: 'NOT_ADOPTED',
      ambiguous: true,
      reason:
        'Contradictory rollout signals: deployment not applied but telemetry observed. Quarantining as ambiguous.',
      subunitAdoptionRatio,
    };
  }

  // Contradictory: deployment applied but policy drift AND telemetry observed.
  if (s.deploymentApplied && s.telemetryObserved && !policyMatches) {
    return {
      kind: 'POLICY_INCONSISTENCY',
      stage: 'PARTIAL',
      ambiguous: false,
      reason: `Local policy digest ${s.localPolicyDigest.slice(0, 8)}… diverges from canonical ${s.expectedPolicyDigest.slice(0, 8)}…`,
      subunitAdoptionRatio,
    };
  }

  // Deployment applied but no telemetry — telemetry gap.
  if (s.deploymentApplied && !s.telemetryObserved) {
    return {
      kind: 'TELEMETRY_GAP',
      stage: 'PILOT',
      ambiguous: true,
      reason:
        'Deployment marked applied but no telemetry observed in the window — adoption cannot be confirmed.',
      subunitAdoptionRatio,
    };
  }

  // Not deployed and no telemetry: simply not adopted.
  if (!s.deploymentApplied && !s.telemetryObserved) {
    return {
      kind: 'CONFIG_DRIFT',
      stage: 'NOT_ADOPTED',
      ambiguous: false,
      reason: 'Institution has not deployed and no telemetry observed.',
      subunitAdoptionRatio,
    };
  }

  // Deployed + telemetry + policy match — happy path branches by sub-unit ratio.
  if (s.subunitsTotal > 0 && s.subunitsAdopted < s.subunitsTotal) {
    return {
      kind: 'PARTIAL_DEPLOYMENT',
      stage: 'PARTIAL',
      ambiguous: false,
      reason: `${s.subunitsAdopted}/${s.subunitsTotal} sub-units adopted; partial deployment surfaced.`,
      subunitAdoptionRatio,
    };
  }

  return {
    kind: null,
    stage: 'ADOPTED',
    ambiguous: false,
    reason: 'Rollout signals clean: deployment applied, telemetry observed, policy match, full sub-unit adoption.',
    subunitAdoptionRatio,
  };
}

// ── Quarantine builder ────────────────────────────────────────────────────────

/**
 * Build a survivability record for a single institution. Pure — never throws.
 *
 * Use `forcedKind: 'INSTITUTIONAL_NONCOOPERATION'` (or any other concrete
 * kind) to mark an institution CONTAMINATED via lineage even though its own
 * rollout signal is clean (a downstream caller decided the institution's
 * lineage parent is failing).
 */
export function quarantineRollout(input: {
  institutionId: string;
  signal: RolloutSignal;
  lineageHints?: Partial<RolloutLineageHints> | null;
  forcedKind?: RolloutFrictionKind;
  forcedReason?: string;
  previouslyAdopted?: boolean;
}): RolloutSurvivabilityRecord {
  const observedAt = new Date().toISOString();
  const hints = normalizeHints(input.lineageHints);

  // Contamination forced by lineage walker.
  if (input.forcedKind && input.forcedReason && input.forcedKind !== 'AMBIGUOUS_ADOPTION_SIGNAL') {
    const isLineageContamination = input.forcedReason.includes('contaminated via lineage');
    if (isLineageContamination) {
      const verdict: RolloutSurvivabilityVerdict = 'CONTAMINATED';
      const stage: AdoptionStage = 'PILOT_REGRESSION';
      const subunitAdoptionRatio = input.signal.subunitsTotal > 0
        ? clampRatio(input.signal.subunitsAdopted / input.signal.subunitsTotal)
        : (input.signal.deploymentApplied ? 1 : 0);
      return {
        schema: SCHEMA_RECORD,
        institutionId: input.institutionId,
        verdict,
        kind: input.forcedKind,
        stage,
        ambiguous: false,
        reason: input.forcedReason,
        rolloutDigest: rolloutDigest({
          institutionId: input.institutionId,
          verdict,
          kind: input.forcedKind,
          stage,
          signal: input.signal,
        }),
        observedAt,
        lineageHints: hints,
        subunitAdoptionRatio,
      };
    }
  }

  const classified = classifyRollout({
    signal: input.signal,
    previouslyAdopted: input.previouslyAdopted,
  });
  const kind = input.forcedKind ?? classified.kind;
  const reason = input.forcedReason ?? classified.reason;
  const stage = classified.stage;

  let verdict: RolloutSurvivabilityVerdict;
  if (kind === null) {
    verdict = 'SURVIVING';
  } else if (classified.ambiguous || kind === 'AMBIGUOUS_ADOPTION_SIGNAL' || kind === 'TELEMETRY_GAP') {
    verdict = 'AMBIGUOUS_ADOPTION';
  } else if (
    kind === 'OPERATIONAL_RESISTANCE' ||
    kind === 'INSTITUTIONAL_NONCOOPERATION' ||
    kind === 'ROLLBACK'
  ) {
    verdict = 'RESISTANT';
  } else if (kind === 'PARTIAL_DEPLOYMENT' || kind === 'POLICY_INCONSISTENCY') {
    verdict = 'PARTIAL_SURVIVING';
  } else {
    // CONFIG_DRIFT and any future unknown concrete kind treated as resistant
    // (i.e. failed to roll out) rather than a soft partial.
    verdict = 'RESISTANT';
  }

  return {
    schema: SCHEMA_RECORD,
    institutionId: input.institutionId,
    verdict,
    kind,
    stage,
    ambiguous: verdict === 'AMBIGUOUS_ADOPTION',
    reason,
    rolloutDigest: rolloutDigest({
      institutionId: input.institutionId,
      verdict,
      kind,
      stage,
      signal: input.signal,
    }),
    observedAt,
    lineageHints: hints,
    subunitAdoptionRatio: classified.subunitAdoptionRatio,
  };
}

/**
 * Non-throwing variant for call sites that want a verdict object even on
 * internal failure. Mirrors evaluateContainment / evaluateTenantScope.
 *
 * If quarantine construction throws (it never should — pure transform), the
 * record returned is a ROLLOUT_BREACH placeholder so a swallowed error
 * cannot masquerade as SURVIVING.
 */
export function evaluateRollout(input: {
  institutionId: string;
  signal: RolloutSignal;
  lineageHints?: Partial<RolloutLineageHints> | null;
  forcedKind?: RolloutFrictionKind;
  forcedReason?: string;
  previouslyAdopted?: boolean;
}): RolloutSurvivabilityRecord {
  try {
    return quarantineRollout(input);
  } catch (err) {
    const observedAt = new Date().toISOString();
    const hints = normalizeHints(input.lineageHints);
    const kind: RolloutFrictionKind = 'AMBIGUOUS_ADOPTION_SIGNAL';
    const verdict: RolloutSurvivabilityVerdict = 'ROLLOUT_BREACH';
    const stage: AdoptionStage = 'NOT_ADOPTED';
    const reason = `Rollout evaluator failed: ${err instanceof Error ? err.message : String(err)}`;
    return {
      schema: SCHEMA_RECORD,
      institutionId: input.institutionId,
      verdict,
      kind,
      stage,
      ambiguous: false,
      reason,
      rolloutDigest: rolloutDigest({
        institutionId: input.institutionId,
        verdict,
        kind,
        stage,
        signal: input.signal,
      }),
      observedAt,
      lineageHints: hints,
      subunitAdoptionRatio: 0,
    };
  }
}

// ── Boundary computation ──────────────────────────────────────────────────────

/**
 * Compute the rollout boundary for a population of institutions. Pure —
 * never throws.
 *
 * `rolloutSurvivabilityRatio` is the fraction of fully surviving institutions.
 * `partialAdoptionResiliencePct` reports how much of the population survived
 * in an operator-actionable form (surviving + partial-surviving + ambiguous).
 * Failures that vanished from the population entirely do NOT count toward
 * resilience.
 */
export function computeRolloutBoundary(input: {
  totalInstitutions: number;
  records: ReadonlyArray<RolloutSurvivabilityRecord>;
  /** When provided, asserts no breach exceeded the configured percentage. */
  minPartialAdoptionResiliencePct?: number;
}): RolloutBoundary {
  const total = Math.max(0, input.totalInstitutions);
  const records = input.records;
  const surviving        = records.filter(r => r.verdict === 'SURVIVING').length;
  const partialSurviving = records.filter(r => r.verdict === 'PARTIAL_SURVIVING').length;
  const ambiguous        = records.filter(r => r.verdict === 'AMBIGUOUS_ADOPTION').length;
  const resistant        = records.filter(r => r.verdict === 'RESISTANT').length;
  const contaminated     = records.filter(r => r.verdict === 'CONTAMINATED').length;
  const breached         = records.filter(r => r.verdict === 'ROLLOUT_BREACH').length;

  const surfaceObserved = surviving + partialSurviving + ambiguous + resistant + contaminated + breached;
  const denominator = total > 0 ? total : Math.max(1, surfaceObserved);

  const rolloutSurvivabilityRatio = denominator === 0 ? 1 : surviving / denominator;
  const partialAdoptionResiliencePct = denominator === 0
    ? 100
    : ((surviving + partialSurviving + ambiguous) / denominator) * 100;
  const institutionalResistancePct = denominator === 0
    ? 0
    : ((resistant + contaminated) / denominator) * 100;

  // Friction visibility = how much of the population produced an operator-visible,
  // actionable friction signal (ambiguous + partial-surviving + the subset of
  // resistant whose kind is TELEMETRY_GAP-adjacent). For simplicity we count
  // every non-clean, non-breach record as "visible" friction.
  const frictionVisible = partialSurviving + ambiguous + resistant + contaminated;
  const deploymentFrictionVisibilityPct = denominator === 0
    ? 0
    : (frictionVisible / denominator) * 100;

  const minFloor = input.minPartialAdoptionResiliencePct ?? DEFAULT_MIN_PARTIAL_ADOPTION_RESILIENCE_PCT;
  const partitioned = breached === 0 && partialAdoptionResiliencePct >= minFloor;

  const rolloutReason = breached > 0
    ? `Rollout breached on ${breached} institution(s); evaluator-level failure cannot be silently merged with surviving cohort.`
    : partitioned
      ? `Rollout intact — ${surviving}/${denominator} surviving, ${partialSurviving} partial, ${ambiguous} ambiguous, ${resistant} resistant, ${contaminated} contaminated.`
      : `Partial adoption resilience ${partialAdoptionResiliencePct.toFixed(2)}% below floor ${minFloor}%; rollout cannot certify partial-cohort survival.`;

  const boundaryDigest = sha256ForPayload({
    schema: SCHEMA_BOUNDARY,
    totalInstitutions: total,
    surviving,
    partialSurviving,
    ambiguous,
    resistant,
    contaminated,
    breached,
    rolloutDigests: records
      .map(r => r.rolloutDigest)
      .slice()
      .sort(),
  });

  return {
    schema: SCHEMA_BOUNDARY,
    partitioned,
    totalInstitutions: total,
    survivingCount: surviving,
    partialSurvivingCount: partialSurviving,
    ambiguousCount: ambiguous,
    resistantCount: resistant,
    contaminatedCount: contaminated,
    rolloutSurvivabilityRatio,
    partialAdoptionResiliencePct,
    institutionalResistancePct,
    deploymentFrictionVisibilityPct,
    rolloutReason,
    boundaryDigest,
    partitionedAt: new Date().toISOString(),
  };
}

/**
 * Strict variant — throws RolloutSurvivabilityError if the boundary is
 * breached or partial adoption resilience is below the configured floor.
 */
export function assertRolloutBoundary(
  boundary: RolloutBoundary,
  options: { minPartialAdoptionResiliencePct?: number } = {},
): void {
  const minFloor = options.minPartialAdoptionResiliencePct ?? DEFAULT_MIN_PARTIAL_ADOPTION_RESILIENCE_PCT;

  if (!boundary.partitioned) {
    if (boundary.partialAdoptionResiliencePct < minFloor) {
      throw new RolloutSurvivabilityError({
        violation: 'PARTIAL_ROLLOUT_FLOOR_BREACHED',
        message: `Partial adoption resilience ${boundary.partialAdoptionResiliencePct.toFixed(2)}% below floor ${minFloor}%.`,
        survivingPct: boundary.partialAdoptionResiliencePct,
      });
    }
    throw new RolloutSurvivabilityError({
      violation: 'BOUNDARY_BREACH',
      message: boundary.rolloutReason,
      survivingPct: boundary.partialAdoptionResiliencePct,
    });
  }
}

/**
 * Hard-fail guard for the "ambiguous adoption forced surviving" anti-pattern.
 * Catches a future regression that would coerce an AMBIGUOUS_ADOPTION verdict
 * back to SURVIVING — the kind of silent collapse this PR exists to prevent.
 */
export function assertAdoptionAmbiguityPreserved(record: RolloutSurvivabilityRecord): void {
  if (record.ambiguous && record.verdict !== 'AMBIGUOUS_ADOPTION') {
    throw new RolloutSurvivabilityError({
      violation: 'AMBIGUOUS_ADOPTION_FORCED_SURVIVING',
      message: `Rollout record for ${record.institutionId} flagged ambiguous but verdict ${record.verdict} discards uncertainty.`,
      institutionId: record.institutionId,
      kind: record.kind,
    });
  }
  if (record.verdict === 'SURVIVING' && record.kind !== null) {
    throw new RolloutSurvivabilityError({
      violation: 'AMBIGUOUS_ADOPTION_FORCED_SURVIVING',
      message: `Rollout record for ${record.institutionId} marked SURVIVING but carries kind ${record.kind} — friction discarded.`,
      institutionId: record.institutionId,
      kind: record.kind,
    });
  }
}

// ── Lineage reconstruction ────────────────────────────────────────────────────

/**
 * Trace a friction lineage from a single resistant root through a set of
 * candidate institutions. Pure — never throws. An edge is emitted whenever a
 * candidate shares one of the root's lineage hints (parentOrgId,
 * policyBundleId, or deploymentManifestId).
 *
 * The reconstruction digest hashes the deterministic shape of the lineage so
 * downstream consumers can assert it has not been silently rewritten.
 */
export function traceFrictionLineage(input: {
  rootInstitutionId: string;
  rootHints: Partial<RolloutLineageHints>;
  candidates: ReadonlyArray<{ institutionId: string; hints: Partial<RolloutLineageHints> }>;
}): RolloutFrictionLineage {
  const root = normalizeHints(input.rootHints);
  const reconstructedAt = new Date().toISOString();
  const edges: RolloutFrictionEdge[] = [];
  const contaminatedSet = new Set<string>();

  for (const c of input.candidates) {
    if (c.institutionId === input.rootInstitutionId) continue;
    const cand = normalizeHints(c.hints);
    let edged = false;

    if (root.parentOrgId !== null && cand.parentOrgId === root.parentOrgId) {
      edges.push({
        fromInstitutionId: input.rootInstitutionId,
        toInstitutionId: c.institutionId,
        reason: 'SHARED_PARENT_ORG',
      });
      edged = true;
    }
    if (root.policyBundleId !== null && cand.policyBundleId === root.policyBundleId) {
      edges.push({
        fromInstitutionId: input.rootInstitutionId,
        toInstitutionId: c.institutionId,
        reason: 'SHARED_POLICY_BUNDLE',
      });
      edged = true;
    }
    if (
      root.deploymentManifestId !== null &&
      cand.deploymentManifestId === root.deploymentManifestId
    ) {
      edges.push({
        fromInstitutionId: input.rootInstitutionId,
        toInstitutionId: c.institutionId,
        reason: 'SHARED_DEPLOYMENT_MANIFEST',
      });
      edged = true;
    }
    if (edged) contaminatedSet.add(c.institutionId);
  }

  const contaminated = [...contaminatedSet].sort();
  const sortedEdges = edges
    .slice()
    .sort((a, b) =>
      a.toInstitutionId.localeCompare(b.toInstitutionId) || a.reason.localeCompare(b.reason),
    );

  const reconstructionDigest = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    rootInstitutionId: input.rootInstitutionId,
    contaminated,
    edges: sortedEdges,
  });

  return {
    schema: SCHEMA_LINEAGE,
    rootInstitutionId: input.rootInstitutionId,
    contaminatedInstitutionIds: contaminated,
    edges: sortedEdges,
    reconstructionDigest,
    reconstructedAt,
  };
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const ROLLOUT_SURVIVABILITY_SENTINELS = Object.freeze({
  DEFAULT_MIN_PARTIAL_ADOPTION_RESILIENCE_PCT,
  SCHEMA_RECORD,
  SCHEMA_BOUNDARY,
  SCHEMA_LINEAGE,
});

export const KNOWN_ROLLOUT_VERDICTS = Object.freeze([
  'SURVIVING',
  'PARTIAL_SURVIVING',
  'AMBIGUOUS_ADOPTION',
  'RESISTANT',
  'CONTAMINATED',
  'ROLLOUT_BREACH',
] as const);

export const KNOWN_ROLLOUT_FRICTION_KINDS = Object.freeze([
  'CONFIG_DRIFT',
  'POLICY_INCONSISTENCY',
  'OPERATIONAL_RESISTANCE',
  'PARTIAL_DEPLOYMENT',
  'INSTITUTIONAL_NONCOOPERATION',
  'ROLLBACK',
  'TELEMETRY_GAP',
  'AMBIGUOUS_ADOPTION_SIGNAL',
] as const);

export const KNOWN_ROLLOUT_VIOLATIONS = Object.freeze([
  'AMBIGUOUS_ADOPTION_FORCED_SURVIVING',
  'BOUNDARY_BREACH',
  'PARTIAL_ROLLOUT_FLOOR_BREACHED',
  'RESISTANCE_OPEN_FAILURE',
] as const);

export const KNOWN_ADOPTION_STAGES = Object.freeze([
  'NOT_ADOPTED',
  'PILOT',
  'PARTIAL',
  'ADOPTED',
  'PILOT_REGRESSION',
  'ABANDONED',
] as const);
