/**
 * institutionalTrustApiHardening.ts - W2-PR117A
 *
 * Pure-transform hardening evaluator for external trust APIs (issuer,
 * verifier, federation, registry, revocation, presentation). Operates on a
 * supplied set of observed external requests and fails closed when:
 *
 *   1. API replay-hardening windows are violated or unenforced.
 *   2. Cross-org request validation is missing for cross-tenant calls.
 *   3. API responses leak unwarranted certainty (ambiguity not preserved).
 *   4. Trust-rate limiting opens instead of fail-closing.
 *   5. API anomaly lineage cannot be reconstructed.
 *   6. External integration survivability is not longitudinally visible.
 *
 * This module does NOT fetch, write, or mutate live API state. It is a
 * deterministic transform consumed by CI gates and chaos suites.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type ApiHardeningMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiHardeningRouteFamily =
  | 'ISSUER'
  | 'VERIFIER'
  | 'FEDERATION'
  | 'REGISTRY'
  | 'REVOCATION'
  | 'PRESENTATION';

export interface ApiRequestObservation {
  /** Idempotency key supplied by caller (RFC 7807-style). */
  requestId: string;
  /** Anti-replay nonce. */
  nonce: string;
  observedAt: string;
  /** Bearer-token / DID-bound org of the caller. */
  callerOrgId: string;
  /** Org the request claims to operate on. */
  targetOrgId: string;
  routeFamily: ApiHardeningRouteFamily;
  /** Semantic route id, e.g. 'verifier.presentation.verify'. */
  routeId: string;
  method: ApiHardeningMethod;
  /** True iff request signature (JWS / HMAC / mTLS) validated. */
  signatureValid: boolean;
  /** ms since signed-at; >0 means outside the allowed replay window. */
  replayWindowExceededMs: number;
  /** True iff request matched a prior idempotency record within window. */
  idempotentReplay: boolean;
  /** True iff caller has an explicit cross-org grant for targetOrgId. */
  crossOrgGrantPresent: boolean;
  /** 0..1 fraction of semantic rate budget remaining at request time. */
  rateBudgetRemaining: number;
  /** Semantic budget class (e.g. trust-tier-gold). */
  rateBudgetClass: string;
  /** True iff request was failed-closed when limits exceeded. */
  failedClosedOnExceedance: boolean;
  /** Preserved ambiguity surfaced in the response, if any. */
  ambiguityFlag: string | null;
  /** True iff the response copy claimed more certainty than evidence. */
  responseLeakedCertainty: boolean;
  /** Detector-supplied anomaly hint. */
  anomalyHint: string | null;
  /** Lineage refs that allow anomaly reconstruction. */
  lineageRefs: readonly string[];
  /** Evidence refs (receipts, attestations) backing the response. */
  evidenceRefs: readonly string[];
  latencyMs: number;
  statusCode: number;
  /** 0..1 signal that the external integration path remains viable. */
  survivabilitySignal: number;
}

export interface ApiHardeningLineageEntry {
  requestId: string;
  observedAt: string;
  callerOrgId: string;
  targetOrgId: string;
  routeFamily: ApiHardeningRouteFamily;
  routeId: string;
  replayHardened: boolean;
  crossOrgValid: boolean;
  ambiguitySafe: boolean;
  rateLimitFailClosed: boolean;
  anomalous: boolean;
  reconstructable: boolean;
  requestHash: string;
}

export interface ApiHardeningLineage {
  schema: 'vitalcv.api-hardening-lineage.v1';
  surfaceId: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  observedRouteFamilies: readonly ApiHardeningRouteFamily[];
  participantCallerOrgIds: readonly string[];
  participantTargetOrgIds: readonly string[];
  timeline: readonly ApiHardeningLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export interface ApiHardeningAnomaly {
  requestId: string;
  observedAt: string;
  callerOrgId: string;
  targetOrgId: string;
  routeId: string;
  reasons: readonly string[];
  reconstructable: boolean;
  anomalyHash: string;
}

export type ApiHardeningStatus =
  | 'HARDENED'
  | 'DEGRADED_HARDENING'
  | 'HARDENING_BLOCKED';

export type ApiHardeningVerdict =
  | 'API_HARDENED'
  | 'API_DEGRADED'
  | 'API_BLOCKED';

export interface ApiHardeningResult {
  schema: 'vitalcv.api-hardening.v1';
  surfaceId: string;
  status: ApiHardeningStatus;
  verdict: ApiHardeningVerdict;
  failClosed: boolean;
  hardeningScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: ApiHardeningLineage;
  replayHardening: {
    enforced: boolean;
    integrityPct: number;
    unsafeRequestIds: readonly string[];
    duplicateNonceCount: number;
    score: number;
  };
  crossOrgValidation: {
    enforced: boolean;
    crossOrgRequestCount: number;
    invalidCrossOrgRequestIds: readonly string[];
    coveragePct: number;
    score: number;
  };
  ambiguityResponses: {
    safe: boolean;
    safePct: number;
    leakingRequestIds: readonly string[];
    preservedAmbiguities: readonly string[];
    score: number;
  };
  trustRateLimiting: {
    failClosed: boolean;
    failClosedPct: number;
    overBudgetRequestCount: number;
    failOpenRequestIds: readonly string[];
    score: number;
  };
  anomalyDetection: {
    status: 'CLEAR' | 'ANOMALY_DETECTED' | 'ANOMALY_LINEAGE_GAP';
    anomalies: readonly ApiHardeningAnomaly[];
    lineageReconstructable: boolean;
    detectionPct: number;
    score: number;
  };
  survivability: {
    longitudinallyVisible: boolean;
    survivabilityPct: number;
    routeFamilyCoverage: number;
    score: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  hardeningHash: string;
  generatedAt: string;
}

export type ApiHardeningGateId =
  | 'api_replay_window_enforced'
  | 'cross_org_validation_enforced'
  | 'ambiguity_safe_api_responses'
  | 'trust_rate_limiting_fail_closed'
  | 'api_anomaly_lineage_reconstructable'
  | 'external_integration_survivability_visible'
  | 'fail_closed_api_semantics';

export interface ApiHardeningGate {
  id: ApiHardeningGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface ApiHardeningGateResult {
  schema: 'vitalcv.api-hardening-ci-gate.v1';
  pass: boolean;
  gates: readonly ApiHardeningGate[];
  failedGateIds: readonly ApiHardeningGateId[];
  gateHash: string;
}

export type ApiHardeningChaosScenarioName =
  | 'REPLAY_WINDOW_DRIFT'
  | 'NONCE_REUSE_FLOOD'
  | 'CROSS_ORG_LEAK'
  | 'AMBIGUITY_LOSS_IN_RESPONSE'
  | 'RATE_LIMIT_FAIL_OPEN'
  | 'ANOMALY_LINEAGE_GAP'
  | 'INTEGRATION_SURVIVABILITY_COLLAPSE';

export interface ApiHardeningChaosScenarioResult {
  scenario: ApiHardeningChaosScenarioName;
  signalSurfaced: boolean;
  status: ApiHardeningStatus;
  failedGateIds: readonly ApiHardeningGateId[];
  surfacedSignals: readonly string[];
}

export interface ApiHardeningChaosReport {
  schema: 'vitalcv.api-hardening-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly ApiHardeningChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

const SCHEMA_LINEAGE = 'vitalcv.api-hardening-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.api-hardening.v1' as const;
const SCHEMA_GATE = 'vitalcv.api-hardening-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.api-hardening-chaos.v1' as const;

const REQUIRED_ROUTE_FAMILIES: readonly ApiHardeningRouteFamily[] = Object.freeze([
  'FEDERATION',
  'ISSUER',
  'PRESENTATION',
  'REGISTRY',
  'REVOCATION',
  'VERIFIER',
]);
const MIN_REQUESTS_FOR_LONGITUDINAL = 4;
const MIN_DISTINCT_TIMESTAMPS = 3;
const MIN_SURVIVABILITY_RATIO = 0.5;
const REPLAY_INTEGRITY_FLOOR_PCT = 95;
const AMBIGUITY_SAFE_FLOOR_PCT = 90;
const CROSS_ORG_COVERAGE_FLOOR_PCT = 95;
const RATE_FAIL_CLOSED_FLOOR_PCT = 95;
const SURVIVABILITY_PCT_FLOOR = 50; // pct(MIN_SURVIVABILITY_RATIO * 100)

export const API_HARDENING_GATE_IDS: readonly ApiHardeningGateId[] = Object.freeze([
  'api_replay_window_enforced',
  'cross_org_validation_enforced',
  'ambiguity_safe_api_responses',
  'trust_rate_limiting_fail_closed',
  'api_anomaly_lineage_reconstructable',
  'external_integration_survivability_visible',
  'fail_closed_api_semantics',
]);

export const API_HARDENING_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
  replayIntegrityFloorPct: REPLAY_INTEGRITY_FLOOR_PCT,
  ambiguitySafeFloorPct: AMBIGUITY_SAFE_FLOOR_PCT,
  crossOrgCoverageFloorPct: CROSS_ORG_COVERAGE_FLOOR_PCT,
  rateFailClosedFloorPct: RATE_FAIL_CLOSED_FLOOR_PCT,
  survivabilityFloorPct: SURVIVABILITY_PCT_FLOOR,
});

interface NormalizedRequest {
  requestId: string;
  nonce: string;
  observedAt: string;
  callerOrgId: string;
  targetOrgId: string;
  routeFamily: ApiHardeningRouteFamily;
  routeId: string;
  method: ApiHardeningMethod;
  signatureValid: boolean;
  replayWindowExceededMs: number;
  idempotentReplay: boolean;
  crossOrgGrantPresent: boolean;
  rateBudgetRemaining: number;
  rateBudgetClass: string;
  failedClosedOnExceedance: boolean;
  ambiguityFlag: string | null;
  responseLeakedCertainty: boolean;
  anomalyHint: string | null;
  lineageRefs: readonly string[];
  evidenceRefs: readonly string[];
  latencyMs: number;
  statusCode: number;
  survivabilitySignal: number;
  survivabilitySignalValid: boolean;
  isCrossOrg: boolean;
}

function cleanString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRequiredString(value: string, fallback: string): string {
  return cleanString(value) ?? fallback;
}

function dedupeSorted(values: readonly string[]): string[] {
  return Array.from(
    new Set(values.map(value => cleanString(value)).filter((value): value is string => value !== null)),
  ).sort();
}

function dedupeChronological(values: readonly (string | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = cleanString(value);
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function validRatio(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function pct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortRequests(a: NormalizedRequest, b: NormalizedRequest): number {
  return a.observedAt.localeCompare(b.observedAt) || a.requestId.localeCompare(b.requestId);
}

function normalizeRequests(requests: readonly ApiRequestObservation[]): NormalizedRequest[] {
  return requests
    .map((request, index): NormalizedRequest => {
      const callerOrgId = cleanRequiredString(request.callerOrgId, 'missing-caller-org');
      const targetOrgId = cleanRequiredString(request.targetOrgId, 'missing-target-org');
      const survivabilitySignalValid = validRatio(request.survivabilitySignal);
      return {
        requestId: cleanRequiredString(request.requestId, `missing-request-${index}`),
        nonce: cleanRequiredString(request.nonce, `missing-nonce-${index}`),
        observedAt: cleanRequiredString(request.observedAt, '0000-00-00T00:00:00.000Z'),
        callerOrgId,
        targetOrgId,
        routeFamily: request.routeFamily,
        routeId: cleanRequiredString(request.routeId, 'missing-route'),
        method: request.method,
        signatureValid: request.signatureValid === true,
        replayWindowExceededMs: Number.isFinite(request.replayWindowExceededMs)
          ? Math.max(0, Math.round(request.replayWindowExceededMs))
          : 0,
        idempotentReplay: request.idempotentReplay === true,
        crossOrgGrantPresent: request.crossOrgGrantPresent === true,
        rateBudgetRemaining: clampRatio(request.rateBudgetRemaining),
        rateBudgetClass: cleanRequiredString(request.rateBudgetClass, 'unclassified'),
        failedClosedOnExceedance: request.failedClosedOnExceedance === true,
        ambiguityFlag: cleanString(request.ambiguityFlag),
        responseLeakedCertainty: request.responseLeakedCertainty === true,
        anomalyHint: cleanString(request.anomalyHint),
        lineageRefs: dedupeSorted(request.lineageRefs),
        evidenceRefs: dedupeSorted(request.evidenceRefs),
        latencyMs: Number.isFinite(request.latencyMs) && request.latencyMs > 0
          ? Math.round(request.latencyMs)
          : 0,
        statusCode: Number.isFinite(request.statusCode) ? Math.round(request.statusCode) : 0,
        survivabilitySignal: clampRatio(request.survivabilitySignal),
        survivabilitySignalValid,
        isCrossOrg: callerOrgId !== targetOrgId,
      };
    })
    .sort(sortRequests);
}

function isOverBudget(request: NormalizedRequest): boolean {
  return request.rateBudgetRemaining <= 0;
}

function isReplayHardened(request: NormalizedRequest): boolean {
  if (!request.signatureValid) return false;
  if (request.replayWindowExceededMs > 0) return false;
  if (request.idempotentReplay) return false;
  return true;
}

function isCrossOrgValid(request: NormalizedRequest): boolean {
  if (!request.isCrossOrg) return true;
  return request.crossOrgGrantPresent === true;
}

function isAmbiguitySafe(request: NormalizedRequest): boolean {
  return request.responseLeakedCertainty === false;
}

function isRateLimitedFailClosed(request: NormalizedRequest): boolean {
  if (!isOverBudget(request)) return true;
  return request.failedClosedOnExceedance === true;
}

function anomalyReasons(request: NormalizedRequest): string[] {
  const reasons: string[] = [];
  if (request.anomalyHint) reasons.push(request.anomalyHint);
  if (!request.signatureValid) reasons.push('API request signature failed validation.');
  if (request.replayWindowExceededMs > 0) reasons.push('Replay window exceeded.');
  if (request.idempotentReplay) reasons.push('Idempotency replay observed for prior request id.');
  if (request.isCrossOrg && !request.crossOrgGrantPresent) reasons.push('Cross-org request without grant.');
  if (request.responseLeakedCertainty) reasons.push('Response leaked certainty beyond evidence.');
  if (isOverBudget(request) && !request.failedClosedOnExceedance) reasons.push('Rate limit failed open.');
  if (request.lineageRefs.length === 0) reasons.push('Lineage references missing on API request.');
  if (request.evidenceRefs.length === 0) reasons.push('Evidence references missing on API request.');
  return reasons;
}

function isRequestAnomalous(request: NormalizedRequest): boolean {
  return anomalyReasons(request).length > 0;
}

function requestHash(request: NormalizedRequest): string {
  return sha256ForPayload({
    requestId: request.requestId,
    nonce: request.nonce,
    observedAt: request.observedAt,
    callerOrgId: request.callerOrgId,
    targetOrgId: request.targetOrgId,
    routeFamily: request.routeFamily,
    routeId: request.routeId,
    method: request.method,
    signatureValid: request.signatureValid,
    replayWindowExceededMs: request.replayWindowExceededMs,
    idempotentReplay: request.idempotentReplay,
    crossOrgGrantPresent: request.crossOrgGrantPresent,
    rateBudgetRemaining: request.rateBudgetRemaining,
    rateBudgetClass: request.rateBudgetClass,
    failedClosedOnExceedance: request.failedClosedOnExceedance,
    ambiguityFlag: request.ambiguityFlag,
    responseLeakedCertainty: request.responseLeakedCertainty,
    anomalyHint: request.anomalyHint,
    lineageRefs: request.lineageRefs,
    evidenceRefs: request.evidenceRefs,
    latencyMs: request.latencyMs,
    statusCode: request.statusCode,
    survivabilitySignal: request.survivabilitySignal,
  });
}

function familiesObserved(requests: readonly NormalizedRequest[]): ApiHardeningRouteFamily[] {
  const observed = new Set(requests.map(request => request.routeFamily));
  return REQUIRED_ROUTE_FAMILIES.filter(family => observed.has(family));
}

export function buildApiHardeningLineage(input: {
  surfaceId: string;
  generatedAt: string;
  requests: readonly ApiRequestObservation[];
}): ApiHardeningLineage {
  const requests = normalizeRequests(input.requests);
  const timeline: ApiHardeningLineageEntry[] = requests.map(request => ({
    requestId: request.requestId,
    observedAt: request.observedAt,
    callerOrgId: request.callerOrgId,
    targetOrgId: request.targetOrgId,
    routeFamily: request.routeFamily,
    routeId: request.routeId,
    replayHardened: isReplayHardened(request),
    crossOrgValid: isCrossOrgValid(request),
    ambiguitySafe: isAmbiguitySafe(request),
    rateLimitFailClosed: isRateLimitedFailClosed(request),
    anomalous: isRequestAnomalous(request),
    reconstructable: request.lineageRefs.length > 0 && request.evidenceRefs.length > 0,
    requestHash: requestHash(request),
  }));
  const participantCallerOrgIds = dedupeSorted(requests.map(request => request.callerOrgId));
  const participantTargetOrgIds = dedupeSorted(requests.map(request => request.targetOrgId));
  const observedRouteFamilies = familiesObserved(requests);
  const lineageHash = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    surfaceId: input.surfaceId,
    participantCallerOrgIds,
    participantTargetOrgIds,
    observedRouteFamilies,
    firstObservedAt: timeline[0]?.observedAt ?? null,
    lastObservedAt: timeline[timeline.length - 1]?.observedAt ?? null,
    timeline: timeline.map(entry => ({
      requestId: entry.requestId,
      observedAt: entry.observedAt,
      callerOrgId: entry.callerOrgId,
      targetOrgId: entry.targetOrgId,
      routeFamily: entry.routeFamily,
      routeId: entry.routeId,
      requestHash: entry.requestHash,
    })),
  });

  return {
    schema: SCHEMA_LINEAGE,
    surfaceId: input.surfaceId,
    firstObservedAt: timeline[0]?.observedAt ?? null,
    lastObservedAt: timeline[timeline.length - 1]?.observedAt ?? null,
    observedRouteFamilies,
    participantCallerOrgIds,
    participantTargetOrgIds,
    timeline,
    lineageHash,
    generatedAt: input.generatedAt,
  };
}

function buildAnomalies(requests: readonly NormalizedRequest[]): ApiHardeningAnomaly[] {
  const anomalies: ApiHardeningAnomaly[] = [];
  for (const request of requests) {
    const reasons = anomalyReasons(request);
    if (reasons.length === 0) continue;
    const reconstructable = request.lineageRefs.length > 0 && request.evidenceRefs.length > 0;
    const anomalyHash = sha256ForPayload({
      requestId: request.requestId,
      observedAt: request.observedAt,
      callerOrgId: request.callerOrgId,
      targetOrgId: request.targetOrgId,
      routeId: request.routeId,
      reasons,
      reconstructable,
    });
    anomalies.push({
      requestId: request.requestId,
      observedAt: request.observedAt,
      callerOrgId: request.callerOrgId,
      targetOrgId: request.targetOrgId,
      routeId: request.routeId,
      reasons,
      reconstructable,
      anomalyHash,
    });
  }
  return anomalies;
}

function countDuplicateNonces(requests: readonly NormalizedRequest[]): number {
  const counts = new Map<string, number>();
  for (const request of requests) {
    counts.set(request.nonce, (counts.get(request.nonce) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicates += count - 1;
  }
  return duplicates;
}

export function evaluateInstitutionalTrustApiHardening(input: {
  surfaceId: string;
  generatedAt: string;
  requests: readonly ApiRequestObservation[];
}): ApiHardeningResult {
  const requests = normalizeRequests(input.requests);
  const lineage = buildApiHardeningLineage(input);
  const total = requests.length;

  // Replay hardening
  const replayHardenedRequests = requests.filter(isReplayHardened);
  const unsafeRequestIds = requests
    .filter(request => !isReplayHardened(request))
    .map(request => request.requestId);
  const duplicateNonceCount = countDuplicateNonces(requests);
  const replayIntegrityPct = total > 0 ? pct((replayHardenedRequests.length / total) * 100) : 0;
  const replayEnforced = total >= 3
    && replayIntegrityPct >= REPLAY_INTEGRITY_FLOOR_PCT
    && duplicateNonceCount === 0;

  // Cross-org validation
  const crossOrgRequests = requests.filter(request => request.isCrossOrg);
  const invalidCrossOrgRequestIds = crossOrgRequests
    .filter(request => !request.crossOrgGrantPresent)
    .map(request => request.requestId);
  const crossOrgCoveragePct = crossOrgRequests.length > 0
    ? pct(((crossOrgRequests.length - invalidCrossOrgRequestIds.length) / crossOrgRequests.length) * 100)
    : 100;
  const crossOrgEnforced = invalidCrossOrgRequestIds.length === 0
    && crossOrgCoveragePct >= CROSS_ORG_COVERAGE_FLOOR_PCT;

  // Ambiguity-safe responses
  const ambiguitySafeRequests = requests.filter(isAmbiguitySafe);
  const leakingRequestIds = requests
    .filter(request => !isAmbiguitySafe(request))
    .map(request => request.requestId);
  const ambiguitySafePct = total > 0 ? pct((ambiguitySafeRequests.length / total) * 100) : 0;
  const ambiguitySafe = total >= 3
    && leakingRequestIds.length === 0
    && ambiguitySafePct >= AMBIGUITY_SAFE_FLOOR_PCT;
  const preservedAmbiguities = dedupeChronological(requests.map(request => request.ambiguityFlag));
  const ambiguityPreserved = leakingRequestIds.length === 0;

  // Trust rate-limiting semantics
  const overBudgetRequests = requests.filter(isOverBudget);
  const failOpenRequestIds = overBudgetRequests
    .filter(request => !request.failedClosedOnExceedance)
    .map(request => request.requestId);
  const rateFailClosedPct = overBudgetRequests.length > 0
    ? pct(((overBudgetRequests.length - failOpenRequestIds.length) / overBudgetRequests.length) * 100)
    : 100;
  const rateLimitedFailClosed = failOpenRequestIds.length === 0
    && rateFailClosedPct >= RATE_FAIL_CLOSED_FLOOR_PCT;

  // Anomaly detection
  const anomalies = buildAnomalies(requests);
  const anomalyLineageReconstructable = anomalies.every(anomaly => anomaly.reconstructable);
  const anomalyDetectionPct = total > 0 ? pct((anomalies.length / total) * 100) : 0;
  const anomalyScore = anomalies.length === 0
    ? 100
    : anomalyLineageReconstructable
      ? pct(100 - anomalyDetectionPct)
      : 0;
  const anomalyStatus: ApiHardeningResult['anomalyDetection']['status'] = anomalies.length === 0
    ? 'CLEAR'
    : anomalyLineageReconstructable
      ? 'ANOMALY_DETECTED'
      : 'ANOMALY_LINEAGE_GAP';

  // Survivability + longitudinal visibility
  const uniqueObservedTimes = new Set(requests.map(request => request.observedAt));
  const survivabilityValid = total > 0 && requests.every(request => request.survivabilitySignalValid);
  const survivabilityPct = pct(average(requests.map(request => request.survivabilitySignal)) * 100);
  const routeFamilyCoverage = lineage.observedRouteFamilies.length;
  const survivabilityVisible = total >= MIN_REQUESTS_FOR_LONGITUDINAL
    && uniqueObservedTimes.size >= MIN_DISTINCT_TIMESTAMPS
    && survivabilityValid
    && survivabilityPct >= SURVIVABILITY_PCT_FLOOR
    && routeFamilyCoverage >= 3;

  const blockers: string[] = [];
  if (!replayEnforced) blockers.push('API replay hardening is not enforced across the surface.');
  if (!crossOrgEnforced) blockers.push('Cross-org request validation has unguarded requests.');
  if (!ambiguitySafe) blockers.push('API responses leaked certainty beyond evidence.');
  if (!rateLimitedFailClosed) blockers.push('Trust rate-limiting failed open instead of fail-closed.');
  if (!anomalyLineageReconstructable) blockers.push('API anomaly lineage is not reconstructable.');
  if (!survivabilityVisible) blockers.push('External integration survivability is not longitudinally visible.');

  const failClosed = blockers.length > 0;
  const rawHardeningScore = pct(
    replayIntegrityPct * 0.22
      + crossOrgCoveragePct * 0.18
      + ambiguitySafePct * 0.18
      + rateFailClosedPct * 0.16
      + anomalyScore * 0.14
      + survivabilityPct * 0.12,
  );
  const hardeningScore = failClosed ? Math.min(rawHardeningScore, 49) : rawHardeningScore;
  const status: ApiHardeningStatus = failClosed
    ? 'HARDENING_BLOCKED'
    : anomalies.length > 0
      ? 'DEGRADED_HARDENING'
      : 'HARDENED';
  const verdict: ApiHardeningVerdict = status === 'HARDENING_BLOCKED'
    ? 'API_BLOCKED'
    : status === 'DEGRADED_HARDENING'
      ? 'API_DEGRADED'
      : 'API_HARDENED';

  const basis: string[] = [];
  if (replayEnforced) basis.push('api_replay_window_enforced');
  if (crossOrgEnforced) basis.push('cross_org_validation_enforced');
  if (ambiguitySafe) basis.push('ambiguity_safe_api_responses');
  if (rateLimitedFailClosed) basis.push('trust_rate_limiting_fail_closed');
  if (anomalyLineageReconstructable) basis.push('api_anomaly_lineage_reconstructable');
  if (survivabilityVisible) basis.push('external_integration_survivability_visible');
  if (!failClosed) basis.push('fail_closed_api_semantics');

  const resultBody = {
    schema: SCHEMA_RESULT,
    surfaceId: input.surfaceId,
    status,
    verdict,
    failClosed,
    hardeningScore,
    blockers,
    ambiguities: preservedAmbiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayHardening: {
      enforced: replayEnforced,
      integrityPct: replayIntegrityPct,
      unsafeRequestIds,
      duplicateNonceCount,
      score: replayIntegrityPct,
    },
    crossOrgValidation: {
      enforced: crossOrgEnforced,
      crossOrgRequestCount: crossOrgRequests.length,
      invalidCrossOrgRequestIds,
      coveragePct: crossOrgCoveragePct,
      score: crossOrgCoveragePct,
    },
    ambiguityResponses: {
      safe: ambiguitySafe,
      safePct: ambiguitySafePct,
      leakingRequestIds,
      preservedAmbiguities,
      score: ambiguitySafePct,
    },
    trustRateLimiting: {
      failClosed: rateLimitedFailClosed,
      failClosedPct: rateFailClosedPct,
      overBudgetRequestCount: overBudgetRequests.length,
      failOpenRequestIds,
      score: rateFailClosedPct,
    },
    anomalyDetection: {
      status: anomalyStatus,
      anomalies,
      lineageReconstructable: anomalyLineageReconstructable,
      detectionPct: anomalyDetectionPct,
      score: anomalyScore,
    },
    survivability: {
      longitudinallyVisible: survivabilityVisible,
      survivabilityPct,
      routeFamilyCoverage,
      score: survivabilityVisible ? survivabilityPct : 0,
    },
    confidence: {
      score: hardeningScore,
      basis,
    },
    generatedAt: input.generatedAt,
  };

  return {
    ...resultBody,
    lineage,
    hardeningHash: sha256ForPayload(resultBody),
  };
}

export function evaluateApiHardeningGate(
  result: ApiHardeningResult,
): ApiHardeningGateResult {
  const gates: ApiHardeningGate[] = [
    {
      id: 'api_replay_window_enforced',
      pass: result.replayHardening.enforced && result.replayHardening.integrityPct >= REPLAY_INTEGRITY_FLOOR_PCT,
      observed: result.replayHardening.integrityPct,
      required: REPLAY_INTEGRITY_FLOOR_PCT,
    },
    {
      id: 'cross_org_validation_enforced',
      pass: result.crossOrgValidation.enforced
        && result.crossOrgValidation.coveragePct >= CROSS_ORG_COVERAGE_FLOOR_PCT,
      observed: result.crossOrgValidation.coveragePct,
      required: CROSS_ORG_COVERAGE_FLOOR_PCT,
    },
    {
      id: 'ambiguity_safe_api_responses',
      pass: result.ambiguityResponses.safe && result.ambiguityResponses.safePct >= AMBIGUITY_SAFE_FLOOR_PCT,
      observed: result.ambiguityResponses.safePct,
      required: AMBIGUITY_SAFE_FLOOR_PCT,
    },
    {
      id: 'trust_rate_limiting_fail_closed',
      pass: result.trustRateLimiting.failClosed
        && result.trustRateLimiting.failClosedPct >= RATE_FAIL_CLOSED_FLOOR_PCT,
      observed: result.trustRateLimiting.failClosedPct,
      required: RATE_FAIL_CLOSED_FLOOR_PCT,
    },
    {
      id: 'api_anomaly_lineage_reconstructable',
      pass: result.anomalyDetection.lineageReconstructable,
      observed: result.anomalyDetection.lineageReconstructable,
      required: true,
    },
    {
      id: 'external_integration_survivability_visible',
      pass: result.survivability.longitudinallyVisible
        && result.survivability.survivabilityPct >= SURVIVABILITY_PCT_FLOOR,
      observed: result.survivability.survivabilityPct,
      required: SURVIVABILITY_PCT_FLOOR,
    },
    {
      id: 'fail_closed_api_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
  ];
  const failedGateIds = gates.filter(gate => !gate.pass).map(gate => gate.id);
  const gateBody = {
    schema: SCHEMA_GATE,
    pass: failedGateIds.length === 0,
    gates,
    failedGateIds,
  };

  return {
    ...gateBody,
    gateHash: sha256ForPayload(gateBody),
  };
}

function scenarioResult(
  scenario: ApiHardeningChaosScenarioName,
  result: ApiHardeningResult,
  gateResult: ApiHardeningGateResult,
  signalPredicate: () => boolean,
  surfacedSignals: readonly string[],
): ApiHardeningChaosScenarioResult {
  return {
    scenario,
    signalSurfaced: signalPredicate(),
    status: result.status,
    failedGateIds: gateResult.failedGateIds,
    surfacedSignals,
  };
}

export function runApiHardeningChaosSimulations(input: {
  surfaceId: string;
  generatedAt: string;
  requests: readonly ApiRequestObservation[];
}): ApiHardeningChaosReport {
  const baseline = evaluateInstitutionalTrustApiHardening(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;

  const replayDrift = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map((request, index) => index === 1
      ? { ...request, replayWindowExceededMs: 90_000, signatureValid: false }
      : request),
  });
  const replayDriftGate = evaluateApiHardeningGate(replayDrift);

  const nonceReuse = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.length > 1
      ? input.requests.map((request, index) => index === 1
        ? { ...request, nonce: input.requests[0].nonce, idempotentReplay: true }
        : request)
      : input.requests,
  });
  const nonceReuseGate = evaluateApiHardeningGate(nonceReuse);

  const crossOrgLeak = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map(request => ({
      ...request,
      targetOrgId: 'org-other',
      crossOrgGrantPresent: false,
    })),
  });
  const crossOrgLeakGate = evaluateApiHardeningGate(crossOrgLeak);

  const ambiguityLoss = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map(request => ({
      ...request,
      ambiguityFlag: null,
      responseLeakedCertainty: true,
    })),
  });
  const ambiguityLossGate = evaluateApiHardeningGate(ambiguityLoss);

  const rateFailOpen = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map(request => ({
      ...request,
      rateBudgetRemaining: 0,
      failedClosedOnExceedance: false,
    })),
  });
  const rateFailOpenGate = evaluateApiHardeningGate(rateFailOpen);

  const anomalyLineageGap = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map(request => request.anomalyHint
      ? { ...request, lineageRefs: [], evidenceRefs: [] }
      : { ...request, anomalyHint: 'forced-anomaly', lineageRefs: [], evidenceRefs: [] }),
  });
  const anomalyLineageGapGate = evaluateApiHardeningGate(anomalyLineageGap);

  const survivabilityCollapse = evaluateInstitutionalTrustApiHardening({
    ...input,
    requests: input.requests.map(request => ({
      ...request,
      survivabilitySignal: -1,
      observedAt: input.requests[0]?.observedAt ?? input.generatedAt,
    })),
  });
  const survivabilityCollapseGate = evaluateApiHardeningGate(survivabilityCollapse);

  const scenarios: ApiHardeningChaosScenarioResult[] = [
    scenarioResult(
      'REPLAY_WINDOW_DRIFT',
      replayDrift,
      replayDriftGate,
      () => replayDriftGate.failedGateIds.includes('api_replay_window_enforced'),
      replayDriftGate.failedGateIds,
    ),
    scenarioResult(
      'NONCE_REUSE_FLOOD',
      nonceReuse,
      nonceReuseGate,
      () => nonceReuseGate.failedGateIds.includes('api_replay_window_enforced'),
      nonceReuseGate.failedGateIds,
    ),
    scenarioResult(
      'CROSS_ORG_LEAK',
      crossOrgLeak,
      crossOrgLeakGate,
      () => crossOrgLeakGate.failedGateIds.includes('cross_org_validation_enforced'),
      crossOrgLeakGate.failedGateIds,
    ),
    scenarioResult(
      'AMBIGUITY_LOSS_IN_RESPONSE',
      ambiguityLoss,
      ambiguityLossGate,
      () => ambiguityLossGate.failedGateIds.includes('ambiguity_safe_api_responses')
        || (baselineAmbiguityCount > 0 && ambiguityLoss.ambiguities.length < baselineAmbiguityCount),
      ambiguityLossGate.failedGateIds,
    ),
    scenarioResult(
      'RATE_LIMIT_FAIL_OPEN',
      rateFailOpen,
      rateFailOpenGate,
      () => rateFailOpenGate.failedGateIds.includes('trust_rate_limiting_fail_closed'),
      rateFailOpenGate.failedGateIds,
    ),
    scenarioResult(
      'ANOMALY_LINEAGE_GAP',
      anomalyLineageGap,
      anomalyLineageGapGate,
      () => anomalyLineageGapGate.failedGateIds.includes('api_anomaly_lineage_reconstructable'),
      anomalyLineageGapGate.failedGateIds,
    ),
    scenarioResult(
      'INTEGRATION_SURVIVABILITY_COLLAPSE',
      survivabilityCollapse,
      survivabilityCollapseGate,
      () => survivabilityCollapseGate.failedGateIds.includes('external_integration_survivability_visible'),
      survivabilityCollapseGate.failedGateIds,
    ),
  ];

  const reportBody = {
    schema: SCHEMA_CHAOS,
    totalScenarios: scenarios.length,
    silentFailureCount: scenarios.filter(scenario => !scenario.signalSurfaced).length,
    scenarios,
    generatedAt: input.generatedAt,
  };

  return {
    ...reportBody,
    reportHash: sha256ForPayload(reportBody),
  };
}
