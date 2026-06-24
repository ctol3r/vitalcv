import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { deriveRecruiterVerdict } from '../lib/recruiter/candidate-verdict';
import { assertPassportData } from '../lib/trust/passport-contract';

// W310-C6 — Recruiter → Candidate → Evidence → Trust → Mobility.
// (1) The pure verdict is honest: 'move forward' requires a decision-grade ready
// candidate; gated/near/unknown degrade. (2) The chain composes through the real
// APIs for one candidate. Pre-existing employer-review/candidates/workspace untouched.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

describe('deriveRecruiterVerdict honesty', () => {
  it('move_forward ONLY for a ready candidate with established/emerging standing', () => {
    expect(deriveRecruiterVerdict('ready', 'established')).toBe('move_forward');
    expect(deriveRecruiterVerdict('ready', 'emerging')).toBe('move_forward');
    // ready but only provisional standing → not a green light
    expect(deriveRecruiterVerdict('ready', 'provisional')).toBe('request_evidence');
  });
  it('degrades honestly for non-ready / thin candidates', () => {
    expect(deriveRecruiterVerdict('near_ready', 'established')).toBe('request_evidence');
    expect(deriveRecruiterVerdict('blocked', 'established')).toBe('not_ready');
    expect(deriveRecruiterVerdict('unknown', 'established')).toBe('insufficient');
    expect(deriveRecruiterVerdict('ready', 'unknown')).toBe('insufficient'); // no decision-grade evidence
  });
});

function buildPassportPayload() {
  return {
    entityId: 'cand-1', npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [{ id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
        verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
        dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
        verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' }],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: { records: [{ id: 'res-1', recordType: 'RESIDENCY', degreeOrTitle: 'IM Residency', institutionName: 'Johns Hopkins', endYear: 2020, completed: true, verificationLevel: 'PRIMARY_SOURCE' }], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: { exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [] },
    readiness: { status: 'PARTIAL', score: 80, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 8, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: { checks: [
      { sourceId: 'NPPES_API', state: 'checked', reason: 'identity checked', checkedAt: '2026-03-01T00:00:00.000Z' },
      { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG clear', checkedAt: '2026-03-01T00:00:00.000Z' },
    ] },
    trustPosture: { band: 'L2', bandLabel: 'Moderate', score: 80, dimensions: [], freshness: { state: 'partial', label: 'Partial', items: [] }, safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [] },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ entityId: id }) });
async function call(path: string) {
  const { GET } = await import(path);
  const res = await GET(new NextRequest('http://localhost/x'), ctx('cand-1'));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('Recruiter candidate chain (W310-C6)', () => {
  it('a fully source-backed candidate composes to a move_forward verdict', async () => {
    const trust = await call('../app/api/graph/[entityId]/trust/route');
    const readiness = await call('../app/api/mobility/[entityId]/readiness/route');
    const timeline = await call('../app/api/timeline/[entityId]/route');
    const organizations = await call('../app/api/organizations/[entityId]/route');

    expect(trust.status).toBe(200);
    expect(readiness.status).toBe(200);

    const standing = timeline.body.reputation.standing;
    const verdict = deriveRecruiterVerdict(readiness.body.readiness, standing);

    // chain composed: same candidate everywhere; decision-grade counts agree
    expect(trust.body.subjectKey).toBe('cand-1');
    expect(trust.body.overall.decisionGradeEvidence).toBe(timeline.body.reputation.decisionGradeEvidence);
    expect(readiness.body.readiness).toBe('ready'); // identity+exclusion+license all checked
    expect(['established', 'emerging']).toContain(standing);
    expect(verdict).toBe('move_forward');
    expect(organizations.body.organizations.some((o: any) => o.kind === 'training_institution')).toBe(true);
  });

  it('per-state placement check returns an honest verdict for an unlicensed state', async () => {
    const { GET } = await import('../app/api/mobility/[entityId]/readiness/route');
    const res = await GET(new NextRequest('http://localhost/x?state=NV'), ctx('cand-1'));
    const body = await res.json();
    expect(res.status).toBe(200);
    // licensed CA, not NV → not 'ready' for NV (near_ready via endorsement, or similar)
    expect(body.readiness).not.toBe('ready');
  });
});
