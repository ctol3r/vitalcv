import {
  createCanonicalSourceCoverage,
  resolveCanonicalTruthStatus,
  type CanonicalSourceCoverage,
  type CanonicalTruthStatus,
} from '../../../../../../packages/trust-state';
import type { TrustPassport } from './passportService';

export interface EmployerEvidencePacketV1 {
  schema: 'vitalcv.employer.packet.v1';
  exportedAt: string;
  exportedBy: string;
  entityId: string;
  clinicianNpi: string;
  displayName: string;
  identity: {
    npi: string | null;
    displayName: string;
    specialty: string | null;
    source: string;
    checkedAt: string | null;
    status: 'confirmed' | 'missing';
    truthStatus: CanonicalTruthStatus;
  };
  safety: {
    exclusionStatus: string;
    exclusionCheckedAt: string | null;
    exclusionConfidence: string | null;
    source: string;
    isClear: boolean;
    negativeFindings: string[];
    truthStatus: CanonicalTruthStatus;
  };
  authority: {
    truthStatus: CanonicalTruthStatus;
    credentials: Array<{
      domain: string;
      status: string;
      jurisdiction: string | null;
      issuerName: string | null;
      sourceId: string | null;
      observedAt: string | null;
      verifiedAt: string | null;
      expiresAt: string | null;
      freshnessDays: string | null;
      confidence: string | null;
      claimCode: string | null;
      reviewRequired: boolean;
    }>;
    summary: {
      active: number;
      missing: string[];
    };
  };
  eligibility: {
    pecosEnrollmentStatus: string;
    enrollmentNote: string | null;
    enrollmentDataVersion: string | null;
    enrollmentDataFreshness: string;
    enrollmentCheckedAt: string | null;
    enrollmentConfidence: string | null;
    source: string;
    truthStatus: CanonicalTruthStatus;
  };
  readiness: {
    status: string;
    score: number;
    readiness_score: number;
    level: string;
    estimatedStartDays: number | null;
    blockers: string[];
    nextActions: TrustPassport['readiness']['nextActions'];
  };
  sourceCoverage: TrustPassport['sourceCoverage'];
}

function fallbackCoverage(sourceId: string, reason: string): CanonicalSourceCoverage {
  return createCanonicalSourceCoverage({
    sourceId,
    state: 'notChecked',
    reason,
  });
}

function findCoverage(
  passport: TrustPassport,
  sourceIds: readonly string[],
  reason: string,
): CanonicalSourceCoverage {
  return sourceIds
    .map((sourceId) => passport.sourceCoverage.checks.find((check) => check.sourceId === sourceId))
    .find((check): check is CanonicalSourceCoverage => Boolean(check))
    ?? fallbackCoverage(sourceIds[0] ?? 'UNKNOWN', reason);
}

export function buildEmployerEvidencePacket(input: {
  passport: TrustPassport;
  employerId: string;
  exportedAt?: string;
}): EmployerEvidencePacketV1 {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const identityCoverage = findCoverage(
    input.passport,
    ['NPPES_API', 'NPPES'],
    'NPPES identity source not yet checked',
  );
  const safetyCoverage = findCoverage(
    input.passport,
    ['OIG_LEIE', 'OIG'],
    'OIG LEIE source not yet checked',
  );
  const licensureSourceId = input.passport.authority.credentials.find(
    (credential) => credential.domain === 'LICENSURE',
  )?.sourceId ?? 'STATE_BOARD';
  const authorityCoverage = findCoverage(
    input.passport,
    [licensureSourceId, 'STATE_BOARD'],
    'Licensure source not yet checked',
  );
  const enrollmentCoverage = findCoverage(
    input.passport,
    ['PECOS_PUBLIC'],
    'PECOS enrollment source not yet checked',
  );

  return {
    schema: 'vitalcv.employer.packet.v1',
    exportedAt,
    exportedBy: input.employerId,
    entityId: input.passport.entityId,
    clinicianNpi: input.passport.npi ?? '',
    displayName: input.passport.identity.displayName,
    identity: {
      npi: input.passport.identity.npi ?? null,
      displayName: input.passport.identity.displayName,
      specialty: input.passport.identity.specialty ?? null,
      source: 'CMS NPPES',
      checkedAt: input.passport.lastCheckedAt ?? null,
      status: input.passport.identity.npi ? 'confirmed' : 'missing',
      truthStatus: resolveCanonicalTruthStatus({
        kind: 'verification',
        satisfied: Boolean(input.passport.identity.npi),
        coverage: identityCoverage,
      }),
    },
    safety: {
      exclusionStatus: input.passport.standing.exclusionStatus,
      exclusionCheckedAt: input.passport.standing.exclusionCheckedAt ?? null,
      exclusionConfidence: input.passport.standing.exclusionConfidenceLabel ?? null,
      source: 'OIG LEIE',
      isClear: input.passport.standing.exclusionClear,
      negativeFindings: input.passport.standing.negativeFindings.filter(
        (finding) => !/pecos|enrollment|medicare/i.test(finding),
      ),
      truthStatus: resolveCanonicalTruthStatus({
        kind: 'clearance',
        satisfied: input.passport.standing.exclusionStatus === 'CLEAR',
        coverage: safetyCoverage,
      }),
    },
    authority: {
      truthStatus: resolveCanonicalTruthStatus({
        kind: 'verification',
        satisfied: input.passport.standing.licensureStatus === 'verified',
        coverage: authorityCoverage,
      }),
      credentials: input.passport.authority.credentials.map((credential) => ({
        domain: credential.domain,
        status: credential.status,
        jurisdiction: credential.jurisdiction ?? null,
        issuerName: credential.issuerName ?? null,
        sourceId: credential.sourceId ?? null,
        observedAt: credential.observedAt ?? null,
        verifiedAt: credential.verifiedAt ?? null,
        expiresAt: credential.expiresAt ?? null,
        freshnessDays: credential.dataFreshnessLabel ?? null,
        confidence: credential.claimConfidenceLabel ?? null,
        claimCode: credential.authorityClaimCode ?? null,
        reviewRequired: credential.reviewRequired ?? false,
      })),
      summary: {
        active: input.passport.authority.summary.active,
        missing: input.passport.authority.summary.missing,
      },
    },
    eligibility: {
      pecosEnrollmentStatus: input.passport.standing.pecosEnrollmentStatus,
      enrollmentNote: input.passport.standing.enrollmentNote ?? null,
      enrollmentDataVersion: input.passport.standing.enrollmentDataVersion ?? null,
      enrollmentDataFreshness: input.passport.standing.enrollmentDataFreshness ?? 'Quarterly',
      enrollmentCheckedAt: input.passport.standing.enrollmentObservedAt ?? null,
      enrollmentConfidence: input.passport.standing.enrollmentConfidenceLabel ?? null,
      source: input.passport.standing.enrollmentSourceLabel ?? 'CMS PECOS',
      truthStatus: resolveCanonicalTruthStatus({
        kind: 'enrollment',
        satisfied: input.passport.standing.pecosEnrollmentStatus === 'ENROLLED',
        coverage: enrollmentCoverage,
      }),
    },
    readiness: {
      status: input.passport.readiness.status,
      score: input.passport.readiness.score,
      readiness_score: input.passport.readiness.readiness_score,
      level: input.passport.readiness.level,
      estimatedStartDays: input.passport.readiness.estimatedStartDays,
      blockers: input.passport.readiness.blockers,
      nextActions: input.passport.readiness.nextActions,
    },
    sourceCoverage: input.passport.sourceCoverage,
  };
}
