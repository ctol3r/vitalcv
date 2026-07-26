import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  projectEvidenceToGraph,
  projectReadiness,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1', npi: '1234567890',
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
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
      negativeFindings: [],
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
    ...overrides,
  };
}

const ctx = (entityId: string) => ({ params: Promise.resolve({ entityId }) });

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload()));
});

describe('Wallet → Mobility → Opportunities integration (W270-C4)', () => {
  it('a fully-checked clinician is READY for their licensed state, NEAR_READY for a new state', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    const trust = propagateTrust(projectEvidenceToGraph(collection));

    const ca = defaultReadinessTemplate('CA');
    expect(projectReadiness(ca, detectGaps(ca, collection, trust), trust).readiness).toBe('ready');

    const nv = defaultReadinessTemplate('NV');
    const nvReadiness = projectReadiness(nv, detectGaps(nv, collection, trust), trust);
    expect(nvReadiness.readiness).toBe('near_ready'); // licensed CA, endorsement path to NV
    expect(nvReadiness.fixableGaps).toContain('licensure');

    const overview = deriveMobilityOverview(collection, trust);
    expect(overview.licensedStates).toEqual(['CA']);
  });
});

const ROUTES = [
  { name: 'overview', path: '../app/api/mobility/[entityId]/route', schema: 'vitalcv.mobility.v1', check: (b: any) => expect(b.licensedStates).toEqual(['CA']) },
  { name: 'readiness', path: '../app/api/mobility/[entityId]/readiness/route', schema: 'vitalcv.mobility-readiness.v1', check: (b: any) => expect(['ready', 'near_ready', 'blocked', 'unknown']).toContain(b.readiness) },
  { name: 'gaps', path: '../app/api/mobility/[entityId]/gaps/route', schema: 'vitalcv.mobility-gaps.v1', check: (b: any) => expect(Array.isArray(b.gaps)).toBe(true) },
];

describe('mobility routes (W270)', () => {
  for (const route of ROUTES) {
    it(`GET ${route.name} returns 200 + ${route.schema}`, async () => {
      const { GET } = await import(route.path);
      const res = await GET(new NextRequest('http://localhost/api/mobility/entity-1'), ctx('entity-1'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      const body = await res.json();
      expect(body.schema).toBe(route.schema);
      route.check(body);
    });

    it(`GET ${route.name} returns 500 on runtime failure`, async () => {
      resolveMock.mockRejectedValueOnce(new Error('boom'));
      const { GET } = await import(route.path);
      const res = await GET(new NextRequest('http://localhost/api/mobility/entity-1'), ctx('entity-1'));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toBe('mobility_unavailable');
    });
  }
});
