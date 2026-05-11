/**
 * governanceStewardship.ts — W2-PR154A: Institutional Governance Stewardship Protocol
 *
 * Pure transforms formalizing longitudinal governance stewardship for
 * constitutional runtime continuity. Goal: ensure caretaker continuity is
 * measurable, governance lineage is reconstructable, succession safeguards
 * are fail-closed, and the institutional runtime survives longitudinally —
 * without ever silently dressing a degraded caretaker as "stewardship healthy".
 *
 * Companion module to:
 *   - governanceRuntimeHardening.ts  (production-runtime survivability axis)
 *   - replayCorruptionContainment.ts (replay-corruption axis)
 *   - multi-tenant/tenantIsolation.ts (tenant axis)
 *   - rollout/rolloutSurvivability.ts (institutional adoption axis)
 *
 * Same shape, same fail-closed contract, different axis: longitudinal
 * governance stewardship — caretaker continuity, succession safeguards,
 * replay-governance caretaking, and institutional runtime stability over time.
 *
 * Hard invariants (fail-closed):
 *   - A degraded caretaker tier is QUARANTINED, never silently merged with
 *     the active population. Ambiguous stewardship signals (caretaker
 *     continuity below threshold but no explicit fault evidence) are preserved
 *     as AMBIGUOUS_STEWARDSHIP, never coerced to ACTIVE.
 *   - When the active stewardship population falls below the configured
 *     continuity floor, the boundary raises CARETAKER_CONTINUITY_FLOOR_BREACH
 *     so the operator sees the breach — never a partial cohort dressed as
 *     fully stewarded.
 *   - Stewardship records carry deterministic, tamper-evident stewardshipDigests
 *     so a forged "active" record cannot replace a real fault-caretaking signal.
 *   - Stewardship lineage is reconstructable longitudinally: every caretaking
 *     record carries the hints needed to walk back to the offending caretaker
 *     pool, replay governance shard, or succession scope.
 *   - Succession protocol is fail-closed: if succession readiness falls below
 *     threshold when succession is pending confirmation, SUCCESSION_THRESHOLD_BREACH
 *     is raised — never a silent hand-off to an unready caretaker.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the
 * boundary checker; runtime dashboards and the W2-PR154A CI gate call it.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

/** What kind of stewardship issue the caretaking signal is reporting. */
export type StewardshipKind =
  | 'CARETAKER_CONTINUITY_DRIFT'       // caretaker continuity score below threshold
  | 'REPLAY_GOVERNANCE_DRIFT'          // replay drift exceeding governance budget
  | 'SUCCESSION_PROTOCOL_BREACH'       // readiness below threshold when succession pending
  | 'GOVERNANCE_LINEAGE_BREAK'         // lineage depth below reconstructable target
  | 'INSTITUTIONAL_STABILITY_COLLAPSE' // institutional runtime stability floor violated
  | 'AMBIGUOUS_CARETAKER_SIGNAL';      // signals contradict — preserve uncertainty

/** Stewardship verdict for a single caretaking shard. */
export type StewardshipVerdict =
  | 'ACTIVE'                        // caretaker functioning, lineage intact
  | 'CARETAKER_CONTINUITY_BREACH'   // caretaker continuity score below threshold
  | 'SUCCESSION_TRIGGERED'          // succession protocol activated and confirmed
  | 'SUCCESSION_PENDING'            // succession underway — readiness not yet confirmed
  | 'AMBIGUOUS_STEWARDSHIP'         // contradictory signals — operator review required
  | 'GOVERNANCE_LINEAGE_BREAK'      // lineage depth below reconstructable target
  | 'INSTITUTIONAL_STABILITY_BREACH'; // institutional runtime stability floor violated

/** Tier classification of a stewardship shard. */
export type StewardshipTier =
  | 'INSTITUTIONAL'   // all scores healthy, full stewardship active
  | 'CARETAKER'       // caretaker operating within tolerance, some drift
  | 'DEGRADED'        // caretaking degraded — drift or continuity breach
  | 'SUCCESSION'      // succession protocol active
  | 'AMBIGUOUS';      // contradictory signals — cannot classify

export type StewardshipViolationKind =
  | 'AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE'
  | 'SUCCESSION_THRESHOLD_BREACH'
  | 'CARETAKER_CONTINUITY_FLOOR_BREACH'
  | 'REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE';

// ── Sentinels ─────────────────────────────────────────────────────────────────

export const KNOWN_STEWARDSHIP_VERDICTS: readonly StewardshipVerdict[] = Object.freeze([
  'ACTIVE',
  'CARETAKER_CONTINUITY_BREACH',
  'SUCCESSION_TRIGGERED',
  'SUCCESSION_PENDING',
  'AMBIGUOUS_STEWARDSHIP',
  'GOVERNANCE_LINEAGE_BREAK',
  'INSTITUTIONAL_STABILITY_BREACH',
] as const);

export const KNOWN_STEWARDSHIP_KINDS: readonly StewardshipKind[] = Object.freeze([
  'CARETAKER_CONTINUITY_DRIFT',
  'REPLAY_GOVERNANCE_DRIFT',
  'SUCCESSION_PROTOCOL_BREACH',
  'GOVERNANCE_LINEAGE_BREAK',
  'INSTITUTIONAL_STABILITY_COLLAPSE',
  'AMBIGUOUS_CARETAKER_SIGNAL',
] as const);

export const KNOWN_STEWARDSHIP_TIERS: readonly StewardshipTier[] = Object.freeze([
  'INSTITUTIONAL',
  'CARETAKER',
  'DEGRADED',
  'SUCCESSION',
  'AMBIGUOUS',
] as const);

export const KNOWN_STEWARDSHIP_VIOLATIONS: readonly StewardshipViolationKind[] = Object.freeze([
  'AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE',
  'SUCCESSION_THRESHOLD_BREACH',
  'CARETAKER_CONTINUITY_FLOOR_BREACH',
  'REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE',
] as const);

export const STEWARDSHIP_SENTINELS = Object.freeze({
  MIN_CARETAKER_CONTINUITY_FLOOR_PCT: 70,
  SUCCESSION_READINESS_THRESHOLD: 0.75,
  GOVERNANCE_LINEAGE_MIN_DEPTH: 3,
  REPLAY_GOVERNANCE_DRIFT_SPIKE_RATIO: 5.0,
} as const);

// ── Error class ───────────────────────────────────────────────────────────────

export class StewardshipError extends Error {
  readonly code = 'STEWARDSHIP_VIOLATION' as const;
  readonly violation: StewardshipViolationKind;
  readonly shardId: string | null;
  readonly kind: StewardshipKind | null;
  readonly partialContinuityPct: number | null;

  constructor(args: {
    violation: StewardshipViolationKind;
    message: string;
    shardId?: string | null;
    kind?: StewardshipKind | null;
    partialContinuityPct?: number | null;
  }) {
    super(args.message);
    this.name = 'StewardshipError';
    this.violation = args.violation;
    this.shardId = args.shardId ?? null;
    this.kind = args.kind ?? null;
    this.partialContinuityPct = args.partialContinuityPct ?? null;
  }
}

// ── Signal / Record shapes ────────────────────────────────────────────────────

/**
 * Observable metrics about a single governance caretaker shard.
 * Callers populate this from their monitoring / telemetry layer.
 */
export interface StewardshipSignal {
  /** 0–1 composite score reflecting how faithfully the caretaker tracks governance intent. */
  caretakerContinuityScore: number;
  /** Minimum continuity score below which caretaking is considered degraded. */
  caretakerContinuityThreshold: number;
  /** Observed replay governance drift (dimensionless ratio vs. ground truth). */
  replayGovernanceDrift: number;
  /** Maximum allowed replay governance drift before raising a kind. */
  replayGovernanceDriftBudget: number;
  /** 0–1 readiness score for the next caretaker in the succession chain. */
  successionReadinessScore: number;
  /** Minimum readiness score required before succession can be confirmed safe. */
  successionActivationThreshold: number;
  /** How many caretaker generations back governance lineage can be reconstructed. */
  governanceLineageDepth: number;
  /** Minimum required lineage depth for the institutional governance contract. */
  governanceLineageTarget: number;
  /** 0–1 composite institutional runtime stability score. */
  institutionalRuntimeStability: number;
  /** Minimum institutional stability below which the stability floor is violated. */
  institutionalStabilityFloor: number;
  /** True iff succession has been triggered and awaits confirmation. */
  successionPendingConfirmation: boolean;
  /** True iff contradictory signals were detected at the caretaker level. */
  caretakerAmbiguityDetected: boolean;
  /** Operator-observed stewardship evidence text — null when none. */
  stewardshipEvidence: string | null;
}

export interface StewardshipLineageHints {
  /** Caretaker pool the shard belongs to. */
  caretakerPoolId: string | null;
  /** Replay governance shard id. */
  replayGovernanceShardId: string | null;
  /** Succession scope id (which succession chain this shard participates in). */
  successionScopeId: string | null;
}

export interface StewardshipCaretakingRecord {
  schema: 'vitalcv.governance-stewardship.v1';
  shardId: string;
  verdict: StewardshipVerdict;
  /** Null when verdict === 'ACTIVE'. */
  kind: StewardshipKind | null;
  tier: StewardshipTier;
  /** True iff verdict === 'AMBIGUOUS_STEWARDSHIP'. Mirrored for fast filtering. */
  ambiguous: boolean;
  reason: string;
  /** SHA-256 over (shardId, verdict, kind, tier, signal). Tamper-evident boundary. */
  stewardshipDigest: string;
  caretakedAt: string;
  lineageHints: StewardshipLineageHints;
  /** 0–1 caretaker continuity score as observed at caretaking time. */
  caretakerContinuityScore: number;
  /** 0–1 succession readiness score as observed at caretaking time. */
  successionReadinessScore: number;
  /** 0–1 institutional runtime stability as observed at caretaking time. */
  institutionalRuntimeStability: number;
  /** Lineage depth as observed at caretaking time. */
  governanceLineageDepth: number;
}

export interface StewardshipBoundary {
  schema: 'vitalcv.governance-stewardship-boundary.v1';
  /** True iff stewardship is intact — no continuity floor breach, ambiguity preserved as flag. */
  partitioned: boolean;
  totalShards: number;
  activeCount: number;
  continuityBreachCount: number;
  successionCount: number;
  ambiguousCount: number;
  lineageBreakCount: number;
  stabilityBreachCount: number;
  /** active / total — 1.0 when every shard is fully active. */
  stewardshipContinuityRatio: number;
  /**
   * (active + caretaker-tier + ambiguous) / total * 100 —
   * what is operator-visible and actionable. Stability breach + lineage break
   * do NOT count toward continuity.
   */
  partialContinuityPct: number;
  /** (ambiguous + continuity-breach + succession-pending) / total * 100 — drift visibility. */
  stewardshipDriftVisibilityPct: number;
  /** 0–1 mean institutional runtime stability across all records. */
  meanInstitutionalStability: number;
  /** 0–1 mean succession readiness across all records. */
  meanSuccessionReadiness: number;
  /** Depth of the shortest lineage across all records. */
  minGovernanceLineageDepth: number;
  boundaryReason: string;
  boundaryDigest: string;
  partitionedAt: string;
}

export interface StewardshipLineageEdge {
  fromShardId: string;
  toShardId: string;
  reason: 'SHARED_CARETAKER_POOL' | 'SHARED_REPLAY_GOVERNANCE_SHARD' | 'SHARED_SUCCESSION_SCOPE';
}

export interface StewardshipLineage {
  schema: 'vitalcv.governance-stewardship-lineage.v1';
  rootShardId: string;
  /** Shards contaminated via the root's lineage hints. Excludes the root. */
  affectedShardIds: string[];
  edges: StewardshipLineageEdge[];
  /** SHA-256 over (rootShardId, sorted affected ids, sorted edges). */
  reconstructionDigest: string;
  reconstructedAt: string;
}

/** Telemetry record emitted for the stewardship board (console.log line). */
export interface StewardshipTelemetryRecord {
  schema: 'vitalcv.stewardship-telemetry.v1';
  shardId: string;
  caretakerContinuityPct: number;
  successionReadinessPct: number;
  institutionalStabilityPct: number;
  governanceLineageDepth: number;
  replayGovernanceDrift: number;
  verdict: StewardshipVerdict;
  tier: StewardshipTier;
  ambiguous: boolean;
  emittedAt: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const SCHEMA_RECORD   = 'vitalcv.governance-stewardship.v1' as const;
const SCHEMA_BOUNDARY = 'vitalcv.governance-stewardship-boundary.v1' as const;
const SCHEMA_LINEAGE  = 'vitalcv.governance-stewardship-lineage.v1' as const;
const SCHEMA_TELEMETRY = 'vitalcv.stewardship-telemetry.v1' as const;

const DEFAULT_MIN_PARTIAL_CONTINUITY_PCT = 70;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeScore(observed: number, threshold: number): boolean {
  if (!Number.isFinite(observed) || !Number.isFinite(threshold)) return false;
  return observed >= threshold;
}

function safeDriftOk(drift: number, budget: number): boolean {
  if (!Number.isFinite(drift) || !Number.isFinite(budget)) return false;
  if (budget <= 0) return false;
  return drift <= budget;
}

function normalizeLineageHints(
  hints: Partial<StewardshipLineageHints> | undefined | null,
): StewardshipLineageHints {
  return {
    caretakerPoolId:
      typeof hints?.caretakerPoolId === 'string' && hints.caretakerPoolId.trim().length > 0
        ? hints.caretakerPoolId.trim()
        : null,
    replayGovernanceShardId:
      typeof hints?.replayGovernanceShardId === 'string' &&
      hints.replayGovernanceShardId.trim().length > 0
        ? hints.replayGovernanceShardId.trim()
        : null,
    successionScopeId:
      typeof hints?.successionScopeId === 'string' && hints.successionScopeId.trim().length > 0
        ? hints.successionScopeId.trim()
        : null,
  };
}

// ── Digest ────────────────────────────────────────────────────────────────────

export function stewardshipDigest(input: {
  shardId: string;
  verdict: StewardshipVerdict;
  kind: StewardshipKind | null;
  tier: StewardshipTier;
  signal: StewardshipSignal;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.stewardship-digest.v1',
    shardId: input.shardId,
    verdict: input.verdict,
    kind: input.kind,
    tier: input.tier,
    signal: {
      caretakerContinuityScore: input.signal.caretakerContinuityScore,
      caretakerContinuityThreshold: input.signal.caretakerContinuityThreshold,
      replayGovernanceDrift: input.signal.replayGovernanceDrift,
      replayGovernanceDriftBudget: input.signal.replayGovernanceDriftBudget,
      successionReadinessScore: input.signal.successionReadinessScore,
      successionActivationThreshold: input.signal.successionActivationThreshold,
      governanceLineageDepth: input.signal.governanceLineageDepth,
      governanceLineageTarget: input.signal.governanceLineageTarget,
      institutionalRuntimeStability: input.signal.institutionalRuntimeStability,
      institutionalStabilityFloor: input.signal.institutionalStabilityFloor,
      successionPendingConfirmation: input.signal.successionPendingConfirmation,
      caretakerAmbiguityDetected: input.signal.caretakerAmbiguityDetected,
      stewardshipEvidence: input.signal.stewardshipEvidence ?? null,
    },
  });
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Pure classifier — given a stewardship signal, return the fault kind, tier,
 * ambiguity flag, and a human-readable reason.
 *
 * Fail-closed table (evaluated in priority order):
 *
 *   ambiguity  | succession  | continuity | lineage | stability | result
 *   -----------+-------------+------------+---------+-----------+----------------------
 *   detected   | *           | *          | *       | *         | AMBIGUOUS_CARETAKER_SIGNAL
 *   *          | pending,low | *          | *       | *         | SUCCESSION_PROTOCOL_BREACH
 *   *          | pending,ok  | *          | *       | *         | SUCCESSION_TRIGGERED → PENDING
 *   *          | triggered   | *          | *       | *         | SUCCESSION_TRIGGERED
 *   ok         | no          | low        | *       | *         | CARETAKER_CONTINUITY_DRIFT
 *   ok         | no          | ok         | broken  | *         | GOVERNANCE_LINEAGE_BREAK
 *   ok         | no          | ok         | ok      | low       | INSTITUTIONAL_STABILITY_COLLAPSE
 *   ok         | no          | ok         | ok      | ok        | null (ACTIVE)
 */
export function classifyStewardshipFault(signal: StewardshipSignal): {
  kind: StewardshipKind | null;
  tier: StewardshipTier;
  ambiguous: boolean;
  reason: string;
} {
  const evidence = signal.stewardshipEvidence ?? null;
  const evidencePresent = typeof evidence === 'string' && evidence.trim().length > 0;

  // Caretaker ambiguity is the highest-priority flag — contradictory signals
  // cannot be resolved by any single-axis classifier.
  if (signal.caretakerAmbiguityDetected) {
    return {
      kind: 'AMBIGUOUS_CARETAKER_SIGNAL',
      tier: 'AMBIGUOUS',
      ambiguous: true,
      reason: evidencePresent
        ? `Contradictory caretaker signals detected — ${evidence}. Operator review required.`
        : 'Contradictory caretaker signals detected. Operator review required before succession.',
    };
  }

  const continuityOk = safeScore(
    signal.caretakerContinuityScore,
    signal.caretakerContinuityThreshold,
  );
  const driftOk = safeDriftOk(
    signal.replayGovernanceDrift,
    signal.replayGovernanceDriftBudget,
  );
  const lineageOk =
    Number.isFinite(signal.governanceLineageDepth) &&
    Number.isFinite(signal.governanceLineageTarget) &&
    signal.governanceLineageDepth >= signal.governanceLineageTarget;
  const stabilityOk = safeScore(
    signal.institutionalRuntimeStability,
    signal.institutionalStabilityFloor,
  );

  // Succession protocol — evaluated before continuity because a succession in
  // progress supersedes continuity classification.
  if (signal.successionPendingConfirmation) {
    const readinessOk = safeScore(
      signal.successionReadinessScore,
      signal.successionActivationThreshold,
    );
    if (!readinessOk) {
      return {
        kind: 'SUCCESSION_PROTOCOL_BREACH',
        tier: 'SUCCESSION',
        ambiguous: false,
        reason:
          `Succession pending but readiness score ${signal.successionReadinessScore.toFixed(3)} ` +
          `is below activation threshold ${signal.successionActivationThreshold.toFixed(3)}. ` +
          'Fail-closed: succession must not proceed until readiness is confirmed.',
      };
    }
    return {
      kind: null,
      tier: 'SUCCESSION',
      ambiguous: false,
      reason:
        `Succession pending confirmation — readiness ${signal.successionReadinessScore.toFixed(3)} ` +
        `meets threshold ${signal.successionActivationThreshold.toFixed(3)}.`,
    };
  }

  // Caretaker continuity — includes replay governance drift as a contributing factor.
  if (!continuityOk || !driftOk) {
    const driftRatio =
      signal.replayGovernanceDriftBudget > 0
        ? (signal.replayGovernanceDrift / signal.replayGovernanceDriftBudget).toFixed(2)
        : '∞';
    if (!continuityOk && !driftOk) {
      return {
        kind: 'CARETAKER_CONTINUITY_DRIFT',
        tier: 'DEGRADED',
        ambiguous: false,
        reason:
          `Caretaker continuity ${signal.caretakerContinuityScore.toFixed(3)} below ` +
          `threshold ${signal.caretakerContinuityThreshold.toFixed(3)} and replay ` +
          `governance drift at ${driftRatio}x budget. Stewardship degraded on both axes.`,
      };
    }
    if (!continuityOk) {
      return {
        kind: 'CARETAKER_CONTINUITY_DRIFT',
        tier: 'CARETAKER',
        ambiguous: false,
        reason:
          `Caretaker continuity score ${signal.caretakerContinuityScore.toFixed(3)} ` +
          `is below threshold ${signal.caretakerContinuityThreshold.toFixed(3)}.`,
      };
    }
    return {
      kind: 'REPLAY_GOVERNANCE_DRIFT',
      tier: 'CARETAKER',
      ambiguous: false,
      reason:
        `Replay governance drift at ${driftRatio}x of budget ` +
        `(observed ${signal.replayGovernanceDrift}, budget ${signal.replayGovernanceDriftBudget}).`,
    };
  }

  // Governance lineage depth.
  if (!lineageOk) {
    return {
      kind: 'GOVERNANCE_LINEAGE_BREAK',
      tier: 'DEGRADED',
      ambiguous: false,
      reason:
        `Governance lineage depth ${signal.governanceLineageDepth} ` +
        `is below required target ${signal.governanceLineageTarget}. ` +
        'Longitudinal lineage reconstruction may be incomplete.',
    };
  }

  // Institutional runtime stability.
  if (!stabilityOk) {
    return {
      kind: 'INSTITUTIONAL_STABILITY_COLLAPSE',
      tier: 'DEGRADED',
      ambiguous: false,
      reason:
        `Institutional runtime stability ${signal.institutionalRuntimeStability.toFixed(3)} ` +
        `is below floor ${signal.institutionalStabilityFloor.toFixed(3)}.`,
    };
  }

  // All signals healthy — but check for evidence contradiction.
  if (evidencePresent) {
    return {
      kind: 'AMBIGUOUS_CARETAKER_SIGNAL',
      tier: 'AMBIGUOUS',
      ambiguous: true,
      reason: `Contradiction: all scores healthy but stewardship evidence present — ${evidence}`,
    };
  }

  return {
    kind: null,
    tier: 'INSTITUTIONAL',
    ambiguous: false,
    reason: 'All stewardship signals within bounds; caretaker continuity is active.',
  };
}

// ── Caretaking record constructor ─────────────────────────────────────────────

/**
 * Classify a stewardship signal into a caretaking record.
 * The record is tamper-evident and carries all lineage hints needed for
 * longitudinal reconstruction.
 */
export function caretakeStewardshipShard(args: {
  shardId: string;
  signal: StewardshipSignal;
  lineageHints?: Partial<StewardshipLineageHints> | null;
}): StewardshipCaretakingRecord {
  const { kind, tier, ambiguous, reason } = classifyStewardshipFault(args.signal);

  const verdict: StewardshipVerdict = (() => {
    if (ambiguous) return 'AMBIGUOUS_STEWARDSHIP';
    if (kind === null && tier === 'SUCCESSION') return 'SUCCESSION_TRIGGERED';
    if (kind === null) return 'ACTIVE';
    if (kind === 'SUCCESSION_PROTOCOL_BREACH') return 'SUCCESSION_PENDING';
    if (tier === 'SUCCESSION') return 'SUCCESSION_TRIGGERED';
    if (kind === 'CARETAKER_CONTINUITY_DRIFT' || kind === 'REPLAY_GOVERNANCE_DRIFT')
      return 'CARETAKER_CONTINUITY_BREACH';
    if (kind === 'GOVERNANCE_LINEAGE_BREAK') return 'GOVERNANCE_LINEAGE_BREAK';
    if (kind === 'INSTITUTIONAL_STABILITY_COLLAPSE') return 'INSTITUTIONAL_STABILITY_BREACH';
    return 'CARETAKER_CONTINUITY_BREACH';
  })();

  return {
    schema: SCHEMA_RECORD,
    shardId: args.shardId,
    verdict,
    kind,
    tier,
    ambiguous,
    reason,
    stewardshipDigest: stewardshipDigest({ shardId: args.shardId, verdict, kind, tier, signal: args.signal }),
    caretakedAt: new Date().toISOString(),
    lineageHints: normalizeLineageHints(args.lineageHints),
    caretakerContinuityScore: clampScore(args.signal.caretakerContinuityScore),
    successionReadinessScore: clampScore(args.signal.successionReadinessScore),
    institutionalRuntimeStability: clampScore(args.signal.institutionalRuntimeStability),
    governanceLineageDepth: Math.max(0, Math.floor(args.signal.governanceLineageDepth ?? 0)),
  };
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

/**
 * Emit a `[stewardship-board]` telemetry line for the given record.
 * The CI gate's "Surface stewardship board" step greps for this tag.
 * Pure side-effect; callers decide when to invoke.
 */
export function emitStewardshipTelemetry(record: StewardshipCaretakingRecord): StewardshipTelemetryRecord {
  const telemetry: StewardshipTelemetryRecord = {
    schema: SCHEMA_TELEMETRY,
    shardId: record.shardId,
    caretakerContinuityPct: Math.round(record.caretakerContinuityScore * 100),
    successionReadinessPct: Math.round(record.successionReadinessScore * 100),
    institutionalStabilityPct: Math.round(record.institutionalRuntimeStability * 100),
    governanceLineageDepth: record.governanceLineageDepth,
    replayGovernanceDrift: 0,
    verdict: record.verdict,
    tier: record.tier,
    ambiguous: record.ambiguous,
    emittedAt: record.caretakedAt,
  };
  console.log(
    '[stewardship-board]',
    JSON.stringify({
      shardId: telemetry.shardId,
      continuityPct: telemetry.caretakerContinuityPct,
      successionReadinessPct: telemetry.successionReadinessPct,
      stabilityPct: telemetry.institutionalStabilityPct,
      lineageDepth: telemetry.governanceLineageDepth,
      verdict: telemetry.verdict,
      tier: telemetry.tier,
    }),
  );
  return telemetry;
}

// ── Boundary ──────────────────────────────────────────────────────────────────

/**
 * Aggregate caretaking records into a stewardship boundary.
 * Exposed for composing multi-shard stewardship assessments.
 */
export function computeStewardshipBoundary(args: {
  totalShards: number;
  records: StewardshipCaretakingRecord[];
  minPartialContinuityPct?: number;
}): StewardshipBoundary {
  const {
    totalShards,
    records,
    minPartialContinuityPct = DEFAULT_MIN_PARTIAL_CONTINUITY_PCT,
  } = args;

  const activeCount = records.filter((r) => r.verdict === 'ACTIVE').length;
  const continuityBreachCount = records.filter(
    (r) => r.verdict === 'CARETAKER_CONTINUITY_BREACH',
  ).length;
  const successionCount = records.filter(
    (r) => r.verdict === 'SUCCESSION_TRIGGERED' || r.verdict === 'SUCCESSION_PENDING',
  ).length;
  const ambiguousCount = records.filter((r) => r.verdict === 'AMBIGUOUS_STEWARDSHIP').length;
  const lineageBreakCount = records.filter((r) => r.verdict === 'GOVERNANCE_LINEAGE_BREAK').length;
  const stabilityBreachCount = records.filter(
    (r) => r.verdict === 'INSTITUTIONAL_STABILITY_BREACH',
  ).length;

  const total = Math.max(1, totalShards);
  const stewardshipContinuityRatio = activeCount / total;
  const partialContinuityPct =
    ((activeCount + ambiguousCount + successionCount) / total) * 100;
  const stewardshipDriftVisibilityPct =
    ((ambiguousCount + continuityBreachCount + successionCount) / total) * 100;

  const meanInstitutionalStability =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.institutionalRuntimeStability, 0) / records.length
      : 1;
  const meanSuccessionReadiness =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.successionReadinessScore, 0) / records.length
      : 1;
  const minGovernanceLineageDepth =
    records.length > 0
      ? Math.min(...records.map((r) => r.governanceLineageDepth))
      : 0;

  const hasBreach =
    lineageBreakCount > 0 ||
    stabilityBreachCount > 0 ||
    records.some((r) => r.verdict === 'SUCCESSION_PENDING');
  const partitioned = !hasBreach && partialContinuityPct >= minPartialContinuityPct;

  const boundaryReason = partitioned
    ? `Stewardship boundary intact: ${activeCount}/${totalShards} shards active, ` +
      `continuity ${stewardshipContinuityRatio.toFixed(3)}.`
    : hasBreach
      ? `Stewardship boundary breached: lineageBreaks=${lineageBreakCount}, ` +
        `stabilityBreaches=${stabilityBreachCount}, successionPending=${successionCount > 0}.`
      : `Partial continuity ${partialContinuityPct.toFixed(1)}% below floor ${minPartialContinuityPct}%.`;

  const boundaryDigest = sha256ForPayload({
    schema: 'vitalcv.stewardship-boundary-digest.v1',
    totalShards,
    activeCount,
    continuityBreachCount,
    successionCount,
    ambiguousCount,
    lineageBreakCount,
    stabilityBreachCount,
    partitioned,
    minPartialContinuityPct,
  });

  return {
    schema: SCHEMA_BOUNDARY,
    partitioned,
    totalShards,
    activeCount,
    continuityBreachCount,
    successionCount,
    ambiguousCount,
    lineageBreakCount,
    stabilityBreachCount,
    stewardshipContinuityRatio,
    partialContinuityPct,
    stewardshipDriftVisibilityPct,
    meanInstitutionalStability,
    meanSuccessionReadiness,
    minGovernanceLineageDepth,
    boundaryReason,
    boundaryDigest,
    partitionedAt: new Date().toISOString(),
  };
}

// ── Assertions (fail-closed) ──────────────────────────────────────────────────

/**
 * Assert that an ambiguous caretaking record was NOT coerced to ACTIVE.
 * Throws StewardshipError(AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE) if the record
 * is ambiguous but the verdict was silently resolved to ACTIVE.
 */
export function assertAmbiguityPreserved(record: StewardshipCaretakingRecord): void {
  if (record.ambiguous && record.verdict === 'ACTIVE') {
    throw new StewardshipError({
      violation: 'AMBIGUOUS_STEWARDSHIP_FORCED_ACTIVE',
      message:
        `Stewardship ambiguity was coerced to ACTIVE for shard '${record.shardId}'. ` +
        'Ambiguous signals must be preserved as AMBIGUOUS_STEWARDSHIP.',
      shardId: record.shardId,
      kind: record.kind,
    });
  }
}

/**
 * Assert that a succession record is not pending with an under-threshold
 * readiness score. Throws StewardshipError(SUCCESSION_THRESHOLD_BREACH) if
 * succession is pending but readiness is insufficient.
 */
export function assertSuccessionReadiness(
  record: StewardshipCaretakingRecord,
  signal: StewardshipSignal,
): void {
  if (
    record.verdict === 'SUCCESSION_PENDING' &&
    signal.successionReadinessScore < signal.successionActivationThreshold
  ) {
    throw new StewardshipError({
      violation: 'SUCCESSION_THRESHOLD_BREACH',
      message:
        `Succession pending for shard '${record.shardId}' but readiness ` +
        `${signal.successionReadinessScore.toFixed(3)} is below activation threshold ` +
        `${signal.successionActivationThreshold.toFixed(3)}. Fail-closed: succession blocked.`,
      shardId: record.shardId,
      kind: 'SUCCESSION_PROTOCOL_BREACH',
    });
  }
}

/**
 * Assert that a stewardship boundary is intact — not breached and above the
 * partial continuity floor. Throws on the first violation found.
 */
export function assertStewardshipBoundary(boundary: StewardshipBoundary): void {
  if (boundary.lineageBreakCount > 0 || boundary.stabilityBreachCount > 0) {
    throw new StewardshipError({
      violation: 'REPLAY_GOVERNANCE_CARETAKER_OPEN_FAILURE',
      message:
        `Stewardship boundary breached: ${boundary.lineageBreakCount} lineage break(s), ` +
        `${boundary.stabilityBreachCount} stability breach(es). ` +
        'Governance caretaking is open — institutional runtime survivability at risk.',
      partialContinuityPct: boundary.partialContinuityPct,
    });
  }

  if (boundary.partialContinuityPct < DEFAULT_MIN_PARTIAL_CONTINUITY_PCT) {
    throw new StewardshipError({
      violation: 'CARETAKER_CONTINUITY_FLOOR_BREACH',
      message:
        `Stewardship partial continuity ${boundary.partialContinuityPct.toFixed(1)}% ` +
        `is below the configured floor of ${DEFAULT_MIN_PARTIAL_CONTINUITY_PCT}%. ` +
        'Operator intervention required before institutional runtime can be considered survivable.',
      partialContinuityPct: boundary.partialContinuityPct,
    });
  }
}

// ── Lineage reconstruction ────────────────────────────────────────────────────

/**
 * Reconstruct the stewardship lineage graph rooted at a given shard.
 * Shards that share a caretaker pool, replay governance shard, or succession
 * scope with the root are considered potentially affected.
 */
export function traceStewardshipLineage(args: {
  rootShardId: string;
  rootHints: StewardshipLineageHints;
  candidates: Array<{
    shardId: string;
    hints: Partial<StewardshipLineageHints>;
  }>;
}): StewardshipLineage {
  const { rootShardId, rootHints, candidates } = args;

  const affectedShardIds: string[] = [];
  const edges: StewardshipLineageEdge[] = [];

  for (const candidate of candidates) {
    if (candidate.shardId === rootShardId) continue;

    const hints = normalizeLineageHints(candidate.hints);
    const reasons: StewardshipLineageEdge['reason'][] = [];

    if (rootHints.caretakerPoolId !== null && hints.caretakerPoolId === rootHints.caretakerPoolId) {
      reasons.push('SHARED_CARETAKER_POOL');
    }
    if (
      rootHints.replayGovernanceShardId !== null &&
      hints.replayGovernanceShardId === rootHints.replayGovernanceShardId
    ) {
      reasons.push('SHARED_REPLAY_GOVERNANCE_SHARD');
    }
    if (
      rootHints.successionScopeId !== null &&
      hints.successionScopeId === rootHints.successionScopeId
    ) {
      reasons.push('SHARED_SUCCESSION_SCOPE');
    }

    if (reasons.length > 0) {
      affectedShardIds.push(candidate.shardId);
      for (const reason of reasons) {
        edges.push({ fromShardId: rootShardId, toShardId: candidate.shardId, reason });
      }
    }
  }

  const sortedAffected = [...affectedShardIds].sort();
  const sortedEdges = [...edges].sort((a, b) => {
    const k = `${a.fromShardId}|${a.toShardId}|${a.reason}`;
    const l = `${b.fromShardId}|${b.toShardId}|${b.reason}`;
    return k < l ? -1 : k > l ? 1 : 0;
  });

  const reconstructionDigest = sha256ForPayload({
    schema: 'vitalcv.stewardship-lineage-digest.v1',
    rootShardId,
    affectedShardIds: sortedAffected,
    edges: sortedEdges,
  });

  return {
    schema: SCHEMA_LINEAGE,
    rootShardId,
    affectedShardIds: sortedAffected,
    edges: sortedEdges,
    reconstructionDigest,
    reconstructedAt: new Date().toISOString(),
  };
}

// ── Maturity score ────────────────────────────────────────────────────────────

/**
 * Derive a 0–100 stewardship protocol maturity score from a boundary.
 * The score is a weighted composite of continuity, succession readiness,
 * institutional stability, and lineage depth — for the completion board.
 */
export function stewardshipMaturityScore(boundary: StewardshipBoundary): {
  maturityScore: number;
  governanceContinuityPct: number;
  replayFidelityPct: number;
  successionSurvivabilityPct: number;
  institutionalStabilityPct: number;
} {
  const governanceContinuityPct = Math.round(boundary.stewardshipContinuityRatio * 100);
  const successionSurvivabilityPct = Math.round(boundary.meanSuccessionReadiness * 100);
  const institutionalStabilityPct = Math.round(boundary.meanInstitutionalStability * 100);
  const lineageDepthScore = Math.min(
    100,
    Math.round(
      (boundary.minGovernanceLineageDepth / STEWARDSHIP_SENTINELS.GOVERNANCE_LINEAGE_MIN_DEPTH) * 100,
    ),
  );
  const replayFidelityPct = Math.round(
    (1 - boundary.stewardshipDriftVisibilityPct / 100) * 100,
  );

  const maturityScore = Math.round(
    governanceContinuityPct * 0.30 +
    replayFidelityPct * 0.25 +
    successionSurvivabilityPct * 0.20 +
    institutionalStabilityPct * 0.15 +
    lineageDepthScore * 0.10,
  );

  return {
    maturityScore: Math.max(0, Math.min(100, maturityScore)),
    governanceContinuityPct,
    replayFidelityPct,
    successionSurvivabilityPct,
    institutionalStabilityPct,
  };
}
