import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { aggregateOrganization, type ProviderSnapshot } from '../lib/organization/aggregate';
import { assertPassportData } from '../lib/trust/passport-contract';

// W510-C6 — Organization → Provider → Evidence → Trust → Hiring. A roster of
// distinct providers aggregates into honest org metrics + a hiring pipeline that
// agrees with the per-candidate recruiter verdict.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function base(entityId: string, overrides: Record<string, unknown>) {
  return {
    entityId, npi: '1234567890',
    identity: { displayName: `Provider ${entityId}`, specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: { credentials: [], summary: { active: 0, expired: 0, stale: 0, missing: [] } },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: { exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z', licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED', enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly', enrollmentNote: 'Current.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [] },
    readiness: { status: 'PARTIAL', score: 60, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 12, nextActions: [] },
    sources: { checked: [], lastFetch: {} },
    sourceCoverage: { checks: [] },
    trustPosture: { band: 'L2', bandLabel: 'Moderate', score: 60, dimensions: [], freshness: { state: 'partial', label: 'Partial', items: [] }, safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [] },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
    ...overrides,
  };
}

const checkedCred = { id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE', verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH', dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA', verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' };
const checkedSources = [ { sourceId: 'NPPES_API', state: 'checked', reason: 'id', checkedAt: '2026-03-01T00:00:00.000Z' }, { sourceId: 'OIG_LEIE', state: 'checked', reason: 'clear', checkedAt: '2026-03-01T00:00:00.000Z' } ];

const PASSPORTS: Record<string, Record<string, unknown>> = {
  'prov-strong': { authority: { credentials: [checkedCred], summary: { active: 1, expired: 0, stale: 0, missing: [] } }, sourceCoverage: { checks: checkedSources } },
  'prov-partial': { sourceCoverage: { checks: [...checkedSources, { sourceId: 'STATE_BOARD', state: 'gated', reason: 'access required', checkedAt: null }] } },
  'prov-thin': { sourceCoverage: { checks: [{ sourceId: 'STATE_BOARD', state: 'gated', reason: 'access required', checkedAt: null }] } },
};

async function callOrg(providers: string) {
  const { GET } = await import('../app/api/organization-os/route');
  const res = await GET(new NextRequest(`http://localhost/api/organization-os?org=acme&providers=${providers}`));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockImplementation((id: string) => Promise.resolve(assertPassportData(base(id, PASSPORTS[id] ?? {}))));
});

describe('aggregateOrganization (unit, deterministic)', () => {
  it('rolls up readiness, hiring pipeline, standing, and state coverage', () => {
    const snaps: ProviderSnapshot[] = [
      { subjectKey: 'a', displayName: 'A', standing: 'established', readiness: 'ready', hiringVerdict: 'move_forward', decisionGradeEvidence: 4, totalEvidence: 4, licensedStates: ['CA', 'NV'], topAction: null },
      { subjectKey: 'b', displayName: 'B', standing: 'emerging', readiness: 'near_ready', hiringVerdict: 'request_evidence', decisionGradeEvidence: 2, totalEvidence: 4, licensedStates: ['CA'], topAction: 'x' },
    ];
    const org = aggregateOrganization('acme', snaps);
    expect(org.metrics.providerCount).toBe(2);
    expect(org.metrics.hiringPipeline.move_forward).toBe(1);
    expect(org.metrics.decisionGradeCoverage.ratio).toBe(0.75); // 6/8
    expect(org.metrics.stateCoverage[0]).toEqual({ state: 'CA', providers: 2 });
    expect(org.directory[0].hiringVerdict).toBe('move_forward'); // most hireable first
    expect(aggregateOrganization('acme', snaps)).toEqual(org); // deterministic
  });
});

describe('Organization OS chain (W510-C6)', () => {
  it('aggregates a mixed roster into an honest hiring pipeline', async () => {
    const { status, body } = await callOrg('prov-strong,prov-partial,prov-thin');
    expect(status).toBe(200);
    expect(body.schema).toBe('vitalcv.organization-os.v1');
    expect(body.metrics.providerCount).toBe(3);
    // strong → move_forward; partial (gated license, near_ready) → request_evidence; thin (no decision-grade) → insufficient
    expect(body.metrics.hiringPipeline.move_forward).toBe(1);
    expect(body.metrics.hiringPipeline.insufficient).toBe(1);
    expect(body.directory[0].subjectKey).toBe('prov-strong'); // most hireable first
    expect(body.metrics.stateCoverage.find((s: any) => s.state === 'CA')?.providers).toBeGreaterThanOrEqual(1);
  });

  it('400s with no providers', async () => {
    const { status } = await callOrg('');
    expect(status).toBe(400);
  });
});
