import { describe, expect, it } from 'vitest';
import {
  checkCredentialStatus,
  CredentialStatus,
  type Credential,
  type RevocationRecord,
} from '@domain/credentials';
import {
  computeCRS as computeDomainCRS,
  computeReadinessSignal,
  CRSReasonCode,
  type CRSInput,
} from '@domain/readiness';
import {
  AuthorityAction,
  AuthorityEventType,
  AuthorityKind,
  resolveAuthoritySnapshot,
  type Authority,
  type AuthorityScope,
  type AuthorityEvent,
} from '@domain/authority';
import type { TrustGradient } from '@domain/qia';

const NOW = new Date('2024-01-15T00:00:00Z');

function buildCredential(issuedAt: Date, expiresAt: Date): Credential {
  return {
    id: 'cred-123',
    type: ['VerifiableCredential'],
    issuer: 'did:web:issuer.vitalcv.com',
    subject: {
      id: 'subject-123',
      type: 'Clinician',
      claims: {
        npi: '1234567890',
      },
    },
    temporal: {
      issued_at: issuedAt,
      expires_at: expiresAt,
    },
  };
}

function buildAuthoritySnapshot(asOf: Date) {
  const authority: Authority = {
    authority_id: 'auth-1',
    kind: AuthorityKind.SYSTEM,
    label: 'VitalCV Authority',
  };
  const scope: AuthorityScope = {
    scope_id: 'scope-1',
    authority_id: authority.authority_id,
    domain: 'credential',
    actions: [AuthorityAction.ASSERT],
    subject: {
      id: 'subject-123',
      type: 'Clinician',
    },
  };
  const grantEvent: AuthorityEvent = {
    event_id: 'evt-1',
    authority_id: authority.authority_id,
    event_type: AuthorityEventType.GRANT,
    occurred_at: new Date(asOf.getTime() - 1000),
    scope,
  };
  return resolveAuthoritySnapshot(authority, [grantEvent], asOf);
}

function buildTrustGradient(score: number): TrustGradient {
  const band = score < 0.4 ? 'LOW' : score < 0.7 ? 'MEDIUM' : 'HIGH';
  return {
    score,
    band,
    components: {
      confidence: score,
      freshness: score,
      dispute_history: score,
      corroboration_density: score,
    },
  };
}

function buildCRSInput(validityResult: CRSInput['credentialValidityResult']): CRSInput {
  return {
    credentialValidityResult: validityResult,
    authorityStateSummary: buildAuthoritySnapshot(NOW),
    qiaValidationResult: { ok: true },
    trustGradient: buildTrustGradient(0.85),
  };
}

describe('Golden Path Safety Checks', () => {
  it('returns greenlight when CRS is GREEN without blockers', () => {
    const credential = buildCredential(
      new Date('2024-01-10T00:00:00Z'),
      new Date('2025-01-10T00:00:00Z'),
    );
    const validity = checkCredentialStatus(credential, null, NOW);
    const crsResult = computeDomainCRS(buildCRSInput(validity), NOW);
    const signal = computeReadinessSignal(crsResult);

    expect(crsResult.grade).toBe('GREEN');
    expect(signal.greenlight).toBe(true);
    expect(signal.blockers).toEqual([]);
  });

  it('blocks readiness when CRS includes a revocation reason', () => {
    const credential = buildCredential(
      new Date('2024-01-10T00:00:00Z'),
      new Date('2025-01-10T00:00:00Z'),
    );
    const revocation: RevocationRecord = {
      credential_id: credential.id,
      revoked_at: new Date('2024-01-12T00:00:00Z'),
      reason: 'COMPROMISED',
      revoked_by: 'did:web:issuer.vitalcv.com',
    };
    const validity = checkCredentialStatus(credential, revocation, NOW);
    const crsResult = computeDomainCRS(buildCRSInput(validity), NOW);
    const signal = computeReadinessSignal(crsResult);

    expect(validity.status).toBe(CredentialStatus.REVOKED);
    expect(signal.greenlight).toBe(false);
    expect(signal.blockers).toContain(CRSReasonCode.CREDENTIAL_REVOKED);
  });

  it('treats revocation as terminal even if credential is expired', () => {
    const credential = buildCredential(
      new Date('2023-01-10T00:00:00Z'),
      new Date('2024-01-01T00:00:00Z'),
    );
    const revocation: RevocationRecord = {
      credential_id: credential.id,
      revoked_at: new Date('2023-12-15T00:00:00Z'),
      reason: 'FRAUD',
      revoked_by: 'did:web:issuer.vitalcv.com',
    };
    const result = checkCredentialStatus(credential, revocation, NOW);

    expect(result.status).toBe(CredentialStatus.REVOKED);
    expect(result.revocation?.reason).toBe('FRAUD');
  });

  it('produces deterministic CRS decisions for identical inputs', () => {
    const credential = buildCredential(
      new Date('2024-01-10T00:00:00Z'),
      new Date('2025-01-10T00:00:00Z'),
    );
    const validity = checkCredentialStatus(credential, null, NOW);
    const input = buildCRSInput(validity);

    const first = computeDomainCRS(input, NOW);
    const second = computeDomainCRS(input, NOW);

    expect(second).toEqual(first);
  });
});
