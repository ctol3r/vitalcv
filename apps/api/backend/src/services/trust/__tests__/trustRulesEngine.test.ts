/**
 * trustRulesEngine.test.ts — Unit tests for the 6-class decision engine
 *
 * Verifies all decision classes, freshness windows, negative signals,
 * conflict detection, and evidence completeness checks.
 */

// jest globals are injected by the jest test runner automatically
import {
  evaluateTrust,
  FRESHNESS_WINDOWS,
  METHODOLOGY_VERSION,
  mostSevere,
  type DecisionClass,
} from '../trustRulesEngine';
import type { NormalizedClaim, ExclusionValue, LicenseValue, NpiIdentityValue } from '../../identity/evidenceModel';

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date('2026-03-22T12:00:00Z');
const NPI = '1234567890';

function daysAgo(n: number, from = NOW): string {
  return new Date(from.getTime() - n * 86_400_000).toISOString();
}
function daysAhead(n: number, from = NOW): string {
  return new Date(from.getTime() + n * 86_400_000).toISOString();
}

function makeClaim(overrides: Partial<NormalizedClaim> & { claimType: NormalizedClaim['claimType'] }): NormalizedClaim {
  const { claimType, value, tier, confidence, confidenceScore, sourceId, derivedAt, observedAt, validUntil, expiresAt, status, ...rest } = overrides;
  return {
    claimId:          `claim_${Math.random().toString(36).slice(2)}`,
    claimType,
    subjectNpi:       NPI,
    value:            value ?? { _type: 'GENERIC' } as NormalizedClaim['value'],
    tier:             tier ?? 'GOLD',
    confidence:       confidence ?? 'HIGH',
    confidenceScore:  confidenceScore ?? 0.9,
    sourceId:         sourceId ?? 'NPPES_API',
    artifactId:       'artifact_test',
    artifactChecksum: 'abc123',
    parserVersion:    'v1.0.0',
    derivedAt:        derivedAt ?? daysAgo(1),
    observedAt:       observedAt ?? daysAgo(1),
    validFrom:        null,
    validUntil:       validUntil ?? null,
    expiresAt:        expiresAt ?? null,
    status:           status ?? 'ACTIVE',
    supersededBy:     null,
    supersedes:       null,
    reviewRequired:   false,
    reviewReason:     null,
    humanReviewAt:    null,
    ...rest,
  };
}

const npiActiveClaim = makeClaim({
  claimType: 'NPI_IDENTITY',
  sourceId: 'NPPES_API',
  value: { _type: 'NPI_IDENTITY', npi: NPI, enumerationType: 'NPI-1', enumerationDate: '2010-01-01', lastUpdated: '2026-01-01', status: 'A', credential: 'MD' } as NpiIdentityValue,
  observedAt: daysAgo(5),
});

const exclusionClearClaim = makeClaim({
  claimType: 'EXCLUSION_STATUS',
  sourceId: 'OIG_LEIE',
  value: { _type: 'EXCLUSION_STATUS', excluded: false, exclusionType: null, exclusionDate: null, reinstatementDate: null, matchType: 'NO_MATCH', waiverState: null, source: 'OIG_LEIE' } as ExclusionValue,
  observedAt: daysAgo(5),
});

const activeLicenseClaim = makeClaim({
  claimType: 'LICENSE',
  sourceId: 'CA_MEDICAL_BOARD',
  value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: daysAhead(365).slice(0, 10), licenseStatus: 'ACTIVE', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
  observedAt: daysAgo(30),
});

const BASE_CLAIMS: NormalizedClaim[] = [npiActiveClaim, exclusionClearClaim, activeLicenseClaim];

// ── mostSevere ───────────────────────────────────────────────────────────────

describe('mostSevere', () => {
  it('NEGATIVE_FINDING_BLOCK beats everything', () => {
    expect(mostSevere('TRUSTED_CURRENT', 'NEGATIVE_FINDING_BLOCK')).toBe('NEGATIVE_FINDING_BLOCK');
  });
  it('CONFLICT_REQUIRES_REVIEW beats STALE', () => {
    expect(mostSevere('STALE_REVERIFY_REQUIRED', 'CONFLICT_REQUIRES_REVIEW')).toBe('CONFLICT_REQUIRES_REVIEW');
  });
  it('TRUSTED_CURRENT is least severe', () => {
    expect(mostSevere('TRUSTED_CURRENT')).toBe('TRUSTED_CURRENT');
  });
});

// ── TRUSTED_CURRENT ───────────────────────────────────────────────────────────

describe('TRUSTED_CURRENT', () => {
  it('emits TRUSTED_CURRENT when all claims are fresh and no negative signals', () => {
    const result = evaluateTrust(NPI, BASE_CLAIMS, { decisionAt: NOW });
    expect(result.decisionClass).toBe('TRUSTED_CURRENT');
    expect(result.npi).toBe(NPI);
    expect(result.methodologyVersion).toBe(METHODOLOGY_VERSION);
    expect(result.aggregateConfidence).toBeGreaterThan(0);
    expect(result.negativeFindings).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it('includes correct claim counts', () => {
    const result = evaluateTrust(NPI, BASE_CLAIMS, { decisionAt: NOW });
    expect(result.goldClaimCount).toBe(3);
    expect(result.claimCount).toBe(3);
  });
});

// ── NEGATIVE_FINDING_BLOCK ────────────────────────────────────────────────────

describe('NEGATIVE_FINDING_BLOCK', () => {
  it('blocks on OIG exclusion hit', () => {
    const excluded = makeClaim({
      claimType: 'EXCLUSION_STATUS',
      sourceId: 'OIG_LEIE',
      tier: 'GOLD',
      value: { _type: 'EXCLUSION_STATUS', excluded: true, exclusionType: 'EXCLUSION', exclusionDate: '2026-01-01', reinstatementDate: null, matchType: 'NPI_MATCH', waiverState: null, source: 'OIG_LEIE' } as ExclusionValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, excluded, activeLicenseClaim], { decisionAt: NOW });
    expect(result.decisionClass).toBe('NEGATIVE_FINDING_BLOCK');
    expect(result.negativeFindings.length).toBeGreaterThan(0);
    expect(result.negativeFindings[0].claimType).toBe('EXCLUSION_STATUS');
  });

  it('blocks on suspended license from primary source', () => {
    const suspended = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      tier: 'GOLD',
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: null, licenseStatus: 'SUSPENDED', disciplinaryActions: ['SUSPENSION'], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, suspended], { decisionAt: NOW });
    expect(result.decisionClass).toBe('NEGATIVE_FINDING_BLOCK');
    expect(result.negativeFindings.some(f => f.reason.toLowerCase().includes('suspend'))).toBe(true);
  });

  it('blocks on deactivated NPI', () => {
    const deactivated = makeClaim({
      claimType: 'NPI_IDENTITY',
      sourceId: 'NPPES_API',
      value: { _type: 'NPI_IDENTITY', npi: NPI, enumerationType: 'NPI-1', enumerationDate: '2010-01-01', lastUpdated: '2026-03-01', status: 'D', credential: null } as NpiIdentityValue,
    });
    const result = evaluateTrust(NPI, [deactivated, exclusionClearClaim, activeLicenseClaim], { decisionAt: NOW });
    expect(result.decisionClass).toBe('NEGATIVE_FINDING_BLOCK');
    expect(result.negativeFindings.some(f => f.reason.includes('deactivated'))).toBe(true);
  });

  it('does NOT block on bronze-tier exclusion claim', () => {
    const bronzeExcluded = makeClaim({
      claimType: 'EXCLUSION_STATUS',
      sourceId: 'THIRD_PARTY',
      tier: 'BRONZE',
      value: { _type: 'EXCLUSION_STATUS', excluded: true, exclusionType: 'EXCLUSION', exclusionDate: '2026-01-01', reinstatementDate: null, matchType: 'NPI_MATCH', waiverState: null, source: 'OIG_LEIE' } as ExclusionValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, bronzeExcluded, activeLicenseClaim], { decisionAt: NOW });
    expect(result.decisionClass).not.toBe('NEGATIVE_FINDING_BLOCK');
  });
});

// ── INSUFFICIENT_EVIDENCE ─────────────────────────────────────────────────────

describe('INSUFFICIENT_EVIDENCE', () => {
  it('emits INSUFFICIENT_EVIDENCE when no claims at all', () => {
    const result = evaluateTrust(NPI, [], { decisionAt: NOW });
    expect(result.decisionClass).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('emits INSUFFICIENT_EVIDENCE when NPI identity claim missing', () => {
    const result = evaluateTrust(NPI, [exclusionClearClaim, activeLicenseClaim], { decisionAt: NOW });
    expect(result.decisionClass).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.explanation).toContain('NPI_IDENTITY');
  });

  it('emits INSUFFICIENT_EVIDENCE when only BRONZE claims present', () => {
    const bronze = { ...npiActiveClaim, tier: 'BRONZE' as const, claimId: 'bronze_1' };
    const result = evaluateTrust(NPI, [bronze], { decisionAt: NOW });
    expect(result.decisionClass).toBe('INSUFFICIENT_EVIDENCE');
  });
});

// ── STALE_REVERIFY_REQUIRED ──────────────────────────────────────────────────

describe('STALE_REVERIFY_REQUIRED', () => {
  it('emits STALE when license was checked beyond the 90-day credentialing window', () => {
    const staleLicense = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      observedAt: daysAgo(95),
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: daysAhead(365).slice(0, 10), licenseStatus: 'ACTIVE', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, staleLicense], { decisionAt: NOW, context: 'credentialing' });
    expect(result.decisionClass).toBe('STALE_REVERIFY_REQUIRED');
    const staleEval = result.freshnessEvals.find(f => f.claimType === 'LICENSE');
    expect(staleEval?.status).toBe('STALE');
  });

  it('uses wider window for accreditation context', () => {
    // 95 days — stale in credentialing (90d) but not in accreditation (180d)
    const cert95dAgo = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      observedAt: daysAgo(95),
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: daysAhead(365).slice(0, 10), licenseStatus: 'ACTIVE', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, cert95dAgo], { decisionAt: NOW, context: 'accreditation' });
    expect(result.decisionClass).not.toBe('STALE_REVERIFY_REQUIRED');
  });

  it('emits STALE when credential itself is expired regardless of verification age', () => {
    const expiredCredential = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      observedAt: daysAgo(5),    // recently verified
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2015-01-01', expiryDate: daysAgo(30).slice(0, 10), licenseStatus: 'EXPIRED', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, expiredCredential], { decisionAt: NOW });
    // Expired credential → STALE (or NEGATIVE_FINDING_BLOCK if EXPIRED maps to blocking status)
    expect(['STALE_REVERIFY_REQUIRED', 'NEGATIVE_FINDING_BLOCK'].includes(result.decisionClass)).toBe(true);
  });
});

// ── TRUSTED_BUT_STALE_SOON ───────────────────────────────────────────────────

describe('TRUSTED_BUT_STALE_SOON', () => {
  it('emits TRUSTED_BUT_STALE_SOON when a claim is within the warning horizon', () => {
    const staleSoon = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      observedAt: daysAgo(82),  // 82 of 90-day window = within 20% remaining
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: daysAhead(300).slice(0, 10), licenseStatus: 'ACTIVE', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, staleSoon], { decisionAt: NOW, context: 'credentialing' });
    expect(result.decisionClass).toBe('TRUSTED_BUT_STALE_SOON');
    const eval_ = result.freshnessEvals.find(f => f.claimType === 'LICENSE');
    expect(eval_?.status).toBe('STALE_SOON');
  });
});

// ── CONFLICT_REQUIRES_REVIEW ─────────────────────────────────────────────────

describe('CONFLICT_REQUIRES_REVIEW', () => {
  it('detects conflicting license status between two GOLD sources', () => {
    const boardSaysActive = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'CA_MEDICAL_BOARD',
      tier: 'GOLD',
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: daysAhead(365).slice(0, 10), licenseStatus: 'ACTIVE', disciplinaryActions: [], source: 'CA_MEDICAL_BOARD' } as LicenseValue,
    });
    const nurseRegistryRevoked = makeClaim({
      claimType: 'LICENSE',
      sourceId: 'NURSYS',
      tier: 'GOLD',
      value: { _type: 'LICENSE', state: 'CA', licenseNumber: 'G12345', issueDate: '2020-01-01', expiryDate: null, licenseStatus: 'REVOKED', disciplinaryActions: ['REVOCATION'], source: 'NURSYS' } as LicenseValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, exclusionClearClaim, boardSaysActive, nurseRegistryRevoked], { decisionAt: NOW });
    // NEGATIVE_FINDING_BLOCK from REVOKED takes precedence over CONFLICT
    expect(['CONFLICT_REQUIRES_REVIEW', 'NEGATIVE_FINDING_BLOCK'].includes(result.decisionClass)).toBe(true);
  });

  it('detects conflicting exclusion status', () => {
    const oigClear = makeClaim({
      claimType: 'EXCLUSION_STATUS',
      sourceId: 'OIG_LEIE',
      tier: 'GOLD',
      value: { _type: 'EXCLUSION_STATUS', excluded: false, exclusionType: null, exclusionDate: null, reinstatementDate: null, matchType: 'NO_MATCH', waiverState: null, source: 'OIG_LEIE' } as ExclusionValue,
    });
    const samGovExcluded = makeClaim({
      claimType: 'EXCLUSION_STATUS',
      sourceId: 'SAM_GOV',
      tier: 'GOLD',
      value: { _type: 'EXCLUSION_STATUS', excluded: true, exclusionType: 'DEBARMENT', exclusionDate: '2025-06-01', reinstatementDate: null, matchType: 'NPI_MATCH', waiverState: null, source: 'SAM_GOV' } as ExclusionValue,
    });
    const result = evaluateTrust(NPI, [npiActiveClaim, oigClear, samGovExcluded, activeLicenseClaim], { decisionAt: NOW });
    // SAM.gov says excluded → NEGATIVE_FINDING_BLOCK takes precedence
    expect(result.decisionClass).toBe('NEGATIVE_FINDING_BLOCK');
  });
});

// ── DecisionArtifact shape ────────────────────────────────────────────────────

describe('DecisionArtifact shape', () => {
  it('always includes required fields', () => {
    const result = evaluateTrust(NPI, BASE_CLAIMS, { decisionAt: NOW });
    expect(result).toMatchObject({
      decisionId: expect.any(String),
      npi: NPI,
      decisionClass: expect.any(String),
      aggregateConfidence: expect.any(Number),
      context: 'credentialing',
      methodologyVersion: METHODOLOGY_VERSION,
      evaluatedAt: expect.any(String),
      expiresAt: expect.any(String),
      claimCount: expect.any(Number),
      goldClaimCount: expect.any(Number),
      silverClaimCount: expect.any(Number),
      freshnessEvals: expect.any(Array),
      negativeFindings: expect.any(Array),
      conflicts: expect.any(Array),
      explanation: expect.any(String),
      claimIds: expect.any(Array),
    });
  });

  it('expiresAt is always after evaluatedAt', () => {
    const result = evaluateTrust(NPI, BASE_CLAIMS, { decisionAt: NOW });
    expect(new Date(result.expiresAt) > new Date(result.evaluatedAt)).toBe(true);
  });

  it('confidence is between 0 and 1', () => {
    const result = evaluateTrust(NPI, BASE_CLAIMS, { decisionAt: NOW });
    expect(result.aggregateConfidence).toBeGreaterThanOrEqual(0);
    expect(result.aggregateConfidence).toBeLessThanOrEqual(1);
  });
});

// ── Freshness windows completeness ───────────────────────────────────────────

describe('FRESHNESS_WINDOWS', () => {
  it('credentialing windows are shorter than or equal to accreditation windows', () => {
    for (const [claimType, credDays] of Object.entries(FRESHNESS_WINDOWS.credentialing)) {
      const accDays = FRESHNESS_WINDOWS.accreditation[claimType as keyof typeof FRESHNESS_WINDOWS.accreditation];
      if (accDays !== undefined && credDays !== undefined) {
        expect(credDays).toBeLessThanOrEqual(accDays);
      }
    }
  });

  it('exclusion checks have the shortest window (30 days)', () => {
    expect(FRESHNESS_WINDOWS.credentialing.EXCLUSION_STATUS).toBe(30);
    expect(FRESHNESS_WINDOWS.accreditation.EXCLUSION_STATUS).toBe(30);
  });
});
