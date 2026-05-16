import {
  NETWORK_OBSERVABILITY_GATE_IDS,
  NETWORK_OBSERVABILITY_SENTINELS,
  evaluateTrustNetworkObservability,
  evaluateTrustNetworkObservabilityGate,
  type TrustNetworkTelemetryEvent,
} from '../institutionalTrustNetworkObservability';

const GENERATED_AT = '2026-05-10T23:00:00.000Z';

const events: TrustNetworkTelemetryEvent[] = [
  {
    eventId: 'ci-issuer',
    observedAt: '2026-05-10T20:00:00.000Z',
    orgId: 'org-issuer',
    actorRole: 'ISSUER',
    actorId: 'issuer-ci',
    eventType: 'credential_issued',
    replaySafe: true,
    replayTraceId: 'trace-ci-1',
    lineageRefs: ['pre-ci', 'credential-ci'],
    evidenceRefs: ['psv-ci', 'issuer-attestation-ci'],
    trustSignal: 0.91,
    latencyMs: 180,
    ambiguity: null,
    anomalyHint: null,
    survivabilitySignal: 0.9,
  },
  {
    eventId: 'ci-replay',
    observedAt: '2026-05-10T20:04:00.000Z',
    orgId: 'org-replay',
    actorRole: 'REPLAY_INFRASTRUCTURE',
    actorId: 'replay-ci',
    eventType: 'replay_checked',
    replaySafe: true,
    replayTraceId: 'trace-ci-2',
    lineageRefs: ['decision-capsule-ci', 'replay-envelope-ci'],
    evidenceRefs: ['replay-proof-ci', 'capsule-hash-ci'],
    trustSignal: 0.9,
    latencyMs: 210,
    ambiguity: null,
    anomalyHint: null,
    survivabilitySignal: 0.9,
  },
  {
    eventId: 'ci-verifier',
    observedAt: '2026-05-10T20:08:00.000Z',
    orgId: 'org-verifier',
    actorRole: 'VERIFIER',
    actorId: 'verifier-ci',
    eventType: 'verification_requested',
    replaySafe: true,
    replayTraceId: 'trace-ci-3',
    lineageRefs: ['acceptance-ci', 'packet-ci'],
    evidenceRefs: ['verifier-request-ci', 'route-contract-ci'],
    trustSignal: 0.86,
    latencyMs: 330,
    ambiguity: 'Verifier requests local policy vocabulary reconciliation.',
    anomalyHint: null,
    survivabilitySignal: 0.84,
  },
  {
    eventId: 'ci-clinician',
    observedAt: '2026-05-10T20:12:00.000Z',
    orgId: 'org-clinician',
    actorRole: 'CLINICIAN',
    actorId: 'clinician-ci',
    eventType: 'trust_route_completed',
    replaySafe: true,
    replayTraceId: 'trace-ci-4',
    lineageRefs: ['holder-presentation-ci', 'qia-ci'],
    evidenceRefs: ['presentation-proof-ci', 'holder-consent-ci'],
    trustSignal: 0.87,
    latencyMs: 360,
    ambiguity: null,
    anomalyHint: null,
    survivabilitySignal: 0.86,
  },
];

describe('CI gate - institutional trust-network observability', () => {
  it('keeps the gate id surface explicit and frozen', () => {
    expect(NETWORK_OBSERVABILITY_GATE_IDS).toEqual([
      'ecosystem_replay_observable',
      'ambiguity_preserved_network_wide',
      'anomaly_lineage_reconstructable',
      'fail_closed_observability_semantics',
      'trust_network_longitudinally_visible',
      'ecosystem_survivability_measurable',
      'cross_org_analytics_fidelity',
    ]);
    expect(Object.isFrozen(NETWORK_OBSERVABILITY_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(NETWORK_OBSERVABILITY_SENTINELS)).toBe(true);
  });

  it('passes only when replay, ambiguity, anomaly-lineage, longitudinal, survivability, and cross-org gates hold', () => {
    const result = evaluateTrustNetworkObservability({
      networkId: 'ci-network',
      generatedAt: GENERATED_AT,
      events,
    });
    const gate = evaluateTrustNetworkObservabilityGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map(gateResult => gateResult.id)).toEqual(NETWORK_OBSERVABILITY_GATE_IDS);
  });
});
