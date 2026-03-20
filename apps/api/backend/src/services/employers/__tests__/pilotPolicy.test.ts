import {
  DEFAULT_AUTOMATION_RULES,
  buildOrganizationRequirementsEnvelope,
  evaluatePilotReadiness,
  parseOrganizationRequirementsEnvelope,
} from '../pilotPolicy';

describe('pilotPolicy', () => {
  it('parses legacy requirement arrays without enabling pilot mode', () => {
    const parsed = parseOrganizationRequirementsEnvelope([
      { label: 'CA Medical License', level: 'L3' },
    ]);

    expect(parsed.requirements).toEqual([{ label: 'CA Medical License', level: 'L3' }]);
    expect(parsed.pilotMode).toBe(false);
    expect(parsed.organizationAcceptanceRules.acceptL3CredentialsAutomatically).toBe(false);
    expect(parsed.trustAcceptanceContracts.triggerDecisionCapsuleOnHire).toBe(false);
  });

  it('round-trips the policy envelope with requirements', () => {
    const envelope = buildOrganizationRequirementsEnvelope({
      requirements: [{ label: 'Board Certification', level: 'L2' }],
      pilotMode: true,
      organizationAcceptanceRules: {
        acceptL3CredentialsAutomatically: true,
        requirePsvOnlyForGaps: true,
      },
      trustAcceptanceContracts: {
        triggerDecisionCapsuleOnHire: true,
      },
      automationRules: DEFAULT_AUTOMATION_RULES,
    });

    const parsed = parseOrganizationRequirementsEnvelope(envelope);
    expect(parsed).toEqual(envelope);
  });

  it('auto-accepts L3 trust states when the pilot rule is enabled', () => {
    const evaluation = evaluatePilotReadiness(
      {
        readiness_level: 'L3',
        readiness_score: 92,
        gap_summary: [],
      },
      {
        pilotMode: true,
        organizationAcceptanceRules: {
          acceptL3CredentialsAutomatically: true,
          requirePsvOnlyForGaps: false,
        },
        trustAcceptanceContracts: {
          triggerDecisionCapsuleOnHire: true,
        },
      },
    );

    expect(evaluation.ready).toBe(true);
    expect(evaluation.autoAccept).toBe(true);
    expect(evaluation.psvRequired).toBe(false);
    expect(evaluation.triggerDecisionCapsuleOnHire).toBe(true);
  });

  it('requires PSV only when trust gaps remain', () => {
    const evaluation = evaluatePilotReadiness(
      {
        readiness_level: 'L2',
        readiness_score: 71,
        gap_summary: ['DEA registration not verified'],
      },
      {
        pilotMode: true,
        organizationAcceptanceRules: {
          acceptL3CredentialsAutomatically: false,
          requirePsvOnlyForGaps: true,
        },
        trustAcceptanceContracts: {
          triggerDecisionCapsuleOnHire: false,
        },
      },
    );

    expect(evaluation.ready).toBe(false);
    expect(evaluation.autoAccept).toBe(false);
    expect(evaluation.psvRequired).toBe(true);
    expect(evaluation.reason).toContain('PSV');
  });
});
