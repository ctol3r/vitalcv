import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { projectEvidenceToGraph, projectOrganizations } from '@vitalcv/domain-evidence';
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
        { id: 'abms', domain: 'ABMS', type: 'BOARD_CERTIFICATION', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, issuerName: 'ABMS',
          verifiedAt: '2026-03-02T00:00:00.000Z', sourceId: 'abms' },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [
        { id: 'res-1', recordType: 'RESIDENCY', degreeOrTitle: 'Internal Medicine Residency', specialty: 'Internal Medicine',
          programName: 'IM Residency', institutionName: 'Johns Hopkins', endYear: 2020, completed: true, verificationLevel: 'PRIMARY_SOURCE' },
      ],
      hasDegree: true, degreeVerified: true, hasResidency: true, fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true, exclusionStatus: 'CLEAR', exclusionCheckedAt: '2026-03-01T00:00:00.000Z',
      licensureStatus: 'verified', deaStatus: 'unknown', pecosStatus: 'enrolled', pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS', enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Current PECOS enrollment found.', enrollmentObservedAt: '2026-03-01T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: { status: 'PARTIAL', score: 72, level: 'L2', blockers: [], gaps: [], estimatedStartDays: 10, nextActions: [] },
    sources: { checked: ['NPPES_API'], lastFetch: { NPPES_API: '2026-03-01T00:00:00.000Z' } },
    sourceCoverage: { checks: [{ sourceId: 'NPPES_API', state: 'checked', reason: 'NPPES identity checked', checkedAt: '2026-03-01T00:00:00.000Z' }] },
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
beforeEach(() => { resolveMock.mockReset(); resolveMock.mockResolvedValue(assertPassportData(buildPassportPayload())); });

describe('Clinician ↔ Organization integration (W265-C4)', () => {
  it('projects training institution, credential issuer, and verification authority orgs', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    const orgs = projectOrganizations(collection, projectEvidenceToGraph(collection));

    const jh = orgs.organizations.find((o) => o.sourceId === 'johnshopkins');
    expect(jh?.kind).toBe('training_institution');
    expect(orgs.relationships.find((r) => r.to === jh!.id)?.type).toBe('TRAINED_AT');

    const abms = orgs.organizations.find((o) => o.sourceId === 'abms');
    expect(abms?.kind).toBe('credential_issuer');
    expect(orgs.relationships.find((r) => r.to === abms!.id)?.type).toBe('CERTIFIED_BY');

    expect(orgs.organizations.some((o) => o.kind === 'verification_authority')).toBe(true);
    expect(orgs.relationships.every((r) => r.from === 'subject:entity-1')).toBe(true);
  });
});

describe('organizations route (W265-C2)', () => {
  it('GET returns 200 + vitalcv.organizations.v1', async () => {
    const { GET } = await import('../app/api/organizations/[entityId]/route');
    const res = await GET(new NextRequest('http://localhost/api/organizations/entity-1'), ctx('entity-1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.schema).toBe('vitalcv.organizations.v1');
    expect(Array.isArray(body.organizations)).toBe(true);
    expect(body.stats.organizationCount).toBe(body.organizations.length);
  });

  it('GET returns 500 on runtime failure', async () => {
    resolveMock.mockRejectedValueOnce(new Error('boom'));
    const { GET } = await import('../app/api/organizations/[entityId]/route');
    const res = await GET(new NextRequest('http://localhost/api/organizations/entity-1'), ctx('entity-1'));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('organizations_unavailable');
  });
});
