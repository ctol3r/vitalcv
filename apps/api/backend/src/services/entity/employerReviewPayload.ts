import type { Prisma, VcvCredentialDomain } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { buildPassport, type ReadinessNextAction } from './passportService';
import { resolveCredentialEvidence } from './evidenceIntegrity';
import type { CanonicalSourceCoverageReport } from '../../../../../../packages/trust-state';

export interface EmployerReviewCredentialRef {
  credentialId: string;
  domain: string;
  credentialType: string;
  status: string;
  verificationLevel: string;
  jurisdiction?: string;
  issuerEntityId?: string;
  issuerName?: string;
  observedAt?: string;
  expiresAt?: string;
  claimConfidenceLabel?: string;
  dataFreshnessLabel?: string;
  dataFreshnessCadence?: string;
  matchConfidence?: string;
  sourceLatency?: string;
  claimState?: string;
  statusLabel?: string;
  dataVersion?: string;
  identityOnly?: boolean;
  sourceDisclaimer?: string;
  artifactIds: string[];
  receiptIds: string[];
}

export interface EmployerReviewPayloadV1 {
  schema: 'vitalcv.employer.review.v1';
  identitySummary: {
    entityId: string;
    displayName: string;
    npi?: string;
    specialty?: string;
    entityType: string;
  };
  readinessSummary: {
    status: string;
    score: number;
    readiness_score: number;
    level: string;
    blockers: string[];
    gaps: string[];
    nextActions: ReadinessNextAction[];
    estimatedStartDays: number | null;
  };
  authorityStanding: {
    exclusionStatus: string;
    exclusionCheckedAt?: string;
    exclusionConfidenceLabel?: string;
    licensureStatus: string;
    deaStatus: string;
    pecosStatus: string;
    pecosEnrollmentStatus?: 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED' | 'OPTED_OUT';
    enrollmentSourceLabel?: string;
    enrollmentDataFreshness?: string;
    enrollmentSourceLatency?: string;
    enrollmentNote?: string | null;
    enrollmentObservedAt?: string;
    enrollmentDataVersion?: string;
    enrollmentStatusLabel?: string;
    enrollmentFreshnessLabel?: string;
    negativeFindings: string[];
  };
  blockers: string[];
  nextActions: ReadinessNextAction[];
  credentialsIncluded: EmployerReviewCredentialRef[];
  receiptReferences: string[];
  proofReferences: string[];
  checkedAt: string;
  sourceCoverage: CanonicalSourceCoverageReport & {
    sources: string[];
    domains: string[];
    credentialCount: number;
  };
  shareMetadata: {
    organizationContextId?: string;
    requestorEntityId?: string;
    sharedByUserId?: string;
    selectiveDomains?: string[] | 'ALL';
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mergeStrings(values: readonly string[][]): string[] {
  return Array.from(new Set(values.flatMap((value) => value))).sort((left, right) => left.localeCompare(right));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX32_RE = /^[0-9a-f]{32}$/i;
function onlyUuids(values: string[]): string[] {
  return values.filter((v) => UUID_RE.test(v));
}
function onlyReceiptIds(values: string[]): string[] {
  return values.filter((v) => UUID_RE.test(v) || HEX32_RE.test(v));
}

export function buildEmployerReviewSourceCoverage(input: {
  passportSourceCoverage: CanonicalSourceCoverageReport;
  domains: readonly string[];
  credentialCount: number;
}): EmployerReviewPayloadV1['sourceCoverage'] {
  return {
    checks: input.passportSourceCoverage.checks,
    summary: input.passportSourceCoverage.summary,
    sources: Array.from(new Set(
      input.passportSourceCoverage.checks.map((check) => check.sourceId),
    )).sort((left, right) => left.localeCompare(right)),
    domains: Array.from(new Set(input.domains)).sort((left, right) => left.localeCompare(right)),
    credentialCount: input.credentialCount,
  };
}

export async function buildEmployerReviewPayload(input: {
  entityId: string;
  organizationContextId?: string;
  sharedByUserId?: string;
  selectiveDomains?: string[];
}): Promise<EmployerReviewPayloadV1> {
  const passport = await buildPassport(input.entityId);
  if (!passport) {
    throw new Error(`Passport unavailable for entity ${input.entityId}`);
  }

  const context = input.organizationContextId
    ? await prisma.vcvOrganizationContext.findUnique({
        where: { id: input.organizationContextId },
        select: { id: true, requestorId: true },
      })
    : null;

  const credentials = await prisma.vcvCredential.findMany({
    where: {
      subjectId: input.entityId,
      status: { not: 'SUPERSEDED' },
      ...(input.selectiveDomains?.length
        ? {
            domain: {
              in: input.selectiveDomains as VcvCredentialDomain[],
            },
          }
        : {}),
    },
    include: {
      issuer: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: [
      { domain: 'asc' },
      { observedAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  const artifactIds = onlyUuids(mergeStrings(credentials.map((credential) => credential.artifactIds)));
  const receiptIds = onlyReceiptIds(mergeStrings(credentials.map((credential) => credential.receiptIds)));
  const passportCredentialsById = new Map(
    passport.authority.credentials.map((credential) => [credential.id, credential] as const),
  );
  const receiptClient = (prisma as unknown as {
    verificationReceiptRecord?: {
      findMany?: (args: Record<string, unknown>) => Promise<Array<{
        receiptId: string;
        sourceArtifactId: string | null;
        verificationArtifactId: string | null;
      }>>;
    };
  }).verificationReceiptRecord;
  const [artifacts, receipts] = await Promise.all([
    artifactIds.length > 0
      ? await prisma.verificationArtifact.findMany({
          where: {
            id: {
              in: artifactIds,
            },
          },
          select: {
            id: true,
            source: true,
          },
        })
      : [],
    receiptIds.length > 0 && receiptClient?.findMany
      ? await receiptClient.findMany({
          where: {
            receiptId: {
              in: receiptIds,
            },
          },
          select: {
            receiptId: true,
            sourceArtifactId: true,
            verificationArtifactId: true,
          },
        })
      : [],
  ]);
  const artifactsById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const receiptsById = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const reviewableCredentials = credentials
    .map((credential) => ({
      credential,
      evidence: resolveCredentialEvidence({
        credential: {
          id: credential.id,
          verificationLevel: credential.verificationLevel,
          artifactIds: credential.artifactIds,
          receiptIds: credential.receiptIds,
        },
        artifactsById,
        receiptsById,
      }),
    }))
    .filter((entry) => entry.evidence.publicSafe);
  const receiptReferences = mergeStrings(reviewableCredentials.map((entry) => entry.evidence.validReceiptIds));

  return {
    schema: 'vitalcv.employer.review.v1',
    identitySummary: {
      entityId: passport.identity.entityId,
      displayName: passport.identity.displayName,
      npi: passport.identity.npi,
      specialty: passport.identity.specialty,
      entityType: passport.identity.entityType,
    },
    readinessSummary: {
      status: passport.readiness.status,
      score: passport.readiness.score,
      readiness_score: passport.readiness.readiness_score,
      level: passport.readiness.level,
      blockers: [...passport.readiness.blockers],
      gaps: [...passport.readiness.gaps],
      nextActions: [...passport.readiness.nextActions],
      estimatedStartDays: passport.readiness.estimatedStartDays,
    },
    authorityStanding: {
      exclusionStatus: passport.standing.exclusionStatus,
      exclusionCheckedAt: passport.standing.exclusionCheckedAt,
      exclusionConfidenceLabel: passport.standing.exclusionConfidenceLabel,
      licensureStatus: passport.standing.licensureStatus,
      deaStatus: passport.standing.deaStatus,
      pecosStatus: passport.standing.pecosStatus,
      pecosEnrollmentStatus: passport.standing.pecosEnrollmentStatus,
      enrollmentSourceLabel: passport.standing.enrollmentSourceLabel,
      enrollmentDataFreshness: passport.standing.enrollmentDataFreshness,
      enrollmentSourceLatency: passport.standing.enrollmentSourceLatency,
      enrollmentNote: passport.standing.enrollmentNote,
      enrollmentObservedAt: passport.standing.enrollmentObservedAt,
      enrollmentDataVersion: passport.standing.enrollmentDataVersion,
      enrollmentStatusLabel: passport.standing.enrollmentStatusLabel,
      enrollmentFreshnessLabel: passport.standing.enrollmentFreshnessLabel,
      negativeFindings: [...passport.standing.negativeFindings],
    },
    blockers: [...passport.readiness.blockers],
    nextActions: [...passport.readiness.nextActions],
    credentialsIncluded: reviewableCredentials.map(({ credential, evidence }) => {
      const passportCredential = passportCredentialsById.get(credential.id);
      return {
        credentialId: credential.id,
        domain: credential.domain,
        credentialType: credential.credentialType,
        status: credential.status,
        verificationLevel: credential.verificationLevel,
        jurisdiction: credential.jurisdiction ?? undefined,
        issuerEntityId: passportCredential?.issuerEntityId ?? credential.issuerId ?? undefined,
        issuerName: passportCredential?.issuerName ?? credential.issuer?.displayName,
        observedAt: passportCredential?.observedAt ?? credential.observedAt?.toISOString(),
        expiresAt: credential.expiresAt?.toISOString(),
        claimConfidenceLabel: passportCredential?.claimConfidenceLabel,
        dataFreshnessLabel: passportCredential?.dataFreshnessLabel,
        dataFreshnessCadence: passportCredential?.dataFreshnessCadence,
        matchConfidence: passportCredential?.matchConfidence,
        sourceLatency: passportCredential?.sourceLatency,
        claimState: passportCredential?.claimState,
        statusLabel: passportCredential?.statusLabel,
        dataVersion: passportCredential?.dataVersion,
        identityOnly: passportCredential?.identityOnly,
        sourceDisclaimer: passportCredential?.sourceDisclaimer,
        artifactIds: [...evidence.validArtifactIds],
        receiptIds: [...evidence.validReceiptIds],
      };
    }),
    receiptReferences,
    proofReferences: [...receiptReferences],
    checkedAt: passport.lastCheckedAt,
    sourceCoverage: buildEmployerReviewSourceCoverage({
      passportSourceCoverage: passport.sourceCoverage,
      domains: reviewableCredentials.map(({ credential }) => credential.domain),
      credentialCount: reviewableCredentials.length,
    }),
    shareMetadata: {
      organizationContextId: context?.id,
      requestorEntityId: context?.requestorId,
      sharedByUserId: input.sharedByUserId,
      selectiveDomains: input.selectiveDomains?.length ? [...input.selectiveDomains] : 'ALL',
    },
  };
}

export function employerReviewPayloadToJson(
  payload: EmployerReviewPayloadV1 | EmployerReviewPayloadV1['sourceCoverage'] | unknown,
): Prisma.InputJsonValue {
  return toJsonValue(payload);
}
