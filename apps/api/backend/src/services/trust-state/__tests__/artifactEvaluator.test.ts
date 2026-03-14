import { evaluateCredentialArtifact } from '../artifactEvaluator';
import type { ArtifactEvaluationContext } from '../types';

function baseContext(): ArtifactEvaluationContext {
  return {
    requirement: {
      canonicalArtifactKey: 'state_license',
      requirementLabel: 'State License',
      requirementWeight: 3,
      mapped: true,
      source: 'workflow_default',
    },
    binding: {
      id: 'binding-1',
      did: 'did:vitalcv:npi:test',
      npi: '1234567890',
      status: 'ACTIVE',
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      contestReason: null,
    },
    verificationArtifacts: [],
    candidateCredentials: [],
    now: new Date('2026-03-13T00:00:00.000Z'),
  };
}

describe('artifactEvaluator', () => {
  it('returns L1 for self-asserted evidence when no verification artifact exists', () => {
    const result = evaluateCredentialArtifact({
      ...baseContext(),
      candidateCredentials: [
        {
          id: 'cred-1',
          candidateCredentialId: 'doc-1',
          clinicianId: '1234567890',
          status: 'UNVERIFIED',
          data: { type: 'State License', label: 'CA Medical License' },
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
    });

    expect(result.resolvedLevel).toBe('L1');
    expect(result.artifactScore).toBe(40);
  });

  it('caps verified evidence at L2 when issuer trust is unresolved or stale', () => {
    const result = evaluateCredentialArtifact({
      ...baseContext(),
      verificationArtifacts: [
        {
          id: 'artifact-1',
          npi: '1234567890',
          source: 'External Credential Authority',
          status: 'VERIFIED',
          rawPayload: { type: 'license' },
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
          suspendedAt: null,
          revocationReason: null,
          lifecycleState: 'active',
          statusLastChecked: new Date('2026-03-13T00:00:00.000Z'),
          psvWindowStart: null,
          psvWindowDeadline: null,
          psvWindowCompliant: null,
          organizationId: null,
          trustState: 'verified',
          createdAt: new Date('2025-08-01T00:00:00.000Z'),
        },
      ],
    });

    expect(result.resolvedLevel).toBe('L2');
    expect(result.reasons.join(' ')).toContain('issuer trust');
  });

  it('fails closed for unmapped requirements', () => {
    const result = evaluateCredentialArtifact({
      ...baseContext(),
      requirement: {
        canonicalArtifactKey: 'unmapped_requirement:legacy_file',
        requirementLabel: 'Legacy File',
        requirementWeight: 2,
        mapped: false,
        source: 'organization_requirement',
      },
    });

    expect(result.resolvedLevel).toBe('L0');
    expect(result.warnings.join(' ')).toContain('could not be mapped');
  });

  it('fails closed when mapped verification evidence is revoked', () => {
    const result = evaluateCredentialArtifact({
      ...baseContext(),
      verificationArtifacts: [
        {
          id: 'artifact-1',
          npi: '1234567890',
          source: 'NURSYS',
          status: 'REVOKED',
          rawPayload: { type: 'license' },
          verifiedAt: new Date('2026-03-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: new Date('2026-03-12T00:00:00.000Z'),
          suspendedAt: null,
          revocationReason: 'issuer revocation',
          lifecycleState: 'REVOKED',
          statusLastChecked: new Date('2026-03-12T00:00:00.000Z'),
          psvWindowStart: null,
          psvWindowDeadline: null,
          psvWindowCompliant: null,
          organizationId: null,
          trustState: 'expired',
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
        },
      ],
      candidateCredentials: [
        {
          id: 'cred-1',
          candidateCredentialId: 'doc-1',
          clinicianId: '1234567890',
          status: 'UNVERIFIED',
          data: { type: 'State License' },
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ],
    });

    expect(result.resolvedLevel).toBe('L0');
    expect(result.revoked).toBe(true);
    expect(result.artifactScore).toBe(0);
  });
});
