import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertPassportData } from '../lib/trust/passport-contract';

// W240 route hardening: the evidence/graph/trust/timeline handlers had no direct
// tests (flagged in codex-safe-review/03). These cover handler wiring: the schema
// envelope, the 200 happy path, the Cache-Control header, and the 500 error path.

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        {
          id: 'lic-ca', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
          verifiedAt: '2026-03-23T12:00:00.000Z', sourceId: 'STATE_BOARD',
        },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: { records: [], hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0 },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 70, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 14, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-23T12:00:00.000Z' } },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-23T12:00:00.000Z' },
        { sourceId: 'STATE_BOARD', state: 'gated', reason: 'institutional access required', checkedAt: null },
      ],
    },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 70, dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
    ...overrides,
  };
}

const ctx = (entityId: string) => ({ params: Promise.resolve({ entityId }) });
const req = () => new NextRequest('http://localhost/api/test');

beforeEach(() => {
  resolveMock.mockReset();
  resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload()));
});

const ROUTES: Array<{ name: string; path: string; schema: string; assert: (b: any) => void }> = [
  {
    name: 'evidence', path: '../app/api/evidence/[entityId]/route', schema: 'vitalcv.evidence-collection.v1',
    assert: (b) => { expect(Array.isArray(b.objects)).toBe(true); expect(b.coverageSummary).toBeDefined(); },
  },
  {
    name: 'graph', path: '../app/api/graph/[entityId]/route', schema: 'vitalcv.evidence-graph.v1',
    assert: (b) => { expect(Array.isArray(b.nodes)).toBe(true); expect(b.stats.nodeCount).toBe(b.nodes.length); },
  },
  {
    name: 'trust', path: '../app/api/graph/[entityId]/trust/route', schema: 'vitalcv.evidence-graph-trust.v1',
    assert: (b) => { expect(Array.isArray(b.dimensions)).toBe(true); expect(b.dimensions).toHaveLength(7); },
  },
  {
    name: 'timeline', path: '../app/api/timeline/[entityId]/route', schema: 'vitalcv.timeline.v1',
    assert: (b) => { expect(Array.isArray(b.events)).toBe(true); expect(b.reputation).toBeDefined(); },
  },
];

describe('evidence API routes (W240 hardening)', () => {
  for (const route of ROUTES) {
    it(`GET ${route.name} returns 200 + ${route.schema} + no-store`, async () => {
      const { GET } = await import(route.path);
      const res = await GET(req(), ctx('entity-1'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      const body = await res.json();
      expect(body.schema).toBe(route.schema);
      expect(body.subjectKey).toBe('entity-1');
      route.assert(body);
    });

    it(`GET ${route.name} returns a 500 envelope when the runtime throws`, async () => {
      resolveMock.mockRejectedValueOnce(new Error('boom'));
      const { GET } = await import(route.path);
      const res = await GET(req(), ctx('entity-1'));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(typeof body.error).toBe('string');
      expect(body.error_description).toBeDefined();
    });
  }
});
