import {
  evaluatePmfVerificationGate,
  verifyInstitutionalPmf,
  type PmfVerificationSignal,
} from '../pmfVerification';

const verificationId = 'pmf-ci';
const institutionId = 'institution-ci';
const verifierId = 'verifier-ci';

function signal(overrides: Partial<PmfVerificationSignal>): PmfVerificationSignal {
  return {
    id: overrides.id ?? 'signal-ci',
    recordedAt: overrides.recordedAt ?? '2026-05-10T19:00:00.000Z',
    institutionId,
    verifierId,
    signalType: overrides.signalType ?? 'deployment_readiness',
    institutionalReadiness: overrides.institutionalReadiness ?? 0.86,
    replayFriction: overrides.replayFriction ?? 0.18,
    adoptionSurvivability: overrides.adoptionSurvivability ?? 0.84,
    deploymentReadiness: overrides.deploymentReadiness ?? 0.86,
    pmfEvidenceStrength: overrides.pmfEvidenceStrength ?? 0.86,
    evidenceRefs: overrides.evidenceRefs ?? ['ci-evidence-a', 'ci-evidence-b'],
    ambiguity: overrides.ambiguity ?? null,
  };
}

describe('CI gate — institutional PMF verification', () => {
  it('requires evidence-derived PMF claims, measurable replay friction, preserved ambiguity, reconstructable lineage, and longitudinal readiness', () => {
    const verification = verifyInstitutionalPmf({
      verificationId,
      institutionId,
      verifierId,
      verifiedAt: '2026-05-10T22:00:00.000Z',
      signals: [
        signal({
          id: 'ci-readiness',
          recordedAt: '2026-05-10T19:00:00.000Z',
          signalType: 'deployment_readiness',
          replayFriction: 0.24,
        }),
        signal({
          id: 'ci-replay',
          recordedAt: '2026-05-10T19:15:00.000Z',
          signalType: 'replay_friction',
          replayFriction: 0.18,
          ambiguity: 'first deployment still needs replay coaching',
        }),
        signal({
          id: 'ci-adoption',
          recordedAt: '2026-05-10T19:30:00.000Z',
          signalType: 'adoption_survivability',
          replayFriction: 0.14,
          adoptionSurvivability: 0.86,
        }),
        signal({
          id: 'ci-pmf',
          recordedAt: '2026-05-10T19:45:00.000Z',
          signalType: 'pmf_evidence',
          replayFriction: 0.12,
          pmfEvidenceStrength: 0.9,
        }),
      ],
    });

    const gate = evaluatePmfVerificationGate({ verification });

    expect(gate.pass).toBe(true);
    expect(gate.failedGateIds).toEqual([]);
    expect(gate.gates.map((gateVerdict) => gateVerdict.id)).toEqual([
      'pmf_claims_evidence_derived',
      'replay_friction_measurable',
      'ambiguity_preserved_in_scoring',
      'fail_closed_pmf_semantics',
      'adoption_readiness_longitudinally_visible',
      'pmf_lineage_reconstructable',
      'pmf_confidence_evidence_derived',
    ]);
  });
});
