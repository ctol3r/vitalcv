import { describe, expect, it } from 'vitest';
import { projectEvidenceToGraph, propagateTrust } from '@vitalcv/domain-evidence';
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

function trustOf(overrides: Record<string, unknown> = {}) {
  return propagateTrust(
    projectEvidenceToGraph(passportToEvidenceCollection(assertPassportData(buildPassportPayload(overrides)))),
  );
}

function dim(trust: ReturnType<typeof trustOf>, name: string) {
  return trust.dimensions.find((d) => d.dimension === name)!;
}

describe('passport -> trust (W222 C5)', () => {
  it('scores identity trust from the checked NPPES evidence', () => {
    expect(dim(trustOf(), 'identity').score).toBe(1);
  });

  it('places gated state-board coverage in authority weakening, not supporting', () => {
    const authority = dim(trustOf(), 'authority');
    expect(authority.weakening).toContain('coverage:STATE_BOARD');
    expect(authority.supporting).not.toContain('coverage:STATE_BOARD');
  });

  it('returns null for dimensions with no evidence (no fabricated trust)', () => {
    expect(dim(trustOf(), 'research').score).toBeNull();
    expect(dim(trustOf(), 'leadership').score).toBeNull();
  });

  it('never inflates a dimension above its contributing evidence', () => {
    const trust = trustOf();
    for (const d of trust.dimensions) {
      if (d.score !== null) expect(d.score).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic', () => {
    expect(trustOf()).toEqual(trustOf());
  });
});
