import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertPassportData } from '../lib/trust/passport-contract';

// W520-C6 — Career → Education → Evidence → Trust → Organizations → Opportunities.
// A clinician with training + licensure resolves into milestones, a career stage,
// and growth gaps — through the real route + pipeline.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload() {
  return {
    entityId: 'grow-1', npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: { credentials: [{ id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE', verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH', dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA', verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' }], summary: { active: 1, expired: 0, stale: 0, missing: [] } },
    training: { records: [{ id: 'res-1', recordType: 'RESIDENCY', degreeOrTitle: 'IM Residency', institutionName: 'Johns Hopkins', endYear: 2018, completed: true, verificationLevel: 'SELF_REPORTED' }], hasDegree: true, degreeVerified: false, hasResidency: true, fellowshipCount: 0 },
    standing: { exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z', licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED', enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [] },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 10, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: { checks: [ { sourceId: 'NPPES_API', state: 'checked', reason: 'identity checked', checkedAt: '2026-03-01T00:00:00.000Z' }, { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG clear', checkedAt: '2026-03-01T00:00:00.000Z' } ] },
    trustPosture: { band: 'L2', bandLabel: 'Moderate', score: 70, dimensions: [], freshness: { state: 'partial', label: 'Partial', items: [] }, safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [] },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ entityId: id }) });
async function call() {
  const { GET } = await import('../app/api/professional-growth/[entityId]/route');
  const res = await GET(new NextRequest('http://localhost/x'), ctx('grow-1'));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('professional-growth route (W520-C6)', () => {
  it('derives milestones, progression, and growth gaps from the record', async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.schema).toBe('vitalcv.professional-growth.v1');
    expect(body.subjectKey).toBe('grow-1');

    // milestones from training + licensure (+ identity/exclusion)
    expect(body.milestones.some((m: any) => m.type === 'training')).toBe(true);
    expect(body.milestones.some((m: any) => m.type === 'licensure' && m.decisionGrade === true)).toBe(true);
    // self-reported residency is reached-but-unverified (honest)
    expect(body.milestones.some((m: any) => m.type === 'training' && m.decisionGrade === false)).toBe(true);

    // progression: decision-grade licensure reaches 'licensed'; self-reported residency does NOT advance the arc
    expect(body.progression.stagesReached).toContain('licensed');
    expect(body.progression.stagesReached).not.toContain('training');
    expect(body.growthGaps.some((g: any) => g.toReachStage === 'board_certified')).toBe(true);
    expect(body.growthGaps.some((g: any) => g.toReachStage === 'training')).toBe(true); // verify your training

    // mentorship model present but empty (external data source)
    expect(body.mentorship).toEqual([]);
  });

  it('returns a 500 envelope on runtime failure', async () => {
    resolveMock.mockRejectedValueOnce(new Error('boom'));
    const { status, body } = await call();
    expect(status).toBe(500);
    expect(body.error).toBe('professional_growth_unavailable');
  });
});
