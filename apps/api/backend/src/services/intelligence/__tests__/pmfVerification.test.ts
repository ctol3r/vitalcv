import {
  buildPmfVerificationLineage,
  evaluatePmfVerificationGate,
  runPmfVerificationChaosSimulations,
  verifyInstitutionalPmf,
  type PmfVerificationSignal,
} from '../pmfVerification';

const VERIFICATION_ID = 'pmf-verification-1';
const INSTITUTION_ID = 'institution-1';
const VERIFIER_ID = 'verifier-1';
const VERIFIED_AT = '2026-05-10T22:00:00.000Z';

function signal(overrides: Partial<PmfVerificationSignal> = {}): PmfVerificationSignal {
  return {
    id: 'signal-1',
    recordedAt: '2026-05-10T19:00:00.000Z',
    institutionId: INSTITUTION_ID,
    verifierId: VERIFIER_ID,
    signalType: 'deployment_readiness',
    institutionalReadiness: 0.86,
    replayFriction: 0.2,
    adoptionSurvivability: 0.82,
    deploymentReadiness: 0.84,
    pmfEvidenceStrength: 0.86,
    evidenceRefs: ['deployment-readiness-review', 'operator-attestation'],
    ambiguity: null,
    ...overrides,
  };
}

function baselineSignals(): PmfVerificationSignal[] {
  return [
    signal({
      id: 'adoption',
      recordedAt: '2026-05-10T19:30:00.000Z',
      signalType: 'adoption_survivability',
      institutionalReadiness: 0.88,
      replayFriction: 0.14,
      adoptionSurvivability: 0.86,
      deploymentReadiness: 0.85,
      pmfEvidenceStrength: 0.84,
      evidenceRefs: ['adoption-prediction-report', 'activation-retention-window'],
    }),
    signal({
      id: 'readiness',
      recordedAt: '2026-05-10T19:00:00.000Z',
      signalType: 'deployment_readiness',
      institutionalReadiness: 0.84,
      replayFriction: 0.24,
      adoptionSurvivability: 0.8,
      deploymentReadiness: 0.82,
      pmfEvidenceStrength: 0.82,
      evidenceRefs: ['deployment-runbook-review', 'pilot-readiness-scorecard'],
    }),
    signal({
      id: 'replay',
      recordedAt: '2026-05-10T19:15:00.000Z',
      signalType: 'replay_friction',
      institutionalReadiness: 0.86,
      replayFriction: 0.18,
      adoptionSurvivability: 0.82,
      deploymentReadiness: 0.84,
      pmfEvidenceStrength: 0.83,
      evidenceRefs: ['replay-friction-report', 'operator-training-completion'],
      ambiguity: 'replay terminology still needs facilitator support during first deployment',
    }),
    signal({
      id: 'pmf',
      recordedAt: '2026-05-10T19:45:00.000Z',
      signalType: 'pmf_evidence',
      institutionalReadiness: 0.9,
      replayFriction: 0.12,
      adoptionSurvivability: 0.88,
      deploymentReadiness: 0.88,
      pmfEvidenceStrength: 0.9,
      evidenceRefs: ['repeat-verifier-intent', 'buyer-workflow-fit-review'],
    }),
  ];
}

describe('PMF verification lineage', () => {
  it('reconstructs PMF evidence lineage deterministically from unordered signals', () => {
    const lineage = buildPmfVerificationLineage({
      verificationId: VERIFICATION_ID,
      signals: baselineSignals(),
    });
    const repeat = buildPmfVerificationLineage({
      verificationId: VERIFICATION_ID,
      signals: [...baselineSignals()].reverse(),
    });

    expect(lineage.timeline.map((entry) => entry.signalId)).toEqual([
      'readiness',
      'replay',
      'adoption',
      'pmf',
    ]);
    expect(lineage.firstRecordedAt).toBe('2026-05-10T19:00:00.000Z');
    expect(lineage.lastRecordedAt).toBe('2026-05-10T19:45:00.000Z');
    expect(lineage.lineageHash).toMatch(/^[a-f0-9]{64}$/);
    expect(lineage.lineageHash).toBe(repeat.lineageHash);
  });
});

describe('institutional PMF verification', () => {
  it('verifies PMF readiness only from longitudinal deployment, replay, adoption, and buyer-fit evidence', () => {
    const verification = verifyInstitutionalPmf({
      verificationId: VERIFICATION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      verifiedAt: VERIFIED_AT,
      signals: baselineSignals(),
    });

    expect(verification.status).toBe('PMF_VERIFIED');
    expect(verification.failClosed).toBe(false);
    expect(verification.verdict).toBe('PMF_READY');
    expect(verification.pmfScore).toBeGreaterThanOrEqual(80);
    expect(verification.institutionalReadiness.score).toBeGreaterThanOrEqual(80);
    expect(verification.replayFriction.measurable).toBe(true);
    expect(verification.replayFriction.trend).toBe('IMPROVING');
    expect(verification.adoptionSurvivability.score).toBeGreaterThanOrEqual(80);
    expect(verification.evidenceSynthesis.evidenceDerived).toBe(true);
    expect(verification.ambiguities).toContain('replay terminology still needs facilitator support during first deployment');
    expect(verification.confidence.basis).toEqual(expect.arrayContaining([
      'pmf_lineage_reconstructable',
      'replay_friction_measurable',
      'deployment_readiness_evidenced',
      'adoption_survivability_evidenced',
      'pmf_evidence_synthesized',
    ]));
    expect(verification.verificationHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed when PMF claims are not evidence-derived and replay friction is not measurable', () => {
    const verification = verifyInstitutionalPmf({
      verificationId: VERIFICATION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      verifiedAt: VERIFIED_AT,
      signals: [
        signal({
          id: 'unsupported-pmf',
          replayFriction: 0.5,
          pmfEvidenceStrength: 0.95,
          evidenceRefs: [],
          ambiguity: 'buyer enthusiasm asserted without deployment evidence',
        }),
      ],
    });

    expect(verification.status).toBe('PMF_BLOCKED');
    expect(verification.failClosed).toBe(true);
    expect(verification.verdict).toBe('PMF_BLOCKED');
    expect(verification.blockers).toContain('PMF lineage is not reconstructable.');
    expect(verification.blockers).toContain('Replay friction is not longitudinally measurable.');
    expect(verification.blockers).toContain('PMF evidence synthesis is not evidence-derived.');
    expect(verification.ambiguities).toContain('buyer enthusiasm asserted without deployment evidence');
  });

  it('keeps deployment readiness partial when adoption survivability is weak', () => {
    const verification = verifyInstitutionalPmf({
      verificationId: VERIFICATION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      verifiedAt: VERIFIED_AT,
      signals: baselineSignals().map((entry) => ({
        ...entry,
        adoptionSurvivability: 0.48,
        ambiguity: entry.id === 'adoption'
          ? 'activation is present but repeat usage has not survived a full cycle'
          : entry.ambiguity,
      })),
    });

    expect(verification.status).toBe('PMF_VERIFIED');
    expect(verification.verdict).toBe('PMF_PARTIAL');
    expect(verification.adoptionSurvivability.score).toBeLessThan(60);
    expect(verification.ambiguities).toContain('activation is present but repeat usage has not survived a full cycle');
  });
});

describe('PMF verification chaos simulations', () => {
  it('surfaces replay friction, readiness collapse, adoption survivability loss, evidence gaps, and ambiguity suppression', () => {
    const chaos = runPmfVerificationChaosSimulations({
      verificationId: VERIFICATION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      verifiedAt: VERIFIED_AT,
      baselineSignals: baselineSignals(),
    });

    expect(chaos.summary.totalScenarios).toBeGreaterThanOrEqual(5);
    expect(chaos.summary.silentCount).toBe(0);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'REPLAY_FRICTION_REGRESSION')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'READINESS_COLLAPSE')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'ADOPTION_SURVIVABILITY_LOSS')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'EVIDENCE_GAP')?.signalSurfaced).toBe(true);
    expect(chaos.verdicts.find((verdict) => verdict.scenario === 'AMBIGUITY_SUPPRESSION')?.signalSurfaced).toBe(true);
  });
});

describe('PMF verification gate failure mode', () => {
  it('rejects unsupported PMF-ready claims instead of allowing optimism through CI', () => {
    const verification = verifyInstitutionalPmf({
      verificationId: VERIFICATION_ID,
      institutionId: INSTITUTION_ID,
      verifierId: VERIFIER_ID,
      verifiedAt: VERIFIED_AT,
      signals: [
        signal({
          id: 'unsupported-ready',
          institutionalReadiness: 0.95,
          deploymentReadiness: 0.95,
          adoptionSurvivability: 0.95,
          pmfEvidenceStrength: 0.95,
          evidenceRefs: [],
          ambiguity: null,
        }),
      ],
    });

    const gate = evaluatePmfVerificationGate({ verification });

    expect(gate.pass).toBe(false);
    expect(gate.failedGateIds).toEqual(expect.arrayContaining([
      'pmf_claims_evidence_derived',
      'replay_friction_measurable',
      'fail_closed_pmf_semantics',
      'pmf_lineage_reconstructable',
    ]));
  });
});
