import { matchRecognitionRequirements } from '../requirementMatchingService';

describe('requirementMatchingService', () => {
  it('matches resolved L3 evidence deterministically', () => {
    const result = matchRecognitionRequirements({
      recognition: {
        resolved: [
          {
            canonicalArtifactKey: 'state_license',
            status: 'VERIFIED',
            resolvedLevel: 'L3',
            freshness: 'current',
            evidenceId: 'license-ca-1',
            state: 'CA',
          },
        ],
      },
      orgRequirements: [
        {
          label: 'CA Medical License',
          level: 'L3',
          state: 'CA',
        },
      ],
    });

    expect(result.requirementResults).toHaveLength(1);
    expect(result.requirementResults[0]).toMatchObject({
      canonicalArtifactKey: 'state_license',
      met: true,
      matchCode: 'MATCHED',
      matchedEvidenceIds: ['license-ca-1'],
    });
    expect(result.blockers).toEqual([]);
    expect(result.missingActions).toEqual([]);
  });

  it('fails closed when no resolved fact exists for a required requirement', () => {
    const result = matchRecognitionRequirements({
      recognition: { resolved: [] },
      orgRequirements: [
        {
          label: 'DEA Registration',
          level: 'L2',
        },
      ],
    });

    expect(result.requirementResults[0]).toMatchObject({
      canonicalArtifactKey: 'dea_registration',
      met: false,
      matchCode: 'NO_MATCHING_RECOGNITION_FACT',
    });
    expect(result.blockers).toEqual([
      {
        canonicalArtifactKey: 'dea_registration',
        requirementLabel: 'DEA Registration',
        matchCode: 'NO_MATCHING_RECOGNITION_FACT',
        detail: 'Recognition does not include a resolved fact for "DEA Registration".',
      },
    ]);
    expect(result.missingActions[0]).toMatchObject({
      canonicalArtifactKey: 'dea_registration',
      blocking: true,
      title: 'Resolve DEA registration',
    });
  });

  it('fails closed for unmapped requirements', () => {
    const result = matchRecognitionRequirements({
      recognition: { resolved: [] },
      orgRequirements: [
        {
          label: 'Legacy File',
          level: 'L1',
        },
      ],
    });

    expect(result.requirementResults[0]).toMatchObject({
      canonicalArtifactKey: 'unmapped_requirement:legacy_file',
      mapped: false,
      met: false,
      matchCode: 'UNMAPPED_REQUIREMENT',
    });
    expect(result.blockers[0]?.matchCode).toBe('UNMAPPED_REQUIREMENT');
    expect(result.missingActions[0]?.detail).toContain('Map "Legacy File"');
  });

  it('does not satisfy a state-scoped requirement with the wrong resolved state', () => {
    const result = matchRecognitionRequirements({
      recognition: {
        resolved: [
          {
            canonicalArtifactKey: 'state_license',
            status: 'VERIFIED',
            resolvedLevel: 'L3',
            freshness: 'current',
            evidenceId: 'license-nv-1',
            state: 'NV',
          },
        ],
      },
      orgRequirements: [
        {
          label: 'CA Medical License',
          level: 'L3',
          state: 'CA',
        },
      ],
    });

    expect(result.requirementResults[0]).toMatchObject({
      canonicalArtifactKey: 'state_license',
      met: false,
      matchCode: 'CONSTRAINT_MISMATCH',
      matchedEvidenceIds: [],
    });
    expect(result.missingActions[0]?.detail).toContain('CA');
  });

  it('treats revoked evidence as a blocker even when a lower-quality fact also exists', () => {
    const input = {
      recognition: {
        resolved: [
          {
            canonicalArtifactKey: 'sanctions_clear',
            status: 'CLEAR',
            resolvedLevel: 'L1' as const,
            freshness: 'current' as const,
            evidenceId: 'self-asserted-1',
          },
          {
            canonicalArtifactKey: 'sanctions_clear',
            status: 'REVOKED',
            resolvedLevel: 'L0' as const,
            freshness: 'current' as const,
            revoked: true,
            evidenceId: 'revoked-1',
            reason: 'issuer revocation',
          },
        ],
      },
      orgRequirements: [
        {
          label: 'Sanctions Clear',
          level: 'L3' as const,
        },
      ],
    };

    const first = matchRecognitionRequirements(input);
    const second = matchRecognitionRequirements(input);

    expect(first).toEqual(second);
    expect(first.requirementResults[0]).toMatchObject({
      met: false,
      matchCode: 'REVOKED_RESOLUTION',
      matchedEvidenceIds: ['revoked-1', 'self-asserted-1'],
    });
    expect(first.blockers[0]?.detail).toContain('revoked');
  });
});
