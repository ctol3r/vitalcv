import {
  ECOSYSTEM_TRUST_BOOTSTRAP_GATE_IDS,
  ECOSYSTEM_TRUST_BOOTSTRAP_SENTINELS,
  evaluateEcosystemTrustBootstrap,
  evaluateEcosystemTrustBootstrapGate,
  type EcosystemTrustBootstrapSignal,
} from '../ecosystemTrustBootstrap';

const signals: EcosystemTrustBootstrapSignal[] = [
  {
    signalId: 'ci-anchor',
    recordedAt: '2026-05-10T20:00:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-anchor',
    participantRole: 'ANCHOR_INSTITUTION',
    signalType: 'anchor_seed_created',
    replaySafe: true,
    replayTraceId: 'ci-replay-1',
    replayOnboardingFidelity: 0.9,
    trustSeedStrength: 0.89,
    activationVisibility: 0.86,
    crossOrgSurvivability: 0.87,
    ecosystemTrust: 0.88,
    evidenceRefs: ['ci-anchor-seed', 'ci-contract'],
    lineageRefs: ['ci-anchor-lineage', 'ci-seed-capsule'],
    ambiguity: null,
  },
  {
    signalId: 'ci-issuer',
    recordedAt: '2026-05-10T20:08:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-issuer',
    participantRole: 'ISSUER',
    signalType: 'issuer_invited',
    replaySafe: true,
    replayTraceId: 'ci-replay-2',
    replayOnboardingFidelity: 0.89,
    trustSeedStrength: 0.9,
    activationVisibility: 0.87,
    crossOrgSurvivability: 0.88,
    ecosystemTrust: 0.89,
    evidenceRefs: ['ci-issuer-invite', 'ci-source-contract'],
    lineageRefs: ['ci-issuer-lineage', 'ci-bootstrap-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-verifier',
    recordedAt: '2026-05-10T20:16:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-verifier',
    participantRole: 'VERIFIER',
    signalType: 'verifier_onboarded',
    replaySafe: true,
    replayTraceId: 'ci-replay-3',
    replayOnboardingFidelity: 0.9,
    trustSeedStrength: 0.9,
    activationVisibility: 0.89,
    crossOrgSurvivability: 0.89,
    ecosystemTrust: 0.9,
    evidenceRefs: ['ci-verifier-onboarding', 'ci-presentation-policy'],
    lineageRefs: ['ci-verifier-lineage', 'ci-oid4vp-route'],
    ambiguity: 'CI verifier preserves local onboarding ambiguity.',
  },
  {
    signalId: 'ci-employer',
    recordedAt: '2026-05-10T20:24:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-employer',
    participantRole: 'EMPLOYER',
    signalType: 'employer_seeded',
    replaySafe: true,
    replayTraceId: 'ci-replay-4',
    replayOnboardingFidelity: 0.91,
    trustSeedStrength: 0.91,
    activationVisibility: 0.9,
    crossOrgSurvivability: 0.9,
    ecosystemTrust: 0.91,
    evidenceRefs: ['ci-employer-seed', 'ci-acceptance-route'],
    lineageRefs: ['ci-employer-lineage', 'ci-decision-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-clinician',
    recordedAt: '2026-05-10T20:32:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-clinician-cohort',
    participantRole: 'CLINICIAN',
    signalType: 'clinician_cohort_seeded',
    replaySafe: true,
    replayTraceId: 'ci-replay-5',
    replayOnboardingFidelity: 0.92,
    trustSeedStrength: 0.92,
    activationVisibility: 0.92,
    crossOrgSurvivability: 0.91,
    ecosystemTrust: 0.92,
    evidenceRefs: ['ci-clinician-cohort', 'ci-wallet-seed'],
    lineageRefs: ['ci-clinician-lineage', 'ci-holder-route'],
    ambiguity: null,
  },
  {
    signalId: 'ci-activation',
    recordedAt: '2026-05-10T20:40:00.000Z',
    ecosystemId: 'ci-bootstrap-ecosystem',
    institutionId: 'ci-institution',
    participantOrgId: 'ci-bootstrap-ops',
    participantRole: 'ANCHOR_INSTITUTION',
    signalType: 'bootstrap_activation_observed',
    replaySafe: true,
    replayTraceId: 'ci-replay-6',
    replayOnboardingFidelity: 0.92,
    trustSeedStrength: 0.92,
    activationVisibility: 0.93,
    crossOrgSurvivability: 0.92,
    ecosystemTrust: 0.93,
    evidenceRefs: ['ci-activation-telemetry', 'ci-bootstrap-score'],
    lineageRefs: ['ci-activation-lineage', 'ci-bootstrap-snapshot'],
    ambiguity: null,
  },
];

describe('CI gate - ecosystem trust bootstrap layer', () => {
  it('keeps the bootstrap gate id surface explicit and frozen', () => {
    expect(ECOSYSTEM_TRUST_BOOTSTRAP_GATE_IDS).toEqual([
      'bootstrap_replay_safe',
      'ambiguity_preserved_cross_org',
      'onboarding_lineage_reconstructable',
      'fail_closed_activation_semantics',
      'ecosystem_trust_longitudinally_visible',
      'institutional_seeding_measurable',
      'cross_org_survivability_measurable',
    ]);
    expect(Object.isFrozen(ECOSYSTEM_TRUST_BOOTSTRAP_GATE_IDS)).toBe(true);
    expect(Object.isFrozen(ECOSYSTEM_TRUST_BOOTSTRAP_SENTINELS)).toBe(true);
  });

  it('passes only when replay onboarding, lineage, seeding, activation, ecosystem trust, and survivability gates hold', () => {
    const result = evaluateEcosystemTrustBootstrap({
      bootstrapId: 'ci-bootstrap',
      ecosystemId: 'ci-bootstrap-ecosystem',
      generatedAt: '2026-05-11T00:10:00.000Z',
      signals,
    });
    const gate = evaluateEcosystemTrustBootstrapGate(result);

    expect(result.failClosed).toBe(false);
    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateResult: { id: string }) => gateResult.id)).toEqual(ECOSYSTEM_TRUST_BOOTSTRAP_GATE_IDS);
  });
});
