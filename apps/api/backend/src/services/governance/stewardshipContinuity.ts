/**
 * stewardshipContinuity.ts — W2-PR160A: Institutional Runtime Stewardship Finalization
 *
 * Pure transforms enforcing the institutional stewardship boundary across
 * the governance runtime. Goal: ensure governance caretaker succession
 * remains replay-faithful, ambiguity-preserving, and fail-closed under
 * stewardship transitions — without ever silently presenting a vacant or
 * contested caretaker seat as "live governance."
 *
 * Companion module to:
 *   - governanceRuntimeHardening.ts  (production runtime survivability axis)
 *   - rollout/rolloutSurvivability.ts (institutional adoption axis)
 *   - replayCorruptionContainment.ts (replay-corruption axis)
 *   - multi-tenant/tenantIsolation.ts (tenant axis)
 *
 * Hard invariants (fail-closed):
 *   - A CONTESTED or VOID lock is QUARANTINED, never merged into the LOCKED
 *     caretaker population. Ambiguous succession signals (dual incumbency,
 *     conflicting handoff timestamps, missing cryptographic handshake) are
 *     preserved as AMBIGUOUS_SUCCESSION, never coerced to SUCCEEDED.
 *   - When the surviving stewardship population falls below the configured
 *     continuity floor, the boundary raises CONTINUITY_BREACH so the
 *     operator sees the breach, never a partial caretaker seat dressed as
 *     full governance coverage.
 *   - Stewardship records carry deterministic, tamper-evident
 *     stewardshipDigests so a forged "active" record cannot replace a real
 *     vacancy or handoff gap.
 *   - Caretaker lineage is longitudinally reconstructable: every record
 *     carries the hints needed to walk back to the originating governance
 *     scope, tenant pool, and replay shard.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the
 * boundary checker; governance dashboards and the W2-PR160A CI gate call it.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MIN_CONTINUITY_SURVIVABILITY_PCT = 70;
const SCHEMA_LOCK = 'vitalcv.stewardship-continuity-lock.v1' as const;
const SCHEMA_SUCCESSION = 'vitalcv.stewardship-succession-chain.v1' as const;
const SCHEMA_REPLAY = 'vitalcv.stewardship-replay-record.v1' as const;
const SCHEMA_TELEMETRY = 'vitalcv.stewardship-telemetry-harmonized.v1' as const;
const SCHEMA_SURVIVABILITY = 'vitalcv.stewardship-survivability-record.v1' as const;
const SCHEMA_BOUNDARY = 'vitalcv.stewardship-continuity-boundary.v1' as const;
const SCHEMA_MATURITY = 'vitalcv.stewardship-maturity-score.v1' as const;
const SCHEMA_LINEAGE = 'vitalcv.caretaker-lineage.v1' as const;

// ── Types ─────────────────────────────────────────────────────────────────────

/** The formal role a caretaker occupies in the governance structure. */
export type CaretakerRole =
  | 'PRIMARY_STEWARD'         // principal decision authority
  | 'SECONDARY_STEWARD'       // backup / co-authority
  | 'INTERIM_STEWARD'         // gap-fill pending formal succession
  | 'AUDITOR_STEWARD'         // read-only observer with succession rights
  | 'EMERGENCY_STEWARD';      // activated only under CONTINUITY_BREACH

/** Lock state of a stewardship continuity unit. */
export type ContinuityLockState =
  | 'LOCKED'                  // active caretaker, no succession in flight
  | 'SUCCESSION_PENDING'      // handoff in progress, current holder still active
  | 'CONTESTED'               // dual-incumbency or conflicting handoff signals
  | 'VACANT'                  // no active caretaker — governance gap
  | 'VOID';                   // record structurally invalid — cannot be evaluated

/** Verdict for a completed succession attempt. */
export type SuccessionVerdict =
  | 'SUCCEEDED'               // clean handoff, new caretaker active
  | 'CONTESTED'               // handoff disputed — both parties claim authority
  | 'VACANT'                  // predecessor withdrew; no successor accepted
  | 'AMBIGUOUS_SUCCESSION'    // signals contradict — preserve uncertainty
  | 'HANDOFF_TIMEOUT';        // succession window expired without completion

/** Stewardship fidelity of a replay operation. */
export type StewardshipReplayVerdict =
  | 'VERIFIED'                // replay performed under valid, locked caretaker
  | 'CARETAKER_EXPIRED'       // caretaker's authority lapsed at replay time
  | 'LINEAGE_GAP'             // no traceable succession path to replay author
  | 'CONTESTED_AUTHORITY'     // replay issuer's authority contested at replay time
  | 'AMBIGUOUS_STEWARDSHIP';  // signals contradict — preserve uncertainty

/** Survivability verdict for a single stewardship unit. */
export type StewardshipSurvivabilityVerdict =
  | 'STABLE'                  // locked, no friction surfaced
  | 'PARTIAL_STABLE'          // succession pending but operator-visible
  | 'AMBIGUOUS_STEWARDSHIP'   // signals contradictory — quarantine + flag
  | 'VACANT'                  // governance gap — no active caretaker
  | 'CONTINUITY_BREACH';      // boundary breached — operator-visible failure

/** What kind of continuity friction the signal is reporting. */
export type ContinuityFrictionKind =
  | 'DUAL_INCUMBENCY'                  // two caretakers claim PRIMARY_STEWARD simultaneously
  | 'HANDOFF_DIGEST_MISMATCH'          // outgoing/incoming handoff digests diverge
  | 'SUCCESSION_WINDOW_EXPIRED'        // handoff window closed without completion
  | 'CARETAKER_AUTHORITY_LAPSE'        // caretaker's term expired, no renewal
  | 'LINEAGE_CHAIN_BROKEN'             // gap in succession chain, no intermediate record
  | 'TELEMETRY_GAP'                    // expected stewardship heartbeat never arrived
  | 'EMERGENCY_ACTIVATION_WITHOUT_GAP' // emergency steward activated with no vacancy
  | 'AMBIGUOUS_CONTINUITY_SIGNAL';     // signals contradict — preserve uncertainty

/** Violation kinds that throw StewardshipHardeningError. */
export type StewardshipHardeningViolationKind =
  | 'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED'
  | 'VACANT_LOCK_FORCED_ACTIVE'
  | 'CONTINUITY_BREACH'
  | 'CONTESTED_LOCK_OPEN_FAILURE'
  | 'SURVIVABILITY_FLOOR_BREACHED';

export class StewardshipHardeningError extends Error {
  readonly code = 'STEWARDSHIP_HARDENING_VIOLATION' as const;
  readonly violation: StewardshipHardeningViolationKind;
  readonly unitId: string | null;
  readonly kind: ContinuityFrictionKind | null;
  readonly survivingPct: number | null;

  constructor(args: {
    violation: StewardshipHardeningViolationKind;
    message: string;
    unitId?: string | null;
    kind?: ContinuityFrictionKind | null;
    survivingPct?: number | null;
  }) {
    super(args.message);
    this.name = 'StewardshipHardeningError';
    this.violation = args.violation;
    this.unitId = args.unitId ?? null;
    this.kind = args.kind ?? null;
    this.survivingPct = args.survivingPct ?? null;
  }
}

// ── Continuity lock ───────────────────────────────────────────────────────────

/** Governance-visible caretaker identity (no PII). */
export interface CaretakerIdentity {
  caretakerId: string;
  role: CaretakerRole;
  /** ISO-8601 start of authority. */
  authorityStart: string;
  /** ISO-8601 end of authority; null = open-ended / still active. */
  authorityEnd: string | null;
  /** Stable org-unit reference — used for lineage reconstruction. */
  orgUnitId: string | null;
}

/** A single snapshot of a stewardship continuity lock. */
export interface StewardshipContinuityLock {
  schema: typeof SCHEMA_LOCK;
  unitId: string;
  state: ContinuityLockState;
  incumbent: CaretakerIdentity | null;
  /** Present when state === 'SUCCESSION_PENDING'. */
  successorCandidate: CaretakerIdentity | null;
  frictionKind: ContinuityFrictionKind | null;
  /** Deterministic digest of (unitId, state, incumbent, successorCandidate, frictionKind). */
  lockDigest: string;
  evaluatedAt: string;
}

/** Input to lockContinuity. */
export interface ContinuityLockInput {
  unitId: string;
  state: ContinuityLockState;
  incumbent: CaretakerIdentity | null;
  successorCandidate?: CaretakerIdentity | null;
  frictionKind?: ContinuityFrictionKind | null;
}

/**
 * Materializes a tamper-evident continuity lock. Throws
 * StewardshipHardeningError if fail-closed invariants are violated.
 */
export function lockContinuity(input: ContinuityLockInput): StewardshipContinuityLock {
  const { unitId, state, incumbent, successorCandidate = null, frictionKind = null } = input;

  // Fail-closed: CONTESTED must not produce an open lock.
  if (state === 'CONTESTED' && frictionKind === null) {
    throw new StewardshipHardeningError({
      violation: 'CONTESTED_LOCK_OPEN_FAILURE',
      message: `Unit ${unitId}: CONTESTED lock produced without a frictionKind — ambiguity must be preserved`,
      unitId,
      kind: null,
    });
  }

  // Fail-closed: VACANT must not be presented as if a caretaker is present.
  if (state === 'VACANT' && incumbent !== null) {
    throw new StewardshipHardeningError({
      violation: 'VACANT_LOCK_FORCED_ACTIVE',
      message: `Unit ${unitId}: VACANT lock cannot carry an incumbent caretaker — vacancy must be surfaced`,
      unitId,
      kind: frictionKind,
    });
  }

  // Fail-closed: VOID is structurally invalid; cannot carry any caretaker.
  if (state === 'VOID' && (incumbent !== null || successorCandidate !== null)) {
    throw new StewardshipHardeningError({
      violation: 'VACANT_LOCK_FORCED_ACTIVE',
      message: `Unit ${unitId}: VOID lock cannot carry incumbent or successor — record is structurally invalid`,
      unitId,
      kind: frictionKind,
    });
  }

  const lockDigest = sha256ForPayload({
    schema: SCHEMA_LOCK,
    unitId,
    state,
    incumbent,
    successorCandidate,
    frictionKind,
  });

  return {
    schema: SCHEMA_LOCK,
    unitId,
    state,
    incumbent,
    successorCandidate,
    frictionKind,
    lockDigest,
    evaluatedAt: new Date().toISOString(),
  };
}

// ── Caretaker succession chain ────────────────────────────────────────────────

/** A single entry in the succession chain — one discrete handoff event. */
export interface CaretakerEntry {
  entryId: string;
  predecessor: CaretakerIdentity | null;
  successor: CaretakerIdentity;
  handoffDigest: string;
  /** ISO-8601 timestamp the handoff was recorded. */
  handoffAt: string;
  verdict: SuccessionVerdict;
  frictionKind: ContinuityFrictionKind | null;
}

/** The full ordered succession chain for a governance unit. */
export interface SuccessionChain {
  schema: typeof SCHEMA_SUCCESSION;
  unitId: string;
  entries: ReadonlyArray<CaretakerEntry>;
  /** True iff chain has no gaps, ambiguous verdicts, or contested entries. */
  chainIntact: boolean;
  /** Count of entries with ambiguous or contested verdicts. */
  ambiguousCount: number;
  /** Count of entries that produced a vacancy. */
  vacancyCount: number;
  chainDigest: string;
  builtAt: string;
}

/** Input to buildSuccessionChain. */
export interface SuccessionChainInput {
  unitId: string;
  entries: ReadonlyArray<{
    entryId: string;
    predecessor: CaretakerIdentity | null;
    successor: CaretakerIdentity;
    handoffDigest: string;
    handoffAt: string;
    verdict: SuccessionVerdict;
    frictionKind?: ContinuityFrictionKind | null;
  }>;
}

/**
 * Builds and validates a tamper-evident succession chain.
 * Throws StewardshipHardeningError if an AMBIGUOUS_SUCCESSION is forced
 * through as SUCCEEDED, or if the chain carries impossible state.
 */
export function buildSuccessionChain(input: SuccessionChainInput): SuccessionChain {
  const { unitId, entries } = input;

  // Validate: AMBIGUOUS_SUCCESSION must never be coerced to SUCCEEDED.
  for (const e of entries) {
    if (e.verdict === 'AMBIGUOUS_SUCCESSION' && e.frictionKind === null) {
      throw new StewardshipHardeningError({
        violation: 'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
        message:
          `Unit ${unitId} entry ${e.entryId}: AMBIGUOUS_SUCCESSION must carry a frictionKind — ` +
          'ambiguity must be preserved operationally',
        unitId,
        kind: null,
      });
    }
  }

  const normalized: CaretakerEntry[] = entries.map((e) => ({
    entryId: e.entryId,
    predecessor: e.predecessor ?? null,
    successor: e.successor,
    handoffDigest: e.handoffDigest,
    handoffAt: e.handoffAt,
    verdict: e.verdict,
    frictionKind: e.frictionKind ?? null,
  }));

  const ambiguousCount = normalized.filter(
    (e) => e.verdict === 'AMBIGUOUS_SUCCESSION' || e.verdict === 'CONTESTED',
  ).length;
  const vacancyCount = normalized.filter((e) => e.verdict === 'VACANT').length;
  const chainIntact = ambiguousCount === 0 && vacancyCount === 0;

  const chainDigest = sha256ForPayload({
    schema: SCHEMA_SUCCESSION,
    unitId,
    entries: normalized.map((e) => ({
      entryId: e.entryId,
      handoffDigest: e.handoffDigest,
      verdict: e.verdict,
    })),
  });

  return {
    schema: SCHEMA_SUCCESSION,
    unitId,
    entries: normalized,
    chainIntact,
    ambiguousCount,
    vacancyCount,
    chainDigest,
    builtAt: new Date().toISOString(),
  };
}

// ── Replay stewardship verification ──────────────────────────────────────────

/** Input signal for replay stewardship verification. */
export interface ReplayStewardshipSignal {
  capsuleId: string;
  replayIssuedAt: string;
  /** The caretaker whose authority is being asserted for this replay. */
  assertedCaretaker: CaretakerIdentity;
  /** Was the lock state LOCKED at replay time? */
  lockStateAtReplay: ContinuityLockState;
  /** Did the assertedCaretaker's authority span the replay timestamp? */
  authoritySpansReplay: boolean;
  /** Is there a traceable succession path from genesis to assertedCaretaker? */
  successionPathPresent: boolean;
  /** Was the caretaker authority contested at replay time? */
  authorityContestedAtReplay: boolean;
}

/** Tamper-evident record of a replay stewardship verification. */
export interface ReplayStewardshipRecord {
  schema: typeof SCHEMA_REPLAY;
  capsuleId: string;
  verdict: StewardshipReplayVerdict;
  assertedCaretaker: CaretakerIdentity;
  frictionKind: ContinuityFrictionKind | null;
  replayDigest: string;
  verifiedAt: string;
}

/**
 * Verifies that a replay operation was performed under valid stewardship.
 * Throws StewardshipHardeningError if an ambiguous signal is forced through
 * as VERIFIED. Pure — never throws on valid inputs.
 */
export function verifyReplayStewardship(
  signal: ReplayStewardshipSignal,
): ReplayStewardshipRecord {
  const {
    capsuleId,
    replayIssuedAt,
    assertedCaretaker,
    lockStateAtReplay,
    authoritySpansReplay,
    successionPathPresent,
    authorityContestedAtReplay,
  } = signal;

  let verdict: StewardshipReplayVerdict;
  let frictionKind: ContinuityFrictionKind | null = null;

  if (authorityContestedAtReplay && !authoritySpansReplay) {
    // Both contested AND expired — structurally ambiguous.
    verdict = 'AMBIGUOUS_STEWARDSHIP';
    frictionKind = 'AMBIGUOUS_CONTINUITY_SIGNAL';
  } else if (authorityContestedAtReplay) {
    verdict = 'CONTESTED_AUTHORITY';
    frictionKind = 'DUAL_INCUMBENCY';
  } else if (lockStateAtReplay === 'VACANT' || lockStateAtReplay === 'VOID') {
    verdict = 'LINEAGE_GAP';
    frictionKind = 'CARETAKER_AUTHORITY_LAPSE';
  } else if (!authoritySpansReplay) {
    verdict = 'CARETAKER_EXPIRED';
    frictionKind = 'CARETAKER_AUTHORITY_LAPSE';
  } else if (!successionPathPresent) {
    verdict = 'LINEAGE_GAP';
    frictionKind = 'LINEAGE_CHAIN_BROKEN';
  } else if (lockStateAtReplay === 'CONTESTED') {
    verdict = 'CONTESTED_AUTHORITY';
    frictionKind = 'DUAL_INCUMBENCY';
  } else {
    verdict = 'VERIFIED';
  }

  // Fail-closed: AMBIGUOUS_STEWARDSHIP must never be silently resolved.
  if (
    verdict === 'AMBIGUOUS_STEWARDSHIP' &&
    frictionKind !== 'AMBIGUOUS_CONTINUITY_SIGNAL'
  ) {
    throw new StewardshipHardeningError({
      violation: 'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
      message:
        `Capsule ${capsuleId}: AMBIGUOUS_STEWARDSHIP verdict produced without ` +
        'AMBIGUOUS_CONTINUITY_SIGNAL frictionKind — ambiguity must be preserved',
      unitId: assertedCaretaker.caretakerId,
      kind: frictionKind,
    });
  }

  const replayDigest = sha256ForPayload({
    schema: SCHEMA_REPLAY,
    capsuleId,
    replayIssuedAt,
    caretakerId: assertedCaretaker.caretakerId,
    role: assertedCaretaker.role,
    verdict,
    frictionKind,
  });

  return {
    schema: SCHEMA_REPLAY,
    capsuleId,
    verdict,
    assertedCaretaker,
    frictionKind,
    replayDigest,
    verifiedAt: new Date().toISOString(),
  };
}

// ── Stewardship telemetry harmonization ──────────────────────────────────────

/** A raw telemetry event emitted by a stewardship unit. */
export interface StewardshipTelemetryEvent {
  eventId: string;
  unitId: string;
  caretakerId: string;
  eventType:
    | 'HEARTBEAT'
    | 'SUCCESSION_INITIATED'
    | 'SUCCESSION_COMPLETED'
    | 'SUCCESSION_CONTESTED'
    | 'VACANCY_DETECTED'
    | 'EMERGENCY_ACTIVATION'
    | 'LOCK_REFRESH';
  emittedAt: string;
  /** Free-form payload — only non-PII fields; hashed below for tamper evidence. */
  payloadDigest: string;
}

/** Harmonized, deduplicated telemetry output for a governance unit. */
export interface HarmonizedStewardshipTelemetry {
  schema: typeof SCHEMA_TELEMETRY;
  unitId: string;
  eventCount: number;
  deduplicatedEventCount: number;
  /** Most recent heartbeat ISO-8601 timestamp; null if none observed. */
  lastHeartbeatAt: string | null;
  /** True iff at least one VACANCY_DETECTED or EMERGENCY_ACTIVATION event exists. */
  vacancySignalPresent: boolean;
  /** True iff any contested succession events exist. */
  contestedSignalPresent: boolean;
  /** IDs of events that were deduplicated (same eventId seen >1). */
  duplicateEventIds: ReadonlyArray<string>;
  harmonyDigest: string;
  harmonizedAt: string;
}

/**
 * Normalizes and deduplicates a stream of stewardship telemetry events.
 * Pure — never throws. Idempotent on identical inputs.
 */
export function harmonizeStewardshipTelemetry(
  events: ReadonlyArray<StewardshipTelemetryEvent>,
): HarmonizedStewardshipTelemetry {
  const unitIds = new Set(events.map((e) => e.unitId));
  const unitId = unitIds.size === 1 ? [...unitIds][0]! : 'MULTI_UNIT';

  // Deduplication by eventId.
  const seen = new Map<string, StewardshipTelemetryEvent>();
  const duplicateEventIds: string[] = [];
  for (const e of events) {
    if (seen.has(e.eventId)) {
      if (!duplicateEventIds.includes(e.eventId)) {
        duplicateEventIds.push(e.eventId);
      }
    } else {
      seen.set(e.eventId, e);
    }
  }
  const deduplicated = [...seen.values()];

  // Last heartbeat.
  const heartbeats = deduplicated
    .filter((e) => e.eventType === 'HEARTBEAT')
    .map((e) => e.emittedAt)
    .sort();
  const lastHeartbeatAt = heartbeats.length > 0 ? heartbeats[heartbeats.length - 1]! : null;

  const vacancySignalPresent = deduplicated.some(
    (e) => e.eventType === 'VACANCY_DETECTED' || e.eventType === 'EMERGENCY_ACTIVATION',
  );
  const contestedSignalPresent = deduplicated.some(
    (e) => e.eventType === 'SUCCESSION_CONTESTED',
  );

  const harmonyDigest = sha256ForPayload({
    schema: SCHEMA_TELEMETRY,
    unitId,
    eventIds: deduplicated.map((e) => e.eventId).sort(),
    lastHeartbeatAt,
    vacancySignalPresent,
    contestedSignalPresent,
  });

  return {
    schema: SCHEMA_TELEMETRY,
    unitId,
    eventCount: events.length,
    deduplicatedEventCount: deduplicated.length,
    lastHeartbeatAt,
    vacancySignalPresent,
    contestedSignalPresent,
    duplicateEventIds: duplicateEventIds.sort(),
    harmonyDigest,
    harmonizedAt: new Date().toISOString(),
  };
}

// ── Continuity survivability scoring ─────────────────────────────────────────

/** Signal for a single governance unit's survivability. */
export interface ContinuitySignal {
  unitId: string;
  lockState: ContinuityLockState;
  successionChainIntact: boolean;
  lastHeartbeatAt: string | null;
  /** ISO-8601; used to compute heartbeat staleness. */
  observationWindowStart: string;
  vacancySignalPresent: boolean;
  contestedSignalPresent: boolean;
  /** True iff emergency steward is active. */
  emergencyActivated: boolean;
  /** Free-form operational notes, e.g. "caretaker on leave". */
  operationalNote: string | null;
}

/** Survivability record for a single governance unit. */
export interface StewardshipSurvivabilityRecord {
  schema: typeof SCHEMA_SURVIVABILITY;
  unitId: string;
  verdict: StewardshipSurvivabilityVerdict;
  frictionKind: ContinuityFrictionKind | null;
  survivabilityDigest: string;
  /** ISO-8601 hints for longitudinal reconstruction. */
  lineageHints: {
    governanceScopeId: string | null;
    tenantPoolId: string | null;
    replayShardId: string | null;
  };
  scoredAt: string;
}

function heartbeatFresh(lastHeartbeatAt: string | null, windowStart: string): boolean {
  if (lastHeartbeatAt === null) return false;
  return new Date(lastHeartbeatAt) >= new Date(windowStart);
}

/**
 * Classifies a single governance unit's stewardship survivability.
 * Fail-closed: ambiguous signals are preserved, never coerced to STABLE.
 */
export function classifyContinuityUnit(
  signal: ContinuitySignal,
  opts: {
    governanceScopeId?: string | null;
    tenantPoolId?: string | null;
    replayShardId?: string | null;
  } = {},
): StewardshipSurvivabilityRecord {
  const {
    unitId,
    lockState,
    successionChainIntact,
    lastHeartbeatAt,
    observationWindowStart,
    vacancySignalPresent,
    contestedSignalPresent,
    emergencyActivated,
  } = signal;

  let verdict: StewardshipSurvivabilityVerdict;
  let frictionKind: ContinuityFrictionKind | null = null;

  const fresh = heartbeatFresh(lastHeartbeatAt, observationWindowStart);

  if (lockState === 'VOID') {
    verdict = 'CONTINUITY_BREACH';
    frictionKind = 'AMBIGUOUS_CONTINUITY_SIGNAL';
  } else if (lockState === 'VACANT' || vacancySignalPresent) {
    verdict = 'VACANT';
    frictionKind = 'CARETAKER_AUTHORITY_LAPSE';
  } else if (contestedSignalPresent && lockState === 'CONTESTED') {
    verdict = 'AMBIGUOUS_STEWARDSHIP';
    frictionKind = 'DUAL_INCUMBENCY';
  } else if (contestedSignalPresent || lockState === 'CONTESTED') {
    // One contested signal but lock reports something else — preserve contradiction.
    verdict = 'AMBIGUOUS_STEWARDSHIP';
    frictionKind = 'AMBIGUOUS_CONTINUITY_SIGNAL';
  } else if (!fresh && !emergencyActivated) {
    verdict = 'AMBIGUOUS_STEWARDSHIP';
    frictionKind = 'TELEMETRY_GAP';
  } else if (!successionChainIntact) {
    verdict = 'PARTIAL_STABLE';
    frictionKind = 'LINEAGE_CHAIN_BROKEN';
  } else if (lockState === 'SUCCESSION_PENDING') {
    verdict = 'PARTIAL_STABLE';
    frictionKind = null;
  } else {
    verdict = 'STABLE';
  }

  const survivabilityDigest = sha256ForPayload({
    schema: SCHEMA_SURVIVABILITY,
    unitId,
    verdict,
    frictionKind,
    lockState,
    lastHeartbeatAt,
  });

  return {
    schema: SCHEMA_SURVIVABILITY,
    unitId,
    verdict,
    frictionKind,
    survivabilityDigest,
    lineageHints: {
      governanceScopeId: opts.governanceScopeId ?? null,
      tenantPoolId: opts.tenantPoolId ?? null,
      replayShardId: opts.replayShardId ?? null,
    },
    scoredAt: new Date().toISOString(),
  };
}

// ── Continuity boundary ───────────────────────────────────────────────────────

/** Aggregate stewardship continuity boundary. */
export interface StewardshipContinuityBoundary {
  schema: typeof SCHEMA_BOUNDARY;
  totalUnits: number;
  stableCount: number;
  partialStableCount: number;
  ambiguousCount: number;
  vacantCount: number;
  breachCount: number;
  /** Percentage of units with STABLE verdict. */
  stablePct: number;
  /** True iff stablePct >= minContinuitySurvivabilityPct. */
  partitioned: boolean;
  boundaryDigest: string;
  evaluatedAt: string;
}

function clampRatio(r: number): number {
  return Math.min(1, Math.max(0, r));
}

/**
 * Aggregates unit-level survivability records into a continuity boundary.
 * Throws StewardshipHardeningError when:
 *   - any VOID or CONTINUITY_BREACH units exist (boundary breach)
 *   - surviving pct falls below the configured floor
 */
export function scoreContinuitySurvivability(
  records: ReadonlyArray<StewardshipSurvivabilityRecord>,
  opts: { minContinuitySurvivabilityPct?: number } = {},
): StewardshipContinuityBoundary {
  const floor =
    opts.minContinuitySurvivabilityPct ?? DEFAULT_MIN_CONTINUITY_SURVIVABILITY_PCT;

  const total = records.length;
  if (total === 0) {
    const emptyDigest = sha256ForPayload({ schema: SCHEMA_BOUNDARY, total: 0 });
    return {
      schema: SCHEMA_BOUNDARY,
      totalUnits: 0,
      stableCount: 0,
      partialStableCount: 0,
      ambiguousCount: 0,
      vacantCount: 0,
      breachCount: 0,
      stablePct: 0,
      partitioned: false,
      boundaryDigest: emptyDigest,
      evaluatedAt: new Date().toISOString(),
    };
  }

  const stableCount = records.filter((r) => r.verdict === 'STABLE').length;
  const partialStableCount = records.filter((r) => r.verdict === 'PARTIAL_STABLE').length;
  const ambiguousCount = records.filter(
    (r) => r.verdict === 'AMBIGUOUS_STEWARDSHIP',
  ).length;
  const vacantCount = records.filter((r) => r.verdict === 'VACANT').length;
  const breachCount = records.filter((r) => r.verdict === 'CONTINUITY_BREACH').length;

  const stablePct = clampRatio(stableCount / total) * 100;
  const partitioned = stablePct >= floor;

  if (breachCount > 0) {
    throw new StewardshipHardeningError({
      violation: 'CONTINUITY_BREACH',
      message:
        `Stewardship boundary: ${breachCount}/${total} units in CONTINUITY_BREACH — ` +
        'operator intervention required before governance can proceed',
      survivingPct: stablePct,
    });
  }

  if (!partitioned) {
    throw new StewardshipHardeningError({
      violation: 'SURVIVABILITY_FLOOR_BREACHED',
      message:
        `Stewardship boundary: stable units ${stablePct.toFixed(1)}% below ` +
        `floor ${floor}% — governance continuity at risk`,
      survivingPct: stablePct,
    });
  }

  const boundaryDigest = sha256ForPayload({
    schema: SCHEMA_BOUNDARY,
    totalUnits: total,
    stableCount,
    partialStableCount,
    ambiguousCount,
    vacantCount,
    breachCount,
    stablePct,
    partitioned,
  });

  return {
    schema: SCHEMA_BOUNDARY,
    totalUnits: total,
    stableCount,
    partialStableCount,
    ambiguousCount,
    vacantCount,
    breachCount,
    stablePct,
    partitioned,
    boundaryDigest,
    evaluatedAt: new Date().toISOString(),
  };
}

// ── Stewardship maturity score ────────────────────────────────────────────────

/** Finalization maturity score for the full stewardship stack. */
export interface StewardshipMaturityScore {
  schema: typeof SCHEMA_MATURITY;
  /** % of governance units with STABLE lock. */
  governanceContinuityPct: number;
  /** % of replay ops with VERIFIED stewardship verdict. */
  replayStewardshipFidelityPct: number;
  /** % of succession entries with SUCCEEDED verdict. */
  successionSurvivabilityPct: number;
  /** stablePct from the boundary. */
  institutionalStabilityPct: number;
  /** Composite score (equal weight of the four above). */
  stewardshipFinalizationMaturityPct: number;
  verdict:
    | 'STEWARDSHIP_FINALIZED'
    | 'STEWARDSHIP_GUARDED'
    | 'STEWARDSHIP_AT_RISK'
    | 'STEWARDSHIP_BLOCKED';
  scoreDigest: string;
}

/**
 * Computes the composite stewardship finalization maturity score.
 * Pure — never throws.
 */
export function computeStewardshipMaturityScore(input: {
  boundary: StewardshipContinuityBoundary;
  replayRecords: ReadonlyArray<ReplayStewardshipRecord>;
  successionChains: ReadonlyArray<SuccessionChain>;
}): StewardshipMaturityScore {
  const { boundary, replayRecords, successionChains } = input;

  const governanceContinuityPct = boundary.stablePct;
  const institutionalStabilityPct = boundary.stablePct;

  const totalReplays = replayRecords.length;
  const verifiedReplays = replayRecords.filter((r) => r.verdict === 'VERIFIED').length;
  const replayStewardshipFidelityPct =
    totalReplays > 0
      ? clampRatio(verifiedReplays / totalReplays) * 100
      : 100; // no replays = no fidelity concern

  const totalSuccessions = successionChains.reduce(
    (sum, c) => sum + c.entries.length,
    0,
  );
  const succeededSuccessions = successionChains
    .flatMap((c) => [...c.entries])
    .filter((e) => e.verdict === 'SUCCEEDED').length;
  const successionSurvivabilityPct =
    totalSuccessions > 0
      ? clampRatio(succeededSuccessions / totalSuccessions) * 100
      : 100; // no successions = no survivability concern

  const stewardshipFinalizationMaturityPct =
    (governanceContinuityPct +
      replayStewardshipFidelityPct +
      successionSurvivabilityPct +
      institutionalStabilityPct) /
    4;

  let verdict: StewardshipMaturityScore['verdict'];
  if (boundary.breachCount > 0) {
    verdict = 'STEWARDSHIP_BLOCKED';
  } else if (stewardshipFinalizationMaturityPct >= 90 && boundary.partitioned) {
    verdict = 'STEWARDSHIP_FINALIZED';
  } else if (stewardshipFinalizationMaturityPct >= 75 && boundary.partitioned) {
    verdict = 'STEWARDSHIP_GUARDED';
  } else {
    verdict = 'STEWARDSHIP_AT_RISK';
  }

  const scoreDigest = sha256ForPayload({
    schema: SCHEMA_MATURITY,
    governanceContinuityPct,
    replayStewardshipFidelityPct,
    successionSurvivabilityPct,
    institutionalStabilityPct,
    stewardshipFinalizationMaturityPct,
    verdict,
    boundaryDigest: boundary.boundaryDigest,
  });

  return {
    schema: SCHEMA_MATURITY,
    governanceContinuityPct,
    replayStewardshipFidelityPct,
    successionSurvivabilityPct,
    institutionalStabilityPct,
    stewardshipFinalizationMaturityPct,
    verdict,
    scoreDigest,
  };
}

// ── Caretaker lineage reconstruction ─────────────────────────────────────────

export interface CaretakerLineageEdge {
  fromCaretakerId: string;
  toCaretakerId: string;
  reason:
    | 'SHARED_ORG_UNIT'
    | 'SHARED_GOVERNANCE_SCOPE'
    | 'SHARED_TENANT_POOL'
    | 'SHARED_REPLAY_SHARD';
}

export interface CaretakerLineage {
  schema: typeof SCHEMA_LINEAGE;
  rootCaretakerId: string;
  contaminatedCaretakerIds: ReadonlyArray<string>;
  edges: ReadonlyArray<CaretakerLineageEdge>;
  reconstructionDigest: string;
  reconstructedAt: string;
}

interface CaretakerLineageHints {
  orgUnitId: string | null;
  governanceScopeId: string | null;
  tenantPoolId: string | null;
  replayShardId: string | null;
}

function normalizeCaretakerHints(h: Partial<CaretakerLineageHints>): CaretakerLineageHints {
  return {
    orgUnitId: h.orgUnitId ?? null,
    governanceScopeId: h.governanceScopeId ?? null,
    tenantPoolId: h.tenantPoolId ?? null,
    replayShardId: h.replayShardId ?? null,
  };
}

/**
 * Reconstructs the caretaker lineage from a root caretaker through candidate
 * peers. Used for longitudinal durability checks. Pure — never throws.
 */
export function traceCaretakerLineage(input: {
  rootCaretakerId: string;
  rootHints: Partial<CaretakerLineageHints>;
  candidates: ReadonlyArray<{
    caretakerId: string;
    hints: Partial<CaretakerLineageHints>;
  }>;
}): CaretakerLineage {
  const root = normalizeCaretakerHints(input.rootHints);
  const edges: CaretakerLineageEdge[] = [];
  const contaminatedSet = new Set<string>();

  for (const c of input.candidates) {
    if (c.caretakerId === input.rootCaretakerId) continue;
    const cand = normalizeCaretakerHints(c.hints);
    let edged = false;

    if (root.orgUnitId !== null && cand.orgUnitId === root.orgUnitId) {
      edges.push({ fromCaretakerId: input.rootCaretakerId, toCaretakerId: c.caretakerId, reason: 'SHARED_ORG_UNIT' });
      edged = true;
    }
    if (root.governanceScopeId !== null && cand.governanceScopeId === root.governanceScopeId) {
      edges.push({ fromCaretakerId: input.rootCaretakerId, toCaretakerId: c.caretakerId, reason: 'SHARED_GOVERNANCE_SCOPE' });
      edged = true;
    }
    if (root.tenantPoolId !== null && cand.tenantPoolId === root.tenantPoolId) {
      edges.push({ fromCaretakerId: input.rootCaretakerId, toCaretakerId: c.caretakerId, reason: 'SHARED_TENANT_POOL' });
      edged = true;
    }
    if (root.replayShardId !== null && cand.replayShardId === root.replayShardId) {
      edges.push({ fromCaretakerId: input.rootCaretakerId, toCaretakerId: c.caretakerId, reason: 'SHARED_REPLAY_SHARD' });
      edged = true;
    }
    if (edged) contaminatedSet.add(c.caretakerId);
  }

  const contaminated = [...contaminatedSet].sort();
  const sortedEdges = edges
    .slice()
    .sort(
      (a, b) =>
        a.toCaretakerId.localeCompare(b.toCaretakerId) ||
        a.reason.localeCompare(b.reason),
    );

  const reconstructionDigest = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    rootCaretakerId: input.rootCaretakerId,
    contaminated,
    edges: sortedEdges,
  });

  return {
    schema: SCHEMA_LINEAGE,
    rootCaretakerId: input.rootCaretakerId,
    contaminatedCaretakerIds: contaminated,
    edges: sortedEdges,
    reconstructionDigest,
    reconstructedAt: new Date().toISOString(),
  };
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/**
 * Asserts that a continuity lock is operational (LOCKED or SUCCESSION_PENDING).
 * Throws StewardshipHardeningError if VACANT, CONTESTED, or VOID.
 */
export function assertContinuityOperational(lock: StewardshipContinuityLock): void {
  if (lock.state === 'LOCKED' || lock.state === 'SUCCESSION_PENDING') return;
  throw new StewardshipHardeningError({
    violation:
      lock.state === 'VACANT' || lock.state === 'VOID'
        ? 'VACANT_LOCK_FORCED_ACTIVE'
        : 'CONTESTED_LOCK_OPEN_FAILURE',
    message:
      `Unit ${lock.unitId}: lock state ${lock.state} is not operational — ` +
      'governance cannot proceed without a locked or succession-pending caretaker',
    unitId: lock.unitId,
    kind: lock.frictionKind,
  });
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const STEWARDSHIP_SENTINELS = Object.freeze({
  DEFAULT_MIN_CONTINUITY_SURVIVABILITY_PCT,
  SCHEMA_LOCK,
  SCHEMA_SUCCESSION,
  SCHEMA_REPLAY,
  SCHEMA_TELEMETRY,
  SCHEMA_SURVIVABILITY,
  SCHEMA_BOUNDARY,
  SCHEMA_MATURITY,
  SCHEMA_LINEAGE,
});

export const KNOWN_CARETAKER_ROLES = Object.freeze([
  'PRIMARY_STEWARD',
  'SECONDARY_STEWARD',
  'INTERIM_STEWARD',
  'AUDITOR_STEWARD',
  'EMERGENCY_STEWARD',
] as const);

export const KNOWN_CONTINUITY_LOCK_STATES = Object.freeze([
  'LOCKED',
  'SUCCESSION_PENDING',
  'CONTESTED',
  'VACANT',
  'VOID',
] as const);

export const KNOWN_SUCCESSION_VERDICTS = Object.freeze([
  'SUCCEEDED',
  'CONTESTED',
  'VACANT',
  'AMBIGUOUS_SUCCESSION',
  'HANDOFF_TIMEOUT',
] as const);

export const KNOWN_STEWARDSHIP_REPLAY_VERDICTS = Object.freeze([
  'VERIFIED',
  'CARETAKER_EXPIRED',
  'LINEAGE_GAP',
  'CONTESTED_AUTHORITY',
  'AMBIGUOUS_STEWARDSHIP',
] as const);

export const KNOWN_STEWARDSHIP_SURVIVABILITY_VERDICTS = Object.freeze([
  'STABLE',
  'PARTIAL_STABLE',
  'AMBIGUOUS_STEWARDSHIP',
  'VACANT',
  'CONTINUITY_BREACH',
] as const);

export const KNOWN_CONTINUITY_FRICTION_KINDS = Object.freeze([
  'DUAL_INCUMBENCY',
  'HANDOFF_DIGEST_MISMATCH',
  'SUCCESSION_WINDOW_EXPIRED',
  'CARETAKER_AUTHORITY_LAPSE',
  'LINEAGE_CHAIN_BROKEN',
  'TELEMETRY_GAP',
  'EMERGENCY_ACTIVATION_WITHOUT_GAP',
  'AMBIGUOUS_CONTINUITY_SIGNAL',
] as const);

export const KNOWN_STEWARDSHIP_HARDENING_VIOLATIONS = Object.freeze([
  'AMBIGUOUS_SUCCESSION_FORCED_SUCCEEDED',
  'VACANT_LOCK_FORCED_ACTIVE',
  'CONTINUITY_BREACH',
  'CONTESTED_LOCK_OPEN_FAILURE',
  'SURVIVABILITY_FLOOR_BREACHED',
] as const);
