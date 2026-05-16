import {
  ECOSYSTEM_EXPANSION_GATE_IDS,
  ECOSYSTEM_EXPANSION_SENTINELS,
  evaluateEcosystemExpansion,
  evaluateEcosystemExpansionGate,
  type EcosystemExpansionSignal,
} from '../ecosystemExpansionLayer';

const signals: EcosystemExpansionSignal[] = [
  {
    signalId: 'ci-issuer',
    recordedAt: '2026-05-10T20:00:00.000Z',
    ecosystemId: 'ci-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-issuer',
    participantRole: 'ISSUER',
    signalType: 'issuer_invited',
    replaySafe: true,
    replayTraceId: 'ci-replay-1',
    replayTrustPropagation: 0.91,
    onboardingFidelity: 0.88,
    ecosystemSurvivability: 0.88,
    institutionalGrowth: 0.82,
    expansionDrift: 0.08,
    evidenceRefs: ['ci-issuer-invite', 'ci-contract'],
    lineageRefs: ['ci-issuer-lineage', 'ci-activation-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-employer',
    recordedAt: '2026-05-10T20:08:00.000Z',
    ecosystemId: 'ci-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-employer',
    participantRole: 'EMPLOYER',
    signalType: 'employer_onboarded',
    replaySafe: true,
    replayTraceId: 'ci-replay-2',
    replayTrustPropagation: 0.89,
    onboardingFidelity: 0.9,
    ecosystemSurvivability: 0.89,
    institutionalGrowth: 0.86,
    expansionDrift: 0.08,
    evidenceRefs: ['ci-employer-onboarded', 'ci-acceptance-route'],
    lineageRefs: ['ci-employer-lineage', 'ci-onboarding-route'],
    ambiguity: 'CI employer preserves local taxonomy ambiguity.',
  },
  {
    signalId: 'ci-clinician',
    recordedAt: '2026-05-10T20:16:00.000Z',
    ecosystemId: 'ci-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-clinician-cohort',
    participantRole: 'CLINICIAN',
    signalType: 'clinician_activated',
    replaySafe: true,
    replayTraceId: 'ci-replay-3',
    replayTrustPropagation: 0.9,
    onboardingFidelity: 0.89,
    ecosystemSurvivability: 0.9,
    institutionalGrowth: 0.88,
    expansionDrift: 0.07,
    evidenceRefs: ['ci-holder-activation', 'ci-qia-route'],
    lineageRefs: ['ci-clinician-lineage', 'ci-wallet-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-verifier',
    recordedAt: '2026-05-10T20:24:00.000Z',
    ecosystemId: 'ci-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-verifier',
    participantRole: 'VERIFIER',
    signalType: 'verifier_connected',
    replaySafe: true,
    replayTraceId: 'ci-replay-4',
    replayTrustPropagation: 0.91,
    onboardingFidelity: 0.9,
    ecosystemSurvivability: 0.91,
    institutionalGrowth: 0.9,
    expansionDrift: 0.07,
    evidenceRefs: ['ci-verifier-connection', 'ci-oid4vp-route'],
    lineageRefs: ['ci-verifier-lineage', 'ci-presentation-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-replay-propagation',
    recordedAt: '2026-05-10T20:32:00.000Z',
    ecosystemId: 'ci-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-replay-infra',
    participantRole: 'VERIFIER',
    signalType: 'replay_trust_propagated',
    replaySafe: true,
    replayTraceId: 'ci-replay-5',
    replayTrustPropagation: 0.92,
    onboardingFidelity: 0.91,
    ecosystemSurvivability: 0.92,
    institutionalGrowth: 0.91,
    expansionDrift: 0.06,
    evidenceRefs: ['ci-replay-propagation', 'ci-decision-capsule-route'],
    lineageRefs: ['ci-replay-lineage', 'ci-trust-propagation-route'],
    ambiguity: null,
  },
];

describe('CI gate - institutional ecosystem expansion layer', () => {
  it('keeps the ecosystem-expansion gate id surface explicit and frozen', () => {
    expect(ECOSYSTEM_EXPANSION_GATE_IDS).toEqual([
      'ecosystem_growth_replay_safe',
      'ambiguity_preserved_during_propagation',
      'onboarding_lineage_reconstructable',
      'fail_closed_expansion_semantics',
      'ecosystem_survivability_measurable',
      'institutional_growth_longitudinally_visible',
      'expansion_drift_measurable',
    ]);
    expect(Object.isFrozen(ECOSYSTEM_EXPANSION_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(ECOSYSTEM_EXPANSION_SENTINELS)).toBe(true);
  });

  it('passes only when replay propagation, onboarding lineage, survivability, growth, drift, and ambiguity gates hold', () => {
    const result = evaluateEcosystemExpansion({
      expansionId: 'ci-expansion',
      ecosystemId: 'ci-ecosystem',
      generatedAt: '2026-05-10T23:55:00.000Z',
      signals,
    });
    const gate = evaluateEcosystemExpansionGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateResult: { id: string }) => gateResult.id)).toEqual(ECOSYSTEM_EXPANSION_GATE_IDS);
  });
});
