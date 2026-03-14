import prisma from '../../graphql/prisma_client';
import { parseBooleanEnv } from '../../utils/environment';
import { stableStringify, sha256Hex } from '../../utils/deterministic';
import { getBindingByDid } from '../identity/npiDidBinding';
import { parseOrganizationRequirementsEnvelope } from '../employers/pilotPolicy';
import {
  findLatestTrustState as findLatestTrustStateSnapshot,
  persistTrustStateSnapshot,
} from '../../../repositories/trustState.repo';
import { evaluateCredentialArtifact } from './artifactEvaluator';
import {
  resolveTrustRequirements,
  TRUST_STATE_METHOD_VERSION,
  TRUST_STATE_UNBOUND_NPI_PREFIX,
} from './policyMatrix';
import {
  buildTrustStateWarnings,
  toArtifactStatusEntries,
} from './readinessExplainer';
import type {
  ArtifactEvaluationResult,
  BindingProjection,
  CandidateCredentialRecord,
  RequirementWeight,
  TrustReadinessLevel,
  TrustReadinessStatus,
  TrustRequirement,
  TrustStateSnapshotPayload,
  VerificationArtifactRecord,
  WorkflowContext,
} from './types';

const EXCLUDED_SNAPSHOT_SOURCES = ['TRUST_STATE_ENGINE', 'TRUST_STATE_ENGINE_V2'] as const;

function enabled(): boolean {
  return parseBooleanEnv(process.env.FEATURE_READINESS_ENGINE, false);
}

function levelRank(level: TrustReadinessLevel): number {
  if (level === 'L0') {
    return 0;
  }
  if (level === 'L1') {
    return 1;
  }
  if (level === 'L2') {
    return 2;
  }
  return 3;
}

function calculateReadinessScore(
  evaluations: readonly Pick<ArtifactEvaluationResult, 'artifactScore' | 'requirementWeight'>[],
): number {
  const totalWeight = evaluations.reduce((sum, evaluation) => sum + evaluation.requirementWeight, 0);
  if (totalWeight === 0) {
    return 0;
  }

  const weightedScore = evaluations.reduce(
    (sum, evaluation) => sum + (evaluation.requirementWeight * evaluation.artifactScore),
    0,
  );
  return Math.round(weightedScore / totalWeight);
}

function deriveReadinessLevel(
  evaluations: readonly Pick<ArtifactEvaluationResult, 'resolvedLevel'>[],
): TrustReadinessLevel {
  if (evaluations.length === 0) {
    return 'L0';
  }

  return evaluations.reduce<TrustReadinessLevel>((lowest, evaluation) => (
    levelRank(evaluation.resolvedLevel) < levelRank(lowest) ? evaluation.resolvedLevel : lowest
  ), 'L3');
}

function deriveReadinessStatus(
  evaluations: readonly Pick<ArtifactEvaluationResult, 'resolvedLevel' | 'revoked'>[],
): TrustReadinessStatus {
  if (evaluations.some((evaluation) => evaluation.revoked || evaluation.resolvedLevel === 'L0')) {
    return 'NOT_READY';
  }

  if (evaluations.every((evaluation) => evaluation.resolvedLevel === 'L3')) {
    return 'READY';
  }

  return 'CONDITIONALLY_READY';
}

function normalizeBinding(binding: Awaited<ReturnType<typeof getBindingByDid>>): BindingProjection | null {
  if (!binding) {
    return null;
  }

  return {
    id: binding.id,
    did: binding.did,
    npi: binding.npi,
    status: binding.status,
    updatedAt: binding.updatedAt,
    contestReason: binding.contestReason,
  };
}

function buildUnboundSyntheticNpi(subjectDid: string): string {
  return `${TRUST_STATE_UNBOUND_NPI_PREFIX}${sha256Hex(subjectDid).slice(0, 16)}`;
}

function buildBindingFailureEvaluations(
  requirements: readonly TrustRequirement[],
  binding: BindingProjection | null,
): ArtifactEvaluationResult[] {
  return requirements.map((requirement) => {
    const isIdentityRequirement = requirement.canonicalArtifactKey === 'identity_binding'
      || requirement.canonicalArtifactKey === 'npi_verification';
    const reason = binding
      ? `DID binding status ${binding.status} prevents trust-state computation`
      : 'subject DID has no DID to NPI binding';
    return {
      canonicalArtifactKey: requirement.canonicalArtifactKey,
      requirementLabel: requirement.requirementLabel,
      requirementWeight: requirement.requirementWeight,
      resolvedLevel: 'L0',
      artifactScore: 0,
      revoked: false,
      freshness: isIdentityRequirement ? 'not_applicable' : 'not_applicable',
      matchedEvidenceIds: binding ? [binding.id] : [],
      reasons: [
        isIdentityRequirement
          ? reason
          : 'subject NPI is unavailable because the DID binding is not ACTIVE',
      ],
      warnings: [
        isIdentityRequirement
          ? `Identity anchor unavailable for "${requirement.requirementLabel}".`
          : `Requirement "${requirement.requirementLabel}" cannot be resolved until the DID binding is ACTIVE.`,
      ],
    };
  });
}

export function buildTrustStateSnapshot(input: {
  subjectDid: string;
  subjectNpi: string | null;
  contextOrgId?: string | null;
  workflowContext?: WorkflowContext;
  requirements: readonly TrustRequirement[];
  binding: BindingProjection | null;
  verificationArtifacts: readonly VerificationArtifactRecord[];
  candidateCredentials: readonly CandidateCredentialRecord[];
  now?: Date;
}): TrustStateSnapshotPayload {
  const now = input.now ?? new Date();
  const workflowContext = input.workflowContext ?? 'job_application';
  const evaluations = input.requirements.map((requirement) => (
    evaluateCredentialArtifact({
      requirement,
      binding: input.binding,
      verificationArtifacts: input.verificationArtifacts,
      candidateCredentials: input.candidateCredentials,
      now,
    })
  ));

  const artifactStatuses = toArtifactStatusEntries(evaluations);
  const warnings = buildTrustStateWarnings(evaluations);
  const readinessScore = calculateReadinessScore(evaluations);
  const readinessLevel = deriveReadinessLevel(evaluations);
  const readinessStatus = deriveReadinessStatus(evaluations);

  return {
    subjectDid: input.subjectDid,
    subjectNpi: input.subjectNpi,
    contextOrgId: input.contextOrgId ?? null,
    workflowContext,
    readinessScore,
    readinessLevel,
    readinessStatus,
    artifactStatuses,
    warnings,
    methodologyVersion: TRUST_STATE_METHOD_VERSION,
    generatedAt: now.toISOString(),
  };
}

async function loadOrganizationRequirements(contextOrgId?: string | null): Promise<ReturnType<typeof parseOrganizationRequirementsEnvelope>['requirements']> {
  if (!contextOrgId) {
    return [];
  }

  const profile = await prisma.organizationProfile.findUnique({
    where: { organizationId: contextOrgId },
    select: { requirements: true },
  });

  return parseOrganizationRequirementsEnvelope(profile?.requirements, []).requirements;
}

async function loadVerificationArtifacts(
  subjectNpi: string,
  contextOrgId?: string | null,
): Promise<VerificationArtifactRecord[]> {
  return prisma.verificationArtifact.findMany({
    where: contextOrgId
      ? {
          npi: subjectNpi,
          source: { notIn: [...EXCLUDED_SNAPSHOT_SOURCES] },
          OR: [
            { organizationId: null },
            { organizationId: contextOrgId },
          ],
        }
      : {
          npi: subjectNpi,
          source: { notIn: [...EXCLUDED_SNAPSHOT_SOURCES] },
        },
    orderBy: [
      { verifiedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      rawPayload: true,
      verifiedAt: true,
      expiresAt: true,
      revokedAt: true,
      suspendedAt: true,
      revocationReason: true,
      lifecycleState: true,
      statusLastChecked: true,
      psvWindowStart: true,
      psvWindowDeadline: true,
      psvWindowCompliant: true,
      organizationId: true,
      trustState: true,
      createdAt: true,
    },
  });
}

async function loadCandidateCredentials(subjectNpi: string): Promise<CandidateCredentialRecord[]> {
  return prisma.candidateCredential.findMany({
    where: { clinicianId: subjectNpi },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      candidateCredentialId: true,
      clinicianId: true,
      status: true,
      data: true,
      createdAt: true,
    },
  });
}

function assertEnabled(): void {
  if (!enabled()) {
    throw new Error('FEATURE_READINESS_ENGINE is disabled');
  }
}

export async function findLatestTrustState(
  subjectDid: string,
  contextOrgId?: string | null,
  workflowContext: WorkflowContext = 'job_application',
): Promise<TrustStateSnapshotPayload | null> {
  assertEnabled();
  return findLatestTrustStateSnapshot(subjectDid, contextOrgId, workflowContext);
}

export async function computeTrustState(
  subjectDid: string,
  contextOrgId?: string | null,
  workflowContext: WorkflowContext = 'job_application',
): Promise<TrustStateSnapshotPayload> {
  assertEnabled();

  const [bindingRow, organizationRequirements] = await Promise.all([
    getBindingByDid(subjectDid),
    loadOrganizationRequirements(contextOrgId),
  ]);

  const binding = normalizeBinding(bindingRow);
  const requirements = resolveTrustRequirements(workflowContext, organizationRequirements);
  const now = new Date();

  if (!binding || binding.status !== 'ACTIVE') {
    const bindingFailureSnapshot = {
      subjectDid,
      subjectNpi: binding?.npi ?? null,
      contextOrgId: contextOrgId ?? null,
      workflowContext,
      readinessScore: 0,
      readinessLevel: 'L0' as const,
      readinessStatus: 'NOT_READY' as const,
      artifactStatuses: toArtifactStatusEntries(buildBindingFailureEvaluations(requirements, binding)),
      warnings: buildTrustStateWarnings(buildBindingFailureEvaluations(requirements, binding)),
      methodologyVersion: TRUST_STATE_METHOD_VERSION,
      generatedAt: now.toISOString(),
    };

    await persistTrustStateSnapshot(bindingFailureSnapshot, {
      syntheticNpi: binding?.npi ?? buildUnboundSyntheticNpi(subjectDid),
    });

    return bindingFailureSnapshot;
  }

  const [verificationArtifacts, candidateCredentials] = await Promise.all([
    loadVerificationArtifacts(binding.npi, contextOrgId),
    loadCandidateCredentials(binding.npi),
  ]);

  const snapshot = buildTrustStateSnapshot({
    subjectDid,
    subjectNpi: binding.npi,
    contextOrgId,
    workflowContext,
    requirements,
    binding,
    verificationArtifacts,
    candidateCredentials,
    now,
  });

  await persistTrustStateSnapshot(snapshot);
  return snapshot;
}

export function buildTrustStateChecksum(snapshot: TrustStateSnapshotPayload): string {
  return sha256Hex(stableStringify(snapshot));
}
