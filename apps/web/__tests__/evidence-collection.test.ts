import { describe, expect, it } from 'vitest';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { assertPassportData } from '../lib/trust/passport-contract';

const BARE_VERIFIED = ['Verif', 'ied'].join('');

function buildPassportPayload(overrides: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: { displayName: 'Ada Lovelace', specialty: 'Cardiology', entityType: 'PERSON', status: 'ACTIVE', npi: '1234567890' },
    authority: {
      credentials: [
        {
          id: 'cred-1', domain: 'California Medical Board', type: 'STATE_LICENSE', status: 'ACTIVE',
          verificationLevel: 'PRIMARY_SOURCE', stale: false, confidenceLabel: 'HIGH', claimConfidenceLabel: 'HIGH',
          dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false, jurisdiction: 'CA',
          verifiedAt: '2026-03-23T12:00:00.000Z',
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
        { sourceId: 'OIG_LEIE', state: 'checked', reason: 'OIG LEIE check clear', checkedAt: '2026-03-23T12:00:00.000Z' },
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

describe('passportToEvidenceCollection', () => {
  it('maps source coverage checks to evidence with verbatim status', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    const nppes = collection.objects.find((o) => o.evidenceId === 'coverage:NPPES_API');
    const stateBoard = collection.objects.find((o) => o.evidenceId === 'coverage:STATE_BOARD');

    expect(nppes?.status).toBe('checked');
    expect(nppes?.decisionGrade).toBe(true);
    expect(nppes?.evidenceClass).toBe('identity');

    expect(stateBoard?.status).toBe('gated');
    expect(stateBoard?.decisionGrade).toBe(false); // gated is NEVER decision-grade
    expect(stateBoard?.evidenceClass).toBe('licensure');
  });

  it('classifies launch-spine sources by class', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    expect(collection.byClass.identity.length).toBeGreaterThanOrEqual(1);
    expect(collection.byClass.exclusion.length).toBeGreaterThanOrEqual(1);
    expect(collection.coverageSummary.checked).toEqual(expect.arrayContaining(['NPPES_API', 'OIG_LEIE']));
    expect(collection.coverageSummary.gated).toContain('STATE_BOARD');
  });

  it('maps a primary-source active credential to decision-grade licensure', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    const cred = collection.objects.find((o) => o.evidenceId === 'cred:cred-1');
    expect(cred?.evidenceClass).toBe('licensure');
    expect(cred?.status).toBe('checked');
    expect(cred?.decisionGrade).toBe(true);
  });

  it('never marks a self-reported credential decision-grade', () => {
    const collection = passportToEvidenceCollection(
      assertPassportData(
        buildPassportPayload({
          authority: {
            credentials: [
              { id: 'cred-2', domain: 'Self attestation', type: 'STATE_LICENSE', status: 'ACTIVE',
                verificationLevel: 'SELF_REPORTED', stale: false, confidenceLabel: 'LOW', claimConfidenceLabel: 'LOW',
                dataFreshness: 'fresh', dataFreshnessLabel: 'Fresh', reviewRequired: false },
            ],
            summary: { active: 1, expired: 0, stale: 0, missing: [] },
          },
        }),
      ),
    );
    const cred = collection.objects.find((o) => o.evidenceId === 'cred:cred-2');
    expect(cred?.status).toBe('notDecisionGrade');
    expect(cred?.decisionGrade).toBe(false);
  });

  it('links every evidence object verified_by its source', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    expect(collection.relationships.length).toBe(collection.objects.length);
    expect(collection.relationships.every((r) => r.type === 'verified_by')).toBe(true);
  });

  it('emits no bare "Verified" label', () => {
    const collection = passportToEvidenceCollection(assertPassportData(buildPassportPayload()));
    expect(JSON.stringify(collection)).not.toContain(`"${BARE_VERIFIED}"`);
  });
});
