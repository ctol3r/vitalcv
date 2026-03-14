import prisma from '../src/graphql/prisma_client';
import { stableStringify, sha256Hex } from '../src/utils/deterministic';
import {
  TRUST_STATE_SNAPSHOT_SOURCE,
} from '../src/services/trust-state/policyMatrix';
import type {
  TrustStateSnapshotPayload,
  WorkflowContext,
} from '../src/services/trust-state/types';

type SnapshotArtifactRow = {
  rawPayload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkflowContext(value: unknown): value is WorkflowContext {
  return value === 'job_application'
    || value === 'privileging'
    || value === 'locums'
    || value === 'share';
}

function isTrustStateSnapshotPayload(value: unknown): value is TrustStateSnapshotPayload {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.subjectDid === 'string'
    && (typeof value.subjectNpi === 'string' || value.subjectNpi === null)
    && (typeof value.contextOrgId === 'string' || value.contextOrgId === null)
    && isWorkflowContext(value.workflowContext)
    && typeof value.readinessScore === 'number'
    && typeof value.readinessLevel === 'string'
    && typeof value.readinessStatus === 'string'
    && Array.isArray(value.artifactStatuses)
    && Array.isArray(value.warnings)
    && typeof value.methodologyVersion === 'string'
    && typeof value.generatedAt === 'string';
}

function normalizeContextOrgId(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function persistTrustStateSnapshot(
  snapshot: TrustStateSnapshotPayload,
  options: {
    syntheticNpi?: string;
  } = {},
): Promise<void> {
  await prisma.verificationArtifact.create({
    data: {
      npi: snapshot.subjectNpi ?? options.syntheticNpi ?? '__trust_state_unbound__',
      source: TRUST_STATE_SNAPSHOT_SOURCE,
      status: snapshot.readinessStatus,
      rawPayload: JSON.parse(stableStringify(snapshot)),
      checksum: sha256Hex(stableStringify(snapshot)),
      verifiedAt: new Date(snapshot.generatedAt),
      expiresAt: null,
      monitoring: false,
      organizationId: normalizeContextOrgId(snapshot.contextOrgId),
      trustState: snapshot.readinessLevel,
    },
  });
}

export async function findLatestTrustState(
  subjectDid: string,
  contextOrgId?: string | null,
  workflowContext?: WorkflowContext,
): Promise<TrustStateSnapshotPayload | null> {
  const candidates = await prisma.verificationArtifact.findMany({
    where: {
      source: TRUST_STATE_SNAPSHOT_SOURCE,
      organizationId: normalizeContextOrgId(contextOrgId),
    },
    orderBy: { verifiedAt: 'desc' },
    take: 50,
    select: {
      rawPayload: true,
    },
  }) as SnapshotArtifactRow[];

  for (const candidate of candidates) {
    if (!isTrustStateSnapshotPayload(candidate.rawPayload)) {
      continue;
    }

    if (candidate.rawPayload.subjectDid !== subjectDid) {
      continue;
    }

    if (workflowContext && candidate.rawPayload.workflowContext !== workflowContext) {
      continue;
    }

    return candidate.rawPayload;
  }

  return null;
}
