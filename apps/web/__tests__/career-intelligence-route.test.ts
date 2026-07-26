import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertPassportData } from '../lib/trust/passport-contract';

// W320-C4 — Evidence → Trust → Timeline → Mobility → Intelligence, through the API.
// Proves the intelligence route composes the full pipeline into deterministic,
// explainable insights/notifications/actions for one clinician.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload() {
  return {
    entityId: 'intel-1', npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        { id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE', verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH', dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA', verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' },
        { id: 'dea', domain: 'DEA', type: 'DEA_REGISTRATION', status: 'EXPIRED', verificationLevel: 'PRIMARY_SOURCE', stale: true, confidenceLabel: 'MEDIUM', claimConfidenceLabel: 'MEDIUM', dataFreshness: 'stale', dataFreshnessLabel: 'Stale', reviewRequired: false, expiresAt: '2026-01-01T00:00:00.000Z' },
      ],
      summary: { active: 1, expired: 1, stale: 1, missing: [] },
    },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: { exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z', licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED', enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [] },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 12, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: { checks: [
      { sourceId: 'NPPES_API', state: 'checked', reason: 'identity checked', checkedAt: '2026-03-01T00:00:00.000Z' },
      { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG clear', checkedAt: '2026-03-01T00:00:00.000Z' },
      { sourceId: 'STATE_BOARD', state: 'gated', reason: 'institutional access required', checkedAt: null },
    ] },
    trustPosture: { band: 'L2', bandLabel: 'Moderate', score: 70, dimensions: [], freshness: { state: 'partial', label: 'Partial', items: [] }, safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [] },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ entityId: id }) });
async function call() {
  const { GET } = await import('../app/api/career-intelligence/[entityId]/route');
  const res = await GET(new NextRequest('http://localhost/x'), ctx('intel-1'));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('career-intelligence route (W320-C4)', () => {
  it('returns 200 + schema with insights/notifications/actions', async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.schema).toBe('vitalcv.career-intelligence.v1');
    expect(body.subjectKey).toBe('intel-1');
    expect(Array.isArray(body.insights)).toBe(true);
    expect(Array.isArray(body.notifications)).toBe(true);
    expect(Array.isArray(body.actions)).toBe(true);
  });

  it('surfaces the expired DEA as a risk + high-priority action (explainable, decision-grade honest)', async () => {
    const { body } = await call();
    expect(body.insights.some((i: any) => i.kind === 'risk')).toBe(true);
    expect(body.actions[0].priority).toBe('high'); // resolve decay first
    // gated STATE_BOARD is owed, never a strength
    expect(body.insights.some((i: any) => i.kind === 'gap')).toBe(true);
    expect(body.insights.every((i: any) => i.basis.length > 0 || i.dimension !== null)).toBe(true); // explainable
  });

  it('is deterministic across calls', async () => {
    const a = await call();
    const b = await call();
    expect(a.body).toEqual(b.body);
  });

  it('returns 500 envelope on runtime failure', async () => {
    resolveMock.mockRejectedValueOnce(new Error('boom'));
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe('career_intelligence_unavailable');
  });
});
