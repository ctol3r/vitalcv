import { describe, expect, it } from 'vitest';
import {
  bucketLanesFromCredentials,
  readinessLevelToProofTier,
  resolveEmployerApplicationContext,
} from '@/lib/apply/resolve-employer-application-context';

describe('readinessLevelToProofTier', () => {
  it('maps L0 → draft_snapshot', () => {
    expect(readinessLevelToProofTier('L0')).toBe('draft_snapshot');
  });
  it('maps L1, L2 → partial_proof_pack', () => {
    expect(readinessLevelToProofTier('L1')).toBe('partial_proof_pack');
    expect(readinessLevelToProofTier('L2')).toBe('partial_proof_pack');
  });
  it('maps L3 → decision_grade_proof_pack', () => {
    expect(readinessLevelToProofTier('L3')).toBe('decision_grade_proof_pack');
  });
  it('collapses unknown readiness values to draft_snapshot (conservative)', () => {
    expect(readinessLevelToProofTier('L7')).toBe('draft_snapshot');
    expect(readinessLevelToProofTier('')).toBe('draft_snapshot');
  });
});

describe('bucketLanesFromCredentials', () => {
  it('sorts Source-backed and Active into included', () => {
    const bucket = bucketLanesFromCredentials([
      { type: 'NPI_IDENTITY', issuer: 'NPPES', status: 'VERIFIED', verifiedAt: null, expiresAt: null },
      { type: 'STATE_LICENSE', issuer: 'CA', status: 'ACTIVE', verifiedAt: null, expiresAt: null },
    ]);
    expect(bucket.included.map((l) => l.label).sort()).toEqual(
      ['NPI Identity', 'State License'].sort(),
    );
    expect(bucket.omitted).toHaveLength(0);
    expect(bucket.blockerKeys).toHaveLength(0);
  });

  it('sorts Pending / Access required / Stale / Unavailable into omitted with a qualifier', () => {
    const bucket = bucketLanesFromCredentials([
      { type: 'DEA_LICENSE', issuer: 'DEA', status: 'PENDING', verifiedAt: null, expiresAt: null },
      { type: 'BOARD_CERT', issuer: 'ABMS', status: 'GATED', verifiedAt: null, expiresAt: null },
      { type: 'STATE_LICENSE', issuer: 'CA', status: 'STALE', verifiedAt: null, expiresAt: null },
    ]);
    expect(bucket.included).toHaveLength(0);
    expect(bucket.omitted.map((l) => l.qualifier).sort()).toEqual(
      ['Access required', 'Pending', 'Stale'].sort(),
    );
    expect(bucket.blockerKeys).toContain('State board access required');
    expect(bucket.blockerKeys).toContain('Source reported stale data');
  });

  it('never leaves an unrecognized status in included (conservative)', () => {
    const bucket = bucketLanesFromCredentials([
      { type: 'DEA_LICENSE', issuer: 'DEA', status: 'MYSTERY_STATE', verifiedAt: null, expiresAt: null },
    ]);
    expect(bucket.included).toHaveLength(0);
    expect(bucket.omitted).toHaveLength(1);
  });
});

describe('resolveEmployerApplicationContext', () => {
  const now = new Date();
  const futureIso = new Date(now.getTime() + 3_600_000).toISOString();
  const pastIso = new Date(now.getTime() - 3_600_000).toISOString();

  function mockFetch(bundle: Record<string, unknown> | null, status = 200): typeof fetch {
    return (async () =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => bundle,
      }) as unknown as Response) as unknown as typeof fetch;
  }

  it('returns expired when bundle is past expiresAt', async () => {
    const result = await resolveEmployerApplicationContext({
      applicationId: 'bundle_x',
      backendUrl: 'http://api.test',
      fetchImpl: mockFetch({
        bundleId: 'bundle_x',
        npi: '1234567890',
        clinicianName: 'Macie Miller',
        trustState: { readiness_level: 'L3', readiness_score: 90, readiness_status: 'ready', computed_at: pastIso },
        credentials: [],
        generatedAt: pastIso,
        expiresAt: pastIso,
        signature: 'sig',
      }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('returns not_found on 404', async () => {
    const result = await resolveEmployerApplicationContext({
      applicationId: 'missing',
      backendUrl: 'http://api.test',
      fetchImpl: mockFetch(null, 404),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not_found');
  });

  it('returns error on network failure', async () => {
    const result = await resolveEmployerApplicationContext({
      applicationId: 'x',
      backendUrl: 'http://api.test',
      fetchImpl: (async () => {
        throw new Error('network');
      }) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('error');
  });

  it('preserves proof tier + limitations for partial bundles (no silent upgrade)', async () => {
    const result = await resolveEmployerApplicationContext({
      applicationId: 'bundle_p',
      backendUrl: 'http://api.test',
      fetchImpl: mockFetch({
        bundleId: 'bundle_p',
        entityId: 'entity_p',
        npi: '9876543210',
        clinicianName: 'Partial Clinician',
        trustState: { readiness_level: 'L1', readiness_score: 55, readiness_status: 'partial', computed_at: futureIso },
        credentials: [
          { type: 'NPI_IDENTITY', issuer: 'NPPES', status: 'VERIFIED', verifiedAt: null, expiresAt: null },
          { type: 'STATE_LICENSE', issuer: 'CA', status: 'GATED', verifiedAt: null, expiresAt: null },
        ],
        generatedAt: futureIso,
        expiresAt: futureIso,
        signature: 'sig',
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.summary.proofTier.tier).toBe('partial_proof_pack');
      expect(result.context.summary.proofTier.acceptAllowed).toBe(false);
      expect(result.context.summary.limitationNote).toMatch(/Partial proof pack/);
      expect(result.context.summary.omittedLanes.map((l) => l.label)).toContain('State License');
      expect(result.context.canonicalReviewHref).toContain('/review/entity_p');
      // Preserve applicationId as-received.
      expect(result.context.applicationId).toBe('bundle_p');
    }
  });

  it('returns canonicalReviewHref=null when the bundle lacks entityId', async () => {
    const result = await resolveEmployerApplicationContext({
      applicationId: 'bundle_ne',
      backendUrl: 'http://api.test',
      fetchImpl: mockFetch({
        bundleId: 'bundle_ne',
        npi: '1111111111',
        clinicianName: 'Legacy Bundle',
        trustState: { readiness_level: 'L3', readiness_score: 90, readiness_status: 'ready', computed_at: futureIso },
        credentials: [
          { type: 'NPI_IDENTITY', issuer: 'NPPES', status: 'VERIFIED', verifiedAt: null, expiresAt: null },
        ],
        generatedAt: futureIso,
        expiresAt: futureIso,
        signature: 'sig',
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.canonicalReviewHref).toBeNull();
  });
});
