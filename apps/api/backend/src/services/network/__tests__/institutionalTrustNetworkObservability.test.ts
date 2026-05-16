import {
  buildTrustNetworkLineage,
  evaluateTrustNetworkObservability,
  evaluateTrustNetworkObservabilityGate,
  runTrustNetworkChaosSimulations,
  type TrustNetworkTelemetryEvent,
} from '../institutionalTrustNetworkObservability';

const NETWORK_ID = 'network-vitalcv-pilot';
const GENERATED_AT = '2026-05-10T23:00:00.000Z';

function event(
  overrides: Partial<TrustNetworkTelemetryEvent> = {},
): TrustNetworkTelemetryEvent {
  return {
    eventId: 'event-issuer-1',
    observedAt: '2026-05-10T20:00:00.000Z',
    orgId: 'org-issuer-a',
    actorRole: 'ISSUER',
    actorId: 'issuer-operator-a',
    eventType: 'credential_issued',
    replaySafe: true,
    replayTraceId: 'replay-trace-1',
    lineageRefs: ['pre-1', 'credential-1'],
    evidenceRefs: ['psv-receipt-1', 'issuer-attestation-1'],
    trustSignal: 0.92,
    latencyMs: 180,
    ambiguity: null,
    anomalyHint: null,
    survivabilitySignal: 0.9,
    ...overrides,
  };
}

function baselineEvents(): TrustNetworkTelemetryEvent[] {
  return [
    event(),
    event({
      eventId: 'event-replay-checked-1',
      observedAt: '2026-05-10T20:04:00.000Z',
      orgId: 'org-replay-infra',
      actorRole: 'REPLAY_INFRASTRUCTURE',
      actorId: 'replay-worker-1',
      eventType: 'replay_checked',
      replayTraceId: 'replay-trace-2',
      lineageRefs: ['decision-capsule-1', 'replay-envelope-1'],
      evidenceRefs: ['replay-proof-1', 'capsule-hash-1'],
      trustSignal: 0.89,
      latencyMs: 220,
      survivabilitySignal: 0.88,
    }),
    event({
      eventId: 'event-verifier-request-1',
      observedAt: '2026-05-10T20:08:00.000Z',
      orgId: 'org-verifier-a',
      actorRole: 'VERIFIER',
      actorId: 'verifier-operator-a',
      eventType: 'verification_requested',
      replayTraceId: 'replay-trace-3',
      lineageRefs: ['acceptance-request-1', 'packet-1'],
      evidenceRefs: ['verifier-request-1', 'route-contract-1'],
      trustSignal: 0.84,
      latencyMs: 340,
      ambiguity: 'Verifier A reports payer-specific vocabulary mapping unresolved.',
      survivabilitySignal: 0.83,
    }),
    event({
      eventId: 'event-replay-degraded-1',
      observedAt: '2026-05-10T20:12:00.000Z',
      orgId: 'org-replay-infra',
      actorRole: 'REPLAY_INFRASTRUCTURE',
      actorId: 'replay-worker-2',
      eventType: 'replay_degraded',
      replayTraceId: 'replay-trace-4',
      lineageRefs: ['degradation-window-1', 'decision-capsule-1'],
      evidenceRefs: ['latency-sample-1', 'operator-note-1'],
      trustSignal: 0.74,
      latencyMs: 2400,
      anomalyHint: 'Replay latency degraded but trace remained reconstructable.',
      survivabilitySignal: 0.78,
    }),
    event({
      eventId: 'event-clinician-presented-1',
      observedAt: '2026-05-10T20:16:00.000Z',
      orgId: 'org-clinician-a',
      actorRole: 'CLINICIAN',
      actorId: 'clinician-holder-a',
      eventType: 'trust_route_completed',
      replayTraceId: 'replay-trace-5',
      lineageRefs: ['holder-presentation-1', 'qia-1'],
      evidenceRefs: ['presentation-proof-1', 'holder-consent-1'],
      trustSignal: 0.87,
      latencyMs: 410,
      survivabilitySignal: 0.86,
    }),
    event({
      eventId: 'event-verifier-accepted-1',
      observedAt: '2026-05-10T20:20:00.000Z',
      orgId: 'org-verifier-b',
      actorRole: 'VERIFIER',
      actorId: 'verifier-operator-b',
      eventType: 'verification_accepted',
      replayTraceId: 'replay-trace-6',
      lineageRefs: ['employer-acceptance-1', 'decision-capsule-2'],
      evidenceRefs: ['acceptance-receipt-1', 'audit-event-1'],
      trustSignal: 0.86,
      latencyMs: 290,
      survivabilitySignal: 0.85,
    }),
  ];
}

describe('W2-PR111A institutional trust-network observability', () => {
  it('builds deterministic anomaly lineage from unordered telemetry', () => {
    const baseline = baselineEvents();
    const lineage = buildTrustNetworkLineage({
      networkId: NETWORK_ID,
      generatedAt: GENERATED_AT,
      events: [...baseline].reverse(),
    });
    const repeat = buildTrustNetworkLineage({
      networkId: NETWORK_ID,
      generatedAt: GENERATED_AT,
      events: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map(entry => entry.eventId)).toEqual([
      'event-issuer-1',
      'event-replay-checked-1',
      'event-verifier-request-1',
      'event-replay-degraded-1',
      'event-clinician-presented-1',
      'event-verifier-accepted-1',
    ]);
    expect(lineage.participantOrgIds).toEqual([
      'org-clinician-a',
      'org-issuer-a',
      'org-replay-infra',
      'org-verifier-a',
      'org-verifier-b',
    ]);
    expect(lineage.firstObservedAt).toBe('2026-05-10T20:00:00.000Z');
    expect(lineage.lastObservedAt).toBe('2026-05-10T20:20:00.000Z');
  });

  it('observes replay telemetry, cross-org analytics, anomalies, ambiguity, and survivability without failing open', () => {
    const result = evaluateTrustNetworkObservability({
      networkId: NETWORK_ID,
      generatedAt: GENERATED_AT,
      events: baselineEvents(),
    });

    expect(result.status).toBe('DEGRADED_OBSERVABILITY');
    expect(result.verdict).toBe('NETWORK_DEGRADED');
    expect(result.failClosed).toBe(false);
    expect(result.replayTelemetry.observable).toBe(true);
    expect(result.replayTelemetry.visibilityPct).toBe(100);
    expect(result.crossOrgAnalytics.visible).toBe(true);
    expect(result.crossOrgAnalytics.rolesObserved).toEqual([
      'CLINICIAN',
      'ISSUER',
      'REPLAY_INFRASTRUCTURE',
      'VERIFIER',
    ]);
    expect(result.anomalyDetection.status).toBe('ANOMALY_DETECTED');
    expect(result.anomalyDetection.lineageReconstructable).toBe(true);
    expect(result.anomalyDetection.anomalies.map(anomaly => anomaly.eventId)).toEqual([
      'event-replay-degraded-1',
    ]);
    expect(result.ambiguities).toEqual([
      'Verifier A reports payer-specific vocabulary mapping unresolved.',
    ]);
    expect(result.longitudinal.visible).toBe(true);
    expect(result.survivability.measurable).toBe(true);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'ecosystem_replay_observable',
      'cross_org_analytics_visible',
      'anomaly_lineage_reconstructable',
      'network_ambiguity_preserved',
      'ecosystem_survivability_measurable',
    ]));
  });

  it('fails closed when replay telemetry, lineage evidence, cross-org coverage, and survivability are not observable', () => {
    const result = evaluateTrustNetworkObservability({
      networkId: NETWORK_ID,
      generatedAt: GENERATED_AT,
      events: [
        event({
          eventId: 'event-broken-1',
          observedAt: '2026-05-10T20:00:00.000Z',
          orgId: 'org-verifier-a',
          actorRole: 'VERIFIER',
          eventType: 'replay_degraded',
          replaySafe: false,
          replayTraceId: null,
          lineageRefs: [],
          evidenceRefs: [],
          trustSignal: 0.31,
          latencyMs: 6400,
          ambiguity: 'Replay failure cause disputed by verifier.',
          anomalyHint: 'Replay trace missing during institutional verification.',
          survivabilitySignal: 0.2,
        }),
      ],
    });

    expect(result.status).toBe('OBSERVABILITY_BLOCKED');
    expect(result.verdict).toBe('NETWORK_BLOCKED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Ecosystem replay telemetry is not observable.',
      'Cross-org trust analytics are below visibility floor.',
      'Anomaly lineage is not reconstructable.',
      'Trust-network longitudinal visibility is insufficient.',
      'Ecosystem survivability is not measurable.',
    ]));
    expect(result.ambiguities).toEqual(['Replay failure cause disputed by verifier.']);

    const gate = evaluateTrustNetworkObservabilityGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'ecosystem_replay_observable',
      'cross_org_analytics_fidelity',
      'anomaly_lineage_reconstructable',
      'fail_closed_observability_semantics',
    ]));
  });

  it('surfaces every trust-network chaos scenario instead of silently normalizing failures', () => {
    const chaos = runTrustNetworkChaosSimulations({
      networkId: NETWORK_ID,
      generatedAt: GENERATED_AT,
      events: baselineEvents(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(6);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map(scenario => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_TELEMETRY_GAP',
      'AMBIGUITY_SUPPRESSION',
      'ANOMALY_LINEAGE_GAP',
      'CROSS_ORG_PARTITION',
      'LONGITUDINAL_COLLAPSE',
      'SURVIVABILITY_SIGNAL_LOSS',
    ]));
    expect(chaos.scenarios.every(scenario => scenario.signalSurfaced)).toBe(true);
  });
});
