import { describe, expect, it } from 'vitest';
import { projectEvidenceToGraph, projectTimeline, propagateTrust } from '@vitalcv/domain-evidence';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

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
        { sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-20T00:00:00.000Z' },
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

function timelineOf(overrides: Record<string, unknown> = {}) {
  const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload(overrides)));
  const graph = projectEvidenceToGraph(collection);
  return projectTimeline(collection, graph, propagateTrust(graph));
}

describe('passport -> timeline (W225 C3/C4)', () => {
  it('builds a chronologically ordered career timeline', () => {
    const t = timelineOf();
    const stamped = t.events.filter((e) => e.occurredAt).map((e) => e.occurredAt!);
    expect(stamped).toEqual([...stamped].sort());
    expect(t.events.length).toBeGreaterThan(0);
  });

  it('marks a checked license as mobility-expanding', () => {
    const t = timelineOf();
    expect(t.events.find((e) => e.evidenceId === 'cred:lic-ca')?.mobilityImpact).toBe('expands');
  });

  it('does not inflate trust impact and reports honest reputation', () => {
    const t = timelineOf();
    for (const e of t.events) expect(e.trustImpact).toBeLessThanOrEqual(1);
    expect(['established', 'emerging', 'provisional', 'unknown']).toContain(t.reputation.standing);
  });

  it('is deterministic', () => {
    expect(timelineOf()).toEqual(timelineOf());
  });
});
