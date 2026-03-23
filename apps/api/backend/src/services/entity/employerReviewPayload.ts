import type { Prisma, VcvCredentialDomain } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { buildPassport } from './passportService';

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
  dataVersion?: string;
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
    level: string;
    blockers: string[];
    gaps: string[];
    estimatedStartDays: number | null;
  };
  authorityStanding: {
    exclusionStatus: string;
    exclusionCheckedAt?: string;
    exclusionConfidenceLabel?: string;
    licensureStatus: string;
    deaStatus: string;
    pecosStatus: string;
    enrollmentObservedAt?: string;
    enrollmentDataVersion?: string;
    enrollmentFreshnessLabel?: string;
    negativeFindings: string[];
  };
  blockers: string[];
  credentialsIncluded: EmployerReviewCredentialRef[];
  receiptReferences: string[];
  proofReferences: string[];
  checkedAt: string;
  sourceCoverage: {
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

  const artifactIds = mergeStrings(credentials.map((credential) => credential.artifactIds));
  const receiptReferences = mergeStrings(credentials.map((credential) => credential.receiptIds));
  const passportCredentialsById = new Map(
    passport.authority.credentials.map((credential) => [credential.id, credential] as const),
  );
  const artifacts = artifactIds.length > 0
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
    : [];

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
      level: passport.readiness.level,
      blockers: [...passport.readiness.blockers],
      gaps: [...passport.readiness.gaps],
      estimatedStartDays: passport.readiness.estimatedStartDays,
    },
    authorityStanding: {
      exclusionStatus: passport.standing.exclusionStatus,
      exclusionCheckedAt: passport.standing.exclusionCheckedAt,
      exclusionConfidenceLabel: passport.standing.exclusionConfidenceLabel,
      licensureStatus: passport.standing.licensureStatus,
      deaStatus: passport.standing.deaStatus,
      pecosStatus: passport.standing.pecosStatus,
      enrollmentObservedAt: passport.standing.enrollmentObservedAt,
      enrollmentDataVersion: passport.standing.enrollmentDataVersion,
      enrollmentFreshnessLabel: passport.standing.enrollmentFreshnessLabel,
      negativeFindings: [...passport.standing.negativeFindings],
    },
    blockers: [...passport.readiness.blockers],
    credentialsIncluded: credentials.map((credential) => {
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
        dataVersion: passportCredential?.dataVersion,
        sourceDisclaimer: passportCredential?.sourceDisclaimer,
        artifactIds: [...credential.artifactIds],
        receiptIds: [...credential.receiptIds],
      };
    }),
    receiptReferences,
    proofReferences: [...receiptReferences],
    checkedAt: passport.lastCheckedAt,
    sourceCoverage: {
      sources: Array.from(new Set(artifacts.map((artifact) => artifact.source))).sort((left, right) => left.localeCompare(right)),
      domains: Array.from(new Set(credentials.map((credential) => credential.domain))).sort((left, right) => left.localeCompare(right)),
      credentialCount: credentials.length,
    },
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
