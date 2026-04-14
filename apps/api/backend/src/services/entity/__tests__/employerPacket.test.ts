import {
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import { buildEmployerEvidencePacket } from '../employerPacket';
import { buildEmployerReviewSourceCoverage } from '../employerReviewPayload';
import type { TrustPassport } from '../passportService';

function buildPassport(): TrustPassport {
  const checks = [
    createCanonicalSourceCoverage({
      sourceId: 'NPPES_API',
      state: 'checked',
      reason: 'NPPES identity checked',
      checkedAt: '2026-03-23T12:00:00.000Z',
      artifactId: 'artifact-nppes',
      checksum: 'checksum-nppes',
      parserVersion: 'v1.2.0',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/',
      proof: { artifactIds: ['artifact-nppes'], receiptIds: ['receipt-nppes'] },
    }),
    createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'checked',
      reason: 'OIG LEIE check clear',
      checkedAt: '2026-03-23T12:00:00.000Z',
      artifactId: 'artifact-oig',
      checksum: 'checksum-oig',
      parserVersion: 'v1.2.0',
      sourceUrl: 'https://oig.hhs.gov/exclusions/',
      proof: { artifactIds: ['artifact-oig'], receiptIds: ['receipt-oig'] },
    }),
    createCanonicalSourceCoverage({
      sourceId: 'STATE_BOARD',
      state: 'gated',
      reason: 'Institutional access required',
      checkedAt: '2026-03-23T12:00:00.000Z',
      artifactId: 'artifact-state-board',
      checksum: 'checksum-state-board',
      parserVersion: 'physician-licensure-launch-lane/v1',
      sourceUrl: 'https://mbc.ca.gov/breeze/',
      proof: { artifactIds: ['artifact-state-board'], receiptIds: ['receipt-state-board'] },
    }),
    createCanonicalSourceCoverage({
      sourceId: 'PECOS_PUBLIC',
      state: 'checked',
      reason: 'CMS PECOS enrollment checked',
      checkedAt: '2026-03-23T12:00:00.000Z',
      artifactId: 'artifact-pecos',
      checksum: 'checksum-pecos',
      parserVersion: 'v1.2.0',
      sourceUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/',
      proof: { artifactIds: ['artifact-pecos'], receiptIds: ['receipt-pecos'] },
    }),
  ] as const;

  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      entityId: 'entity-1',
      displayName: 'Dr. Jane Doe',
      npi: '1234567890',
      specialty: 'Family Medicine',
      entityType: 'CLINICIAN',
      status: 'ACTIVE',
    },
    authority: {
      credentials: [
        {
          id: 'cred-1',
          domain: 'LICENSURE',
          type: 'STATE_LICENSE',
          status: 'ACTIVE',
          verificationLevel: 'SOURCE_VERIFIED',
          sourceId: 'STATE_BOARD',
          observedAt: '2026-03-23T12:00:00.000Z',
          expiresAt: '2027-03-23T12:00:00.000Z',
          stale: false,
          confidenceLabel: 'HIGH',
          claimConfidenceLabel: 'HIGH',
          dataFreshness: 'Weekly',
          dataFreshnessLabel: 'Weekly',
          reviewRequired: false,
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
      exclusionCheckedAt: '2026-03-23T12:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      licensureStatus: 'verified',
      deaStatus: 'registered',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentSourceLatency: 'QUARTERLY',
      enrollmentNote: 'Medicare enrolled',
      enrollmentObservedAt: '2026-03-23T12:00:00.000Z',
      enrollmentDataVersion: '2026-Q1',
      enrollmentStatusLabel: 'Enrolled',
      enrollmentFreshnessLabel: 'Quarterly',
      enrollmentConfidenceLabel: 'HIGH',
      negativeFindings: [],
    },
    readiness: {
      status: 'PARTIAL',
      score: 59,
      readiness_score: 59,
      level: 'L1',
      blockers: [],
      gaps: [],
      nextActions: [],
      estimatedStartDays: 14,
    },
    sources: {
      checked: ['NPPES_API', 'OIG_LEIE', 'STATE_BOARD', 'PECOS_PUBLIC'],
      lastFetch: {
        NPPES_API: '2026-03-23T12:00:00.000Z',
      },
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
        status: 'ACCESS_REQUIRED',
        satisfied: true,
        decisionGrade: false,
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
      band: 'L1',
      bandLabel: 'Partial trust',
      score: 59,
      dimensions: [
        {
          id: 'identity',
          label: 'Identity',
          state: 'current',
          detail: 'Identity is confirmed in CMS NPPES and is safe to rely on now.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'safety',
          label: 'Safety',
          state: 'current',
          detail: 'Current OIG/LEIE exclusion screening is clear.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'authority',
          label: 'Authority',
          state: 'gated',
          detail: 'Institutional access required',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
        {
          id: 'eligibility',
          label: 'Eligibility',
          state: 'current',
          detail: 'CMS PECOS shows Medicare enrollment.',
          checkedAt: '2026-03-23T12:00:00.000Z',
        },
      ],
      freshness: {
        state: 'partial',
        label: 'Partial source coverage',
        items: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'CMS NPPES',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'safety',
            label: 'Safety',
            source: 'OIG LEIE',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'authority',
            label: 'Authority',
            source: 'STATE_BOARD',
            state: 'partial',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Institutional access required',
          },
          {
            id: 'eligibility',
            label: 'Eligibility',
            source: 'CMS PECOS',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
        ],
      },
      safeToRelyOnNow: [
        'Identity confirmed via CMS NPPES.',
        'OIG/LEIE exclusion check is clear.',
        'Medical degree is source-verified.',
        'Residency completion is source-verified.',
      ],
      missingItems: [
      ],
      gatedItems: ['Institutional access required'],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    decisionPosture: {
      status: 'PARTIAL',
      headline: 'Partial decision posture',
      proven: [
        {
          sourceId: 'NPPES_API',
          dimension: 'identity',
          state: 'checked',
          checkedAt: '2026-03-23T12:00:00.000Z',
          expiresAt: '2026-03-30T12:00:00.000Z',
          reason: 'NPPES identity checked',
        },
        {
          sourceId: 'OIG_LEIE',
          dimension: 'safety',
          state: 'checked',
          checkedAt: '2026-03-23T12:00:00.000Z',
          expiresAt: '2026-03-30T12:00:00.000Z',
          reason: 'OIG LEIE check clear',
        },
        {
          sourceId: 'PECOS_PUBLIC',
          dimension: 'eligibility',
          state: 'checked',
          checkedAt: '2026-03-23T12:00:00.000Z',
          expiresAt: '2026-06-21T12:00:00.000Z',
          reason: 'CMS PECOS enrollment checked',
        },
      ],
      missing: [
        {
          sourceId: 'STATE_BOARD',
          dimension: 'authority',
          state: 'gated',
          checkedAt: '2026-03-23T12:00:00.000Z',
          expiresAt: null,
          reason: 'Institutional access required',
        },
      ],
      blockers: [],
      freshness: {
        state: 'partial',
        label: 'Partial source coverage',
        items: [
          {
            id: 'identity',
            label: 'Identity',
            source: 'CMS NPPES',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'safety',
            label: 'Safety',
            source: 'OIG LEIE',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
          {
            id: 'authority',
            label: 'Authority',
            source: 'STATE_BOARD',
            state: 'partial',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Institutional access required',
          },
          {
            id: 'eligibility',
            label: 'Eligibility',
            source: 'CMS PECOS',
            state: 'current',
            checkedAt: '2026-03-23T12:00:00.000Z',
            note: 'Current attached check',
          },
        ],
      },
      nextAction: 'Request a source-backed state licensure check before start.',
    },
    decision: {
      decision: 'PROCEED_WITH_CAUTION',
      confidence: 55,
      rationale: ['Partial decision posture'],
      blockers: [],
      next_actions: ['Request a source-backed state licensure check before start.'],
    },
    lastCheckedAt: '2026-03-23T12:00:00.000Z',
  };
}

describe('employer packet truth', () => {
  it('keeps packet export source coverage aligned with employer review payload coverage and emits a launch-spine manifest', () => {
    const passport = buildPassport();

    const packet = buildEmployerEvidencePacket({
      passport,
      employerId: 'employer-1',
      exportedAt: '2026-03-23T13:00:00.000Z',
    });
    const reviewCoverage = buildEmployerReviewSourceCoverage({
      passportSourceCoverage: passport.sourceCoverage,
      domains: ['LICENSURE'],
      credentialCount: 1,
    });

    expect(packet.sourceCoverage).toEqual(passport.sourceCoverage);
    expect(reviewCoverage.checks).toEqual(packet.sourceCoverage.checks);
    expect(reviewCoverage.summary).toEqual(packet.sourceCoverage.summary);
    expect(packet.identity.truthStatus).toBe('VERIFIED');
    expect(packet.safety.truthStatus).toBe('CLEAR');
    expect(packet.authority.truthStatus).toBe('ACCESS_REQUIRED');
    expect(packet.eligibility.truthStatus).toBe('ENROLLED');
    expect(packet.receiptReferences).toEqual([
      { sourceId: 'NPPES_API', receiptId: 'receipt-nppes' },
      { sourceId: 'OIG_LEIE', receiptId: 'receipt-oig' },
      { sourceId: 'PECOS_PUBLIC', receiptId: 'receipt-pecos' },
      { sourceId: 'STATE_BOARD', receiptId: 'receipt-state-board' },
    ]);
    expect(packet.artifactReferences).toEqual([
      {
        sourceId: 'NPPES_API',
        artifactId: 'artifact-nppes',
        checksum: 'checksum-nppes',
        parserVersion: 'v1.2.0',
        sourceUrl: 'https://npiregistry.cms.hhs.gov/api/',
        rawArtifactRef: 'artifact-nppes',
      },
      {
        sourceId: 'OIG_LEIE',
        artifactId: 'artifact-oig',
        checksum: 'checksum-oig',
        parserVersion: 'v1.2.0',
        sourceUrl: 'https://oig.hhs.gov/exclusions/',
        rawArtifactRef: 'artifact-oig',
      },
      {
        sourceId: 'PECOS_PUBLIC',
        artifactId: 'artifact-pecos',
        checksum: 'checksum-pecos',
        parserVersion: 'v1.2.0',
        sourceUrl: 'https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment/',
        rawArtifactRef: 'artifact-pecos',
      },
      {
        sourceId: 'STATE_BOARD',
        artifactId: 'artifact-state-board',
        checksum: 'checksum-state-board',
        parserVersion: 'physician-licensure-launch-lane/v1',
        sourceUrl: 'https://mbc.ca.gov/breeze/',
        rawArtifactRef: 'artifact-state-board',
      },
    ]);
    expect(packet.sourceCoverageSummary.checked).toEqual(['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC']);
    expect(packet.sourceCoverageSummary.gated).toEqual(['STATE_BOARD']);
    expect(packet.freshness).toEqual(passport.trustPosture.freshness);
    expect(packet.decisionPosture).toEqual({
      status: 'PARTIAL',
      headline: 'Some decision-grade checks are still missing, gated, stale, or under review.',
      blockers: [],
      nextAction: 'Request refresh or route to review before relying on missing lanes.',
      freshness: passport.trustPosture.freshness,
    });
    expect(packet.sourceCoverage.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'NPPES_API',
        observedAt: '2026-03-23T12:00:00.000Z',
        parserVersion: 'v1.2.0',
        freshness: expect.objectContaining({
          status: 'current',
          observedAt: '2026-03-23T12:00:00.000Z',
        }),
        provenance: expect.objectContaining({
          artifactId: 'artifact-nppes',
          receiptIds: ['receipt-nppes'],
          parserVersion: 'v1.2.0',
        }),
      }),
      expect.objectContaining({
        sourceId: 'STATE_BOARD',
        observedAt: '2026-03-23T12:00:00.000Z',
        freshness: expect.objectContaining({
          status: 'unknown',
        }),
        provenance: expect.objectContaining({
          artifactId: 'artifact-state-board',
          receiptIds: ['receipt-state-board'],
        }),
      }),
    ]));
    expect(packet.manifest).toEqual(expect.objectContaining({
      schema: 'vitalcv.employer.packet-manifest.v1',
      exportedAt: '2026-03-23T13:00:00.000Z',
      exportedBy: 'employer-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      bundleFiles: [
        'packet.json',
        'manifest.json',
        'source-coverage.json',
        'status.json',
        'README.txt',
      ],
      receiptReferences: packet.receiptReferences,
      artifactReferences: packet.artifactReferences,
      sourceCoverage: packet.sourceCoverage,
      sourceCoverageSummary: packet.sourceCoverageSummary,
      freshness: packet.freshness,
      status: {
        truth: packet.truth,
        freshness: packet.freshness,
        readiness: {
          status: packet.readiness.status,
          score: packet.readiness.score,
          readiness_score: packet.readiness.readiness_score,
          level: packet.readiness.level,
          blockers: packet.readiness.blockers,
        },
        decisionPosture: packet.decisionPosture,
        sourceCoverageSummary: packet.sourceCoverageSummary,
      },
    }));
    expect(packet.manifest.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: 'NPPES_API',
        truthStatus: 'VERIFIED',
        state: 'checked',
        checksum: 'checksum-nppes',
        freshness: expect.objectContaining({
          status: 'current',
          observedAt: '2026-03-23T12:00:00.000Z',
        }),
        provenance: expect.objectContaining({
          artifactId: 'artifact-nppes',
          receiptIds: ['receipt-nppes'],
          parserVersion: 'v1.2.0',
        }),
      }),
      expect.objectContaining({
        sourceId: 'STATE_BOARD',
        truthStatus: 'ACCESS_REQUIRED',
        state: 'gated',
        credentialExpiresAt: '2027-03-23T12:00:00.000Z',
        reviewRequired: false,
        freshness: expect.objectContaining({
          status: 'unknown',
          expiresAt: '2027-03-23T12:00:00.000Z',
        }),
        provenance: expect.objectContaining({
          artifactId: 'artifact-state-board',
          receiptIds: ['receipt-state-board'],
          parserVersion: 'physician-licensure-launch-lane/v1',
        }),
      }),
      expect.objectContaining({
        sourceId: 'PECOS_PUBLIC',
        truthStatus: 'ENROLLED',
        state: 'checked',
        checksum: 'checksum-pecos',
      }),
    ]));
  });

  it('preserves stale versus checked packet state in both source checks and the manifest', () => {
    const passport = buildPassport();
    const staleSafety = createCanonicalSourceCoverage({
      sourceId: 'OIG_LEIE',
      state: 'stale',
      reason: 'OIG LEIE screening is stale and should be refreshed.',
      checkedAt: '2025-12-23T12:00:00.000Z',
      artifactId: 'artifact-oig',
      checksum: 'checksum-oig',
      parserVersion: 'v1.2.0',
      sourceUrl: 'https://oig.hhs.gov/exclusions/',
      proof: { artifactIds: ['artifact-oig'], receiptIds: ['receipt-oig'] },
      freshnessWindowHours: 24,
    });

    passport.sourceCoverage = {
      checks: passport.sourceCoverage.checks.map((check) => (
        check.sourceId === 'OIG_LEIE' ? staleSafety : check
      )),
      summary: summarizeCanonicalSourceCoverage([
        passport.sourceCoverage.checks[0],
        staleSafety,
        passport.sourceCoverage.checks[2],
        passport.sourceCoverage.checks[3],
      ]),
    };
    passport.truth = {
      ...passport.truth,
      safety: {
        ...passport.truth.safety,
        status: 'PENDING',
        satisfied: false,
        decisionGrade: false,
        coverage: staleSafety,
      },
    };
    passport.trustPosture = {
      ...passport.trustPosture,
      freshness: {
        state: 'stale',
        label: 'At least one source is stale',
        items: passport.trustPosture.freshness.items.map((item) => (
          item.id === 'safety'
            ? {
                ...item,
                state: 'stale',
                checkedAt: '2025-12-23T12:00:00.000Z',
                note: 'OIG LEIE screening is stale and should be refreshed.',
              }
            : item
        )),
      },
      staleItems: ['OIG LEIE screening is stale and should be refreshed.'],
    };

    const packet = buildEmployerEvidencePacket({
      passport,
      employerId: 'employer-1',
      exportedAt: '2026-03-23T13:00:00.000Z',
    });

    expect(packet.sourceCoverageSummary.stale).toEqual(['OIG_LEIE']);
    expect(packet.sourceCoverageSummary.checked).toEqual(['NPPES_API', 'PECOS_PUBLIC']);
    expect(packet.sourceCoverage.checks.find((check) => check.sourceId === 'OIG_LEIE')).toEqual(
      expect.objectContaining({
        state: 'stale',
        freshness: expect.objectContaining({
          status: 'stale',
        }),
        provenance: expect.objectContaining({
          receiptIds: ['receipt-oig'],
        }),
      }),
    );
    expect(packet.manifest.sources.find((source) => source.sourceId === 'OIG_LEIE')).toEqual(
      expect.objectContaining({
        state: 'stale',
        truthStatus: 'PENDING',
        freshness: expect.objectContaining({
          status: 'stale',
        }),
        provenance: expect.objectContaining({
          receiptIds: ['receipt-oig'],
        }),
      }),
    );
  });
});
