/**
 * governanceRuntimeHardening.ts — W2-PR107A: Production Governance Runtime Hardening
 *
 * Pure transforms enforcing the production-runtime survivability boundary
 * across the governance runtime. Goal: ensure the governance runtime stays
 * replay-safe under load, ambiguity-preserving under degradation, and
 * fail-closed under fault injection — without ever silently dressing a
 * degraded runtime as "production healthy".
 *
 * Companion module to:
 *   - replayCorruptionContainment.ts (replay-corruption axis)
 *   - multi-tenant/tenantIsolation.ts (tenant axis)
 *   - rollout/rolloutSurvivability.ts (institutional adoption axis)
 *   - runtimeTrustCohesion.ts        (mutation cohesion axis)
 *
 * Same shape, same fail-closed contract, different axis: production-runtime
 * survivability under sustained institutional workloads.
 *
 * Hard invariants (fail-closed):
 *   - A degraded runtime tier is QUARANTINED, never silently merged with
 *     the healthy population. Ambiguous runtime signals (replay backpressure
 *     contradicting throughput, partial isolation breach with healthy
 *     headline) are preserved as AMBIGUOUS, never coerced to HEALTHY.
 *   - When the surviving runtime population falls below the configured
 *     resilience floor, the boundary raises HARDENING_BREACH so the
 *     operator sees the breach, never a partial cluster dressed as
 *     production-ready.
 *   - Runtime survivability records carry deterministic, tamper-evident
 *     hardeningDigests so a forged "healthy" record cannot replace a real
 *     fault-containment signal.
 *   - Runtime drift is reconstructable longitudinally: every survivability
 *     record carries the hints needed to walk back to the offending tenant
 *     pool, replay shard, or governance rule scope.
 *
 * No fetches, no DB writes, no audit-event writes. This module is the
 * boundary checker; runtime dashboards and the W2-PR107A CI gate call it.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Production runtime tier a single shard is assigned to. */
export type RuntimeTier =
  | 'HEALTHY'                  // sub-budget latency, no faults, no isolation breach
  | 'DEGRADED'                 // slow tail, partial backpressure, no isolation breach
  | 'STRESSED'                 // backpressure + replay slowdown, no isolation breach
  | 'CIRCUIT_OPEN'             // fail-closed circuit tripped, replays paused
  | 'ISOLATION_BREACH'         // resource isolation boundary breached
  | 'AMBIGUOUS_RUNTIME';       // signals contradict — preserve uncertainty

/** What kind of runtime fault the hardening signal is reporting. */
export type RuntimeFaultKind =
  | 'REPLAY_BACKPRESSURE'                // replay queue depth exceeds budget
  | 'GOVERNANCE_RULE_TIMEOUT'            // governance rule eval exceeds wall budget
  | 'TENANT_RESOURCE_EXHAUSTION'         // single tenant consuming pool past quota
  | 'CROSS_TENANT_RESOURCE_BLEED'        // pool exhausted by one tenant starves another
  | 'REPLAY_VARIANCE_SPIKE'              // p99/p50 replay latency ratio collapses headroom
  | 'CIRCUIT_BREAKER_OPEN'               // fail-closed circuit tripped
  | 'RUNTIME_FAULT_AMBIGUOUS';           // signals contradict — preserve uncertainty

/** Survivability verdict for a single runtime shard. */
export type RuntimeSurvivabilityVerdict =
  | 'SURVIVING'                          // tier=HEALTHY, no fault surfaced
  | 'PARTIAL_SURVIVING'                  // tier=DEGRADED|STRESSED, operator-visible
  | 'AMBIGUOUS_RUNTIME'                  // signals contradictory — quarantine + flag
  | 'CONTAINED'                          // fault present and circuit-contained
  | 'CONTAMINATED'                       // dragged down by a peer shard's fault
  | 'HARDENING_BREACH';                  // boundary breached — operator-visible failure

export type RuntimeHardeningViolationKind =
  | 'AMBIGUOUS_RUNTIME_FORCED_HEALTHY'
  | 'BOUNDARY_BREACH'
  | 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED'
  | 'ISOLATION_OPEN_FAILURE'
  | 'CIRCUIT_BREAKER_DISABLED';

export class RuntimeHardeningError extends Error {
  readonly code = 'RUNTIME_HARDENING_VIOLATION' as const;
  readonly violation: RuntimeHardeningViolationKind;
  readonly shardId: string | null;
  readonly kind: RuntimeFaultKind | null;
  readonly survivabilityPct: number | null;

  constructor(args: {
    violation: RuntimeHardeningViolationKind;
    message: string;
    shardId?: string | null;
    kind?: RuntimeFaultKind | null;
    survivabilityPct?: number | null;
  }) {
    super(args.message);
    this.name = 'RuntimeHardeningError';
    this.violation = args.violation;
    this.shardId = args.shardId ?? null;
    this.kind = args.kind ?? null;
    this.survivabilityPct = args.survivabilityPct ?? null;
  }
}

/**
 * The hardening signal a survivability classifier consumes. Mirrors the
 * shape of replayEngine's IntegrityCheck and rolloutSurvivability's
 * RolloutSignal — a small, narrow contract so this module never reaches
 * into telemetry storage or HTTP layers.
 */
export interface RuntimeHardeningSignal {
  /** Replay queue depth at the moment of the snapshot. */
  replayQueueDepth: number;
  /** Replay queue budget (depth above this == backpressure). */
  replayQueueBudget: number;
  /** p50 replay latency in milliseconds. */
  replayLatencyP50Ms: number;
  /** p99 replay latency in milliseconds. */
  replayLatencyP99Ms: number;
  /** Wall-clock budget for governance rule evaluation in ms. */
  governanceRuleBudgetMs: number;
  /** Observed wall-clock for the slowest governance rule eval in ms. */
  governanceRuleObservedMs: number;
  /** Per-tenant resource quota (e.g. concurrent replays allotted). */
  tenantResourceQuota: number;
  /** Observed concurrent resource use for the busiest tenant. */
  tenantResourceObserved: number;
  /** True iff a tenant exhausted the shared pool such that another tenant starved. */
  crossTenantBleedDetected: boolean;
  /** True iff the fail-closed circuit breaker is currently open. */
  circuitBreakerOpen: boolean;
  /** True iff the runtime explicitly disabled the fail-closed circuit (anti-pattern). */
  circuitBreakerDisabled: boolean;
  /** Operator-observed runtime evidence — empty when no fault. */
  faultEvidence: string | null;
}

export interface RuntimeShardLineageHints {
  /** Tenant pool the shard is assigned to. */
  tenantPoolId: string | null;
  /** Replay shard id (e.g. consistent-hash ring slot). */
  replayShardId: string | null;
  /** Governance rule scope id (rule set the shard enforces). */
  governanceRuleScopeId: string | null;
}

export interface RuntimeSurvivabilityRecord {
  schema: 'vitalcv.runtime-hardening.v1';
  shardId: string;
  verdict: RuntimeSurvivabilityVerdict;
  /** Null when verdict === 'SURVIVING'. */
  kind: RuntimeFaultKind | null;
  tier: RuntimeTier;
  /** True iff verdict === 'AMBIGUOUS_RUNTIME'. Mirrored for fast filtering. */
  ambiguous: boolean;
  reason: string;
  /** SHA-256 over (shardId, verdict, kind, tier, signal). Tamper-evident boundary. */
  hardeningDigest: string;
  observedAt: string;
  lineageHints: RuntimeShardLineageHints;
  /** Numeric 0..1 — replay headroom (1 - queueDepth/budget), clamped non-negative. */
  replayHeadroomRatio: number;
  /** Numeric 0..1 — governance headroom (1 - observed/budget), clamped non-negative. */
  governanceHeadroomRatio: number;
  /** Numeric 0..1 — tenant resource headroom (1 - observed/quota), clamped non-negative. */
  tenantHeadroomRatio: number;
  /** p99/p50 replay latency ratio (>= 1.0). */
  replayLatencyVariance: number;
}

export interface RuntimeHardeningBoundary {
  schema: 'vitalcv.runtime-hardening-boundary.v1';
  /** True iff hardening is intact — no breach, ambiguity preserved as flag. */
  partitioned: boolean;
  totalShards: number;
  survivingCount: number;
  partialSurvivingCount: number;
  ambiguousCount: number;
  containedCount: number;
  contaminatedCount: number;
  /** surviving / total — 1.0 when every shard is fully healthy. */
  runtimeSurvivabilityRatio: number;
  /**
   * (surviving + partial-surviving + ambiguous + contained) / total * 100 —
   * what survived in some operator-actionable form. CONTAMINATED + breach
   * do NOT count.
   */
  partialSurvivabilityPct: number;
  /** (contained + contaminated + breach) / total * 100. */
  faultContainmentPct: number;
  /** (ambiguous + partial + contained) / total * 100 — drift visibility. */
  runtimeDriftVisibilityPct: number;
  hardeningReason: string;
  boundaryDigest: string;
  partitionedAt: string;
}

export interface RuntimeFaultEdge {
  fromShardId: string;
  toShardId: string;
  reason: 'SHARED_TENANT_POOL' | 'SHARED_REPLAY_SHARD' | 'SHARED_GOVERNANCE_SCOPE';
}

export interface RuntimeFaultLineage {
  schema: 'vitalcv.runtime-fault-lineage.v1';
  rootShardId: string;
  /** Shards contaminated via the root's lineage hints. Excludes the root. */
  contaminatedShardIds: string[];
  edges: RuntimeFaultEdge[];
  /** SHA-256 over (rootShardId, sorted contaminated ids, sorted edges). */
  reconstructionDigest: string;
  reconstructedAt: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const SCHEMA_RECORD   = 'vitalcv.runtime-hardening.v1' as const;
const SCHEMA_BOUNDARY = 'vitalcv.runtime-hardening-boundary.v1' as const;
const SCHEMA_LINEAGE  = 'vitalcv.runtime-fault-lineage.v1' as const;

const DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT = 70;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clampRatio(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  if (denominator <= 0) return 0;
  return clampRatio(1 - numerator / denominator);
}

function safeVariance(p99: number, p50: number): number {
  if (!Number.isFinite(p99) || !Number.isFinite(p50)) return 1;
  if (p50 <= 0) return Math.max(1, p99 > 0 ? Number.POSITIVE_INFINITY : 1);
  const ratio = p99 / p50;
  return Number.isFinite(ratio) ? Math.max(1, ratio) : 1;
}

function normalizeHints(
  hints: Partial<RuntimeShardLineageHints> | undefined | null,
): RuntimeShardLineageHints {
  return {
    tenantPoolId:
      typeof hints?.tenantPoolId === 'string' && hints.tenantPoolId.trim().length > 0
        ? hints.tenantPoolId.trim()
        : null,
    replayShardId:
      typeof hints?.replayShardId === 'string' && hints.replayShardId.trim().length > 0
        ? hints.replayShardId.trim()
        : null,
    governanceRuleScopeId:
      typeof hints?.governanceRuleScopeId === 'string' &&
      hints.governanceRuleScopeId.trim().length > 0
        ? hints.governanceRuleScopeId.trim()
        : null,
  };
}

export function hardeningDigest(input: {
  shardId: string;
  verdict: RuntimeSurvivabilityVerdict;
  kind: RuntimeFaultKind | null;
  tier: RuntimeTier;
  signal: RuntimeHardeningSignal;
}): string {
  return sha256ForPayload({
    schema: 'vitalcv.runtime-hardening-digest.v1',
    shardId: input.shardId,
    verdict: input.verdict,
    kind: input.kind,
    tier: input.tier,
    signal: {
      replayQueueDepth: input.signal.replayQueueDepth,
      replayQueueBudget: input.signal.replayQueueBudget,
      replayLatencyP50Ms: input.signal.replayLatencyP50Ms,
      replayLatencyP99Ms: input.signal.replayLatencyP99Ms,
      governanceRuleBudgetMs: input.signal.governanceRuleBudgetMs,
      governanceRuleObservedMs: input.signal.governanceRuleObservedMs,
      tenantResourceQuota: input.signal.tenantResourceQuota,
      tenantResourceObserved: input.signal.tenantResourceObserved,
      crossTenantBleedDetected: input.signal.crossTenantBleedDetected,
      circuitBreakerOpen: input.signal.circuitBreakerOpen,
      circuitBreakerDisabled: input.signal.circuitBreakerDisabled,
      faultEvidence: input.signal.faultEvidence ?? null,
    },
  });
}

// ── Classifier ────────────────────────────────────────────────────────────────

/**
 * Pure classifier — given a hardening signal, return the fault kind, tier,
 * an ambiguity flag, and a human-readable reason.
 *
 * Fail-closed table:
 *
 *   queueOk | govOk  | tenantOk | bleed  | circuit | result
 *   --------+--------+----------+--------+---------+-----------------------
 *   true    | true   | true     | false  | closed  | HEALTHY (kind=null)
 *   *       | *      | *        | *      | DISABLED| RUNTIME_FAULT_AMBIGUOUS
 *   false   | true   | true     | false  | closed  | REPLAY_BACKPRESSURE
 *   true    | false  | true     | false  | closed  | GOVERNANCE_RULE_TIMEOUT
 *   true    | true   | false    | false  | closed  | TENANT_RESOURCE_EXHAUSTION
 *   any     | any    | any      | true   | closed  | CROSS_TENANT_RESOURCE_BLEED
 *   p99/p50 | n/a    | n/a      | n/a    | closed  | REPLAY_VARIANCE_SPIKE (>= 12x)
 *   any     | any    | any      | any    | OPEN    | CIRCUIT_BREAKER_OPEN
 *   contradiction (e.g. healthy budget, fault evidence text)| RUNTIME_FAULT_AMBIGUOUS
 */
export function classifyRuntimeFault(signal: RuntimeHardeningSignal): {
  kind: RuntimeFaultKind | null;
  tier: RuntimeTier;
  ambiguous: boolean;
  reason: string;
} {
  // Disabled circuit breaker is itself a hardening anti-pattern — flag as
  // AMBIGUOUS and force operator review.
  if (signal.circuitBreakerDisabled) {
    return {
      kind: 'RUNTIME_FAULT_AMBIGUOUS',
      tier: 'AMBIGUOUS_RUNTIME',
      ambiguous: true,
      reason:
        'Circuit breaker explicitly disabled — fail-closed runtime semantics ' +
        'cannot be asserted. Operator review required.',
    };
  }

  const queueOk =
    Number.isFinite(signal.replayQueueDepth) &&
    Number.isFinite(signal.replayQueueBudget) &&
    signal.replayQueueBudget > 0 &&
    signal.replayQueueDepth <= signal.replayQueueBudget;
  const govOk =
    Number.isFinite(signal.governanceRuleObservedMs) &&
    Number.isFinite(signal.governanceRuleBudgetMs) &&
    signal.governanceRuleBudgetMs > 0 &&
    signal.governanceRuleObservedMs <= signal.governanceRuleBudgetMs;
  const tenantOk =
    Number.isFinite(signal.tenantResourceObserved) &&
    Number.isFinite(signal.tenantResourceQuota) &&
    signal.tenantResourceQuota > 0 &&
    signal.tenantResourceObserved <= signal.tenantResourceQuota;

  const variance = safeVariance(signal.replayLatencyP99Ms, signal.replayLatencyP50Ms);
  const varianceSpike = variance >= 12;
  const evidence = signal.faultEvidence ?? null;
  const evidencePresent = typeof evidence === 'string' && evidence.trim().length > 0;

  // Open circuit dominates everything else — fault is contained.
  if (signal.circuitBreakerOpen) {
    return {
      kind: 'CIRCUIT_BREAKER_OPEN',
      tier: 'CIRCUIT_OPEN',
      ambiguous: false,
      reason: evidencePresent
        ? `Circuit breaker open — ${evidence}`
        : 'Circuit breaker open — replays paused under fail-closed semantics.',
    };
  }

  // Cross-tenant bleed is an isolation breach regardless of headline numbers.
  if (signal.crossTenantBleedDetected) {
    return {
      kind: 'CROSS_TENANT_RESOURCE_BLEED',
      tier: 'ISOLATION_BREACH',
      ambiguous: false,
      reason: evidencePresent
        ? `Cross-tenant resource bleed detected — ${evidence}`
        : 'Cross-tenant resource bleed detected — pool exhaustion crossed isolation boundary.',
    };
  }

  // All headline budgets met — but if the signal carries fault evidence text
  // or a variance spike, treat as ambiguous (contradiction with budgets).
  if (queueOk && govOk && tenantOk) {
    if (evidencePresent) {
      return {
        kind: 'RUNTIME_FAULT_AMBIGUOUS',
        tier: 'AMBIGUOUS_RUNTIME',
        ambiguous: true,
        reason: `Contradiction: budgets met but fault evidence present — ${evidence}`,
      };
    }
    if (varianceSpike) {
      return {
        kind: 'REPLAY_VARIANCE_SPIKE',
        tier: 'STRESSED',
        ambiguous: false,
        reason:
          `Replay variance spike: p99/p50=${variance.toFixed(2)}x — tail collapsed ` +
          'headroom even though queue depth is within budget.',
      };
    }
    return {
      kind: null,
      tier: 'HEALTHY',
      ambiguous: false,
      reason: 'All hardening signals within budget; runtime is healthy.',
    };
  }

  // Single-axis violations — pick the tightest one.
  if (!queueOk && govOk && tenantOk) {
    return {
      kind: 'REPLAY_BACKPRESSURE',
      tier: signal.replayQueueDepth >= signal.replayQueueBudget * 1.5 ? 'STRESSED' : 'DEGRADED',
      ambiguous: false,
      reason: evidencePresent
        ? `Replay backpressure — depth=${signal.replayQueueDepth}/${signal.replayQueueBudget}: ${evidence}`
        : `Replay backpressure — depth=${signal.replayQueueDepth} exceeds budget=${signal.replayQueueBudget}.`,
    };
  }
  if (queueOk && !govOk && tenantOk) {
    return {
      kind: 'GOVERNANCE_RULE_TIMEOUT',
      tier: 'DEGRADED',
      ambiguous: false,
      reason: evidencePresent
        ? `Governance rule timeout — observed=${signal.governanceRuleObservedMs}ms / budget=${signal.governanceRuleBudgetMs}ms: ${evidence}`
        : `Governance rule timeout — observed=${signal.governanceRuleObservedMs}ms exceeds budget=${signal.governanceRuleBudgetMs}ms.`,
    };
  }
  if (queueOk && govOk && !tenantOk) {
    return {
      kind: 'TENANT_RESOURCE_EXHAUSTION',
      tier: 'DEGRADED',
      ambiguous: false,
      reason: evidencePresent
        ? `Tenant resource exhaustion — observed=${signal.tenantResourceObserved}/${signal.tenantResourceQuota}: ${evidence}`
        : `Tenant resource exhaustion — observed=${signal.tenantResourceObserved} exceeds quota=${signal.tenantResourceQuota}.`,
    };
  }

  // Multi-axis fault — preserve uncertainty rather than picking one arbitrarily.
  return {
    kind: 'RUNTIME_FAULT_AMBIGUOUS',
    tier: 'AMBIGUOUS_RUNTIME',
    ambiguous: true,
    reason: evidencePresent
      ? `Multi-axis runtime fault — ${evidence}`
      : 'Multi-axis runtime fault: replay, governance, and/or tenant budgets simultaneously breached. Preserving uncertainty.',
  };
}

// ── Survivability record builder ──────────────────────────────────────────────

/**
 * Build a survivability record for a single shard. Pure — never throws.
 *
 * Use `forcedKind: 'CIRCUIT_BREAKER_OPEN'` (or any concrete kind) to mark a
 * shard CONTAMINATED via lineage even though its own signal is clean (a
 * downstream caller decided the shard's lineage parent is faulted).
 */
export function quarantineRuntimeShard(input: {
  shardId: string;
  signal: RuntimeHardeningSignal;
  lineageHints?: Partial<RuntimeShardLineageHints> | null;
  forcedKind?: RuntimeFaultKind;
  forcedReason?: string;
  forcedVerdict?: RuntimeSurvivabilityVerdict;
}): RuntimeSurvivabilityRecord {
  const observedAt = new Date().toISOString();
  const hints = normalizeHints(input.lineageHints);

  const replayHeadroomRatio = safeRatio(
    input.signal.replayQueueDepth,
    input.signal.replayQueueBudget,
  );
  const governanceHeadroomRatio = safeRatio(
    input.signal.governanceRuleObservedMs,
    input.signal.governanceRuleBudgetMs,
  );
  const tenantHeadroomRatio = safeRatio(
    input.signal.tenantResourceObserved,
    input.signal.tenantResourceQuota,
  );
  const replayLatencyVariance = safeVariance(
    input.signal.replayLatencyP99Ms,
    input.signal.replayLatencyP50Ms,
  );

  // Lineage-driven contamination override.
  if (input.forcedVerdict === 'CONTAMINATED') {
    const verdict: RuntimeSurvivabilityVerdict = 'CONTAMINATED';
    const kind: RuntimeFaultKind = input.forcedKind ?? 'RUNTIME_FAULT_AMBIGUOUS';
    const tier: RuntimeTier = 'STRESSED';
    const reason =
      input.forcedReason ??
      `Shard ${input.shardId} contaminated via lineage from a faulted peer.`;
    return {
      schema: SCHEMA_RECORD,
      shardId: input.shardId,
      verdict,
      kind,
      tier,
      ambiguous: false,
      reason,
      hardeningDigest: hardeningDigest({
        shardId: input.shardId,
        verdict,
        kind,
        tier,
        signal: input.signal,
      }),
      observedAt,
      lineageHints: hints,
      replayHeadroomRatio,
      governanceHeadroomRatio,
      tenantHeadroomRatio,
      replayLatencyVariance,
    };
  }

  const classified = classifyRuntimeFault(input.signal);
  const kind = input.forcedKind ?? classified.kind;
  const tier = classified.tier;
  const reason = input.forcedReason ?? classified.reason;

  let verdict: RuntimeSurvivabilityVerdict;
  if (input.forcedVerdict) {
    verdict = input.forcedVerdict;
  } else if (kind === null) {
    verdict = 'SURVIVING';
  } else if (classified.ambiguous || kind === 'RUNTIME_FAULT_AMBIGUOUS') {
    verdict = 'AMBIGUOUS_RUNTIME';
  } else if (kind === 'CIRCUIT_BREAKER_OPEN') {
    verdict = 'CONTAINED';
  } else if (kind === 'CROSS_TENANT_RESOURCE_BLEED') {
    verdict = 'HARDENING_BREACH';
  } else if (kind === 'REPLAY_VARIANCE_SPIKE') {
    verdict = 'PARTIAL_SURVIVING';
  } else {
    verdict = 'PARTIAL_SURVIVING';
  }

  return {
    schema: SCHEMA_RECORD,
    shardId: input.shardId,
    verdict,
    kind,
    tier,
    ambiguous: verdict === 'AMBIGUOUS_RUNTIME',
    reason,
    hardeningDigest: hardeningDigest({
      shardId: input.shardId,
      verdict,
      kind,
      tier,
      signal: input.signal,
    }),
    observedAt,
    lineageHints: hints,
    replayHeadroomRatio,
    governanceHeadroomRatio,
    tenantHeadroomRatio,
    replayLatencyVariance,
  };
}

/**
 * Non-throwing variant. If quarantine construction throws (it never should —
 * pure transform), the record returned is a HARDENING_BREACH placeholder so
 * a swallowed error cannot masquerade as SURVIVING.
 */
export function evaluateRuntimeShard(input: {
  shardId: string;
  signal: RuntimeHardeningSignal;
  lineageHints?: Partial<RuntimeShardLineageHints> | null;
}): RuntimeSurvivabilityRecord {
  try {
    return quarantineRuntimeShard(input);
  } catch (err) {
    const observedAt = new Date().toISOString();
    const hints = normalizeHints(input.lineageHints);
    const kind: RuntimeFaultKind = 'RUNTIME_FAULT_AMBIGUOUS';
    const tier: RuntimeTier = 'AMBIGUOUS_RUNTIME';
    const verdict: RuntimeSurvivabilityVerdict = 'HARDENING_BREACH';
    const reason = `Hardening evaluator failed: ${err instanceof Error ? err.message : String(err)}`;
    // The original signal may itself be the source of the throw (e.g. a
    // poisoned getter). Hash a deterministic shardId-only fallback so we
    // still emit a tamper-evident digest without re-touching the bad signal.
    const fallbackDigest = sha256ForPayload({
      schema: 'vitalcv.runtime-hardening-digest.v1',
      shardId: input.shardId,
      verdict,
      kind,
      tier,
      signal: { fallback: true, reason },
    });
    return {
      schema: SCHEMA_RECORD,
      shardId: input.shardId,
      verdict,
      kind,
      tier,
      ambiguous: false,
      reason,
      hardeningDigest: fallbackDigest,
      observedAt,
      lineageHints: hints,
      replayHeadroomRatio: 0,
      governanceHeadroomRatio: 0,
      tenantHeadroomRatio: 0,
      replayLatencyVariance: 1,
    };
  }
}

// ── Boundary computation ──────────────────────────────────────────────────────

/**
 * Compute the hardening boundary for a population of runtime shards.
 * Pure — never throws.
 */
export function computeRuntimeHardeningBoundary(input: {
  totalShards: number;
  records: ReadonlyArray<RuntimeSurvivabilityRecord>;
  /** When provided, asserts no breach exceeded the configured percentage. */
  minPartialSurvivabilityPct?: number;
}): RuntimeHardeningBoundary {
  const total = Math.max(0, input.totalShards);
  const records = input.records;
  const survivingCount       = records.filter((r) => r.verdict === 'SURVIVING').length;
  const partialSurvivingCount = records.filter((r) => r.verdict === 'PARTIAL_SURVIVING').length;
  const ambiguousCount       = records.filter((r) => r.verdict === 'AMBIGUOUS_RUNTIME').length;
  const containedCount       = records.filter((r) => r.verdict === 'CONTAINED').length;
  const contaminatedCount    = records.filter((r) => r.verdict === 'CONTAMINATED').length;
  const breachCount          = records.filter((r) => r.verdict === 'HARDENING_BREACH').length;

  const surfaceObserved =
    survivingCount + partialSurvivingCount + ambiguousCount + containedCount + contaminatedCount + breachCount;
  const denominator = total > 0 ? total : Math.max(1, surfaceObserved);

  const runtimeSurvivabilityRatio = denominator === 0 ? 1 : survivingCount / denominator;
  const partialSurvivabilityPct =
    denominator === 0
      ? 100
      : ((survivingCount + partialSurvivingCount + ambiguousCount + containedCount) / denominator) * 100;
  const faultContainmentPct =
    denominator === 0
      ? 0
      : ((containedCount + contaminatedCount + breachCount) / denominator) * 100;
  const runtimeDriftVisibilityPct =
    denominator === 0
      ? 0
      : ((ambiguousCount + partialSurvivingCount + containedCount) / denominator) * 100;

  const minFloor = input.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT;
  const partitioned = breachCount === 0 && partialSurvivabilityPct >= minFloor;

  const hardeningReason =
    breachCount > 0
      ? `Hardening boundary breached on ${breachCount} shard(s); evaluator-level failure cannot be silently merged with healthy lineage.`
      : partitioned
        ? `Hardening intact — ${survivingCount}/${denominator} healthy, ${partialSurvivingCount} partial, ${ambiguousCount} ambiguous, ${containedCount} contained, ${contaminatedCount} contaminated.`
        : `Partial survivability ${partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%; cannot certify production-runtime hardening.`;

  const boundaryDigest = sha256ForPayload({
    schema: SCHEMA_BOUNDARY,
    totalShards: total,
    survivingCount,
    partialSurvivingCount,
    ambiguousCount,
    containedCount,
    contaminatedCount,
    breachCount,
    recordDigests: records
      .map((r) => r.hardeningDigest)
      .slice()
      .sort(),
  });

  return {
    schema: SCHEMA_BOUNDARY,
    partitioned,
    totalShards: total,
    survivingCount,
    partialSurvivingCount,
    ambiguousCount,
    containedCount,
    contaminatedCount,
    runtimeSurvivabilityRatio,
    partialSurvivabilityPct,
    faultContainmentPct,
    runtimeDriftVisibilityPct,
    hardeningReason,
    boundaryDigest,
    partitionedAt: new Date().toISOString(),
  };
}

/**
 * Strict variant — throws RuntimeHardeningError if the boundary is breached
 * or partial survivability is below the configured floor.
 */
export function assertRuntimeHardeningBoundary(
  boundary: RuntimeHardeningBoundary,
  options: { minPartialSurvivabilityPct?: number } = {},
): void {
  const minFloor = options.minPartialSurvivabilityPct ?? DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT;

  if (!boundary.partitioned) {
    if (boundary.partialSurvivabilityPct < minFloor) {
      throw new RuntimeHardeningError({
        violation: 'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
        message: `Runtime partial survivability ${boundary.partialSurvivabilityPct.toFixed(2)}% below floor ${minFloor}%.`,
        survivabilityPct: boundary.partialSurvivabilityPct,
      });
    }
    throw new RuntimeHardeningError({
      violation: 'BOUNDARY_BREACH',
      message: boundary.hardeningReason,
      survivabilityPct: boundary.partialSurvivabilityPct,
    });
  }
}

/**
 * Hard-fail guard for the "ambiguous runtime forced healthy" anti-pattern.
 * Catches a future regression that would coerce an AMBIGUOUS_RUNTIME verdict
 * back to SURVIVING — the kind of silent collapse this PR exists to prevent.
 */
export function assertAmbiguityPreserved(record: RuntimeSurvivabilityRecord): void {
  if (record.ambiguous && record.verdict !== 'AMBIGUOUS_RUNTIME') {
    throw new RuntimeHardeningError({
      violation: 'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
      message: `Hardening record for ${record.shardId} flagged ambiguous but verdict ${record.verdict} discards uncertainty.`,
      shardId: record.shardId,
      kind: record.kind,
    });
  }
  if (record.verdict === 'SURVIVING' && record.kind !== null) {
    throw new RuntimeHardeningError({
      violation: 'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
      message: `Hardening record for ${record.shardId} marked SURVIVING but carries kind ${record.kind} — uncertainty discarded.`,
      shardId: record.shardId,
      kind: record.kind,
    });
  }
}

/**
 * Hard-fail guard for the "circuit breaker disabled" anti-pattern. Production
 * runtime cannot certify fail-closed semantics if the circuit breaker is
 * explicitly turned off.
 */
export function assertCircuitBreakerEnabled(signal: RuntimeHardeningSignal): void {
  if (signal.circuitBreakerDisabled) {
    throw new RuntimeHardeningError({
      violation: 'CIRCUIT_BREAKER_DISABLED',
      message:
        'Circuit breaker explicitly disabled — production-runtime fail-closed semantics ' +
        'cannot be certified.',
      kind: 'RUNTIME_FAULT_AMBIGUOUS',
    });
  }
}

// ── Replay-performance stabilization ──────────────────────────────────────────

export interface ReplayStabilityWindow {
  schema: 'vitalcv.replay-stability-window.v1';
  /** How many replays the window covers. */
  sampleCount: number;
  /** p50 latency across the window in ms. */
  windowP50Ms: number;
  /** p99 latency across the window in ms. */
  windowP99Ms: number;
  /** Tail headroom: 1 - (p99 - p50) / budget, clamped to [0,1]. */
  tailHeadroomRatio: number;
  /** True iff p99 < tailLatencyBudgetMs AND p99/p50 < varianceBudget. */
  withinBudget: boolean;
  /** Stable iff withinBudget AND no contradiction with the headline tier. */
  stabilized: boolean;
  /** Reason text — always present, deterministic. */
  reason: string;
  /** SHA-256 over the window inputs — deterministic stability fingerprint. */
  stabilityDigest: string;
}

/**
 * Compute a replay-performance stability window. Pure — never throws.
 *
 * `sample` is the array of observed replay latencies in ms. The function
 * returns p50/p99 plus a deterministic stability digest the operator can
 * compare across windows to surface longitudinal drift.
 */
export function computeReplayStabilityWindow(input: {
  sample: ReadonlyArray<number>;
  tailLatencyBudgetMs: number;
  varianceBudget?: number;
}): ReplayStabilityWindow {
  const SCHEMA = 'vitalcv.replay-stability-window.v1' as const;
  const varianceBudget = input.varianceBudget ?? 6;
  const valid = input.sample
    .slice()
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);

  const n = valid.length;
  if (n === 0) {
    const reason = 'No samples in window — cannot certify replay stability.';
    return {
      schema: SCHEMA,
      sampleCount: 0,
      windowP50Ms: 0,
      windowP99Ms: 0,
      tailHeadroomRatio: 0,
      withinBudget: false,
      stabilized: false,
      reason,
      stabilityDigest: sha256ForPayload({
        schema: SCHEMA,
        sampleCount: 0,
        budget: input.tailLatencyBudgetMs,
        varianceBudget,
      }),
    };
  }

  const idxP50 = Math.min(n - 1, Math.max(0, Math.floor(0.5 * (n - 1))));
  const idxP99 = Math.min(n - 1, Math.max(0, Math.ceil(0.99 * (n - 1))));
  const p50 = valid[idxP50];
  const p99 = valid[idxP99];
  const variance = safeVariance(p99, p50);

  const budget = Math.max(1, input.tailLatencyBudgetMs);
  const tailDelta = Math.max(0, p99 - p50);
  const tailHeadroomRatio = clampRatio(1 - tailDelta / budget);
  const withinBudget = p99 <= budget && variance < varianceBudget;
  const stabilized = withinBudget;

  const reason = stabilized
    ? `Replay window stable — n=${n}, p50=${p50.toFixed(2)}ms, p99=${p99.toFixed(2)}ms (variance=${variance.toFixed(2)}x).`
    : `Replay window UNSTABLE — n=${n}, p50=${p50.toFixed(2)}ms, p99=${p99.toFixed(2)}ms (variance=${variance.toFixed(2)}x), budget=${budget}ms.`;

  const stabilityDigest = sha256ForPayload({
    schema: SCHEMA,
    sampleCount: n,
    p50,
    p99,
    variance,
    budget,
    varianceBudget,
    withinBudget,
  });

  return {
    schema: SCHEMA,
    sampleCount: n,
    windowP50Ms: p50,
    windowP99Ms: p99,
    tailHeadroomRatio,
    withinBudget,
    stabilized,
    reason,
    stabilityDigest,
  };
}

// ── Runtime survivability scoring ─────────────────────────────────────────────

export interface RuntimeMaturityScore {
  schema: 'vitalcv.runtime-maturity-score.v1';
  runtimeSurvivabilityPct: number;
  replayPerformanceStabilityPct: number;
  faultContainmentIntegrityPct: number;
  resourceIsolationFidelityPct: number;
  productionRuntimeMaturityPct: number;
  /**
   * Verdict tier:
   *   - PRODUCTION_READY  ≥ 90% maturity, no breach
   *   - PRODUCTION_GUARDED ≥ 75% AND no breach
   *   - PRODUCTION_AT_RISK < 75% OR partial survivability < floor
   *   - PRODUCTION_BLOCKED any HARDENING_BREACH on the boundary
   */
  verdict: 'PRODUCTION_READY' | 'PRODUCTION_GUARDED' | 'PRODUCTION_AT_RISK' | 'PRODUCTION_BLOCKED';
  /** Deterministic score digest — drift across snapshots is operator-visible. */
  scoreDigest: string;
}

/**
 * Compose a single Production Runtime Maturity score from the boundary and
 * replay stability window. Pure — never throws.
 *
 * The four sub-scores are weighted equally (25%) into a single maturity %.
 */
export function computeRuntimeMaturityScore(input: {
  boundary: RuntimeHardeningBoundary;
  replayStability: ReplayStabilityWindow;
  /** Records on the boundary — used to derive isolation fidelity. */
  records: ReadonlyArray<RuntimeSurvivabilityRecord>;
}): RuntimeMaturityScore {
  const SCHEMA = 'vitalcv.runtime-maturity-score.v1' as const;

  const runtimeSurvivabilityPct = input.boundary.partialSurvivabilityPct;
  const replayPerformanceStabilityPct = input.replayStability.stabilized
    ? clampRatio(input.replayStability.tailHeadroomRatio) * 100
    : Math.min(99, clampRatio(input.replayStability.tailHeadroomRatio) * 100);

  const denom = Math.max(1, input.boundary.totalShards);
  // Containment integrity = (1 - breach/total). Containment is good when
  // faults are contained (CONTAINED + CONTAMINATED count toward containment),
  // but BREACH does not.
  const breachCount = denom - (
    input.boundary.survivingCount +
    input.boundary.partialSurvivingCount +
    input.boundary.ambiguousCount +
    input.boundary.containedCount +
    input.boundary.contaminatedCount
  );
  const safeBreach = Math.max(0, breachCount);
  const faultContainmentIntegrityPct = clampRatio(1 - safeBreach / denom) * 100;

  // Resource isolation fidelity = 1 - (any record showing isolation breach
  // tier or cross-tenant bleed) / total.
  const isolationBreachCount = input.records.filter(
    (r) => r.tier === 'ISOLATION_BREACH' || r.kind === 'CROSS_TENANT_RESOURCE_BLEED',
  ).length;
  const resourceIsolationFidelityPct = clampRatio(1 - isolationBreachCount / denom) * 100;

  const productionRuntimeMaturityPct =
    (runtimeSurvivabilityPct +
      replayPerformanceStabilityPct +
      faultContainmentIntegrityPct +
      resourceIsolationFidelityPct) /
    4;

  let verdict: RuntimeMaturityScore['verdict'];
  if (safeBreach > 0) {
    verdict = 'PRODUCTION_BLOCKED';
  } else if (productionRuntimeMaturityPct >= 90 && input.boundary.partitioned) {
    verdict = 'PRODUCTION_READY';
  } else if (productionRuntimeMaturityPct >= 75 && input.boundary.partitioned) {
    verdict = 'PRODUCTION_GUARDED';
  } else {
    verdict = 'PRODUCTION_AT_RISK';
  }

  const scoreDigest = sha256ForPayload({
    schema: SCHEMA,
    runtimeSurvivabilityPct,
    replayPerformanceStabilityPct,
    faultContainmentIntegrityPct,
    resourceIsolationFidelityPct,
    productionRuntimeMaturityPct,
    verdict,
    boundaryDigest: input.boundary.boundaryDigest,
    replayStabilityDigest: input.replayStability.stabilityDigest,
  });

  return {
    schema: SCHEMA,
    runtimeSurvivabilityPct,
    replayPerformanceStabilityPct,
    faultContainmentIntegrityPct,
    resourceIsolationFidelityPct,
    productionRuntimeMaturityPct,
    verdict,
    scoreDigest,
  };
}

// ── Lineage reconstruction ────────────────────────────────────────────────────

/**
 * Trace a fault lineage from a single quarantined root through a set of
 * candidate shards. Pure — never throws.
 */
export function traceRuntimeFaultLineage(input: {
  rootShardId: string;
  rootHints: Partial<RuntimeShardLineageHints>;
  candidates: ReadonlyArray<{ shardId: string; hints: Partial<RuntimeShardLineageHints> }>;
}): RuntimeFaultLineage {
  const root = normalizeHints(input.rootHints);
  const reconstructedAt = new Date().toISOString();
  const edges: RuntimeFaultEdge[] = [];
  const contaminatedSet = new Set<string>();

  for (const c of input.candidates) {
    if (c.shardId === input.rootShardId) continue;
    const cand = normalizeHints(c.hints);
    let edged = false;

    if (root.tenantPoolId !== null && cand.tenantPoolId === root.tenantPoolId) {
      edges.push({
        fromShardId: input.rootShardId,
        toShardId: c.shardId,
        reason: 'SHARED_TENANT_POOL',
      });
      edged = true;
    }
    if (root.replayShardId !== null && cand.replayShardId === root.replayShardId) {
      edges.push({
        fromShardId: input.rootShardId,
        toShardId: c.shardId,
        reason: 'SHARED_REPLAY_SHARD',
      });
      edged = true;
    }
    if (
      root.governanceRuleScopeId !== null &&
      cand.governanceRuleScopeId === root.governanceRuleScopeId
    ) {
      edges.push({
        fromShardId: input.rootShardId,
        toShardId: c.shardId,
        reason: 'SHARED_GOVERNANCE_SCOPE',
      });
      edged = true;
    }
    if (edged) contaminatedSet.add(c.shardId);
  }

  const contaminated = [...contaminatedSet].sort();
  const sortedEdges = edges
    .slice()
    .sort(
      (a, b) =>
        a.toShardId.localeCompare(b.toShardId) || a.reason.localeCompare(b.reason),
    );

  const reconstructionDigest = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    rootShardId: input.rootShardId,
    contaminated,
    edges: sortedEdges,
  });

  return {
    schema: SCHEMA_LINEAGE,
    rootShardId: input.rootShardId,
    contaminatedShardIds: contaminated,
    edges: sortedEdges,
    reconstructionDigest,
    reconstructedAt,
  };
}

// ── Sentinels (exported for tests / CI gates) ─────────────────────────────────

export const HARDENING_SENTINELS = Object.freeze({
  DEFAULT_MIN_PARTIAL_SURVIVABILITY_PCT,
  SCHEMA_RECORD,
  SCHEMA_BOUNDARY,
  SCHEMA_LINEAGE,
});

export const KNOWN_RUNTIME_TIERS = Object.freeze([
  'HEALTHY',
  'DEGRADED',
  'STRESSED',
  'CIRCUIT_OPEN',
  'ISOLATION_BREACH',
  'AMBIGUOUS_RUNTIME',
] as const);

export const KNOWN_RUNTIME_FAULT_KINDS = Object.freeze([
  'REPLAY_BACKPRESSURE',
  'GOVERNANCE_RULE_TIMEOUT',
  'TENANT_RESOURCE_EXHAUSTION',
  'CROSS_TENANT_RESOURCE_BLEED',
  'REPLAY_VARIANCE_SPIKE',
  'CIRCUIT_BREAKER_OPEN',
  'RUNTIME_FAULT_AMBIGUOUS',
] as const);

export const KNOWN_RUNTIME_SURVIVABILITY_VERDICTS = Object.freeze([
  'SURVIVING',
  'PARTIAL_SURVIVING',
  'AMBIGUOUS_RUNTIME',
  'CONTAINED',
  'CONTAMINATED',
  'HARDENING_BREACH',
] as const);

export const KNOWN_RUNTIME_HARDENING_VIOLATIONS = Object.freeze([
  'AMBIGUOUS_RUNTIME_FORCED_HEALTHY',
  'BOUNDARY_BREACH',
  'PARTIAL_SURVIVABILITY_FLOOR_BREACHED',
  'ISOLATION_OPEN_FAILURE',
  'CIRCUIT_BREAKER_DISABLED',
] as const);
