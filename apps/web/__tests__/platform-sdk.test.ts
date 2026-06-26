import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createVitalCVClient, PlatformContractError } from '../lib/platform/client';
import { PLATFORM_ENDPOINTS, platformPath } from '../lib/platform/contract';
import { assertPassportData } from '../lib/trust/passport-contract';

// W330-C5 — External Client → SDK → API → Evidence → Trust → Timeline → Mobility.
// A fetch that routes the SDK's requests to the REAL route handlers exercises the
// whole platform path; also validates the C1 boundary (every endpoint returns its
// declared schema) and the SDK's fail-closed contract checking (C4).

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({ resolvePassportRuntimePassport: resolveMock }));

function buildPassportPayload() {
  return {
    entityId: 'ext-1', npi: '1234567890',
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

// Map a platform URL to its real route handler.
const ROUTES: Array<{ re: RegExp; mod: string }> = [
  { re: /^\/api\/evidence\/[^/]+$/, mod: '../app/api/evidence/[entityId]/route' },
  { re: /^\/api\/graph\/[^/]+\/trust$/, mod: '../app/api/graph/[entityId]/trust/route' },
  { re: /^\/api\/timeline\/[^/]+$/, mod: '../app/api/timeline/[entityId]/route' },
  { re: /^\/api\/mobility\/[^/]+\/readiness$/, mod: '../app/api/mobility/[entityId]/readiness/route' },
  { re: /^\/api\/mobility\/[^/]+$/, mod: '../app/api/mobility/[entityId]/route' },
  { re: /^\/api\/organizations\/[^/]+$/, mod: '../app/api/organizations/[entityId]/route' },
  { re: /^\/api\/career-intelligence\/[^/]+$/, mod: '../app/api/career-intelligence/[entityId]/route' },
];

const routedFetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input.toString();
  const path = new URL(url).pathname;
  const match = ROUTES.find((r) => r.re.test(path));
  if (!match) return new Response('not found', { status: 404 });
  const entityId = decodeURIComponent(path.split('/').filter(Boolean)[2]);
  const { GET } = await import(match.mod);
  return GET(new NextRequest(url), { params: Promise.resolve({ entityId }) });
}) as unknown as typeof fetch;

const client = createVitalCVClient({ baseUrl: 'https://platform.test', fetch: routedFetch });

beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('Platform SDK end-to-end (W330-C4/C5)', () => {
  it('an external client retrieves typed, schema-verified projections through the pipeline', async () => {
    const evidence = await client.getEvidence('ext-1');
    const trust = await client.getTrust('ext-1');
    const timeline = await client.getTimeline('ext-1');
    const mobility = await client.getMobility('ext-1');
    const intelligence = await client.getIntelligence('ext-1');

    expect(evidence.subjectKey).toBe('ext-1');
    expect(trust.dimensions).toHaveLength(7);
    expect(timeline.reputation.decisionGradeEvidence).toBe(trust.overall.decisionGradeEvidence);
    expect(mobility.licensedStates).toContain('CA');
    expect(Array.isArray(intelligence.actions)).toBe(true);
    expect(client.version).toBe('v1');
  });

  it('passes the state query through to per-state readiness', async () => {
    const nv = await client.getMobilityReadiness('ext-1', 'NV');
    expect(nv.readiness).not.toBe('ready'); // licensed CA, not NV
  });

  it('C1 boundary: every declared platform endpoint returns its declared schema', async () => {
    for (const ep of PLATFORM_ENDPOINTS) {
      const res = await routedFetch(`https://platform.test${platformPath(ep.id, 'ext-1')}`);
      const body = await (res as Response).json();
      expect(body.schema).toBe(ep.schema);
    }
  });

  it('C4: SDK fails closed on a schema-contract mismatch', async () => {
    const badFetch = (async () => new Response(JSON.stringify({ schema: 'vitalcv.evidence-collection.v2' }), { status: 200 })) as unknown as typeof fetch;
    const bad = createVitalCVClient({ baseUrl: 'https://x', fetch: badFetch });
    await expect(bad.getEvidence('ext-1')).rejects.toBeInstanceOf(PlatformContractError);
  });
});
