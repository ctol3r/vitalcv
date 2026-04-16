import { describe, expect, it } from 'vitest';
import type { PassportData } from '../lib/trust/passport-contract';
import { buildPassportReviewTruthModel } from '../lib/trust/passport-review-truth';
import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import {
  ALL_CLEAR_ACTION_DETAIL,
  ALL_CLEAR_ACTION_LABEL,
  MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE,
} from '../lib/trust/single-action';

function buildPassport(
  overrides: Partial<PassportData> = {},
): PassportData {
  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'checked',
      reason: 'NPPES identity checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'checked',
      reason: 'OIG LEIE check clear',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'checked',
      reason: 'Licensure checked',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'checked',
      reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
      checkedAt: '2026-03-20T00:00:00.000Z',
    }),
  ] as const;
  const base: PassportData = {
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
          observedAt: '2026-03-20T00:00:00.000Z',
          verifiedAt: '2026-03-20T00:00:00.000Z',
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
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: 'Medicare enrolled',
      enrollmentObservedAt: '2026-03-20T00:00:00.000Z',
      enrollmentDataVersion: 'Q1 2026',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'Quarterly release',
      negativeFindings: [],
    },
    readiness: {
      status: 'PARTIAL',
      score: 88,
      level: 'L2',
      blockers: ['DEA_REGISTRATION'],
      gaps: ['DEA registration not verified'],
      estimatedStartDays: 14,
      nextActions: [
        {
          id: 'next-1',
          title: 'Upload DEA evidence',
          detail: 'Attach DEA evidence before relying on the controlled-substance layer.',
          priority: 'HIGH',
        },
      ],
    },
    sources: {
      checked: ['NPPES', 'OIG'],
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
      score: 88,
      dimensions: [],
      freshness: {
        state: 'current',
        label: 'Current attached checks',
        items: [],
      },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: ['DEA_REGISTRATION'],
    },
    lastCheckedAt: '2026-03-20T00:00:00.000Z',
  };

  return {
    ...base,
    ...overrides,
    identity: {
      ...base.identity,
      ...overrides.identity,
    },
    authority: {
      ...base.authority,
      ...overrides.authority,
      credentials: overrides.authority?.credentials ?? base.authority.credentials,
      summary: {
        ...base.authority.summary,
        ...overrides.authority?.summary,
      },
    },
    training: {
      ...base.training,
      ...overrides.training,
      records: overrides.training?.records ?? base.training.records,
    },
    standing: {
      ...base.standing,
      ...overrides.standing,
      negativeFindings: overrides.standing?.negativeFindings ?? base.standing.negativeFindings,
    },
    readiness: {
      ...base.readiness,
      ...overrides.readiness,
      blockers: overrides.readiness?.blockers ?? base.readiness.blockers,
      gaps: overrides.readiness?.gaps ?? base.readiness.gaps,
      nextActions: overrides.readiness?.nextActions ?? base.readiness.nextActions,
    },
    sources: {
      ...base.sources,
      ...overrides.sources,
      checked: overrides.sources?.checked ?? base.sources.checked,
      lastFetch: {
        ...base.sources.lastFetch,
        ...overrides.sources?.lastFetch,
      },
    },
    sourceCoverage: overrides.sourceCoverage ?? base.sourceCoverage,
    truth: overrides.truth ?? base.truth,
    trustPosture: {
      ...base.trustPosture,
      ...overrides.trustPosture,
      dimensions: overrides.trustPosture?.dimensions ?? base.trustPosture.dimensions,
      freshness: {
        ...base.trustPosture.freshness,
        ...overrides.trustPosture?.freshness,
        items: overrides.trustPosture?.freshness?.items ?? base.trustPosture.freshness.items,
      },
      safeToRelyOnNow: overrides.trustPosture?.safeToRelyOnNow ?? base.trustPosture.safeToRelyOnNow,
      missingItems: overrides.trustPosture?.missingItems ?? base.trustPosture.missingItems,
      gatedItems: overrides.trustPosture?.gatedItems ?? base.trustPosture.gatedItems,
      reviewRequiredItems: overrides.trustPosture?.reviewRequiredItems ?? base.trustPosture.reviewRequiredItems,
      staleItems: overrides.trustPosture?.staleItems ?? base.trustPosture.staleItems,
      blockers: overrides.trustPosture?.blockers ?? base.trustPosture.blockers,
    },
  };
}

describe('passport review truth', () => {
  it('maps proof states into source-backed, contextual, stale, review, and missing buckets', () => {
    const reviewRequiredSafetyCoverage = createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'reviewRequired',
      reason: 'Potential exclusion match requires manual review',
      checkedAt: '2026-03-20T00:00:00.000Z',
    });
    const coverageChecks = [
      createCanonicalSourceCoverage({
        sourceId: 'NPPES_API',
        state: 'checked',
        reason: 'NPPES identity checked',
        checkedAt: '2026-03-20T00:00:00.000Z',
      }),
      reviewRequiredSafetyCoverage,
      createCanonicalSourceCoverage({
        sourceId: 'STATE_BOARD',
        state: 'checked',
        reason: 'Licensure checked',
        checkedAt: '2026-03-20T00:00:00.000Z',
      }),
      createCanonicalSourceCoverage({
        sourceId: 'PECOS_PUBLIC',
        state: 'checked',
        reason: 'CMS PECOS confirms enrolled status in the current quarterly release',
        checkedAt: '2026-03-20T00:00:00.000Z',
      }),
    ] as const;
    const passport = buildPassport({
      sourceCoverage: {
        checks: [...coverageChecks],
        summary: summarizeCanonicalSourceCoverage(coverageChecks),
      },
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
      standing: {
        ...buildPassport().standing,
        exclusionClear: false,
        exclusionStatus: 'POSSIBLE_MATCH',
        deaStatus: 'unknown',
      },
      truth: {
        ...buildPassport().truth,
        safety: {
          ...buildPassport().truth.safety,
          status: 'REVIEW_REQUIRED',
          satisfied: false,
          decisionGrade: false,
          coverage: reviewRequiredSafetyCoverage,
        },
      },
    });

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Identity Verification', 'Physician license (OR)']),
    );
    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).toContain('Enrollment / Eligibility');
    expect(truth.buckets.contextualOnly.map((item) => item.label)).not.toContain('Physician license (OR)');
    expect(truth.buckets.stale.map((item) => item.label)).toContain('Board certified');
    expect(truth.buckets.needsReview.map((item) => item.label)).toContain('Sanctions & Exclusions');
    expect(truth.buckets.missingOrAccessRequired.map((item) => item.label)).toContain('DEA / Controlled Substance');
    expect(truth.buckets.nextActions.map((item) => item.label)).toContain('Upload DEA evidence');
    expect(truth.proofSummary.decisionGradeCount).toBe(3);
    expect(truth.proofSummary.informationalCount).toBe(0);
    expect(truth.proofSummary.warningCount).toBe(1);
  });

  it('keeps manual-only authority out of source-backed truth', () => {
    const passport = buildPassport({
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
      standing: {
        ...buildPassport().standing,
        licensureStatus: 'pending',
      },
    });

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).not.toContain('License verification — manual lane only (TX)');
    expect(truth.buckets.missingOrAccessRequired.map((item) => item.label)).toContain('License verification — manual lane only (TX)');
  });

  it('splits mixed authority credentials across verified and access-limited review buckets', () => {
    const passport = buildPassport({
      authority: {
        credentials: [
          buildPassport().authority.credentials[0],
          {
            ...buildPassport().authority.credentials[0],
            id: 'cred-manual',
            status: 'UNRESOLVED',
            authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
            participationStatus: 'institution_access_unavailable',
            sourceScope: 'FSMB_MED_API',
            jurisdiction: 'CA',
          },
        ],
        summary: { active: 1, expired: 0, stale: 0, missing: [] },
      },
    });

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).toContain('Physician license (OR)');
    expect(truth.buckets.missingOrAccessRequired.map((item) => item.label)).toContain('License verification — access required (CA)');
  });

  it('keeps unsupported current authority claims contextual instead of source-backed', () => {
    const passport = buildPassport({
      authority: {
        credentials: [
          buildPassport().authority.credentials[0],
          {
            ...buildPassport().authority.credentials[0],
            id: 'cred-board-current',
            domain: 'BOARD_CERTIFICATION',
            type: 'BOARD_CERT',
            issuerName: 'ABMS',
            sourceId: 'ABMS',
            stale: false,
            observedAt: '2026-03-20T00:00:00.000Z',
            verifiedAt: '2026-03-20T00:00:00.000Z',
            authorityClaimCode: 'BOARD_CERTIFIED',
          },
        ],
        summary: { active: 2, expired: 0, stale: 0, missing: [] },
      },
    });

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).not.toContain('Board certified');
    expect(truth.buckets.contextualOnly.map((item) => item.label)).toContain('Board certified');
  });

  it('keeps stale and contextual top-level truth out of source-backed review buckets', () => {
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

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.stale.map((item) => item.label)).toContain('Sanctions & Exclusions');
    expect(truth.buckets.contextualOnly.map((item) => item.label)).toContain('Enrollment / Eligibility');
    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).not.toContain('Sanctions & Exclusions');
    expect(truth.buckets.sourceBackedNow.map((item) => item.label)).not.toContain('Enrollment / Eligibility');
    expect(truth.posture.dimensions.find((item) => item.label === 'Exclusion check (OIG/LEIE)')?.state).toBe('stale');
    expect(truth.posture.dimensions.find((item) => item.label === 'Medicare enrollment (PECOS)')?.state).toBe('unavailable');
  });

  it('returns an explicit all-clear action when no next action is attached', () => {
    const passport = buildPassport({
      readiness: {
        ...buildPassport().readiness,
        nextActions: [],
      },
    });

    const truth = buildPassportReviewTruthModel(passport);

    expect(truth.buckets.nextActions).toEqual([
      {
        id: 'action:all-clear',
        label: ALL_CLEAR_ACTION_LABEL,
        detail: ALL_CLEAR_ACTION_DETAIL,
      },
    ]);
  });

  it('throws when more than one next action is attached', () => {
    const passport = buildPassport({
      readiness: {
        ...buildPassport().readiness,
        nextActions: [
          buildPassport().readiness.nextActions[0],
          {
            id: 'next-2',
            title: 'Route to manual review',
            detail: 'Escalate this packet before proceeding.',
            priority: 'MEDIUM',
          },
        ],
      },
    });

    expect(() => buildPassportReviewTruthModel(passport)).toThrow(
      MULTIPLE_ACTIONS_FORBIDDEN_MESSAGE,
    );
  });
});
