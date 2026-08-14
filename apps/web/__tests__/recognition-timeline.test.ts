/**
 * Recognition in the Professional Memory timeline.
 *
 * Truth contract: recorded employer acceptances (and only recorded ones)
 * project into the timeline as acceptance-class career events with
 * recognitionImpact 'acceptance'; a failed acceptance read yields honest
 * omission — a valid timeline with an empty recognition lane, never
 * fabricated events.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  buildEvidenceCollection,
  projectEvidenceToGraph,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { acceptanceHistoryToEvidenceObjects } from '../lib/recognition/acceptance-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

const resolveMock = vi.fn();
vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

function acceptanceHistoryPayload() {
  return {
    ok: true as const,
    summary: {
      acceptedOrganizationCount: 1,
      hasPriorAcceptances: true,
      headline: 'Accepted by 1 organization',
      trustCopy: null,
    },
    history: [
      {
        acceptanceId: 'accept-1',
        orgLabel: 'Pilot organization 1',
        isAnonymized: true,
        acceptedByOrgId: 'org-entity-1',
        acceptedAt: '2026-03-23T18:00:00.000Z',
        acceptanceScope: 'pilot' as const,
        acceptanceReason: 'Accepted as head start using VitalCV verification.',
      },
    ],
  };
}

// Minimal valid PassportData (same shape the W240 route tests use).
function buildPassportPayload(npi: string) {
  return {
    entityId: npi,
    npi,
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi },
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
      ],
    },
    trustPosture: {
      band: 'L2', bandLabel: 'Moderate trust', score: 70, dimensions: [],
      freshness: { state: 'partial', label: 'Partial source coverage', items: [] },
      safeToRelyOnNow: [], missingItems: [], gatedItems: [], reviewRequiredItems: [], staleItems: [], blockers: [],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

describe('acceptanceHistoryToEvidenceObjects', () => {
  it('produces collection-valid acceptance evidence with an accepted_by relationship', () => {
    const { objects, relationships } = acceptanceHistoryToEvidenceObjects(
      '1234567890',
      acceptanceHistoryPayload(),
    );

    expect(objects).toHaveLength(1);
    expect(objects[0].evidenceClass).toBe('acceptance');
    expect(objects[0].decisionGrade).toBe(true);
    expect(objects[0].label).toBe('Accepted as head start — Pilot organization 1');
    expect(objects[0].checkedAt).toBe('2026-03-23T18:00:00.000Z');
    expect(objects[0].provenance.artifactIds).toEqual(['accept-1']);
    expect(relationships).toEqual([
      {
        from: 'acceptance:accept-1',
        to: 'org-entity-1',
        type: 'accepted_by',
        confidence: null,
        observedAt: '2026-03-23T18:00:00.000Z',
      },
    ]);

    // Must satisfy the collection's decisionGrade invariant (throws otherwise).
    const collection = buildEvidenceCollection({
      subjectKey: '1234567890',
      generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
      objects,
      relationships,
    });
    expect(collection.byClass.acceptance).toHaveLength(1);
  });

  it('projects into the timeline recognition lane with recognitionImpact acceptance', () => {
    const { objects, relationships } = acceptanceHistoryToEvidenceObjects(
      '1234567890',
      acceptanceHistoryPayload(),
    );
    const collection = buildEvidenceCollection({
      subjectKey: '1234567890',
      generatedFor: { displayName: 'Ada Lovelace', npi: '1234567890' },
      objects,
      relationships,
    });
    const graph = projectEvidenceToGraph(collection);
    const trust = propagateTrust(graph);
    const timeline = projectTimeline(collection, graph, trust);

    expect(timeline.recognition).toHaveLength(1);
    expect(timeline.recognition[0].type).toBe('acceptance');
    expect(timeline.recognition[0].recognitionImpact).toBe('acceptance');
    expect(timeline.recognition[0].label).toBe('Accepted as head start — Pilot organization 1');
  });
});

describe('GET /api/timeline/[entityId] recognition merge', () => {
  const ctx = (entityId: string) => ({ params: Promise.resolve({ entityId }) });
  const req = () => new NextRequest('http://localhost/api/timeline/test');

  beforeEach(() => {
    vi.restoreAllMocks();
    resolveMock.mockReset();
  });

  it('omits acceptance evidence from the public NPI timeline while retaining public evidence', async () => {
    resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload('1234567890')));
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/employer-review/1234567890/acceptance-history')) {
        return new Response(JSON.stringify(acceptanceHistoryPayload()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const { GET } = await import('../app/api/timeline/[entityId]/route');
    const res = await GET(req(), ctx('1234567890'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.schema).toBe('vitalcv.timeline.v1');
    expect(body.recognition).toEqual([]);
    expect(body.events.some((e: { type: string }) => e.type === 'acceptance')).toBe(false);
    expect(JSON.stringify(body)).not.toContain('Pilot organization 1');
    expect(body.events.some((e: { type: string }) => e.type === 'licensure')).toBe(true);
  });

  it('does not request acceptance history for the public timeline', async () => {
    resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload('1234567890')));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'boom' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/timeline/[entityId]/route');
    const res = await GET(req(), ctx('1234567890'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.recognition).toEqual([]);
    expect(body.events.some((e: { type: string }) => e.type === 'acceptance')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the acceptance read entirely for non-NPI subjects', async () => {
    resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload('1234567890')));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../app/api/timeline/[entityId]/route');
    const res = await GET(req(), ctx('entity-1'));
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
