import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertPassportData } from '../lib/trust/passport-contract';

// W300-C6 — Ecosystem integration: one clinician resolves coherently across ALL
// six APIs the ecosystem UI composes (evidence → trust → timeline → mobility →
// organizations). Proves the layers agree (same subject, consistent decision-grade
// counts) — the data backbone behind the Ecosystem Home / Map / Feed / Network.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload() {
  return {
    entityId: 'entity-eco', npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        { id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
          verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'STATE_BOARD' },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [{ id: 'res-1', recordType: 'RESIDENCY', degreeOrTitle: 'IM Residency', specialty: 'Internal Medicine', programName: 'IM', institutionName: 'Johns Hopkins', endYear: 2020, completed: true, verificationLevel: 'PRIMARY_SOURCE' }],
      hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z', negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 72, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 10, nextActions: [] },
    sources: { checked: ['NPPES_API', 'OIG_LEIE'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z', OIG_LEIE: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-01T00:00:00.000Z' },
        { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG LEIE clear', checkedAt: '2026-03-01T00:00:00.000Z' },
      ],
    },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 72, dimensions: [],
      freshness: { state: 'partial', label: 'Partial', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-02T00:00:00.000Z',
  };
}

const ctx = (id: string) => ({ params: Promise.resolve({ entityId: id }) });
const req = () => new NextRequest('http://localhost/api/test');
async function call(path: string) {
  const { GET } = await import(path);
  const res = await GET(req(), ctx('entity-eco'));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload()));
});

describe('Ecosystem integration across all six APIs (W300-C6)', () => {
  it('resolves a coherent ecosystem for one clinician', async () => {
    const evidence = await call('../app/api/evidence/[entityId]/route');
    const trust = await call('../app/api/graph/[entityId]/trust/route');
    const timeline = await call('../app/api/timeline/[entityId]/route');
    const mobility = await call('../app/api/mobility/[entityId]/route');
    const readiness = await call('../app/api/mobility/[entityId]/readiness/route');
    const organizations = await call('../app/api/organizations/[entityId]/route');

    for (const r of [evidence, trust, timeline, mobility, readiness, organizations]) {
      expect(r.status).toBe(200);
    }

    // Same subject across every layer
    expect(evidence.body.subjectKey).toBe('entity-eco');
    expect(trust.body.subjectKey).toBe('entity-eco');
    expect(timeline.body.subjectKey).toBe('entity-eco');
    expect(mobility.body.subjectKey).toBe('entity-eco');
    expect(organizations.body.subjectKey).toBe('entity-eco');

    // Decision-grade evidence count AGREES across trust and timeline (the layers compose honestly)
    expect(trust.body.overall.decisionGradeEvidence).toBe(timeline.body.reputation.decisionGradeEvidence);

    // The training institution surfaces as an organization (the network)
    expect(organizations.body.organizations.some((o: any) => o.kind === 'training_institution')).toBe(true);

    // Mobility reflects the CA license; readiness is a valid honest verdict
    expect(mobility.body.licensedStates).toContain('CA');
    expect(['ready', 'near_ready', 'blocked', 'unknown']).toContain(readiness.body.readiness);

    // Ecosystem Home's "career health" standing is honest (decision-grade evidence exists)
    expect(['established', 'emerging', 'provisional']).toContain(timeline.body.reputation.standing);
  });
});
