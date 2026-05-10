/**
 * Multi-institution replay load testing (W2-PR113A).
 *
 * Pure deterministic load simulator over a synthetic multi-institution
 * workload. Does NOT make network calls; the simulator models a
 * single-queue replay-classifier under load using a closed-form
 * approximation that mirrors W2-PR33A reconstruction semantics.
 *
 * Output: per-org throughput + latency percentiles + contention map +
 * saturation finding. Reproducible — identical input ⇒ identical output.
 */

import { createHash } from "node:crypto";
import { canonicalize } from "./tamper-evident-persistence.js";

// ---------------------------------------------------------------------------
// Workload + simulator inputs
// ---------------------------------------------------------------------------

export interface OrgWorkload {
  readonly orgId: string;
  /** Requests per second offered by this org. */
  readonly requestsPerSecond: number;
  /** Fraction of requests that produce R-AMBIGUOUS observations (0..1). */
  readonly ambiguityRatio: number;
  /** Per-request CPU cost in arbitrary units (caller defines unit). */
  readonly cpuCostPerRequest: number;
}

export interface SystemCapacity {
  /** Total CPU units the replay-classifier can spend per second. */
  readonly cpuUnitsPerSecond: number;
  /** Maximum concurrent in-flight requests before queueing collapses. */
  readonly maxConcurrentInFlight: number;
  /**
   * Latency floor for a single request when the system is uncontended
   * (ms). Caller-supplied; typical: 5–50ms.
   */
  readonly baseLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Per-org result
// ---------------------------------------------------------------------------

export interface OrgLoadResult {
  readonly orgId: string;
  readonly offeredRps: number;
  readonly servedRps: number;
  readonly droppedRps: number;
  /** p50 / p95 / p99 latency in ms; under saturation p99 inflates super-linearly. */
  readonly p50LatencyMs: number;
  readonly p95LatencyMs: number;
  readonly p99LatencyMs: number;
  /** Observed ambiguity rate in served traffic (preserved end-to-end). */
  readonly observedAmbiguityRatio: number;
  /** True iff this org's offered load exceeded its proportional capacity. */
  readonly contended: boolean;
}

// ---------------------------------------------------------------------------
// Saturation report
// ---------------------------------------------------------------------------

export const SATURATION_LEVELS = [
  "UNDERUTILIZED",
  "HEALTHY",
  "PRESSURED",
  "SATURATED",
  "COLLAPSED",
] as const;
export type SaturationLevel = (typeof SATURATION_LEVELS)[number];

export interface ReplayLoadSimulation {
  readonly executedAt: string;
  readonly capacity: SystemCapacity;
  readonly perOrg: readonly OrgLoadResult[];
  /** Aggregate utilization 0..1+ (>1 = saturated). */
  readonly aggregateUtilization: number;
  /** Aggregate served:offered ratio 0..1. */
  readonly aggregateServedRatio: number;
  /** Worst observed p99 latency across orgs (ms). */
  readonly worstP99LatencyMs: number;
  readonly saturationLevel: SaturationLevel;
  /**
   * True iff observed ambiguity ratio diverged from offered ambiguity
   * ratio in any org by more than 1% — silent ambiguity loss under load.
   */
  readonly ambiguityErasureDetected: boolean;
  /** Deterministic hash binding inputs + outputs for tamper evidence. */
  readonly simulationHash: string;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Run the deterministic load simulation.
 *
 * Model:
 *   1. Total offered CPU = Σ(rps_org × cpu_cost_org)
 *   2. utilization = offered_cpu / capacity.cpuUnitsPerSecond
 *   3. If utilization ≤ 1, every org's requests are served (servedRps =
 *      offeredRps). Latency p50 = baseLatency × (1 + 0.5×util),
 *      p95 = base × (1 + 1.5×util), p99 = base × (1 + 3×util).
 *   4. If utilization > 1 (saturation), each org's served capacity is
 *      proportional to its share: served_org = offered_org × (1/util).
 *      Dropped = offered − served. Latency p99 inflates super-linearly:
 *      p99 = base × (1 + 3×util + (util-1)²×20).
 *   5. Concurrent in-flight estimated as Σ(served_rps × p50_ms / 1000).
 *      If estimate > maxConcurrentInFlight ⇒ COLLAPSED.
 *   6. Ambiguity ratio is preserved exactly (drops are uniform across
 *      a request stream); no silent erasure.
 */
export function simulateReplayLoad(
  workloads: readonly OrgWorkload[],
  capacity: SystemCapacity,
  nowIso: string,
): ReplayLoadSimulation {
  const offeredCpu = workloads.reduce((a, w) => a + w.requestsPerSecond * w.cpuCostPerRequest, 0);
  // Zero-capacity ⇒ fail-closed: treat as fully saturated (servedFraction=0)
  const zeroCapacity = capacity.cpuUnitsPerSecond <= 0;
  const utilization = zeroCapacity
    ? (offeredCpu === 0 ? 0 : 9999) // sentinel for "infinite" within finite hashable range
    : offeredCpu / capacity.cpuUnitsPerSecond;
  const saturated = utilization > 1;
  const servedFraction = zeroCapacity ? 0 : (saturated ? 1 / utilization : 1);

  // Latency model
  const base = capacity.baseLatencyMs;
  const p50 = base * (1 + 0.5 * Math.min(1, utilization));
  const p95 = base * (1 + 1.5 * Math.min(1, utilization));
  const p99 = saturated
    ? base * (1 + 3 * Math.min(1, utilization) + Math.pow(utilization - 1, 2) * 20)
    : base * (1 + 3 * utilization);

  let totalOffered = 0;
  let totalServed = 0;
  let worstP99 = 0;
  let ambigErasure = false;
  const perOrg: OrgLoadResult[] = workloads.map((w) => {
    const served = w.requestsPerSecond * servedFraction;
    const dropped = w.requestsPerSecond - served;
    totalOffered += w.requestsPerSecond;
    totalServed += served;
    if (p99 > worstP99) worstP99 = p99;
    // Ambiguity preservation: served stream retains the same ratio
    const observedAmbig = w.ambiguityRatio;
    if (Math.abs(observedAmbig - w.ambiguityRatio) > 0.01) ambigErasure = true;
    return Object.freeze({
      orgId: w.orgId,
      offeredRps: w.requestsPerSecond,
      servedRps: served,
      droppedRps: dropped,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
      p99LatencyMs: p99,
      observedAmbiguityRatio: observedAmbig,
      contended: dropped > 0,
    });
  });

  // Concurrent in-flight check
  const estimatedInFlight = perOrg.reduce((a, o) => a + (o.servedRps * o.p50LatencyMs) / 1000, 0);
  const collapsed = estimatedInFlight > capacity.maxConcurrentInFlight;

  let saturationLevel: SaturationLevel;
  if (collapsed) saturationLevel = "COLLAPSED";
  else if (utilization > 1) saturationLevel = "SATURATED";
  else if (utilization > 0.85) saturationLevel = "PRESSURED";
  else if (utilization < 0.3) saturationLevel = "UNDERUTILIZED";
  else saturationLevel = "HEALTHY";

  const aggregateServedRatio = totalOffered === 0 ? 1 : totalServed / totalOffered;

  const preHash = {
    capacity,
    workloads: [...workloads].sort((a, b) => a.orgId.localeCompare(b.orgId)),
    perOrg: [...perOrg].sort((a, b) => a.orgId.localeCompare(b.orgId)),
    utilization,
    aggregateServedRatio,
    saturationLevel,
    worstP99,
    ambiguityErasureDetected: ambigErasure,
  };
  const simulationHash = sha256Hex(canonicalize(preHash));

  return Object.freeze({
    executedAt: nowIso,
    capacity,
    perOrg: Object.freeze(perOrg),
    aggregateUtilization: utilization,
    aggregateServedRatio,
    worstP99LatencyMs: worstP99,
    saturationLevel,
    ambiguityErasureDetected: ambigErasure,
    simulationHash,
  });
}

// ---------------------------------------------------------------------------
// Cross-org contention map
// ---------------------------------------------------------------------------

export interface ContentionMap {
  /** Orgs whose offered load was reduced (dropped > 0). */
  readonly contendedOrgs: readonly string[];
  /** Per-org served:offered ratio. */
  readonly perOrgServedRatio: Readonly<Record<string, number>>;
  /**
   * Largest gap between any two orgs' served ratios (0..1). Larger ⇒
   * unfair queueing; the simulator's proportional model means this is
   * always 0 — caller-supplied alternative queueing policies would
   * surface here.
   */
  readonly maxFairnessGap: number;
}

export function deriveContentionMap(sim: ReplayLoadSimulation): ContentionMap {
  const contended = sim.perOrg.filter((o) => o.contended).map((o) => o.orgId);
  const ratios: Record<string, number> = {};
  for (const o of sim.perOrg) {
    ratios[o.orgId] = o.offeredRps === 0 ? 1 : o.servedRps / o.offeredRps;
  }
  const ratioValues = Object.values(ratios);
  const maxFairnessGap =
    ratioValues.length === 0 ? 0 : Math.max(...ratioValues) - Math.min(...ratioValues);
  return Object.freeze({
    contendedOrgs: Object.freeze(contended),
    perOrgServedRatio: Object.freeze(ratios),
    maxFairnessGap,
  });
}

// ---------------------------------------------------------------------------
// CI gate
// ---------------------------------------------------------------------------

export type ReplayLoadFinding =
  | { readonly tag: "saturation-collapsed" }
  | { readonly tag: "saturation-saturated"; readonly utilization: number }
  | { readonly tag: "p99-latency-spike"; readonly observed: number; readonly threshold: number }
  | { readonly tag: "ambiguity-erasure-under-load" }
  | { readonly tag: "served-ratio-below-floor"; readonly observed: number; readonly threshold: number };

export interface ReplayLoadReport {
  readonly executedAt: string;
  readonly simulation: ReplayLoadSimulation;
  readonly contention: ContentionMap;
  readonly findings: readonly ReplayLoadFinding[];
  readonly hasCiGatingCondition: boolean;
}

export function buildReplayLoadReport(
  workloads: readonly OrgWorkload[],
  capacity: SystemCapacity,
  nowIso: string,
  options: { readonly p99LatencyThresholdMs?: number; readonly minServedRatio?: number } = {},
): ReplayLoadReport {
  const p99Threshold = options.p99LatencyThresholdMs ?? 2000;
  const minServed = options.minServedRatio ?? 0.95;
  const sim = simulateReplayLoad(workloads, capacity, nowIso);
  const contention = deriveContentionMap(sim);
  const findings: ReplayLoadFinding[] = [];

  if (sim.saturationLevel === "COLLAPSED") {
    findings.push({ tag: "saturation-collapsed" });
  } else if (sim.saturationLevel === "SATURATED") {
    findings.push({ tag: "saturation-saturated", utilization: sim.aggregateUtilization });
  }
  if (sim.worstP99LatencyMs > p99Threshold) {
    findings.push({ tag: "p99-latency-spike", observed: sim.worstP99LatencyMs, threshold: p99Threshold });
  }
  if (sim.ambiguityErasureDetected) {
    findings.push({ tag: "ambiguity-erasure-under-load" });
  }
  if (sim.aggregateServedRatio < minServed) {
    findings.push({ tag: "served-ratio-below-floor", observed: sim.aggregateServedRatio, threshold: minServed });
  }

  return Object.freeze({
    executedAt: nowIso,
    simulation: sim,
    contention,
    findings: Object.freeze(findings),
    hasCiGatingCondition: findings.length > 0,
  });
}
