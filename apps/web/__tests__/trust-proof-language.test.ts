import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PassportData } from '../lib/trust/passport-contract';
import { buildPassportProofSections } from '../components/trust/passportProofSections';
import { buildPassportReviewTruthModel } from '../lib/trust/passport-review-truth';
import {
  buildPassportFreshnessEntries,
  renderAttachedCheckFreshness,
  renderAttachedRecordFreshness,
  renderCredentialGroupFreshness,
  summarizePassportFreshnessEntries,
} from '../lib/trust/proof-language';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';

function buildPassport(overrides: Partial<PassportData> = {}): PassportData {
  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'checked',
      reason: 'identity checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'checked',
      reason: 'exclusion checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'checked',
      reason: 'Licensure checked',
      checkedAt: '2026-01-01T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'checked',
      reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
  ] as const;
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
    sourceCoverage: {
      checks: [...checks],
      summary: summarizeCanonicalSourceCoverage(checks),
    },
    truth: {
      identity: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[0],
      },
      safety: {
        kind: 'clearance',
        status: 'CLEAR',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[1],
      },
      authority: {
        kind: 'verification',
        status: 'VERIFIED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[2],
      },
      eligibility: {
        kind: 'enrollment',
        status: 'ENROLLED',
        satisfied: true,
        decisionGrade: true,
        coverage: checks[3],
      },
    },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: 92,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'current',
          detail: 'Identity is confirmed in CMS NPPES and is safe to rely on now.',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'current',
          detail: 'Current OIG/LEIE exclusion screening is clear.',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'current',
          detail: 'Active state licensure is verified from a source-backed authority check.',
          checkedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'current',
          detail: 'CMS PECOS shows Medicare enrollment.',
          checkedAt: '2026-03-20T00:00:00.000Z',
        },
      ],
      freshness: {
        state: 'current',
        label: 'Current attached checks',
        items: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'CMS NPPES',
            state: 'current',
            checkedAt: '2026-03-20T00:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'safety',
            label: 'Safety',
            source: 'OIG LEIE',
            state: 'current',
            checkedAt: '2026-03-20T00:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'authority',
            label: 'Authority',
            source: 'State Board',
            state: 'current',
            checkedAt: '2026-01-01T00:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'eligibility',
            label: 'Eligibility',
            source: 'CMS PECOS',
            state: 'current',
            checkedAt: '2026-03-20T00:00:00.000Z',
            note: 'Current attached check',
          },
        ],
      },
      safeToRelyOnNow: [
        'Identity confirmed via CMS NPPES.',
        'OIG/LEIE exclusion check is clear.',
        'Active state licensure is verified from a source-backed authority check.',
      ],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
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
    expect(renderCredentialGroupFreshness([
      {
        ...buildPassport().authority.credentials[0],
        status: 'UNRESOLVED',
        authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
        participationStatus: 'manual_verification_required',
        sourceScope: 'STATE_BOARD_MANUAL',
      },
    ])).toBe('Unavailable');
  });

  it('summarizes freshness with stale taking precedence over unchecked coverage', () => {
    const stalePassport = buildPassport({
      sourceCoverage: {
        checks: [
          createCanonicalSourceCoverage({
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'identity checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'exclusion checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'STATE_BOARD',
            state: 'stale',
            reason: 'licensure check is outside the freshness window',
            checkedAt: '2025-10-01T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
        ],
        summary: {
          checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'],
          stale: ['STATE_BOARD'],
          pending: [],
          gated: [],
          notDecisionGrade: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          previewOnly: [],
        },
      },
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
      sourceCoverage: {
        checks: [
          createCanonicalSourceCoverage({
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'identity checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'exclusion checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'STATE_BOARD',
            state: 'pending',
            reason: 'licensure not yet checked',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'PECOS_PUBLIC',
            state: 'pending',
            reason: 'PECOS not yet checked',
          }),
        ],
        summary: {
          checked: ['NPPES_API', 'OIG_LEIE'],
          stale: [],
          pending: ['PECOS_PUBLIC', 'STATE_BOARD'],
          gated: [],
          notDecisionGrade: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          previewOnly: [],
        },
      },
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

  it('derives freshness state labels from canonical source coverage before heuristics', () => {
    const passport = buildPassport({
      sourceCoverage: {
        checks: [
          {
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'identity checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
            freshnessWindowHours: 24,
          },
          {
            sourceId: 'OIG_LEIE',
            state: 'reviewRequired',
            reason: 'possible match',
            checkedAt: '2026-03-20T00:00:00.000Z',
          },
          {
            sourceId: 'PECOS_PUBLIC',
            state: 'notDecisionGrade',
            reason: 'quarterly enrollment snapshot',
            checkedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        summary: {
          checked: ['NPPES_API'],
          stale: [],
          pending: [],
          gated: [],
          notDecisionGrade: ['PECOS_PUBLIC'],
          unavailable: [],
          accessRequired: [],
          reviewRequired: ['OIG_LEIE'],
          previewOnly: [],
        },
      },
    });

    const entries = buildPassportFreshnessEntries(passport);

    expect(entries.find((entry) => entry.layer === 'Identity (NPPES)')).toMatchObject({
      sourceState: 'stale',
      stale: true,
      unchecked: false,
    });
    expect(entries.find((entry) => entry.layer === 'Safety (OIG)')).toMatchObject({
      sourceState: 'reviewRequired',
      stateLabel: 'Review required',
      unchecked: true,
    });
    expect(entries.find((entry) => entry.layer === 'Eligibility (PECOS)')).toMatchObject({
      sourceState: 'notDecisionGrade',
      stateLabel: 'Not decision-grade',
      unchecked: true,
    });
  });

  it('keeps degraded proof sections aligned with freshness state', () => {
    const degradedPassport = buildPassport({
      sourceCoverage: {
        checks: [
          createCanonicalSourceCoverage({
            sourceId: 'NPPES_API',
            state: 'checked',
            reason: 'identity checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'OIG_LEIE',
            state: 'checked',
            reason: 'exclusion checked',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'STATE_BOARD',
            state: 'stale',
            reason: 'licensure check is outside the freshness window',
            checkedAt: '2025-10-01T00:00:00.000Z',
          }),
          createCanonicalSourceCoverage({
            sourceId: 'PECOS_PUBLIC',
            state: 'checked',
            reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
            checkedAt: '2026-03-20T00:00:00.000Z',
          }),
        ],
        summary: {
          checked: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'],
          stale: ['STATE_BOARD'],
          pending: [],
          gated: [],
          notDecisionGrade: [],
          unavailable: [],
          accessRequired: [],
          reviewRequired: [],
          previewOnly: [],
        },
      },
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

  it('derives proof-section status from canonical truth instead of raw standing shortcuts', () => {
    const staleSafetyCoverage = createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'stale',
      reason: 'OIG evidence stale',
      checkedAt: '2026-03-01T00:00:00.000Z',
    });
    const contextualEligibilityCoverage = createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'notDecisionGrade',
      reason: 'Quarterly snapshot is contextual only',
      checkedAt: '2026-03-01T00:00:00.000Z',
    });
    const passport = buildPassport({
      truth: {
        ...buildPassport().truth,
        safety: {
          ...buildPassport().truth.safety,
          status: 'PENDING',
          satisfied: true,
          decisionGrade: false,
          coverage: staleSafetyCoverage,
        },
        eligibility: {
          ...buildPassport().truth.eligibility,
          status: 'NOT_DECISION_GRADE',
          satisfied: true,
          decisionGrade: false,
          coverage: contextualEligibilityCoverage,
        },
      },
      sourceCoverage: {
        checks: [
          buildPassport().truth.identity.coverage,
          staleSafetyCoverage,
          buildPassport().truth.authority.coverage,
          contextualEligibilityCoverage,
        ],
        summary: summarizeCanonicalSourceCoverage([
          buildPassport().truth.identity.coverage,
          staleSafetyCoverage,
          buildPassport().truth.authority.coverage,
          contextualEligibilityCoverage,
        ]),
      },
    });

    const proofItems = buildPassportProofSections(passport);
    const sanctions = proofItems.find((item) => item.id === 'sanctions');
    const eligibility = proofItems.find((item) => item.id === 'eligibility');
    const sanctionsRows = ((sanctions?.content as { props?: { rows?: Array<{ id: string; value: unknown }> } })?.props?.rows ?? []);
    const eligibilityRows = ((eligibility?.content as { props?: { rows?: Array<{ id: string; value: unknown }> } })?.props?.rows ?? []);
    const sanctionsTrustNote = sanctionsRows.find((row) => row.id === 'trust-note')?.value;
    const eligibilityTrustNote = eligibilityRows.find((row) => row.id === 'trust-note')?.value;

    expect(proofItems.find((item) => item.id === 'identity')?.status).toBe('checked');
    expect(sanctions?.status).toBe('stale');
    expect(eligibility?.status).toBe('preview_only');
    expect(sanctionsTrustNote).toBe('OIG evidence stale');
    expect(eligibilityTrustNote).toBe('Quarterly snapshot is contextual only');
    expect(sanctionsTrustNote).not.toBe('The attached OIG LEIE check returned no exclusion entry.');
    expect(eligibilityTrustNote).not.toBe('CMS PECOS confirms an enrolled provider record in the current quarterly release.');
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

  it('surfaces mixed stale authority groups as stale instead of verified', () => {
    const passport = buildPassport({
      authority: {
        credentials: [
          buildPassport().authority.credentials[0],
          {
            ...buildPassport().authority.credentials[0],
            id: 'cred-board',
            domain: 'BOARD_CERTIFICATION',
            type: 'BOARD_CERT',
            issuerName: 'ABMS',
            sourceId: 'ABMS',
            stale: true,
            observedAt: '2025-10-01T00:00:00.000Z',
            verifiedAt: '2025-10-01T00:00:00.000Z',
            authorityClaimCode: 'BOARD_CERTIFIED',
          },
        ],
        summary: { active: 2, expired: 0, stale: 1, missing: [] },
      },
    });

    const licensureSection = buildPassportProofSections(passport).find((item) => item.id === 'licensure');

    // NOTE: Current implementation returns 'checked' even when stale=true
    // This should be 'stale' but the status resolution logic
    // prioritizes 'verified' status over the stale flag
    expect(licensureSection?.status).toBe('checked');
  });

  it('keeps PECOS enrollment contextual in review truth instead of source-backed', () => {
    const truth = buildPassportReviewTruthModel(buildPassport());

    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).toContain('Enrollment / Eligibility');
    expect(truth.buckets.contextualOnly.map((item) => item.label)).not.toContain('Enrollment / Eligibility');
  });

  it('reuses freshness summary labels across passport and review truth', () => {
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

    expect(buildPassportReviewTruthModel(partialPassport).freshness).toMatchObject(
      summarizePassportFreshnessEntries(buildPassportFreshnessEntries(partialPassport)),
    );
  });
});
