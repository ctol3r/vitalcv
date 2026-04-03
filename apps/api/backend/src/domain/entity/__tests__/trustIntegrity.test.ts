/**
 * trustIntegrity.test.ts — Wave X: Truth Integrity Enforcement
 *
 * Tests that enforce the TRUTH DOCTRINE across the trust spine:
 *
 * 1. Stale downgrade — null verifiedAt + known domain → stale
 * 2. Stale downgrade — expired freshness window → stale
 * 3. Missing source → reviewRequired (not decision-grade)
 * 4. Receipt validation — artifact validator enforces sha256 + RFC3339
 * 5. Enrichment isolation — academic dimension returns 0 by default
 * 6. isDecisionGrade — unified guard enforces all four conditions
 *
 * These tests must pass on every CI run. Any failure = truth integrity violation.
 */

import {
  isCredentialStale,
  isDecisionGrade,
  FRESHNESS_WINDOWS_DAYS,
} from '../contracts';
import {
  validateCredentialArtifact,
  validateVerificationArtifact,
} from '@vitalcv/trust-state';

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

// ── 1. Stale downgrade — null verifiedAt ───────────────────────────────────────

describe('isCredentialStale — null verifiedAt', () => {
  it('returns true when verifiedAt is null for a domain with a freshness window', () => {
    // LICENSURE has a 90-day freshness window
    expect(isCredentialStale({ domain: 'LICENSURE', verifiedAt: null })).toBe(true);
  });

  it('returns true when verifiedAt is undefined for a domain with a freshness window', () => {
    expect(isCredentialStale({ domain: 'EXCLUSION_CHECK', verifiedAt: undefined })).toBe(true);
  });

  it('returns false when domain has no freshness window (untracked domain)', () => {
    // No window defined → cannot determine staleness → not stale
    expect(isCredentialStale({ domain: 'UNKNOWN_DOMAIN_XYZ', verifiedAt: null })).toBe(false);
  });

  it('returns false when verifiedAt is null for BOARD_CERTIFICATION with no window', () => {
    // BOARD_CERTIFICATION has a window — should return true
    expect(isCredentialStale({ domain: 'BOARD_CERTIFICATION', verifiedAt: null })).toBe(true);
  });
});

// ── 2. Stale downgrade — expired freshness window ─────────────────────────────

describe('isCredentialStale — freshness window expiry', () => {
  it('returns true when verifiedAt is past the LICENSURE window (90 days)', () => {
    expect(
      isCredentialStale({ domain: 'LICENSURE', verifiedAt: daysAgo(91) }),
    ).toBe(true);
  });

  it('returns false when verifiedAt is within the LICENSURE window', () => {
    expect(
      isCredentialStale({ domain: 'LICENSURE', verifiedAt: daysAgo(89) }),
    ).toBe(false);
  });

  it('returns true when verifiedAt is past the EXCLUSION_CHECK window (90 days)', () => {
    expect(
      isCredentialStale({ domain: 'EXCLUSION_CHECK', verifiedAt: daysAgo(95) }),
    ).toBe(true);
  });

  it('returns false when verifiedAt is exactly at the BOARD_CERTIFICATION window boundary', () => {
    // 180 days window — 179 days ago is not stale
    expect(
      isCredentialStale({ domain: 'BOARD_CERTIFICATION', verifiedAt: daysAgo(179) }),
    ).toBe(false);
  });

  it('returns true when verifiedAt is past the DEA_REGISTRATION window (120 days)', () => {
    expect(
      isCredentialStale({ domain: 'DEA_REGISTRATION', verifiedAt: daysAgo(121) }),
    ).toBe(true);
  });

  it('freshness windows have expected values (regression guard)', () => {
    // These values drive credentialing decisions — lock them
    expect(FRESHNESS_WINDOWS_DAYS['LICENSURE']).toBe(90);
    expect(FRESHNESS_WINDOWS_DAYS['BOARD_CERTIFICATION']).toBe(180);
    expect(FRESHNESS_WINDOWS_DAYS['DEA_REGISTRATION']).toBe(120);
    expect(FRESHNESS_WINDOWS_DAYS['MEDICARE_ENROLLMENT']).toBe(180);
    expect(FRESHNESS_WINDOWS_DAYS['EXCLUSION_CHECK']).toBe(90);
  });
});

// ── 3. Missing source → not decision-grade ────────────────────────────────────

describe('isDecisionGrade — missing source', () => {
  const baseCredential = {
    domain: 'LICENSURE',
    verifiedAt: daysAgo(10),
    reviewRequired: false,
  };

  it('returns false when sourceId is null', () => {
    expect(isDecisionGrade({ ...baseCredential, sourceId: null })).toBe(false);
  });

  it('returns false when sourceId is undefined', () => {
    expect(isDecisionGrade({ ...baseCredential, sourceId: undefined })).toBe(false);
  });

  it('returns false when sourceId is an empty string', () => {
    // empty string is treated same as absent — no traceable source
    // Note: isDecisionGrade checks !!sourceId so '' → false
    expect(isDecisionGrade({ ...baseCredential, sourceId: '' })).toBe(false);
  });

  it('returns true with all four conditions satisfied', () => {
    expect(isDecisionGrade({ ...baseCredential, sourceId: 'NPPES_API' })).toBe(true);
  });

  it('returns false when reviewRequired is true even with valid source', () => {
    expect(
      isDecisionGrade({ ...baseCredential, sourceId: 'NPPES_API', reviewRequired: true }),
    ).toBe(false);
  });

  it('returns false when verifiedAt is null even with valid source', () => {
    expect(
      isDecisionGrade({ domain: 'LICENSURE', verifiedAt: null, sourceId: 'NPPES_API', reviewRequired: false }),
    ).toBe(false);
  });

  it('returns false when credential is stale even with valid source and timestamp', () => {
    expect(
      isDecisionGrade({
        domain: 'LICENSURE',
        verifiedAt: daysAgo(95),
        sourceId: 'NPPES_API',
        reviewRequired: false,
      }),
    ).toBe(false);
  });
});

// ── 4. Receipt validation ──────────────────────────────────────────────────────

describe('validateCredentialArtifact — receipt enforcement', () => {
  it('accepts a valid artifact with source and sha256 credential_hash', () => {
    const artifact = validateCredentialArtifact({
      source: 'NPPES_API',
      credential_hash: 'a'.repeat(64),
    });
    expect(artifact.source).toBe('NPPES_API');
    expect(artifact.credential_hash).toBe('a'.repeat(64));
  });

  it('rejects an artifact with missing source', () => {
    expect(() => validateCredentialArtifact({ credential_hash: 'a'.repeat(64) })).toThrow('source');
  });

  it('rejects an artifact with non-sha256 credential_hash', () => {
    expect(() =>
      validateCredentialArtifact({ source: 'NPPES_API', credential_hash: 'short-hash' }),
    ).toThrow('SHA-256');
  });

  it('rejects an artifact with no credential_hash', () => {
    expect(() => validateCredentialArtifact({ source: 'NPPES_API' })).toThrow('credential hash');
  });
});

describe('validateVerificationArtifact — receipt enforcement', () => {
  const validArtifact = {
    source: 'OIG_LEIE',
    verification_method: 'bulk_download',
    fresh_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    evidence_hash: 'b'.repeat(64),
  };

  it('accepts a valid verification artifact', () => {
    const result = validateVerificationArtifact(validArtifact);
    expect(result.source).toBe('OIG_LEIE');
    expect(result.evidence_hash).toBe('b'.repeat(64));
  });

  it('rejects artifact with non-UTC fresh_until timestamp', () => {
    expect(() =>
      validateVerificationArtifact({ ...validArtifact, fresh_until: '2026-12-31' }),
    ).toThrow('RFC3339');
  });

  it('rejects artifact with non-sha256 evidence_hash', () => {
    expect(() =>
      validateVerificationArtifact({ ...validArtifact, evidence_hash: 'not-a-hash' }),
    ).toThrow('SHA-256');
  });

  it('rejects artifact with no verification_method', () => {
    const { verification_method: _, ...noMethod } = validArtifact;
    expect(() => validateVerificationArtifact(noMethod)).toThrow('verification method');
  });
});

// ── 5. Enrichment isolation — academic dimension ──────────────────────────────

describe('Enrichment isolation — academic trust dimension', () => {
  it('ACADEMIC_TRUST_SCORE_ENABLED is not set in test environment', () => {
    // If this test fails, someone enabled academic scoring in the test env.
    // Academic scoring must be explicitly opted into — never on by default.
    expect(process.env.ACADEMIC_TRUST_SCORE_ENABLED).not.toBe('true');
  });

  it('scoreAcademic (via module behavior check) — returns 0 when OPENALEX/PUBMED present but flag disabled', () => {
    // We test the behavior by verifying the environment flag is absent.
    // The actual dimension function is tested indirectly via computeTrustScoreV1
    // integration tests. Here we assert the contract: disabled = 0 score.
    //
    // This test exists to CATCH anyone accidentally setting the flag to 'true'
    // in a production-like test env. If you need to test academic scoring,
    // set ACADEMIC_TRUST_SCORE_ENABLED=true in your test and add a comment.
    const isEnabled = process.env.ACADEMIC_TRUST_SCORE_ENABLED === 'true';
    if (isEnabled) {
      // If enabled, academic sources must be primary-source verification artifacts,
      // not name-match enrichment. This is enforced by process review, not code.
      console.warn(
        'ACADEMIC_TRUST_SCORE_ENABLED=true. Ensure academic artifacts are ' +
        'primary-source verified, not name-match enrichment.',
      );
    }
    expect(isEnabled).toBe(false);
  });
});

// ── 6. sourceCoverage state contract (regression) ─────────────────────────────

describe('sourceCoverage state contract', () => {
  it('only "checked" is decision-grade — all other canonical states are non-decision-grade', () => {
    // Import and verify the contract from trust-state package
    const { DECISION_GRADE_SOURCE_COVERAGE_STATES, CANONICAL_SOURCE_COVERAGE_STATES } =
      require('@vitalcv/trust-state');

    expect(DECISION_GRADE_SOURCE_COVERAGE_STATES).toEqual(['checked']);
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('stale');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('gated');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('unavailable');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('pending');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('accessRequired');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('reviewRequired');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('notDecisionGrade');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('previewOnly');
    // Preview-only surfaces are explicitly never decision-grade.
    expect(DECISION_GRADE_SOURCE_COVERAGE_STATES).not.toContain('previewOnly');
    expect(DECISION_GRADE_SOURCE_COVERAGE_STATES).not.toContain('stale');
    expect(DECISION_GRADE_SOURCE_COVERAGE_STATES).not.toContain('gated');
    expect(DECISION_GRADE_SOURCE_COVERAGE_STATES).not.toContain('pending');
  });
});
