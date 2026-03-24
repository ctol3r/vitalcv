import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PassportData } from '../app/passport/[id]/page';
import { buildPassportProofSections } from '../components/trust/passportProofSections';
import {
  buildPassportFreshnessEntries,
  renderAttachedCheckFreshness,
  renderAttachedRecordFreshness,
  renderCredentialGroupFreshness,
  summarizePassportFreshnessEntries,
} from '../lib/trust/proof-language';

function buildPassport(overrides: Partial<PassportData> = {}): PassportData {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      displayName: 'Ada Lovelace',
      specialty: 'ICU',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [
        {
          id: 'cred-licensure',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          issuerName: 'State Board',
          sourceId: 'STATE_BOARD',
          jurisdiction: 'OR',
          observedAt: '2026-01-01T00:00:00.000Z',
          verifiedAt: '2026-01-01T00:00:00.000Z',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'Weekly',
          dataFreshnessLabel: 'Weekly',
          reviewRequired: false,
          authorityClaimCode: 'PHYSICIAN_LICENSE_ACTIVE',
        },
      ],
      summary: { active: 1, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-20T00:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'registered',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Medicare enrolled',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      negativeFindings: [],
    },
    readiness: {
      status: 'READY',
      score: 92,
      level: 'L2',
      blockers: [],
      gaps: [],
      estimatedStartDays: 3,
      nextActions: [],
    },
    sources: {
      checked: ['STATE_BOARD', 'CMS PECOS', 'OIG_LEIE'],
      lastFetch: {},
    },
    lastCheckedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('trust proof language', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders canonical freshness labels for records and checks', () => {
    expect(renderAttachedRecordFreshness('2026-03-20T00:00:00.000Z')).toBe('Current attached record');
    expect(renderAttachedRecordFreshness()).toBe('No attached record');
    expect(renderAttachedCheckFreshness('2026-03-20T00:00:00.000Z')).toBe('Current attached check');
    expect(renderAttachedCheckFreshness()).toBe('No attached check');
    expect(renderCredentialGroupFreshness([])).toBe('No attached record');
    expect(renderCredentialGroupFreshness([
      buildPassport().authority.credentials[0],
    ])).toBe('Within freshness window');
    expect(renderCredentialGroupFreshness([
      {
        ...buildPassport().authority.credentials[0],
        stale: true,
      },
    ])).toBe('Mixed freshness');
  });

  it('summarizes freshness with stale taking precedence over unchecked coverage', () => {
    const stalePassport = buildPassport({
      authority: {
        credentials: [
          {
            ...buildPassport().authority.credentials[0],
            stale: true,
            observedAt: '2025-10-01T00:00:00.000Z',
          },
        ],
        summary: { active: 1, expired: 0, stale: 1, missing: [] },
      },
      standing: {
        ...buildPassport().standing,
        pecosEnrollmentStatus: 'UNCHECKED',
      },
    });

    expect(
      summarizePassportFreshnessEntries(buildPassportFreshnessEntries(stalePassport)),
    ).toEqual({
      state: 'stale',
      label: 'Stale sources present',
    });

    const partialPassport = buildPassport({
      authority: {
        credentials: [],
        summary: { active: 0, expired: 0, stale: 0, missing: ['LICENSURE'] },
      },
      standing: {
        ...buildPassport().standing,
        pecosEnrollmentStatus: 'UNCHECKED',
      },
    });

    expect(
      summarizePassportFreshnessEntries(buildPassportFreshnessEntries(partialPassport)),
    ).toEqual({
      state: 'partial',
      label: 'Partial source coverage',
    });
  });

  it('keeps degraded proof sections aligned with freshness state', () => {
    const degradedPassport = buildPassport({
      authority: {
        credentials: [
          {
            ...buildPassport().authority.credentials[0],
            stale: true,
            observedAt: '2025-10-01T00:00:00.000Z',
          },
        ],
        summary: { active: 1, expired: 0, stale: 1, missing: [] },
      },
      standing: {
        ...buildPassport().standing,
        exclusionStatus: 'POSSIBLE_MATCH',
        exclusionClear: false,
      },
    });

    const proofItems = buildPassportProofSections(degradedPassport);

    expect(proofItems.find((item) => item.id === 'licensure')?.status).toBe('stale');
    expect(proofItems.find((item) => item.id === 'sanctions')?.status).toBe('review_required');
    expect(
      summarizePassportFreshnessEntries(buildPassportFreshnessEntries(degradedPassport)).state,
    ).toBe('stale');
  });

  it('renders manual-only authority as contextual proof instead of verified truth', () => {
    const manualOnlyPassport = buildPassport({
      authority: {
        credentials: [
          {
            ...buildPassport().authority.credentials[0],
            status: 'UNRESOLVED',
            authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
            participationStatus: 'manual_verification_required',
            sourceScope: 'STATE_BOARD_MANUAL',
            jurisdiction: 'TX',
          },
        ],
        summary: { active: 0, expired: 0, stale: 0, missing: [] },
      },
    });

    const proofItems = buildPassportProofSections(manualOnlyPassport);
    const licensureSection = proofItems.find((item) => item.id === 'licensure');

    expect(licensureSection?.status).toBe('unavailable');
  });
});
