/**
 * runtimeProductionSeal.ts — W2-PR170A
 *
 * Pure production-seal evaluator. Seals the constitutional runtime as
 * production-grade institutional trust infrastructure.
 *
 * Covers:
 *   1. Production seal verification — globally verified or fail-closed
 *   2. Replay-production immutability — replays locked against post-seal mutation
 *   3. Governance-runtime permanence — governance state permanent after seal
 *   4. Production seal telemetry — longitudinally observable seal state
 *   5. Runtime durability scoring — durability scored across all seven domains
 *   6. Production chaos simulations — eight adversarial scenarios each surface signals
 *   7. Production-seal CI gates — seven binary gates enforce the seal contract
 *
 * No fetches, no DB writes, no audit writes. Callers supply evidence; this
 * module returns deterministic verdicts, scores, lineage, and chaos reports.
 */

import { sha256ForPayload } from '../../utils/deterministic';

// ── Domain taxonomy ──────────────────────────────────────────────────────────

export type ProductionSealDomain =
  | 'production_seal_verification'
  | 'replay_production_immutability'
  | 'governance_runtime_permanence'
  | 'production_seal_telemetry'
  | 'runtime_durability_scoring'
  | 'production_chaos_resilience'
  | 'constitutional_trust_stability';

// ── Evidence ─────────────────────────────────────────────────────────────────

export interface ProductionSealEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: ProductionSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  /** 0–1: fidelity of the production seal for this evidence entry */
  sealFidelity: number;
  /** 0–1: immutability of replay records observed by this entry */
  immutabilityScore: number;
  /** 0–1: permanence of governance state observed by this entry */
  permanenceScore: number;
  /** 0–1: observability of production telemetry */
  telemetryScore: number;
  /** 0–1: longitudinal durability of the runtime */
  durabilityScore: number;
  /** 0–1: resilience against chaos scenarios */
  chaosResilienceScore: number;
  /** 0–1: stability of constitutional trust */
  constitutionalStability: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  telemetryRefs: readonly string[];
  /** Signals of observed or potential drift */
  driftSignals: readonly string[];
  /** Signals from chaos probes */
  chaosSignals: readonly string[];
  /** Non-null when a drift risk is recorded on this entry */
  driftRisk: string | null;
}

// ── Lineage ───────────────────────────────────────────────────────────────────

export interface ProductionSealLineageEntry {
  position: number;
  evidenceId: string;
  recordedAt: string;
  domain: ProductionSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  telemetryRefCount: number;
  driftSignalCount: number;
  chaosSignalCount: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  driftRisk: boolean;
  evidenceHash: string;
}

export interface ProductionSealLineage {
  schema: 'vitalcv.runtime-production-seal-lineage.v1';
  sealId: string;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  domainsObserved: readonly ProductionSealDomain[];
  sourceSystemIds: readonly string[];
  timeline: readonly ProductionSealLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export type ProductionSealStatus =
  | 'PRODUCTION_SEAL_READY'
  | 'PRODUCTION_SEAL_DEGRADED'
  | 'PRODUCTION_SEAL_BLOCKED';

export type ProductionSealVerdict =
  | 'PRODUCTION_SEALED'
  | 'PRODUCTION_SEALED_WITH_DRIFT_RISK'
  | 'PRODUCTION_PARTIAL'
  | 'PRODUCTION_FAIL_CLOSED';

export interface ProductionSealResult {
  schema: 'vitalcv.runtime-production-seal.v1';
  sealId: string;
  generatedAt: string;
  status: ProductionSealStatus;
  verdict: ProductionSealVerdict;
  failClosed: boolean;
  /** Completion board: Production Seal Maturity % */
  sealMaturityScore: number;
  blockers: readonly string[];
  driftSignals: readonly string[];
  lineage: ProductionSealLineage;
  /** Completion board: Replay Production Fidelity % */
  replayFidelity: {
    immutable: boolean;
    fidelityPct: number;
    traceCoveragePct: number;
    mutableReplayIds: readonly string[];
  };
  /** Completion board: Runtime Permanence % */
  runtimePermanence: {
    permanent: boolean;
    permanencePct: number;
    governanceSealedPct: number;
  };
  /** Completion board: Drift Resistance % */
  driftResistance: {
    impossible: boolean;
    resistancePct: number;
    driftRiskIds: readonly string[];
  };
  /** Completion board: Constitutional Trust Stability % */
  constitutionalTrust: {
    stable: boolean;
    stabilityPct: number;
    longitudinallyDurable: boolean;
    durabilityPct: number;
    firstRecordedAt: string | null;
    lastRecordedAt: string | null;
  };
  productionTelemetry: {
    observable: boolean;
    observabilityPct: number;
    telemetryRefCount: number;
  };
  chaosResilience: {
    resilient: boolean;
    resiliencePct: number;
    chaosSignalCount: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  sealHash: string;
}

// ── CI Gates ──────────────────────────────────────────────────────────────────

export type ProductionSealGateId =
  | 'production_seal_globally_verified'
  | 'replay_production_immutable'
  | 'governance_permanently_sealed'
  | 'fail_closed_production_semantics'
  | 'drift_impossible_post_production_seal'
  | 'production_telemetry_observable'
  | 'runtime_durability_longitudinally_scored';

export interface ProductionSealGate {
  id: ProductionSealGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface ProductionSealGateResult {
  schema: 'vitalcv.runtime-production-seal-ci-gate.v1';
  pass: boolean;
  gates: readonly ProductionSealGate[];
  failedGateIds: readonly ProductionSealGateId[];
  gateHash: string;
}

// ── Chaos ─────────────────────────────────────────────────────────────────────

export type ProductionSealChaosScenarioName =
  | 'PRODUCTION_SEAL_CORRUPTION'
  | 'REPLAY_PRODUCTION_MUTATION'
  | 'GOVERNANCE_PERMANENCE_COLLAPSE'
  | 'TELEMETRY_BLACKOUT'
  | 'DURABILITY_SCORING_FAILURE'
  | 'FAIL_CLOSED_OVERRIDE'
  | 'CONSTITUTIONAL_DRIFT'
  | 'CHAOS_RESILIENCE_EXHAUSTION';

export interface ProductionSealChaosScenarioResult {
  scenario: ProductionSealChaosScenarioName;
  signalSurfaced: boolean;
  status: ProductionSealStatus;
  failedGateIds: readonly ProductionSealGateId[];
  surfacedSignals: readonly string[];
}

export interface ProductionSealChaosReport {
  schema: 'vitalcv.runtime-production-seal-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly ProductionSealChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface ProductionSealInput {
  sealId: string;
  generatedAt: string;
  evidence: readonly ProductionSealEvidence[];
}

// ── Sentinels / constants ─────────────────────────────────────────────────────

const SCHEMA_LINEAGE = 'vitalcv.runtime-production-seal-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.runtime-production-seal.v1' as const;
const SCHEMA_GATE = 'vitalcv.runtime-production-seal-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.runtime-production-seal-chaos.v1' as const;

const MIN_SCORE = 75;
const MIN_TRACE_COVERAGE = 85;
const MIN_TEMPORAL_SPREAD = 3;

const REQUIRED_DOMAINS: readonly ProductionSealDomain[] = Object.freeze([
  'production_seal_verification',
  'replay_production_immutability',
  'governance_runtime_permanence',
  'production_seal_telemetry',
  'runtime_durability_scoring',
  'production_chaos_resilience',
  'constitutional_trust_stability',
]);

export const PRODUCTION_SEAL_GATE_IDS: readonly ProductionSealGateId[] = Object.freeze([
  'production_seal_globally_verified',
  'replay_production_immutable',
  'governance_permanently_sealed',
  'fail_closed_production_semantics',
  'drift_impossible_post_production_seal',
  'production_telemetry_observable',
  'runtime_durability_longitudinally_scored',
]);

export const PRODUCTION_SEAL_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
  minScore: MIN_SCORE,
  requiredDomains: REQUIRED_DOMAINS,
});

// ── Internal normalisation helpers ────────────────────────────────────────────

interface NormalizedEvidence {
  evidenceId: string;
  recordedAt: string;
  domain: ProductionSealDomain;
  sourceSystemId: string;
  replayTraceId: string | null;
  sealFidelity: number;
  immutabilityScore: number;
  permanenceScore: number;
  telemetryScore: number;
  durabilityScore: number;
  chaosResilienceScore: number;
  constitutionalStability: number;
  sealed: boolean;
  immutable: boolean;
  failClosedReady: boolean;
  evidenceRefs: readonly string[];
  lineageRefs: readonly string[];
  telemetryRefs: readonly string[];
  driftSignals: readonly string[];
  chaosSignals: readonly string[];
  driftRisk: string | null;
}

function cleanStr(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function requiredStr(value: string, fallback: string): string {
  return cleanStr(value) ?? fallback;
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map(v => cleanStr(v)).filter((v): v is string => v !== null)),
  ).sort();
}

function dedupeChronological(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const c = cleanStr(v);
    if (c && !seen.has(c)) { seen.add(c); out.push(c); }
  }
  return out;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return v > 1 ? 1 : v;
}

function pct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(0, Math.min(100, v)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function normalize(evidence: readonly ProductionSealEvidence[]): NormalizedEvidence[] {
  return evidence
    .map((e, i) => ({
      evidenceId: requiredStr(e.evidenceId, `missing-production-evidence-${i}`),
      recordedAt: requiredStr(e.recordedAt, '0000-00-00T00:00:00.000Z'),
      domain: e.domain,
      sourceSystemId: requiredStr(e.sourceSystemId, 'missing-source-system'),
      replayTraceId: cleanStr(e.replayTraceId),
      sealFidelity: clamp01(e.sealFidelity),
      immutabilityScore: clamp01(e.immutabilityScore),
      permanenceScore: clamp01(e.permanenceScore),
      telemetryScore: clamp01(e.telemetryScore),
      durabilityScore: clamp01(e.durabilityScore),
      chaosResilienceScore: clamp01(e.chaosResilienceScore),
      constitutionalStability: clamp01(e.constitutionalStability),
      sealed: e.sealed === true,
      immutable: e.immutable === true,
      failClosedReady: e.failClosedReady === true,
      evidenceRefs: dedupeSorted(e.evidenceRefs),
      lineageRefs: dedupeSorted(e.lineageRefs),
      telemetryRefs: dedupeSorted(e.telemetryRefs),
      driftSignals: dedupeSorted(e.driftSignals),
      chaosSignals: dedupeSorted(e.chaosSignals),
      driftRisk: cleanStr(e.driftRisk),
    }))
    .sort(
      (a, b) =>
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.evidenceId.localeCompare(b.evidenceId),
    );
}

function computeEvidenceHash(e: NormalizedEvidence): string {
  return sha256ForPayload({
    evidenceId: e.evidenceId,
    recordedAt: e.recordedAt,
    domain: e.domain,
    sourceSystemId: e.sourceSystemId,
    replayTraceId: e.replayTraceId,
    sealFidelity: e.sealFidelity,
    immutabilityScore: e.immutabilityScore,
    permanenceScore: e.permanenceScore,
    telemetryScore: e.telemetryScore,
    durabilityScore: e.durabilityScore,
    chaosResilienceScore: e.chaosResilienceScore,
    constitutionalStability: e.constitutionalStability,
    sealed: e.sealed,
    immutable: e.immutable,
    failClosedReady: e.failClosedReady,
    evidenceRefs: e.evidenceRefs,
    lineageRefs: e.lineageRefs,
    telemetryRefs: e.telemetryRefs,
    driftSignals: e.driftSignals,
    chaosSignals: e.chaosSignals,
    driftRisk: e.driftRisk,
  });
}

function observedDomains(evidence: readonly NormalizedEvidence[]): ProductionSealDomain[] {
  const present = new Set(evidence.map(e => e.domain));
  return REQUIRED_DOMAINS.filter(d => present.has(d));
}

function hasAllDomains(evidence: readonly NormalizedEvidence[]): boolean {
  const present = new Set(evidence.map(e => e.domain));
  return REQUIRED_DOMAINS.every(d => present.has(d));
}

// ── Lineage builder ───────────────────────────────────────────────────────────

function buildLineageFromNormalized(input: {
  sealId: string;
  generatedAt: string;
  evidence: readonly NormalizedEvidence[];
}): ProductionSealLineage {
  const timeline: ProductionSealLineageEntry[] = input.evidence.map((e, i) => ({
    position: i + 1,
    evidenceId: e.evidenceId,
    recordedAt: e.recordedAt,
    domain: e.domain,
    sourceSystemId: e.sourceSystemId,
    replayTraceId: e.replayTraceId,
    evidenceRefCount: e.evidenceRefs.length,
    lineageRefCount: e.lineageRefs.length,
    telemetryRefCount: e.telemetryRefs.length,
    driftSignalCount: e.driftSignals.length,
    chaosSignalCount: e.chaosSignals.length,
    sealed: e.sealed,
    immutable: e.immutable,
    failClosedReady: e.failClosedReady,
    driftRisk: e.driftRisk !== null,
    evidenceHash: computeEvidenceHash(e),
  }));

  const body = {
    schema: SCHEMA_LINEAGE,
    sealId: input.sealId,
    firstRecordedAt: timeline[0]?.recordedAt ?? null,
    lastRecordedAt: timeline[timeline.length - 1]?.recordedAt ?? null,
    domainsObserved: observedDomains(input.evidence),
    sourceSystemIds: dedupeSorted(input.evidence.map(e => e.sourceSystemId)),
    timeline,
    generatedAt: input.generatedAt,
  };

  return { ...body, lineageHash: sha256ForPayload(body) };
}

export function buildProductionSealLineage(input: ProductionSealInput): ProductionSealLineage {
  return buildLineageFromNormalized({ ...input, evidence: normalize(input.evidence) });
}

// ── Main evaluator ────────────────────────────────────────────────────────────

export function evaluateProductionSeal(input: ProductionSealInput): ProductionSealResult {
  const evidence = normalize(input.evidence);
  const lineage = buildLineageFromNormalized({ ...input, evidence });
  const hasDomains = hasAllDomains(evidence);

  // ── Replay production fidelity ──────────────────────────────────────────────
  const traceCoveragePct = evidence.length > 0
    ? pct((evidence.filter(e => e.replayTraceId !== null).length / evidence.length) * 100)
    : 0;
  const sealFidelityPct = pct(average(evidence.map(e => e.sealFidelity)) * 100);
  const immutabilityPct = pct(average(evidence.map(e => e.immutabilityScore)) * 100);
  const replayFidelityPct = pct((sealFidelityPct + immutabilityPct) / 2);
  const mutableReplayIds = evidence
    .filter(e => !e.sealed || !e.immutable)
    .map(e => e.evidenceId);
  const allSealedImmutable = evidence.length > 0 && mutableReplayIds.length === 0;
  const replayImmutable =
    evidence.length >= REQUIRED_DOMAINS.length
    && hasDomains
    && replayFidelityPct >= MIN_SCORE
    && traceCoveragePct >= MIN_TRACE_COVERAGE
    && allSealedImmutable;

  // ── Governance-runtime permanence ───────────────────────────────────────────
  const permanencePct = pct(average(evidence.map(e => e.permanenceScore)) * 100);
  const governanceDomainEvidence = evidence.filter(
    e => e.domain === 'governance_runtime_permanence',
  );
  const governanceSealedPct = governanceDomainEvidence.length === 0
    ? 0
    : pct(
      (governanceDomainEvidence.filter(e => e.sealed && e.immutable).length /
        governanceDomainEvidence.length) * 100,
    );
  const governancePermanent =
    hasDomains
    && evidence.some(e => e.domain === 'governance_runtime_permanence')
    && permanencePct >= MIN_SCORE
    && governanceSealedPct === 100
    && allSealedImmutable;

  // ── Drift resistance ────────────────────────────────────────────────────────
  const allDriftSignals = dedupeChronological(
    evidence.flatMap(e => e.driftSignals),
  );
  const driftRiskIds = evidence
    .filter(e => e.driftRisk !== null || !e.sealed || !e.immutable)
    .map(e => e.evidenceId);
  const driftResistancePct = evidence.length > 0
    ? pct(
      (evidence.filter(e => e.driftRisk === null && e.sealed && e.immutable).length /
        evidence.length) * 100,
    )
    : 0;
  const driftImpossible =
    hasDomains
    && evidence.some(e => e.domain === 'production_seal_verification')
    && driftRiskIds.length === 0
    && driftResistancePct === 100;

  // ── Production telemetry ────────────────────────────────────────────────────
  const telemetryRefCount = evidence.reduce((s, e) => s + e.telemetryRefs.length, 0);
  const telemetryCoveragePct = evidence.length > 0
    ? pct((evidence.filter(e => e.telemetryRefs.length > 0).length / evidence.length) * 100)
    : 0;
  const telemetryScorePct = pct(average(evidence.map(e => e.telemetryScore)) * 100);
  const observabilityPct = pct((telemetryCoveragePct * 0.5) + (telemetryScorePct * 0.5));
  const telemetryObservable =
    hasDomains
    && evidence.some(e => e.domain === 'production_seal_telemetry')
    && evidence.every(e => e.telemetryRefs.length > 0)
    && allSealedImmutable
    && telemetryScorePct >= MIN_SCORE;

  // ── Chaos resilience ────────────────────────────────────────────────────────
  const allChaosSignals = dedupeChronological(
    evidence.flatMap(e => e.chaosSignals),
  );
  const chaosResiliencePct = pct(average(evidence.map(e => e.chaosResilienceScore)) * 100);
  const chaosResilient =
    hasDomains
    && evidence.some(e => e.domain === 'production_chaos_resilience')
    && chaosResiliencePct >= MIN_SCORE
    && allSealedImmutable;

  // ── Constitutional trust stability ─────────────────────────────────────────
  const stabilityPct = pct(average(evidence.map(e => e.constitutionalStability)) * 100);
  const durabilityPct = pct(average(evidence.map(e => e.durabilityScore)) * 100);
  const uniqueTimestamps = new Set(evidence.map(e => e.recordedAt));
  const runtimeStable = stabilityPct >= MIN_SCORE && allSealedImmutable;
  const longitudinallyDurable =
    runtimeStable
    && hasDomains
    && evidence.some(e => e.domain === 'runtime_durability_scoring')
    && durabilityPct >= MIN_SCORE
    && uniqueTimestamps.size >= MIN_TEMPORAL_SPREAD
    && lineage.firstRecordedAt !== null
    && lineage.lastRecordedAt !== null
    && lineage.firstRecordedAt !== lineage.lastRecordedAt;

  // ── Fail-closed semantics ──────────────────────────────────────────────────
  const failClosedReady = evidence.length > 0 && evidence.every(e => e.failClosedReady);

  // ── Evidence lineage reconstructable ──────────────────────────────────────
  const evidenceRefCount = evidence.reduce((s, e) => s + e.evidenceRefs.length, 0);
  const lineageRefCount = evidence.reduce((s, e) => s + e.lineageRefs.length, 0);
  const sealGloballyVerified =
    evidence.length >= REQUIRED_DOMAINS.length
    && hasDomains
    && evidence.every(e => e.evidenceRefs.length > 0)
    && evidence.every(e => e.lineageRefs.length > 0)
    && replayImmutable
    && governancePermanent
    && failClosedReady;

  // ── Blockers ────────────────────────────────────────────────────────────────
  const blockers: string[] = [];
  if (!sealGloballyVerified) blockers.push('Production seal is not globally verified.');
  if (!replayImmutable) blockers.push('Replay-production immutability is not enforced.');
  if (!governancePermanent) blockers.push('Governance-runtime permanence is not sealed.');
  if (!telemetryObservable) blockers.push('Production seal telemetry is not observable.');
  if (!driftImpossible) blockers.push('Post-production-seal drift is not impossible.');
  if (!failClosedReady) blockers.push('Fail-closed production semantics are not ready.');
  if (!longitudinallyDurable) blockers.push('Runtime durability is not longitudinally scored.');

  const failClosed = blockers.length > 0;

  // ── Scores ──────────────────────────────────────────────────────────────────
  const rawMaturity = pct(
    replayFidelityPct * 0.20
    + permanencePct * 0.15
    + driftResistancePct * 0.18
    + stabilityPct * 0.17
    + durabilityPct * 0.15
    + chaosResiliencePct * 0.08
    + observabilityPct * 0.07,
  );
  const sealMaturityScore = failClosed ? Math.min(rawMaturity, 49) : rawMaturity;

  // ── Status & verdict ────────────────────────────────────────────────────────
  const status: ProductionSealStatus = failClosed
    ? 'PRODUCTION_SEAL_BLOCKED'
    : allDriftSignals.length > 0 || sealMaturityScore < 90
      ? 'PRODUCTION_SEAL_DEGRADED'
      : 'PRODUCTION_SEAL_READY';

  const verdict: ProductionSealVerdict =
    status === 'PRODUCTION_SEAL_BLOCKED'
      ? 'PRODUCTION_FAIL_CLOSED'
      : status === 'PRODUCTION_SEAL_READY'
        ? 'PRODUCTION_SEALED'
        : allDriftSignals.length > 0
          ? 'PRODUCTION_SEALED_WITH_DRIFT_RISK'
          : 'PRODUCTION_PARTIAL';

  // ── Confidence basis ────────────────────────────────────────────────────────
  const basis: string[] = [];
  if (sealGloballyVerified) basis.push('production_seal_globally_verified');
  if (replayImmutable) basis.push('replay_production_immutable');
  if (governancePermanent) basis.push('governance_permanently_sealed');
  if (!failClosed) basis.push('fail_closed_production_semantics');
  if (driftImpossible) basis.push('drift_impossible_post_production_seal');
  if (telemetryObservable) basis.push('production_telemetry_observable');
  if (longitudinallyDurable) basis.push('runtime_durability_longitudinally_scored');

  const body = {
    schema: SCHEMA_RESULT,
    sealId: input.sealId,
    generatedAt: input.generatedAt,
    status,
    verdict,
    failClosed,
    sealMaturityScore,
    blockers,
    driftSignals: allDriftSignals,
    lineageHash: lineage.lineageHash,
    replayFidelity: {
      immutable: replayImmutable,
      fidelityPct: replayFidelityPct,
      traceCoveragePct,
      mutableReplayIds,
    },
    runtimePermanence: {
      permanent: governancePermanent,
      permanencePct,
      governanceSealedPct,
    },
    driftResistance: {
      impossible: driftImpossible,
      resistancePct: driftResistancePct,
      driftRiskIds,
    },
    constitutionalTrust: {
      stable: runtimeStable,
      stabilityPct,
      longitudinallyDurable,
      durabilityPct,
      firstRecordedAt: lineage.firstRecordedAt,
      lastRecordedAt: lineage.lastRecordedAt,
    },
    productionTelemetry: {
      observable: telemetryObservable,
      observabilityPct,
      telemetryRefCount,
    },
    chaosResilience: {
      resilient: chaosResilient,
      resiliencePct: chaosResiliencePct,
      chaosSignalCount: allChaosSignals.length,
    },
    confidence: {
      score: sealMaturityScore,
      basis,
    },
    evidenceRefCount,
    lineageRefCount,
  };

  return { ...body, lineage, sealHash: sha256ForPayload(body) };
}

// ── CI gate evaluator ─────────────────────────────────────────────────────────

export function evaluateProductionSealGate(
  result: ProductionSealResult,
): ProductionSealGateResult {
  const gates: ProductionSealGate[] = [
    {
      id: 'production_seal_globally_verified',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'replay_production_immutable',
      pass: result.replayFidelity.immutable,
      observed: result.replayFidelity.fidelityPct,
      required: MIN_SCORE,
    },
    {
      id: 'governance_permanently_sealed',
      pass: result.runtimePermanence.permanent,
      observed: result.runtimePermanence.permanencePct,
      required: MIN_SCORE,
    },
    {
      id: 'fail_closed_production_semantics',
      pass: !result.failClosed,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'drift_impossible_post_production_seal',
      pass: result.driftResistance.impossible,
      observed: result.driftResistance.resistancePct,
      required: 100,
    },
    {
      id: 'production_telemetry_observable',
      pass: result.productionTelemetry.observable,
      observed: result.productionTelemetry.observabilityPct,
      required: MIN_SCORE,
    },
    {
      id: 'runtime_durability_longitudinally_scored',
      pass: result.constitutionalTrust.longitudinallyDurable,
      observed: result.constitutionalTrust.durabilityPct,
      required: MIN_SCORE,
    },
  ];
  const failedGateIds = gates.filter(g => !g.pass).map(g => g.id);
  const body = { schema: SCHEMA_GATE, pass: failedGateIds.length === 0, gates, failedGateIds };
  return { ...body, gateHash: sha256ForPayload(body) };
}

// ── Durability scoring helper ─────────────────────────────────────────────────

export interface RuntimeDurabilityScore {
  schema: 'vitalcv.runtime-durability-score.v1';
  sealId: string;
  generatedAt: string;
  overallDurabilityPct: number;
  replayFidelityPct: number;
  permanencePct: number;
  driftResistancePct: number;
  stabilityPct: number;
  durabilityPct: number;
  chaosResiliencePct: number;
  observabilityPct: number;
  longitudinallyDurable: boolean;
  scoreHash: string;
}

export function scoreRuntimeDurability(
  input: ProductionSealInput,
): RuntimeDurabilityScore {
  const result = evaluateProductionSeal(input);
  const body = {
    schema: 'vitalcv.runtime-durability-score.v1' as const,
    sealId: input.sealId,
    generatedAt: input.generatedAt,
    overallDurabilityPct: result.sealMaturityScore,
    replayFidelityPct: result.replayFidelity.fidelityPct,
    permanencePct: result.runtimePermanence.permanencePct,
    driftResistancePct: result.driftResistance.resistancePct,
    stabilityPct: result.constitutionalTrust.stabilityPct,
    durabilityPct: result.constitutionalTrust.durabilityPct,
    chaosResiliencePct: result.chaosResilience.resiliencePct,
    observabilityPct: result.productionTelemetry.observabilityPct,
    longitudinallyDurable: result.constitutionalTrust.longitudinallyDurable,
  };
  return { ...body, scoreHash: sha256ForPayload(body) };
}

// ── Chaos simulations ─────────────────────────────────────────────────────────

function chaosResult(
  scenario: ProductionSealChaosScenarioName,
  mutated: ProductionSealResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): ProductionSealChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: mutated.status,
    failedGateIds: evaluateProductionSealGate(mutated).failedGateIds,
    surfacedSignals,
  };
}

export function runProductionSealChaosSimulations(
  input: ProductionSealInput,
): ProductionSealChaosReport {
  const baseline = evaluateProductionSeal(input);
  const baselineGate = evaluateProductionSealGate(baseline);

  // 1. PRODUCTION_SEAL_CORRUPTION — degrade seal fidelity on all evidence
  const sealCorrupted = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e => ({
      ...e,
      sealFidelity: 0.1,
      sealed: false,
      immutable: false,
    })),
  });
  const sealCorruptedGate = evaluateProductionSealGate(sealCorrupted);

  // 2. REPLAY_PRODUCTION_MUTATION — strip replay traces + drop immutability
  const replayMutated = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e =>
      e.domain === 'replay_production_immutability'
        ? { ...e, replayTraceId: null, immutabilityScore: 0.1, sealed: false, immutable: false }
        : e,
    ),
  });
  const replayMutatedGate = evaluateProductionSealGate(replayMutated);

  // 3. GOVERNANCE_PERMANENCE_COLLAPSE — collapse governance permanence
  const govCollapsed = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e =>
      e.domain === 'governance_runtime_permanence'
        ? { ...e, permanenceScore: 0.1, sealed: false, immutable: false }
        : e,
    ),
  });
  const govCollapsedGate = evaluateProductionSealGate(govCollapsed);

  // 4. TELEMETRY_BLACKOUT — remove all telemetry refs and seal telemetry domain
  const telemetryBlackout = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e =>
      e.domain === 'production_seal_telemetry'
        ? { ...e, telemetryRefs: [], telemetryScore: 0.1, sealed: false }
        : e,
    ),
  });
  const telemetryBlackoutGate = evaluateProductionSealGate(telemetryBlackout);

  // 5. DURABILITY_SCORING_FAILURE — collapse durability on all evidence
  const durabilityFailed = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e => ({
      ...e,
      recordedAt: '2026-05-11T00:00:00.000Z',
      durabilityScore: 0.1,
      constitutionalStability: 0.1,
    })),
  });
  const durabilityFailedGate = evaluateProductionSealGate(durabilityFailed);

  // 6. FAIL_CLOSED_OVERRIDE — disable fail-closed on all evidence
  const failClosedOverridden = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e => ({ ...e, failClosedReady: false })),
  });
  const failClosedOverriddenGate = evaluateProductionSealGate(failClosedOverridden);

  // 7. CONSTITUTIONAL_DRIFT — inject drift signals and drop constitutional stability
  const constitutionalDrift = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e =>
      e.domain === 'constitutional_trust_stability'
        ? {
          ...e,
          constitutionalStability: 0.1,
          driftRisk: 'constitutional_drift_injected',
          driftSignals: [...e.driftSignals, 'constitutional_drift_injected'],
          sealed: false,
          immutable: false,
        }
        : e,
    ),
  });
  const constitutionalDriftGate = evaluateProductionSealGate(constitutionalDrift);
  const baselineDriftSignalCount = baseline.driftSignals.length;

  // 8. CHAOS_RESILIENCE_EXHAUSTION — collapse chaos resilience and inject signals
  const chaosExhausted = evaluateProductionSeal({
    ...input,
    evidence: input.evidence.map(e =>
      e.domain === 'production_chaos_resilience'
        ? { ...e, chaosResilienceScore: 0.0, chaosSignals: ['chaos_resilience_exhausted'] }
        : e,
    ),
  });
  const chaosExhaustedGate = evaluateProductionSealGate(chaosExhausted);

  const scenarios: ProductionSealChaosScenarioResult[] = [
    chaosResult(
      'PRODUCTION_SEAL_CORRUPTION',
      sealCorrupted,
      sealCorruptedGate.failedGateIds.includes('production_seal_globally_verified')
        || sealCorruptedGate.failedGateIds.includes('replay_production_immutable'),
      sealCorruptedGate.failedGateIds,
    ),
    chaosResult(
      'REPLAY_PRODUCTION_MUTATION',
      replayMutated,
      replayMutatedGate.failedGateIds.includes('replay_production_immutable'),
      replayMutatedGate.failedGateIds,
    ),
    chaosResult(
      'GOVERNANCE_PERMANENCE_COLLAPSE',
      govCollapsed,
      govCollapsedGate.failedGateIds.includes('governance_permanently_sealed'),
      govCollapsedGate.failedGateIds,
    ),
    chaosResult(
      'TELEMETRY_BLACKOUT',
      telemetryBlackout,
      telemetryBlackoutGate.failedGateIds.includes('production_telemetry_observable'),
      telemetryBlackoutGate.failedGateIds,
    ),
    chaosResult(
      'DURABILITY_SCORING_FAILURE',
      durabilityFailed,
      durabilityFailedGate.failedGateIds.includes('runtime_durability_longitudinally_scored'),
      durabilityFailedGate.failedGateIds,
    ),
    chaosResult(
      'FAIL_CLOSED_OVERRIDE',
      failClosedOverridden,
      failClosedOverriddenGate.failedGateIds.includes('fail_closed_production_semantics'),
      failClosedOverriddenGate.failedGateIds,
    ),
    chaosResult(
      'CONSTITUTIONAL_DRIFT',
      constitutionalDrift,
      baselineDriftSignalCount === 0
        ? constitutionalDrift.driftSignals.length > 0
          || constitutionalDriftGate.failedGateIds.includes('drift_impossible_post_production_seal')
        : constitutionalDriftGate.failedGateIds.includes('drift_impossible_post_production_seal'),
      constitutionalDriftGate.failedGateIds,
    ),
    chaosResult(
      'CHAOS_RESILIENCE_EXHAUSTION',
      chaosExhausted,
      chaosExhausted.chaosResilience.chaosSignalCount > baseline.chaosResilience.chaosSignalCount
        || !chaosExhausted.chaosResilience.resilient
        || chaosExhaustedGate.failedGateIds.length > baselineGate.failedGateIds.length,
      chaosExhaustedGate.failedGateIds,
    ),
  ];

  const body = {
    schema: SCHEMA_CHAOS,
    totalScenarios: scenarios.length,
    silentFailureCount: scenarios.filter(s => !s.signalSurfaced).length,
    scenarios,
    generatedAt: input.generatedAt,
  };

  return { ...body, reportHash: sha256ForPayload(body) };
}
