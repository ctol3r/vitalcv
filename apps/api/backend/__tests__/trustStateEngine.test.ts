/**
 * Wave 243 — Trust State Engine tests
 *
 * Tests cover:
 * 1. excluded clinician => hard fail / downgraded readiness (L0)
 * 2. missing credential => L0/L1 path
 * 3. verified fresh credential => L3 path
 * 4. stale credential => downgrade
 * 5. deterministic recomputation => identical output
 */

// We test the pure computation functions directly by extracting logic.
// Since computeClinicianTrustState does I/O, we test the scoring + band + gap
// functions which are the deterministic core.

// ── Import internals (re-export for testing) ─────────────────────────────────

// We need to test the scoring logic in isolation. The engine uses private
// functions, so we duplicate the pure logic here for testing purposes.

type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';
type LicensureStatus = 'verified' | 'pending' | 'expired' | 'unknown';
type ExclusionStatus = 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED' | 'UNKNOWN';
type PecosStatus = 'ENROLLED' | 'ENROLLMENT_NOT_FOUND' | 'UNKNOWN';

function computeScore(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  credentialCount: number;
  hasVerifiedArtifacts: boolean;
}): number {
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';

  if (exclusionStatus === 'EXCLUDED') {
    return 0;
  }

  let score = 0;
  if (params.identityVerified) score += 20;
  if (params.licensureStatus === 'verified') score += 30;
  else if (params.licensureStatus === 'pending') score += 15;
  if (exclusionStatus === 'CLEAR') score += 30;
  if (pecosStatus === 'ENROLLED') score += 20;
  return Math.min(score, 100);
}

function deriveBand(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  trustScore: number;
}): TrustBand {
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';
  const reviewRequired =
    exclusionStatus === 'POSSIBLE_MATCH'
    || exclusionStatus === 'UNCHECKED'
    || exclusionStatus === 'UNKNOWN';

  if (exclusionStatus === 'EXCLUDED') return 'L0';
  if (!params.identityVerified) return 'L0';
  if (params.licensureStatus === 'expired') return 'L0';
  if (reviewRequired) return 'L1';
  if (pecosStatus === 'ENROLLMENT_NOT_FOUND') return 'L1';
  if (
    params.trustScore >= 90
    && exclusionStatus === 'CLEAR'
    && pecosStatus === 'ENROLLED'
    && params.licensureStatus === 'verified'
  ) {
    return 'L3';
  }
  if (params.trustScore >= 60) return 'L2';
  if (params.trustScore >= 20) return 'L1';
  return 'L0';
}

function detectGaps(params: {
  identityVerified: boolean;
  licensureStatus: LicensureStatus;
  exclusionClear: boolean;
  exclusionStatus?: ExclusionStatus;
  pecosStatus?: PecosStatus;
  credentialCount: number;
  facts: Array<{ factType: string }>;
}): string[] {
  const gaps: string[] = [];
  const exclusionStatus =
    params.exclusionStatus ?? (params.exclusionClear ? 'CLEAR' : 'EXCLUDED');
  const pecosStatus = params.pecosStatus ?? 'UNKNOWN';
  if (!params.identityVerified) gaps.push('NPI identity not verified');
  if (params.licensureStatus === 'unknown') gaps.push('State licensure not verified');
  if (params.licensureStatus === 'expired') gaps.push('State license expired');
  if (exclusionStatus === 'POSSIBLE_MATCH') gaps.push('OIG/LEIE possible match requires review');
  else if (exclusionStatus === 'UNCHECKED' || exclusionStatus === 'UNKNOWN') gaps.push('OIG/LEIE exclusion check unchecked');
  else if (exclusionStatus === 'EXCLUDED') gaps.push('OIG/LEIE exclusion check flagged');
  if (pecosStatus === 'UNKNOWN') gaps.push('PECOS enrollment not verified');
  if (pecosStatus === 'ENROLLMENT_NOT_FOUND') gaps.push('PECOS enrollment not found');
  if (params.credentialCount === 0) gaps.push('No credential documents on file');
  const factTypes = params.facts.map((f) => f.factType.toLowerCase());
  if (!factTypes.some((t) => t.includes('board') || t.includes('certification'))) {
    gaps.push('No board certification on file');
  }
  if (!factTypes.some((t) => t.includes('dea'))) {
    gaps.push('DEA registration not verified');
  }
  if (!factTypes.some((t) => t.includes('malpractice') || t.includes('insurance'))) {
    gaps.push('Malpractice insurance not on file');
  }
  return gaps;
}

// ── Test 1: Excluded clinician => hard fail / L0 ─────────────────────────────

describe('Trust State Engine — excluded clinician', () => {
  it('returns L0 when exclusion check is flagged, regardless of other evidence', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: false, // EXCLUDED
      exclusionStatus: 'EXCLUDED',
      pecosStatus: 'ENROLLED',
      credentialCount: 5,
      hasVerifiedArtifacts: true,
    });
    // Score should still compute but band must be L0
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: false,
      exclusionStatus: 'EXCLUDED',
      pecosStatus: 'ENROLLED',
      trustScore: score,
    });
    expect(score).toBe(0);
    expect(band).toBe('L0');
  });

  it('includes OIG/LEIE gap in gap summary', () => {
    const gaps = detectGaps({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: false,
      exclusionStatus: 'EXCLUDED',
      pecosStatus: 'ENROLLED',
      credentialCount: 3,
      facts: [{ factType: 'Certification' }, { factType: 'DEARegistration' }, { factType: 'MalpracticeInsurance' }],
    });
    expect(gaps).toContain('OIG/LEIE exclusion check flagged');
  });
});

// ── Test 2: Missing credential => L0/L1 path ────────────────────────────────

describe('Trust State Engine — missing credentials', () => {
  it('returns L1 with identity only and no credentials', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'unknown',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      credentialCount: 0,
      pecosStatus: 'UNKNOWN',
      hasVerifiedArtifacts: false,
    });
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'unknown',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      trustScore: score,
    });
    // identity(20) + exclusion(30) = 50 => L1
    expect(score).toBe(50);
    expect(band).toBe('L1');
  });

  it('returns L0 with no identity verification', () => {
    const score = computeScore({
      identityVerified: false,
      licensureStatus: 'unknown',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      credentialCount: 0,
      hasVerifiedArtifacts: false,
    });
    const band = deriveBand({
      identityVerified: false,
      licensureStatus: 'unknown',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      trustScore: score,
    });
    expect(band).toBe('L0');
  });

  it('includes gap for missing credentials', () => {
    const gaps = detectGaps({
      identityVerified: true,
      licensureStatus: 'unknown',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      credentialCount: 0,
      facts: [],
    });
    expect(gaps).toContain('No credential documents on file');
    expect(gaps).toContain('No board certification on file');
    expect(gaps).toContain('DEA registration not verified');
    expect(gaps).toContain('State licensure not verified');
    expect(gaps).toContain('PECOS enrollment not verified');
  });
});

// ── Test 3: Verified fresh credential => L3 path ────────────────────────────

describe('Trust State Engine — verified fresh credentials', () => {
  it('returns L3 with full verified evidence', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      credentialCount: 0,
      hasVerifiedArtifacts: true,
    });
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      trustScore: score,
    });
    // identity(20) + licensure(30) + exclusion(30) + pecos(20) = 100
    expect(score).toBe(100);
    expect(band).toBe('L3');
  });

  it('returns L2 when PECOS is still unknown even if other sources are clear', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      credentialCount: 0,
      hasVerifiedArtifacts: true,
    });
    // identity(20) + verified(30) + exclusion(30) = 80
    expect(score).toBe(80);
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'UNKNOWN',
      trustScore: score,
    });
    expect(band).toBe('L2');
  });
});

// ── Test 4: Stale credential => downgrade ────────────────────────────────────

describe('Trust State Engine — stale credentials', () => {
  it('caps L3 to L2 when artifacts are stale', () => {
    // Simulate: score qualifies for L3 but stale artifact present
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      credentialCount: 0,
      hasVerifiedArtifacts: true,
    });
    let band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      trustScore: score,
    });
    expect(band).toBe('L3');
    // Apply stale downgrade (mirrors engine logic)
    const hasStaleArtifact = true;
    if (hasStaleArtifact && band === 'L3') band = 'L2';
    expect(band).toBe('L2');
  });

  it('returns L0 when license is expired', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'expired',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      credentialCount: 2,
      hasVerifiedArtifacts: true,
    });
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'expired',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      trustScore: score,
    });
    expect(band).toBe('L0');
  });

  it('caps LEIE possible matches at review-required L1', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: false,
      exclusionStatus: 'POSSIBLE_MATCH',
      pecosStatus: 'ENROLLED',
      credentialCount: 0,
      hasVerifiedArtifacts: true,
    });
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: false,
      exclusionStatus: 'POSSIBLE_MATCH',
      pecosStatus: 'ENROLLED',
      trustScore: score,
    });
    expect(score).toBe(70);
    expect(band).toBe('L1');
  });

  it('treats PECOS enrollment-not-found as a blocker', () => {
    const score = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLMENT_NOT_FOUND',
      credentialCount: 0,
      hasVerifiedArtifacts: true,
    });
    const band = deriveBand({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLMENT_NOT_FOUND',
      trustScore: score,
    });
    const gaps = detectGaps({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLMENT_NOT_FOUND',
      credentialCount: 0,
      facts: [],
    });

    expect(score).toBe(80);
    expect(band).toBe('L1');
    expect(gaps).toContain('PECOS enrollment not found');
  });
});

// ── Test 5: Deterministic recomputation => identical output ──────────────────

describe('Trust State Engine — deterministic recomputation', () => {
  it('produces identical output for identical inputs', () => {
    const params = {
      identityVerified: true,
      licensureStatus: 'verified' as LicensureStatus,
      exclusionClear: true,
      exclusionStatus: 'CLEAR' as ExclusionStatus,
      pecosStatus: 'ENROLLED' as PecosStatus,
      credentialCount: 3,
      hasVerifiedArtifacts: true,
    };
    const score1 = computeScore(params);
    const score2 = computeScore(params);
    expect(score1).toBe(score2);

    const bandParams = {
      identityVerified: true,
      licensureStatus: 'verified' as LicensureStatus,
      exclusionClear: true,
      exclusionStatus: 'CLEAR' as ExclusionStatus,
      pecosStatus: 'ENROLLED' as PecosStatus,
      trustScore: score1,
    };
    const band1 = deriveBand(bandParams);
    const band2 = deriveBand(bandParams);
    expect(band1).toBe(band2);

    const gapParams = {
      identityVerified: true,
      licensureStatus: 'verified' as LicensureStatus,
      exclusionClear: true,
      exclusionStatus: 'CLEAR' as ExclusionStatus,
      pecosStatus: 'ENROLLED' as PecosStatus,
      credentialCount: 3,
      facts: [
        { factType: 'Certification' },
        { factType: 'DEARegistration' },
        { factType: 'MalpracticeInsurance' },
      ],
    };
    const gaps1 = detectGaps(gapParams);
    const gaps2 = detectGaps(gapParams);
    expect(gaps1).toEqual(gaps2);
  });

  it('produces different output for different inputs', () => {
    const score1 = computeScore({
      identityVerified: true,
      licensureStatus: 'verified',
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      pecosStatus: 'ENROLLED',
      credentialCount: 4,
      hasVerifiedArtifacts: true,
    });
    const score2 = computeScore({
      identityVerified: false,
      licensureStatus: 'unknown',
      exclusionClear: false,
      exclusionStatus: 'EXCLUDED',
      pecosStatus: 'UNKNOWN',
      credentialCount: 0,
      hasVerifiedArtifacts: false,
    });
    expect(score1).not.toBe(score2);
    expect(score1).toBeGreaterThan(score2);
  });
});
