import {
  buildEcosystemTrustBootstrapLineage,
  evaluateEcosystemTrustBootstrap,
  evaluateEcosystemTrustBootstrapGate,
  runEcosystemTrustBootstrapChaosSimulations,
  type EcosystemTrustBootstrapSignal,
} from '../ecosystemTrustBootstrap';

const BOOTSTRAP_ID = 'trust-bootstrap-135a';
const ECOSYSTEM_ID = 'vitalcv-bootstrap-ecosystem';
const GENERATED_AT = '2026-05-11T00:10:00.000Z';

function signal(overrides: Partial<EcosystemTrustBootstrapSignal> = {}): EcosystemTrustBootstrapSignal {
  return {
    signalId: 'signal-anchor-seed-1',
    recordedAt: '2026-05-10T20:00:00.000Z',
    ecosystemId: ECOSYSTEM_ID,
    institutionId: 'institution-anchor-a',
    participantOrgId: 'anchor-a',
    participantRole: 'ANCHOR_INSTITUTION',
    signalType: 'anchor_seed_created',
    replaySafe: true,
    replayTraceId: 'replay-trace-1',
    replayOnboardingFidelity: 0.9,
    trustSeedStrength: 0.88,
    activationVisibility: 0.84,
    crossOrgSurvivability: 0.86,
    ecosystemTrust: 0.87,
    evidenceRefs: ['anchor-seed-1', 'trust-contract-1'],
    lineageRefs: ['bootstrap-lineage-1', 'seed-capsule-1'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineSignals(): EcosystemTrustBootstrapSignal[] {
  return [
    signal(),
    signal({
      signalId: 'signal-issuer-invite-1',
      recordedAt: '2026-05-10T20:08:00.000Z',
      participantOrgId: 'issuer-a',
      participantRole: 'ISSUER',
      signalType: 'issuer_invited',
      replayTraceId: 'replay-trace-2',
      replayOnboardingFidelity: 0.88,
      trustSeedStrength: 0.87,
      activationVisibility: 0.85,
      crossOrgSurvivability: 0.87,
      ecosystemTrust: 0.88,
      evidenceRefs: ['issuer-invite-1', 'source-contract-1'],
      lineageRefs: ['issuer-lineage-1', 'bootstrap-route-1'],
    }),
    signal({
      signalId: 'signal-verifier-onboarded-1',
      recordedAt: '2026-05-10T20:16:00.000Z',
      participantOrgId: 'verifier-a',
      participantRole: 'VERIFIER',
      signalType: 'verifier_onboarded',
      replayTraceId: 'replay-trace-3',
      replayOnboardingFidelity: 0.89,
      trustSeedStrength: 0.88,
      activationVisibility: 0.88,
      crossOrgSurvivability: 0.88,
      ecosystemTrust: 0.89,
      evidenceRefs: ['verifier-onboarding-1', 'presentation-policy-1'],
      lineageRefs: ['verifier-lineage-1', 'oid4vp-route-1'],
      ambiguity: 'Verifier A requires local onboarding terminology mapping.',
    }),
    signal({
      signalId: 'signal-employer-seeded-1',
      recordedAt: '2026-05-10T20:24:00.000Z',
      participantOrgId: 'employer-a',
      participantRole: 'EMPLOYER',
      signalType: 'employer_seeded',
      replayTraceId: 'replay-trace-4',
      replayOnboardingFidelity: 0.9,
      trustSeedStrength: 0.9,
      activationVisibility: 0.89,
      crossOrgSurvivability: 0.89,
      ecosystemTrust: 0.9,
      evidenceRefs: ['employer-seed-1', 'acceptance-route-1'],
      lineageRefs: ['employer-lineage-1', 'decision-route-1'],
    }),
    signal({
      signalId: 'signal-clinician-cohort-1',
      recordedAt: '2026-05-10T20:32:00.000Z',
      participantOrgId: 'clinician-cohort-a',
      participantRole: 'CLINICIAN',
      signalType: 'clinician_cohort_seeded',
      replayTraceId: 'replay-trace-5',
      replayOnboardingFidelity: 0.91,
      trustSeedStrength: 0.89,
      activationVisibility: 0.9,
      crossOrgSurvivability: 0.9,
      ecosystemTrust: 0.91,
      evidenceRefs: ['clinician-cohort-1', 'wallet-seed-1'],
      lineageRefs: ['clinician-lineage-1', 'holder-route-1'],
    }),
    signal({
      signalId: 'signal-bootstrap-activation-1',
      recordedAt: '2026-05-10T20:40:00.000Z',
      participantOrgId: 'bootstrap-ops-a',
      participantRole: 'ANCHOR_INSTITUTION',
      signalType: 'bootstrap_activation_observed',
      replayTraceId: 'replay-trace-6',
      replayOnboardingFidelity: 0.92,
      trustSeedStrength: 0.91,
      activationVisibility: 0.93,
      crossOrgSurvivability: 0.91,
      ecosystemTrust: 0.92,
      evidenceRefs: ['activation-telemetry-1', 'bootstrap-score-1'],
      lineageRefs: ['activation-lineage-1', 'bootstrap-snapshot-1'],
    }),
  ];
}

describe('W2-PR135A ecosystem trust bootstrap layer', () => {
  it('builds deterministic onboarding lineage from unordered bootstrap telemetry', () => {
    const baseline = baselineSignals();
    const lineage = buildEcosystemTrustBootstrapLineage({
      bootstrapId: BOOTSTRAP_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: [...baseline].reverse(),
    });
    const repeat = buildEcosystemTrustBootstrapLineage({
      bootstrapId: BOOTSTRAP_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baseline,
    });

    expect(lineage.lineageHash).toBe(repeat.lineageHash);
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.timeline.map((entry: { signalId: string }) => entry.signalId)).toEqual([
      'signal-anchor-seed-1',
      'signal-issuer-invite-1',
      'signal-verifier-onboarded-1',
      'signal-employer-seeded-1',
      'signal-clinician-cohort-1',
      'signal-bootstrap-activation-1',
    ]);
    expect(lineage.rolesObserved).toEqual([
      'ANCHOR_INSTITUTION',
      'CLINICIAN',
      'EMPLOYER',
      'ISSUER',
      'VERIFIER',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-10T20:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-10T20:40:00.000Z');
  });

  it('scores replay-aware onboarding, trust seeding, activation visibility, survivability, and ambiguity preservation', () => {
    const result = evaluateEcosystemTrustBootstrap({
      bootstrapId: BOOTSTRAP_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals(),
    });

    expect(result.status).toBe('BOOTSTRAP_DEGRADED');
    expect(result.verdict).toBe('BOOTSTRAP_READY_WITH_AMBIGUITY');
    expect(result.failClosed).toBe(false);
    expect(result.replayOnboarding.replaySafe).toBe(true);
    expect(result.replayOnboarding.fidelityPct).toBeGreaterThanOrEqual(90);
    expect(result.onboarding.lineageReconstructable).toBe(true);
    expect(result.trustSeeding.measurable).toBe(true);
    expect(result.activation.visible).toBe(true);
    expect(result.survivability.measurable).toBe(true);
    expect(result.ecosystemTrust.longitudinallyVisible).toBe(true);
    expect(result.ambiguities).toEqual([
      'Verifier A requires local onboarding terminology mapping.',
    ]);
    expect(result.confidence.basis).toEqual(expect.arrayContaining([
      'bootstrap_replay_safe',
      'ambiguity_preserved_cross_org',
      'onboarding_lineage_reconstructable',
      'institutional_seeding_measurable',
      'ecosystem_activation_visible',
      'ecosystem_trust_longitudinally_visible',
    ]));
  });

  it('fails closed when replay onboarding, lineage, seeding, activation, and ecosystem trust are not evidenced', () => {
    const result = evaluateEcosystemTrustBootstrap({
      bootstrapId: BOOTSTRAP_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: [
        signal({
          signalId: 'signal-broken-bootstrap-1',
          signalType: 'bootstrap_activation_observed',
          replaySafe: false,
          replayTraceId: null,
          replayOnboardingFidelity: 0.2,
          trustSeedStrength: 0.18,
          activationVisibility: 0.19,
          crossOrgSurvivability: 0.2,
          ecosystemTrust: 0.21,
          evidenceRefs: [],
          lineageRefs: [],
          ambiguity: 'Initial verifier onboarding lacks replay evidence.',
        }),
      ],
    });

    expect(result.status).toBe('BOOTSTRAP_BLOCKED');
    expect(result.verdict).toBe('BOOTSTRAP_FAIL_CLOSED');
    expect(result.failClosed).toBe(true);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'Bootstrap replay onboarding is not safe.',
      'Onboarding lineage is not reconstructable.',
      'Institutional trust seeding is not measurable.',
      'Ecosystem activation is not visible.',
      'Ecosystem trust is not longitudinally visible.',
      'Cross-org survivability is not measurable.',
    ]));
    expect(result.ambiguities).toEqual(['Initial verifier onboarding lacks replay evidence.']);

    const gate = evaluateEcosystemTrustBootstrapGate(result);
    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'bootstrap_replay_safe',
      'onboarding_lineage_reconstructable',
      'fail_closed_activation_semantics',
      'institutional_seeding_measurable',
    ]));
  });

  it('surfaces every trust-bootstrap chaos scenario without silent normalization', () => {
    const chaos = runEcosystemTrustBootstrapChaosSimulations({
      bootstrapId: BOOTSTRAP_ID,
      ecosystemId: ECOSYSTEM_ID,
      generatedAt: GENERATED_AT,
      signals: baselineSignals(),
    });

    expect(chaos.totalScenarios).toBeGreaterThanOrEqual(7);
    expect(chaos.silentFailureCount).toBe(0);
    expect(chaos.scenarios.map((scenario: { scenario: string }) => scenario.scenario)).toEqual(expect.arrayContaining([
      'REPLAY_ONBOARDING_DROP',
      'AMBIGUITY_SUPPRESSION',
      'ONBOARDING_LINEAGE_GAP',
      'TRUST_SEEDING_LOSS',
      'ACTIVATION_VISIBILITY_COLLAPSE',
      'ECOSYSTEM_TRUST_LONGITUDINAL_COLLAPSE',
      'CROSS_ORG_SURVIVABILITY_LOSS',
    ]));
    expect(chaos.scenarios.every((scenario: { signalSurfaced: boolean }) => scenario.signalSurfaced)).toBe(true);
  });
});
