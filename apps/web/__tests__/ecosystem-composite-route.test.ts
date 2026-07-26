import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertPassportData } from '../lib/trust/passport-contract';

// W400-C1 — the composite ecosystem endpoint resolves the passport ONCE and runs
// the whole pipeline a single time, returning every projection. Previously the
// dashboard fired 6 calls (6× passport resolution); this collapses it to 1.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload() {
  return {
    entityId: 'eco-1', npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: { credentials: [{ id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE', verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH', dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA', verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' }], summary: { active: 1, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: { exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z', licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED', enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [] },
    readiness: { status: 'PARTIAL', score: 75, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 10, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: { checks: [ { sourceId: 'NPPES_API', state: 'checked', reason: 'identity checked', checkedAt: '2026-03-01T00:00:00.000Z' }, { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG clear', checkedAt: '2026-03-01T00:00:00.000Z' } ] },
    trustPosture: { band: 'L2', bandLabel: 'Moderate', score: 75, dimensions: [], freshness: { state: 'partial', label: 'Partial', items: [] }, safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [] },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ entityId: id }) });
async function call() {
  const { GET } = await import('../app/api/ecosystem/[entityId]/route');
  const res = await GET(new NextRequest('http://localhost/x'), ctx('eco-1'));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('composite ecosystem endpoint (W400-C1)', () => {
  it('returns every projection in one response, resolving the passport exactly once', async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.schema).toBe('vitalcv.ecosystem.v1');
    expect(body.subjectKey).toBe('eco-1');
    for (const key of ['evidence', 'trust', 'timeline', 'mobility', 'readiness', 'organizations', 'intelligence']) {
      expect(body[key]).toBeDefined();
    }
    // the optimization: ONE passport resolution for the whole dashboard
    expect(resolveMock).toHaveBeenCalledTimes(1);
    // projections agree (composed from one pipeline run)
    expect(body.trust.overall.decisionGradeEvidence).toBe(body.timeline.reputation.decisionGradeEvidence);
    expect(body.mobility.licensedStates).toContain('CA');
  });

  it('returns a 500 envelope on runtime failure', async () => {
    resolveMock.mockRejectedValueOnce(new Error('boom'));
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe('ecosystem_unavailable');
  });
});
