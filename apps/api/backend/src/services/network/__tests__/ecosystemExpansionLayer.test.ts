import {
  buildEcosystemExpansionLineage,
  evaluateEcosystemExpansion,
  evaluateEcosystemExpansionGate,
  runEcosystemExpansionChaosSimulations,
  type EcosystemExpansionSignal,
} from '../ecosystemExpansionLayer';

const EXPANSION_ID = 'ecosystem-expansion-131a';
const ECOSYSTEM_ID = 'vitalcv-ecosystem-pilot';
const GENERATED_AT = '2026-05-10T23:55:00.000Z';

function signal(overrides: Partial<EcosystemExpansionSignal> = {}): EcosystemExpansionSignal {
  return {
    signalId: 'signal-issuer-1',
    recordedAt: '2026-05-10T20:00:00.000Z',
    ecosystemId: ECOSYSTEM_ID,
    institutionId: 'institution-anchor-a',
    participantOrgId: 'issuer-a',
    participantRole: 'ISSUER',
    signalType: 'issuer_invited',
    replaySafe: true,
    replayTraceId: 'replay-trace-1',
    replayTrustPropagation: 0.9,
    onboardingFidelity: 0.86,
    ecosystemSurvivability: 0.88,
    institutionalGrowth: 0.78,
    expansionDrift: 0.08,
    evidenceRefs: ['issuer-invite-1', 'trust-contract-1'],
    lineageRefs: ['issuer-lineage-1', 'activation-route-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineSignals(): EcosystemExpansionSignal[] {
  return [
    signal(),
    signal({
      signalId: 'signal-employer-1',
      recordedAt: '2026-05-10T20:08:00.000Z',
      participantOrgId: 'employer-a',
      participantRole: 'EMPLOYER',
      signalType: 'employer_onboarded',
      replayTraceId: 'replay-trace-2',
      replayTrustPropagation: 0.88,
      onboardingFidelity: 0.9,
      ecosystemSurvivability: 0.86,
      institutionalGrowth: 0.82,
      expansionDrift: 0.1,
      evidenceRefs: ['employer-onboarding-1', 'acceptance-route-1'],
      lineageRefs: ['employer-lineage-1', 'onboarding-route-1'],
      ambiguity: 'Employer A requires local taxonomy mapping during propagation.',
    }),
    signal({
      signalId: 'signal-clinician-1',
      recordedAt: '2026-05-10T20:16:00.000Z',
      participantOrgId: 'clinician-cohort-a',
      participantRole: 'CLINICIAN',
      signalType: 'clinician_activated',
      replayTraceId: 'replay-trace-3',
      replayTrustPropagation: 0.87,
      onboardingFidelity: 0.87,
      ecosystemSurvivability: 0.87,
      institutionalGrowth: 0.86,
      expansionDrift: 0.09,
      evidenceRefs: ['holder-activation-1', 'qia-route-1'],
      lineageRefs: ['clinician-lineage-1', 'wallet-route-1'],
    }),
    signal({
      signalId: 'signal-verifier-1',
      recordedAt: '2026-05-10T20:24:00.000Z',
      participantOrgId: 'verifier-a',
      participantRole: 'VERIFIER',
      signalType: 'verifier_connected',
      replayTraceId: 'replay-trace-4',
      replayTrustPropagation: 0.89,
      onboardingFidelity: 0.88,
      ecosystemSurvivability: 0.89,
      institutionalGrowth: 0.88,
      expansionDrift: 0.08,
      evidenceRefs: ['verifier-connection-1', 'oid4vp-route-1'],
      lineageRefs: ['verifier-lineage-1', 'presentation-route-1'],
    }),
    signal({
      signalId: 'signal-replay-propagation-1',
      recordedAt: '2026-05-10T20:32:00.000Z',
      participantOrgId: 'replay-infra-a',
      participantRole: 'VERIFIER',
      signalType: 'replay_trust_propagated',
      replayTraceId: 'replay-trace-5',
      replayTrustPropagation: 0.91,
      onboardingFidelity: 0.89,
      ecosystemSurvivability: 0.9,
      institutionalGrowth: 0.9,
      expansionDrift: 0.07,
      evidenceRefs: ['replay-propagation-1', 'decision-capsule-route-1'],
      lineageRefs: ['replay-lineage-1', 'trust-propagation-route-1'],
    }),
    signal({
      signalId: 'signal-survivability-1',
      recordedAt: '2026-05-10T20:40:00.000Z',
      participantOrgId: 'ecosystem-ops-a',
      participantRole: 'ISSUER',
      signalType: 'survivability_observed',
      replayTraceId: 'replay-trace-6',
      replayTrustPropagation: 0.9,
      onboardingFidelity: 0.9,
      ecosystemSurvivability: 0.92,
      institutionalGrowth: 0.91,
      expansionDrift: 0.07,
      evidenceRefs: ['survivability-telemetry-1', 'expansion-boundary-1'],
      lineageRefs: ['survivability-lineage-1', 'expansion-snapshot-1'],
    }),
  ];
}

describe('W2-PR131A institutional ecosystem expansion layer', () => {
  it('builds deterministic onboarding lineage from unordered expansion telemetry', () => {
    const baseline = baselineSignals();
    const lineage = buildEcosystemExpansionLineage({
      expansionId: EXPANSION_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: [...baseline].reverse(),
    });
    const repeat = buildEcosystemExpansionLineage({
      expansionId: EXPANSION_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { signalId: string }) => entry.signalId)).toEqual([
      'signal-issuer-1',
      'signal-employer-1',
      'signal-clinician-1',
      'signal-verifier-1',
      'signal-replay-propagation-1',
      'signal-survivability-1',
    ]);
    expect(lineage.rolesObserved).toEqual(['CLINICIAN', 'EMPLOYER', 'ISSUER', 'VERIFIER']);
    expect(lineage.firstRecordedAt).toBe('2026-05-10T20:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-10T20:40:00.000Z');
  });

  it('scores replay propagation, cross-org onboarding, survivability, drift, growth, and ambiguity preservation', () => {
    const result = evaluateEcosystemExpansion({
      expansionId: EXPANSION_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals(),
    });

    expect(result.status).toBe('EXPANSION_DEGRADED');
    expect(result.verdict).toBe('EXPANSION_READY_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayPropagation.replaySafe).toBe(true);
    expect(result.replayPropagation.propagationPct).toBeGreaterThanOrEqual(89);
    expect(result.onboarding.lineageReconstructable).toBe(true);
    expect(result.onboarding.fidelityPct).toBeGreaterThanOrEqual(88);
    expect(result.survivability.measurable).toBe(true);
    expect(result.growth.longitudinallyVisible).toBe(true);
    expect(result.drift.measurable).toBe(true);
    expect(result.ambiguities).toEqual([
      'Employer A requires local taxonomy mapping during propagation.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'ecosystem_growth_replay_safe',
      'ambiguity_preserved_during_propagation',
      'onboarding_lineage_reconstructable',
      'ecosystem_survivability_measurable',
      'institutional_growth_longitudinally_visible',
      'expansion_drift_measurable',
    ]));
  });

  it('fails closed when replay propagation, onboarding lineage, survivability, and growth visibility are missing', () => {
    const result = evaluateEcosystemExpansion({
      expansionId: EXPANSION_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: [
        signal({
          signalId: 'signal-broken-1',
          signalType: 'replay_trust_propagated',
          replaySafe: false,
          replayTraceId: null,
          replayTrustPropagation: 0.22,
          onboardingFidelity: 0.19,
          ecosystemSurvivability: 0.18,
          institutionalGrowth: 0.2,
          expansionDrift: 0.86,
          evidenceRefs: [],
          lineageRefs: [],
          ambiguity: 'Verifier ecosystem supplied no replay propagation envelope.',
        }),
      ],
    });

    expect(result.status).toBe('EXPANSION_BLOCKED');
    expect(result.verdict).toBe('EXPANSION_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Ecosystem growth is not replay-safe.',
      'Cross-org onboarding lineage is not reconstructable.',
      'Ecosystem survivability is not measurable.',
      'Institutional growth is not longitudinally visible.',
      'Expansion drift is not measurable below risk floor.',
    ]));
    expect(result.ambiguities).toEqual([
      'Verifier ecosystem supplied no replay propagation envelope.',
    ]);

    const gate = evaluateEcosystemExpansionGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'ecosystem_growth_replay_safe',
      'onboarding_lineage_reconstructable',
      'fail_closed_expansion_semantics',
      'ecosystem_survivability_measurable',
    ]));
  });

  it('surfaces every ecosystem-expansion chaos scenario without silent normalization', () => {
    const chaos = runEcosystemExpansionChaosSimulations({
      expansionId: EXPANSION_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(6);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_PROPAGATION_DROP',
      'AMBIGUITY_SUPPRESSION',
      'ONBOARDING_LINEAGE_GAP',
      'SURVIVABILITY_SIGNAL_LOSS',
      'GROWTH_LONGITUDINAL_COLLAPSE',
      'EXPANSION_DRIFT_SPIKE',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
