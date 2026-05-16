/**
 * institutionalTrustNetworkObservability.ts - W2-PR111A
 *
 * Pure trust-network observability transforms for issuer / verifier /
 * clinician / replay-infrastructure telemetry. This module does not fetch,
 * mutate, or synthesize live telemetry. It evaluates a supplied event set and
 * fails closed when replay visibility, cross-org coverage, anomaly lineage, or
 * survivability evidence is insufficient.
 */

import { sha256ForPayload } from '../../utils/deterministic';

export type TrustNetworkActorRole =
  | 'ISSUER'
  | 'VERIFIER'
  | 'CLINICIAN'
  | 'REPLAY_INFRASTRUCTURE';

export type TrustNetworkEventType =
  | 'credential_issued'
  | 'verification_requested'
  | 'verification_accepted'
  | 'replay_checked'
  | 'replay_degraded'
  | 'trust_route_completed'
  | 'ambiguity_observed'
  | 'anomaly_reported';

export interface TrustNetworkTelemetryEvent {
  eventId: string;
  observedAt: string;
  orgId: string;
  actorRole: TrustNetworkActorRole;
  actorId: string;
  eventType: TrustNetworkEventType;
  replaySafe: boolean;
  replayTraceId: string | null;
  lineageRefs: readonly string[];
  evidenceRefs: readonly string[];
  /** 0..1 evidence-derived trust signal for this event. */
  trustSignal: number;
  latencyMs: number;
  ambiguity: string | null;
  anomalyHint: string | null;
  /** 0..1 signal that this participant path remains operationally viable. */
  survivabilitySignal: number;
}

export interface TrustNetworkLineageEntry {
  eventId: string;
  observedAt: string;
  orgId: string;
  actorRole: TrustNetworkActorRole;
  actorId: string;
  eventType: TrustNetworkEventType;
  replayTraceId: string | null;
  evidenceRefCount: number;
  lineageRefCount: number;
  ambiguous: boolean;
  anomalous: boolean;
  eventHash: string;
}

export interface TrustNetworkLineage {
  schema: 'vitalcv.trust-network-observability-lineage.v1';
  networkId: string;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  participantOrgIds: readonly string[];
  rolesObserved: readonly TrustNetworkActorRole[];
  timeline: readonly TrustNetworkLineageEntry[];
  lineageHash: string;
  generatedAt: string;
}

export interface TrustNetworkAnomaly {
  eventId: string;
  orgId: string;
  actorRole: TrustNetworkActorRole;
  observedAt: string;
  reasons: readonly string[];
  reconstructable: boolean;
  anomalyHash: string;
}

export type TrustNetworkObservabilityStatus =
  | 'OBSERVABLE'
  | 'DEGRADED_OBSERVABILITY'
  | 'OBSERVABILITY_BLOCKED';

export type TrustNetworkObservabilityVerdict =
  | 'NETWORK_OBSERVABLE'
  | 'NETWORK_DEGRADED'
  | 'NETWORK_BLOCKED';

export interface TrustNetworkObservabilityResult {
  schema: 'vitalcv.trust-network-observability.v1';
  networkId: string;
  status: TrustNetworkObservabilityStatus;
  verdict: TrustNetworkObservabilityVerdict;
  failClosed: boolean;
  networkScore: number;
  blockers: readonly string[];
  ambiguities: readonly string[];
  ambiguityPreserved: boolean;
  lineage: TrustNetworkLineage;
  replayTelemetry: {
    observable: boolean;
    visibilityPct: number;
    replayEventCount: number;
    unsafeEventIds: readonly string[];
    score: number;
  };
  crossOrgAnalytics: {
    visible: boolean;
    participantOrgIds: readonly string[];
    rolesObserved: readonly TrustNetworkActorRole[];
    fidelityPct: number;
    score: number;
  };
  anomalyDetection: {
    status: 'CLEAR' | 'ANOMALY_DETECTED' | 'ANOMALY_LINEAGE_GAP';
    anomalies: readonly TrustNetworkAnomaly[];
    lineageReconstructable: boolean;
    detectionPct: number;
    score: number;
  };
  longitudinal: {
    visible: boolean;
    eventCount: number;
    firstObservedAt: string | null;
    lastObservedAt: string | null;
    score: number;
  };
  survivability: {
    measurable: boolean;
    survivabilityPct: number;
    score: number;
  };
  confidence: {
    score: number;
    basis: readonly string[];
  };
  observabilityHash: string;
  generatedAt: string;
}

export type TrustNetworkObservabilityGateId =
  | 'ecosystem_replay_observable'
  | 'ambiguity_preserved_network_wide'
  | 'anomaly_lineage_reconstructable'
  | 'fail_closed_observability_semantics'
  | 'trust_network_longitudinally_visible'
  | 'ecosystem_survivability_measurable'
  | 'cross_org_analytics_fidelity';

export interface TrustNetworkObservabilityGate {
  id: TrustNetworkObservabilityGateId;
  pass: boolean;
  observed: number | boolean;
  required: number | boolean;
}

export interface TrustNetworkObservabilityGateResult {
  schema: 'vitalcv.trust-network-observability-ci-gate.v1';
  pass: boolean;
  gates: readonly TrustNetworkObservabilityGate[];
  failedGateIds: readonly TrustNetworkObservabilityGateId[];
  gateHash: string;
}

export type TrustNetworkChaosScenarioName =
  | 'REPLAY_TELEMETRY_GAP'
  | 'AMBIGUITY_SUPPRESSION'
  | 'ANOMALY_LINEAGE_GAP'
  | 'CROSS_ORG_PARTITION'
  | 'LONGITUDINAL_COLLAPSE'
  | 'SURVIVABILITY_SIGNAL_LOSS';

export interface TrustNetworkChaosScenarioResult {
  scenario: TrustNetworkChaosScenarioName;
  signalSurfaced: boolean;
  status: TrustNetworkObservabilityStatus;
  failedGateIds: readonly TrustNetworkObservabilityGateId[];
  surfacedSignals: readonly string[];
}

export interface TrustNetworkChaosReport {
  schema: 'vitalcv.trust-network-observability-chaos.v1';
  totalScenarios: number;
  silentFailureCount: number;
  scenarios: readonly TrustNetworkChaosScenarioResult[];
  reportHash: string;
  generatedAt: string;
}

const SCHEMA_LINEAGE = 'vitalcv.trust-network-observability-lineage.v1' as const;
const SCHEMA_RESULT = 'vitalcv.trust-network-observability.v1' as const;
const SCHEMA_GATE = 'vitalcv.trust-network-observability-ci-gate.v1' as const;
const SCHEMA_CHAOS = 'vitalcv.trust-network-observability-chaos.v1' as const;
const REQUIRED_ROLES: readonly TrustNetworkActorRole[] = Object.freeze([
  'CLINICIAN',
  'ISSUER',
  'REPLAY_INFRASTRUCTURE',
  'VERIFIER',
]);
const MIN_PARTICIPANT_ORGS = 4;
const MIN_EVENTS_FOR_LONGITUDINAL = 4;
const ANOMALY_LATENCY_MS = 2_000;
const LOW_TRUST_SIGNAL = 0.55;
const MIN_SURVIVABILITY_RATIO = 0.5;

export const NETWORK_OBSERVABILITY_GATE_IDS: readonly TrustNetworkObservabilityGateId[] = Object.freeze([
  'ecosystem_replay_observable',
  'ambiguity_preserved_network_wide',
  'anomaly_lineage_reconstructable',
  'fail_closed_observability_semantics',
  'trust_network_longitudinally_visible',
  'ecosystem_survivability_measurable',
  'cross_org_analytics_fidelity',
]);

export const NETWORK_OBSERVABILITY_SENTINELS = Object.freeze({
  lineageSchema: SCHEMA_LINEAGE,
  resultSchema: SCHEMA_RESULT,
  gateSchema: SCHEMA_GATE,
  chaosSchema: SCHEMA_CHAOS,
  failClosed: true,
});

interface NormalizedEvent {
  eventId: string;
  observedAt: string;
  orgId: string;
  actorRole: TrustNetworkActorRole;
  actorId: string;
  eventType: TrustNetworkEventType;
  replaySafe: boolean;
  replayTraceId: string | null;
  lineageRefs: readonly string[];
  evidenceRefs: readonly string[];
  trustSignal: number;
  latencyMs: number;
  ambiguity: string | null;
  anomalyHint: string | null;
  survivabilitySignal: number;
  survivabilitySignalValid: boolean;
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

function sortEvents(a: NormalizedEvent, b: NormalizedEvent): number {
  return a.observedAt.localeCompare(b.observedAt) || a.eventId.localeCompare(b.eventId);
}

function normalizeEvents(events: readonly TrustNetworkTelemetryEvent[]): NormalizedEvent[] {
  return events
    .map((event, index) => {
      const survivabilitySignalValid = validRatio(event.survivabilitySignal);
      return {
        eventId: cleanRequiredString(event.eventId, `missing-event-${index}`),
        observedAt: cleanRequiredString(event.observedAt, '0000-00-00T00:00:00.000Z'),
        orgId: cleanRequiredString(event.orgId, 'missing-org'),
        actorRole: event.actorRole,
        actorId: cleanRequiredString(event.actorId, 'missing-actor'),
        eventType: event.eventType,
        replaySafe: event.replaySafe === true,
        replayTraceId: cleanString(event.replayTraceId),
        lineageRefs: dedupeSorted(event.lineageRefs),
        evidenceRefs: dedupeSorted(event.evidenceRefs),
        trustSignal: clampRatio(event.trustSignal),
        latencyMs: Number.isFinite(event.latencyMs) && event.latencyMs > 0 ? Math.round(event.latencyMs) : 0,
        ambiguity: cleanString(event.ambiguity),
        anomalyHint: cleanString(event.anomalyHint),
        survivabilitySignal: clampRatio(event.survivabilitySignal),
        survivabilitySignalValid,
      };
    })
    .sort(sortEvents);
}

function isReplayRelevant(event: NormalizedEvent): boolean {
  return event.eventType === 'replay_checked'
    || event.eventType === 'replay_degraded'
    || event.replayTraceId !== null;
}

function anomalyReasons(event: NormalizedEvent): string[] {
  const reasons: string[] = [];
  if (event.anomalyHint) reasons.push(event.anomalyHint);
  if (!event.replaySafe) reasons.push('Replay marked unsafe.');
  if (isReplayRelevant(event) && !event.replayTraceId) reasons.push('Replay trace is missing.');
  if (event.lineageRefs.length === 0) reasons.push('Lineage references are missing.');
  if (event.evidenceRefs.length === 0) reasons.push('Evidence references are missing.');
  if (event.trustSignal < LOW_TRUST_SIGNAL) reasons.push('Trust signal below observability floor.');
  if (event.latencyMs >= ANOMALY_LATENCY_MS) reasons.push('Latency exceeds anomaly threshold.');
  return reasons;
}

function rolesObserved(events: readonly NormalizedEvent[]): TrustNetworkActorRole[] {
  const observed = new Set(events.map(event => event.actorRole));
  return REQUIRED_ROLES.filter(role => observed.has(role));
}

function eventHash(event: NormalizedEvent): string {
  return sha256ForPayload({
    eventId: event.eventId,
    observedAt: event.observedAt,
    orgId: event.orgId,
    actorRole: event.actorRole,
    actorId: event.actorId,
    eventType: event.eventType,
    replaySafe: event.replaySafe,
    replayTraceId: event.replayTraceId,
    lineageRefs: event.lineageRefs,
    evidenceRefs: event.evidenceRefs,
    trustSignal: event.trustSignal,
    latencyMs: event.latencyMs,
    ambiguity: event.ambiguity,
    anomalyHint: event.anomalyHint,
    survivabilitySignal: event.survivabilitySignal,
  });
}

export function buildTrustNetworkLineage(input: {
  networkId: string;
  generatedAt: string;
  events: readonly TrustNetworkTelemetryEvent[];
}): TrustNetworkLineage {
  const events = normalizeEvents(input.events);
  const timeline: TrustNetworkLineageEntry[] = events.map(event => ({
    eventId: event.eventId,
    observedAt: event.observedAt,
    orgId: event.orgId,
    actorRole: event.actorRole,
    actorId: event.actorId,
    eventType: event.eventType,
    replayTraceId: event.replayTraceId,
    evidenceRefCount: event.evidenceRefs.length,
    lineageRefCount: event.lineageRefs.length,
    ambiguous: event.ambiguity !== null,
    anomalous: anomalyReasons(event).length > 0,
    eventHash: eventHash(event),
  }));
  const participantOrgIds = dedupeSorted(events.map(event => event.orgId));
  const observedRoles = rolesObserved(events);
  const lineageHash = sha256ForPayload({
    schema: SCHEMA_LINEAGE,
    networkId: input.networkId,
    participantOrgIds,
    rolesObserved: observedRoles,
    firstObservedAt: timeline[0]?.observedAt ?? null,
    lastObservedAt: timeline[timeline.length - 1]?.observedAt ?? null,
    timeline: timeline.map(entry => ({
      eventId: entry.eventId,
      observedAt: entry.observedAt,
      orgId: entry.orgId,
      actorRole: entry.actorRole,
      eventType: entry.eventType,
      eventHash: entry.eventHash,
    })),
  });

  return {
    schema: SCHEMA_LINEAGE,
    networkId: input.networkId,
    firstObservedAt: timeline[0]?.observedAt ?? null,
    lastObservedAt: timeline[timeline.length - 1]?.observedAt ?? null,
    participantOrgIds,
    rolesObserved: observedRoles,
    timeline,
    lineageHash,
    generatedAt: input.generatedAt,
  };
}

function buildAnomalies(events: readonly NormalizedEvent[]): TrustNetworkAnomaly[] {
  const anomalies: TrustNetworkAnomaly[] = [];
  for (const event of events) {
    const reasons = anomalyReasons(event);
    if (reasons.length === 0) continue;
    const reconstructable = event.lineageRefs.length > 0 && event.evidenceRefs.length > 0;
    const anomalyHash = sha256ForPayload({
      eventId: event.eventId,
      observedAt: event.observedAt,
      orgId: event.orgId,
      reasons,
      reconstructable,
    });
    anomalies.push({
      eventId: event.eventId,
      orgId: event.orgId,
      actorRole: event.actorRole,
      observedAt: event.observedAt,
      reasons,
      reconstructable,
      anomalyHash,
    });
  }
  return anomalies;
}

export function evaluateTrustNetworkObservability(input: {
  networkId: string;
  generatedAt: string;
  events: readonly TrustNetworkTelemetryEvent[];
}): TrustNetworkObservabilityResult {
  const events = normalizeEvents(input.events);
  const lineage = buildTrustNetworkLineage(input);
  const participantOrgIds = lineage.participantOrgIds;
  const observedRoles = lineage.rolesObserved;
  const total = events.length;
  const traceableCount = events.filter(event => event.replayTraceId !== null).length;
  const replayEvents = events.filter(isReplayRelevant);
  const unsafeEventIds = events
    .filter(event => !event.replaySafe || (isReplayRelevant(event) && event.replayTraceId === null))
    .map(event => event.eventId);
  const replayVisibilityPct = total > 0 ? pct((traceableCount / total) * 100) : 0;
  const replayObservable = total >= 3
    && replayEvents.length > 0
    && unsafeEventIds.length === 0
    && replayVisibilityPct >= 85;

  const roleCoveragePct = pct((observedRoles.length / REQUIRED_ROLES.length) * 100);
  const orgCoveragePct = pct((Math.min(participantOrgIds.length, MIN_PARTICIPANT_ORGS) / MIN_PARTICIPANT_ORGS) * 100);
  const trustFidelityPct = pct(average(events.map(event => event.trustSignal)) * 100);
  const crossOrgScore = pct(roleCoveragePct * 0.45 + orgCoveragePct * 0.35 + trustFidelityPct * 0.2);
  const crossOrgVisible = participantOrgIds.length >= MIN_PARTICIPANT_ORGS
    && observedRoles.length === REQUIRED_ROLES.length
    && crossOrgScore >= 75;

  const anomalies = buildAnomalies(events);
  const anomalyLineageReconstructable = anomalies.every(anomaly => anomaly.reconstructable);
  const anomalyDetectionPct = total > 0 ? pct((anomalies.length / total) * 100) : 0;
  const anomalyScore = anomalies.length === 0
    ? 100
    : anomalyLineageReconstructable
      ? pct(100 - anomalyDetectionPct)
      : 0;
  const anomalyStatus: TrustNetworkObservabilityResult['anomalyDetection']['status'] = anomalies.length === 0
    ? 'CLEAR'
    : anomalyLineageReconstructable
      ? 'ANOMALY_DETECTED'
      : 'ANOMALY_LINEAGE_GAP';

  const uniqueObservedTimes = new Set(events.map(event => event.observedAt));
  const longitudinalVisible = total >= MIN_EVENTS_FOR_LONGITUDINAL
    && uniqueObservedTimes.size >= 3
    && lineage.firstObservedAt !== null
    && lineage.lastObservedAt !== null
    && lineage.firstObservedAt !== lineage.lastObservedAt;
  const survivabilityValues = events.map(event => event.survivabilitySignal);
  const survivabilityValid = events.length > 0 && events.every(event => event.survivabilitySignalValid);
  const survivabilityPct = pct(average(survivabilityValues) * 100);
  const survivabilityMeasurable = total >= 3
    && survivabilityValid
    && survivabilityPct >= pct(MIN_SURVIVABILITY_RATIO * 100);
  const ambiguities = dedupeChronological(events.map(event => event.ambiguity));
  const ambiguityPreserved = dedupeChronological(events.map(event => event.ambiguity)).length === ambiguities.length;

  const blockers: string[] = [];
  if (!replayObservable) blockers.push('Ecosystem replay telemetry is not observable.');
  if (!crossOrgVisible) blockers.push('Cross-org trust analytics are below visibility floor.');
  if (!anomalyLineageReconstructable) blockers.push('Anomaly lineage is not reconstructable.');
  if (!longitudinalVisible) blockers.push('Trust-network longitudinal visibility is insufficient.');
  if (!survivabilityMeasurable) blockers.push('Ecosystem survivability is not measurable.');

  const failClosed = blockers.length > 0;
  const rawNetworkScore = pct(
    replayVisibilityPct * 0.28
      + crossOrgScore * 0.24
      + anomalyScore * 0.2
      + survivabilityPct * 0.16
      + (longitudinalVisible ? 100 : 0) * 0.12,
  );
  const networkScore = failClosed ? Math.min(rawNetworkScore, 49) : rawNetworkScore;
  const status: TrustNetworkObservabilityStatus = failClosed
    ? 'OBSERVABILITY_BLOCKED'
    : anomalies.length > 0 || ambiguities.length > 0
      ? 'DEGRADED_OBSERVABILITY'
      : 'OBSERVABLE';
  const verdict: TrustNetworkObservabilityVerdict = status === 'OBSERVABILITY_BLOCKED'
    ? 'NETWORK_BLOCKED'
    : status === 'DEGRADED_OBSERVABILITY'
      ? 'NETWORK_DEGRADED'
      : 'NETWORK_OBSERVABLE';

  const basis: string[] = [];
  if (replayObservable) basis.push('ecosystem_replay_observable');
  if (crossOrgVisible) basis.push('cross_org_analytics_visible');
  if (anomalyLineageReconstructable) basis.push('anomaly_lineage_reconstructable');
  if (ambiguityPreserved) basis.push('network_ambiguity_preserved');
  if (longitudinalVisible) basis.push('trust_network_longitudinally_visible');
  if (survivabilityMeasurable) basis.push('ecosystem_survivability_measurable');
  if (!failClosed) basis.push('fail_closed_observability_semantics');

  const resultBody = {
    schema: SCHEMA_RESULT,
    networkId: input.networkId,
    status,
    verdict,
    failClosed,
    networkScore,
    blockers,
    ambiguities,
    ambiguityPreserved,
    lineageHash: lineage.lineageHash,
    replayTelemetry: {
      observable: replayObservable,
      visibilityPct: replayVisibilityPct,
      replayEventCount: replayEvents.length,
      unsafeEventIds,
      score: replayVisibilityPct,
    },
    crossOrgAnalytics: {
      visible: crossOrgVisible,
      participantOrgIds,
      rolesObserved: observedRoles,
      fidelityPct: trustFidelityPct,
      score: crossOrgScore,
    },
    anomalyDetection: {
      status: anomalyStatus,
      anomalies,
      lineageReconstructable: anomalyLineageReconstructable,
      detectionPct: anomalyDetectionPct,
      score: anomalyScore,
    },
    longitudinal: {
      visible: longitudinalVisible,
      eventCount: total,
      firstObservedAt: lineage.firstObservedAt,
      lastObservedAt: lineage.lastObservedAt,
      score: longitudinalVisible ? 100 : 0,
    },
    survivability: {
      measurable: survivabilityMeasurable,
      survivabilityPct,
      score: survivabilityMeasurable ? survivabilityPct : 0,
    },
    confidence: {
      score: networkScore,
      basis,
    },
    generatedAt: input.generatedAt,
  };

  return {
    ...resultBody,
    lineage,
    observabilityHash: sha256ForPayload(resultBody),
  };
}

export function evaluateTrustNetworkObservabilityGate(
  result: TrustNetworkObservabilityResult,
): TrustNetworkObservabilityGateResult {
  const gates: TrustNetworkObservabilityGate[] = [
    {
      id: 'ecosystem_replay_observable',
      pass: result.replayTelemetry.observable,
      observed: result.replayTelemetry.observable,
      required: true,
    },
    {
      id: 'ambiguity_preserved_network_wide',
      pass: result.ambiguityPreserved,
      observed: result.ambiguityPreserved,
      required: true,
    },
    {
      id: 'anomaly_lineage_reconstructable',
      pass: result.anomalyDetection.lineageReconstructable,
      observed: result.anomalyDetection.lineageReconstructable,
      required: true,
    },
    {
      id: 'fail_closed_observability_semantics',
      pass: !result.failClosed && result.blockers.length === 0,
      observed: !result.failClosed,
      required: true,
    },
    {
      id: 'trust_network_longitudinally_visible',
      pass: result.longitudinal.visible,
      observed: result.longitudinal.visible,
      required: true,
    },
    {
      id: 'ecosystem_survivability_measurable',
      pass: result.survivability.measurable,
      observed: result.survivability.measurable,
      required: true,
    },
    {
      id: 'cross_org_analytics_fidelity',
      pass: result.crossOrgAnalytics.visible && result.crossOrgAnalytics.score >= 75,
      observed: result.crossOrgAnalytics.score,
      required: 75,
    },
  ];
  const failedGateIds = gates
    .filter(gate => !gate.pass)
    .map(gate => gate.id);
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
  scenario: TrustNetworkChaosScenarioName,
  result: TrustNetworkObservabilityResult,
  signalSurfaced: boolean,
  surfacedSignals: readonly string[],
): TrustNetworkChaosScenarioResult {
  return {
    scenario,
    signalSurfaced,
    status: result.status,
    failedGateIds: evaluateTrustNetworkObservabilityGate(result).failedGateIds,
    surfacedSignals,
  };
}

export function runTrustNetworkChaosSimulations(input: {
  networkId: string;
  generatedAt: string;
  events: readonly TrustNetworkTelemetryEvent[];
}): TrustNetworkChaosReport {
  const baseline = evaluateTrustNetworkObservability(input);
  const baselineAmbiguityCount = baseline.ambiguities.length;
  const withReplayGap = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map((event, index) => index === 1
      ? { ...event, replaySafe: false, replayTraceId: null }
      : event),
  });
  const replayGapGate = evaluateTrustNetworkObservabilityGate(withReplayGap);

  const ambiguitySuppressed = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map(event => ({ ...event, ambiguity: null })),
  });

  const anomalyLineageGap = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map(event => event.anomalyHint
      ? { ...event, lineageRefs: [], evidenceRefs: [] }
      : event),
  });
  const anomalyLineageGate = evaluateTrustNetworkObservabilityGate(anomalyLineageGap);

  const crossOrgPartition = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map(event => ({
      ...event,
      orgId: 'org-partitioned',
      actorRole: 'VERIFIER' as const,
    })),
  });
  const crossOrgGate = evaluateTrustNetworkObservabilityGate(crossOrgPartition);

  const longitudinalCollapse = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map(event => ({
      ...event,
      observedAt: input.events[0]?.observedAt ?? input.generatedAt,
    })),
  });
  const longitudinalGate = evaluateTrustNetworkObservabilityGate(longitudinalCollapse);

  const survivabilityLoss = evaluateTrustNetworkObservability({
    ...input,
    events: input.events.map(event => ({
      ...event,
      survivabilitySignal: -1,
    })),
  });
  const survivabilityGate = evaluateTrustNetworkObservabilityGate(survivabilityLoss);

  const scenarios: TrustNetworkChaosScenarioResult[] = [
    scenarioResult(
      'REPLAY_TELEMETRY_GAP',
      withReplayGap,
      replayGapGate.failedGateIds.includes('ecosystem_replay_observable'),
      replayGapGate.failedGateIds,
    ),
    scenarioResult(
      'AMBIGUITY_SUPPRESSION',
      ambiguitySuppressed,
      baselineAmbiguityCount > 0 && ambiguitySuppressed.ambiguities.length < baselineAmbiguityCount,
      baselineAmbiguityCount > 0 && ambiguitySuppressed.ambiguities.length < baselineAmbiguityCount
        ? ['ambiguity_preserved_network_wide']
        : [],
    ),
    scenarioResult(
      'ANOMALY_LINEAGE_GAP',
      anomalyLineageGap,
      anomalyLineageGate.failedGateIds.includes('anomaly_lineage_reconstructable'),
      anomalyLineageGate.failedGateIds,
    ),
    scenarioResult(
      'CROSS_ORG_PARTITION',
      crossOrgPartition,
      crossOrgGate.failedGateIds.includes('cross_org_analytics_fidelity'),
      crossOrgGate.failedGateIds,
    ),
    scenarioResult(
      'LONGITUDINAL_COLLAPSE',
      longitudinalCollapse,
      longitudinalGate.failedGateIds.includes('trust_network_longitudinally_visible'),
      longitudinalGate.failedGateIds,
    ),
    scenarioResult(
      'SURVIVABILITY_SIGNAL_LOSS',
      survivabilityLoss,
      survivabilityGate.failedGateIds.includes('ecosystem_survivability_measurable'),
      survivabilityGate.failedGateIds,
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
