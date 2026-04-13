import type { PrismaClient } from '@prisma/client';
import { sha256ForPayload } from '../../utils/deterministic';
import { createGraphNodeId } from './ids';
import {
  deactivateMirrorNodes,
  supersedeEdgesFromSourceNode,
  upsertMirrorEdge,
  upsertMirrorNode,
} from './graphMirrorStore';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function looksLikeNpi(value: string | null): value is string {
  return Boolean(value && /^\d{10}$/.test(value));
}

async function ensureClinicianNode(
  prismaClient: PrismaClient,
  input: {
    npi?: string | null;
    entityId?: string | null;
    displayName?: string | null;
  },
): Promise<{ id: string } | null> {
  const npi = input.npi ?? null;

  if (looksLikeNpi(npi)) {
    const [profile, provider, entity] = await Promise.all([
      prismaClient.personProfile.findFirst({
        where: { npi },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          specialty: true,
          stateOfPractice: true,
          updatedAt: true,
        },
      }),
      prismaClient.provider.findUnique({
        where: { npi },
        select: {
          id: true,
          fullName: true,
          providerType: true,
          taxonomyCode: true,
          stateOfPractice: true,
          updatedAt: true,
        },
      }).catch(() => null),
      prismaClient.vcvEntity.findFirst({
        where: { npi },
        select: {
          id: true,
          displayName: true,
          metadata: true,
          updatedAt: true,
        },
      }).catch(() => null),
    ]);

    const fullName = [
      profile?.firstName ?? null,
      profile?.lastName ?? null,
    ].filter((value): value is string => Boolean(value)).join(' ').trim();
    const label =
      input.displayName
      ?? fullName
      ?? provider?.fullName
      ?? entity?.displayName
      ?? `Clinician ${npi}`;

    return upsertMirrorNode(prismaClient, {
      type: 'clinician',
      sourceKind: 'npi',
      sourceId: npi,
      label,
      title: label,
      groupKey: profile?.specialty ?? provider?.taxonomyCode ?? 'clinician',
      tags: uniqueSorted([
        profile?.specialty ?? '',
        profile?.stateOfPractice ?? '',
        provider?.taxonomyCode ?? '',
      ]),
      metadata: {
        npi,
        entityId: entity?.id ?? input.entityId ?? null,
        specialty: profile?.specialty ?? null,
        state: profile?.stateOfPractice ?? provider?.stateOfPractice ?? null,
        taxonomyCode: provider?.taxonomyCode ?? null,
      },
      sourceRefs: uniqueSorted([
        profile?.id ?? '',
        provider?.id ?? '',
        entity?.id ?? '',
      ]),
      sourceUpdatedAt: profile?.updatedAt ?? provider?.updatedAt ?? entity?.updatedAt ?? new Date(),
    });
  }

  if (!input.entityId) {
    return null;
  }

  const entity = await prismaClient.vcvEntity.findUnique({
    where: { id: input.entityId },
    select: {
      id: true,
      displayName: true,
      metadata: true,
      updatedAt: true,
    },
  });

  if (!entity) {
    return null;
  }

  const metadata = asRecord(entity.metadata);
  const label = input.displayName ?? entity.displayName;
  return upsertMirrorNode(prismaClient, {
    type: 'clinician',
    sourceKind: 'vcv_entity',
    sourceId: entity.id,
    label,
    title: label,
    groupKey: 'clinician',
    metadata: {
      entityId: entity.id,
      ...metadata,
    },
    sourceRefs: [entity.id],
    sourceUpdatedAt: entity.updatedAt,
  });
}

async function ensureOrganizationNodeFromOrganizationId(
  prismaClient: PrismaClient,
  organizationId: string,
): Promise<{ id: string } | null> {
  const organization = await prismaClient.organization.findUnique({
    where: { id: organizationId },
    include: {
      organizationProfile: {
        select: {
          id: true,
          specialties: true,
          statesCovered: true,
          verified: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!organization) {
    return null;
  }

  const profile = organization.organizationProfile;
  return upsertMirrorNode(prismaClient, {
    type: 'organization',
    sourceKind: 'organization',
    sourceId: organization.id,
    label: organization.name,
    title: organization.name,
    groupKey: organization.slug,
    tags: uniqueSorted([
      ...(profile?.specialties ?? []),
      ...(profile?.statesCovered ?? []),
    ]),
    metadata: {
      organizationId: organization.id,
      slug: organization.slug,
      verified: profile?.verified ?? false,
    },
    sourceRefs: uniqueSorted([organization.id, profile?.id ?? '']),
    sourceUpdatedAt: profile?.updatedAt ?? organization.updatedAt,
  });
}

async function ensureOrganizationNodeFromEntityId(
  prismaClient: PrismaClient,
  entityId: string,
): Promise<{ id: string } | null> {
  const entity = await prismaClient.vcvEntity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      displayName: true,
      metadata: true,
      updatedAt: true,
    },
  });

  if (!entity) {
    return null;
  }

  const metadata = asRecord(entity.metadata);
  return upsertMirrorNode(prismaClient, {
    type: 'organization',
    sourceKind: 'vcv_entity',
    sourceId: entity.id,
    label: entity.displayName,
    title: entity.displayName,
    groupKey: slugify(entity.displayName),
    metadata: {
      entityId: entity.id,
      ...metadata,
    },
    sourceRefs: [entity.id],
    sourceUpdatedAt: entity.updatedAt,
  });
}

async function ensureOrganizationNodeFromLabel(
  prismaClient: PrismaClient,
  label: string,
  metadata: JsonRecord = {},
): Promise<{ id: string }> {
  return upsertMirrorNode(prismaClient, {
    type: 'organization',
    sourceKind: 'employer_ref',
    sourceId: slugify(label),
    label,
    title: label,
    groupKey: slugify(label),
    metadata,
    sourceRefs: [],
    sourceUpdatedAt: new Date(),
  });
}

async function ensureSourceNode(
  prismaClient: PrismaClient,
  sourceId: string,
): Promise<{ id: string }> {
  return upsertMirrorNode(prismaClient, {
    type: 'source',
    sourceKind: 'source',
    sourceId,
    label: sourceId,
    title: sourceId,
    groupKey: sourceId,
    metadata: { sourceId },
    sourceRefs: [sourceId],
    sourceUpdatedAt: new Date(),
  });
}

async function findSnapshotNodeForNpi(
  prismaClient: PrismaClient,
  npi: string,
): Promise<{ id: string } | null> {
  const state = await prismaClient.providerDecisionState.findUnique({
    where: { npi },
    select: { id: true },
  });

  if (!state) {
    return null;
  }

  return prismaClient.graphNode.findUnique({
    where: {
      id: createGraphNodeId({
        type: 'snapshot',
        sourceKind: 'provider_decision_state',
        sourceId: npi,
      }),
    },
    select: { id: true },
  });
}

export async function syncOrganizationNode(
  organizationId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  await ensureOrganizationNodeFromOrganizationId(prismaClient, organizationId);
}

export async function syncOpportunityNode(
  opportunityId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const opportunity = await prismaClient.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      specialty: true,
      state: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!opportunity) {
    return;
  }

  const programNode = await upsertMirrorNode(prismaClient, {
    type: 'program',
    sourceKind: 'opportunity',
    sourceId: opportunity.id,
    label: opportunity.title,
    title: opportunity.title,
    groupKey: opportunity.specialty,
    tags: uniqueSorted([opportunity.specialty, opportunity.state, opportunity.status]),
    metadata: {
      opportunityId: opportunity.id,
      organizationId: opportunity.organizationId,
      specialty: opportunity.specialty,
      state: opportunity.state,
      status: opportunity.status,
    },
    sourceRefs: [opportunity.id],
    sourceUpdatedAt: opportunity.updatedAt,
  });

  const edgeIds: string[] = [];
  const organizationNode = await ensureOrganizationNodeFromOrganizationId(prismaClient, opportunity.organizationId);
  if (organizationNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: programNode.id,
      targetNodeId: organizationNode.id,
      edgeType: 'child_of',
      directed: true,
      confidence: 1,
      provenance: { opportunityId: opportunity.id, organizationId: opportunity.organizationId },
      explanation: 'Opportunity belongs to employer organization',
      materialHash: sha256ForPayload({
        opportunityId: opportunity.id,
        organizationId: opportunity.organizationId,
      }),
    });
    edgeIds.push(edge.id);
  }

  await supersedeEdgesFromSourceNode(prismaClient, programNode.id, edgeIds);
}

export async function syncVerificationArtifact(
  artifactId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const artifact = await prismaClient.verificationArtifact.findUnique({
    where: { id: artifactId },
    select: {
      id: true,
      npi: true,
      source: true,
      artifactType: true,
      status: true,
      lifecycleState: true,
      trustTier: true,
      confidenceScore: true,
      checksum: true,
      statusLastChecked: true,
      rawPayload: true,
    },
  });

  if (!artifact) {
    return;
  }

  const payload = asRecord(artifact.rawPayload);
  const artifactNode = await upsertMirrorNode(prismaClient, {
    type: 'artifact',
    sourceKind: 'verification_artifact',
    sourceId: artifact.id,
    label:
      asString(payload.credentialType)
      ?? asString(payload.licenseType)
      ?? `${artifact.source} ${artifact.artifactType}`.trim(),
    title: `${artifact.source} ${artifact.artifactType}`.trim(),
    groupKey: artifact.source,
    tags: uniqueSorted([
      artifact.source,
      artifact.artifactType,
      artifact.trustTier ?? '',
    ]),
    metadata: {
      artifactId: artifact.id,
      npi: artifact.npi,
      source: artifact.source,
      artifactType: artifact.artifactType,
      status: artifact.status,
      lifecycleState: artifact.lifecycleState,
      trustTier: artifact.trustTier,
      confidenceScore: artifact.confidenceScore,
    },
    sourceRefs: [artifact.id],
    sourceChecksum: artifact.checksum,
    sourceUpdatedAt: artifact.statusLastChecked,
  });

  const edgeIds: string[] = [];
  const clinicianNode = await ensureClinicianNode(prismaClient, { npi: artifact.npi });
  if (clinicianNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: artifactNode.id,
      targetNodeId: clinicianNode.id,
      edgeType: 'verifies',
      directed: true,
      confidence: artifact.confidenceScore ?? 0.8,
      provenance: { artifactId: artifact.id, npi: artifact.npi },
      explanation: 'Artifact verifies clinician subject',
      materialHash: artifact.checksum,
    });
    edgeIds.push(edge.id);
  }

  const sourceNode = await ensureSourceNode(prismaClient, artifact.source);
  const sourceEdge = await upsertMirrorEdge(prismaClient, {
    sourceNodeId: artifactNode.id,
    targetNodeId: sourceNode.id,
    edgeType: 'verified_by',
    directed: true,
    confidence: artifact.confidenceScore ?? 0.8,
    provenance: { artifactId: artifact.id, sourceId: artifact.source },
    explanation: 'Artifact linked to authoritative source',
    materialHash: artifact.checksum,
  });
  edgeIds.push(sourceEdge.id);

  await supersedeEdgesFromSourceNode(prismaClient, artifactNode.id, edgeIds);
}

export async function syncClaimRecord(
  claimRecordId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const claim = await prismaClient.claimRecord.findUnique({
    where: { id: claimRecordId },
    select: {
      id: true,
      claimId: true,
      subjectNpi: true,
      claimType: true,
      sourceId: true,
      confidenceScore: true,
      verificationArtifactId: true,
      observedAt: true,
      value: true,
    },
  });

  if (!claim) {
    return;
  }

  const claimValue = asRecord(claim.value);
  const claimNode = await upsertMirrorNode(prismaClient, {
    type: 'claim',
    sourceKind: 'claim_record',
    sourceId: claim.id,
    label: claim.claimType,
    title: claim.claimType,
    groupKey: claim.claimType,
    tags: uniqueSorted([claim.claimType, claim.sourceId]),
    metadata: {
      claimId: claim.claimId,
      subjectNpi: claim.subjectNpi,
      sourceId: claim.sourceId,
      confidenceScore: claim.confidenceScore,
      value: claimValue,
    },
    sourceRefs: [claim.id],
    sourceChecksum: sha256ForPayload({
      claimId: claim.claimId,
      value: claimValue,
    }),
    sourceUpdatedAt: claim.observedAt,
  });

  const edgeIds: string[] = [];
  const clinicianNode = await ensureClinicianNode(prismaClient, { npi: claim.subjectNpi });
  if (clinicianNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: claimNode.id,
      targetNodeId: clinicianNode.id,
      edgeType: 'references',
      directed: true,
      confidence: claim.confidenceScore,
      provenance: { claimRecordId: claim.id, subjectNpi: claim.subjectNpi },
      explanation: 'Claim references clinician subject',
      materialHash: sha256ForPayload({ claimId: claim.claimId, subjectNpi: claim.subjectNpi }),
    });
    edgeIds.push(edge.id);
  }

  if (claim.verificationArtifactId) {
    await syncVerificationArtifact(claim.verificationArtifactId, prismaClient);
    const artifactNode = await upsertMirrorNode(prismaClient, {
      type: 'artifact',
      sourceKind: 'verification_artifact',
      sourceId: claim.verificationArtifactId,
      label: 'Verification Artifact',
      metadata: { artifactId: claim.verificationArtifactId },
    });
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: claimNode.id,
      targetNodeId: artifactNode.id,
      edgeType: 'derived_from',
      directed: true,
      confidence: claim.confidenceScore,
      provenance: { claimRecordId: claim.id, verificationArtifactId: claim.verificationArtifactId },
      explanation: 'Claim derived from verification artifact',
      materialHash: sha256ForPayload({
        claimRecordId: claim.id,
        verificationArtifactId: claim.verificationArtifactId,
      }),
    });
    edgeIds.push(edge.id);
  }

  const sourceNode = await ensureSourceNode(prismaClient, claim.sourceId);
  const sourceEdge = await upsertMirrorEdge(prismaClient, {
    sourceNodeId: claimNode.id,
    targetNodeId: sourceNode.id,
    edgeType: 'sourced_from',
    directed: true,
    confidence: claim.confidenceScore,
    provenance: { claimRecordId: claim.id, sourceId: claim.sourceId },
    explanation: 'Claim sourced from upstream authority',
    materialHash: sha256ForPayload({ claimRecordId: claim.id, sourceId: claim.sourceId }),
  });
  edgeIds.push(sourceEdge.id);

  await supersedeEdgesFromSourceNode(prismaClient, claimNode.id, edgeIds);
}

export async function syncProviderDecisionSnapshot(
  npi: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const state = await prismaClient.providerDecisionState.findUnique({
    where: { npi },
    select: {
      id: true,
      npi: true,
      decisionClass: true,
      aggregateConfidence: true,
      methodologyVersion: true,
      evaluatedAt: true,
      expiresAt: true,
      explanation: true,
      claimIds: true,
      conflicts: true,
    },
  });

  if (!state) {
    return;
  }

  const snapshotNode = await upsertMirrorNode(prismaClient, {
    type: 'snapshot',
    sourceKind: 'provider_decision_state',
    sourceId: npi,
    label: state.decisionClass,
    title: `${state.decisionClass} snapshot`,
    groupKey: `snapshot:${npi}`,
    tags: uniqueSorted([state.decisionClass, state.methodologyVersion]),
    metadata: {
      npi,
      stateId: state.id,
      decisionClass: state.decisionClass,
      aggregateConfidence: state.aggregateConfidence,
      methodologyVersion: state.methodologyVersion,
      expiresAt: state.expiresAt.toISOString(),
      explanation: state.explanation,
      conflicts: state.conflicts,
    },
    sourceRefs: [state.id],
    sourceChecksum: sha256ForPayload({
      id: state.id,
      decisionClass: state.decisionClass,
      conflicts: state.conflicts,
      claimIds: state.claimIds,
    }),
    sourceUpdatedAt: state.evaluatedAt,
  });

  const edgeIds: string[] = [];
  const clinicianNode = await ensureClinicianNode(prismaClient, { npi });
  if (clinicianNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: snapshotNode.id,
      targetNodeId: clinicianNode.id,
      edgeType: 'references',
      directed: true,
      confidence: state.aggregateConfidence,
      provenance: { npi, stateId: state.id },
      explanation: 'Snapshot references clinician state',
      materialHash: sha256ForPayload({ stateId: state.id, npi }),
    });
    edgeIds.push(edge.id);
  }

  const claimIds = asStringArray(state.claimIds);
  if (claimIds.length > 0) {
    const claims = await prismaClient.claimRecord.findMany({
      where: {
        subjectNpi: npi,
        claimId: { in: claimIds },
      },
      select: { id: true },
    });

    for (const claim of claims) {
      await syncClaimRecord(claim.id, prismaClient);
      const claimNode = await upsertMirrorNode(prismaClient, {
        type: 'claim',
        sourceKind: 'claim_record',
        sourceId: claim.id,
        label: claim.id,
        metadata: { claimRecordId: claim.id },
      });
      const edge = await upsertMirrorEdge(prismaClient, {
        sourceNodeId: snapshotNode.id,
        targetNodeId: claimNode.id,
        edgeType: 'depends_on',
        directed: true,
        confidence: state.aggregateConfidence,
        provenance: { stateId: state.id, claimRecordId: claim.id },
        explanation: 'Snapshot depends on claim evidence',
        materialHash: sha256ForPayload({ stateId: state.id, claimRecordId: claim.id }),
      });
      edgeIds.push(edge.id);
    }
  }

  await supersedeEdgesFromSourceNode(prismaClient, snapshotNode.id, edgeIds);
  await syncDivergencesForNpi(npi, prismaClient, snapshotNode.id, clinicianNode?.id ?? null);
}

export async function syncDivergencesForNpi(
  npi: string,
  prismaClient: PrismaClient,
  snapshotNodeId?: string | null,
  clinicianNodeId?: string | null,
): Promise<void> {
  const clinicianNode = clinicianNodeId
    ? { id: clinicianNodeId }
    : await ensureClinicianNode(prismaClient, { npi });

  const rows = await prismaClient.anomalyHistory.findMany({
    where: {
      subjectType: 'NPI',
      subjectId: npi,
      anomalyKey: { startsWith: 'div_' },
      status: { not: 'RESOLVED' },
    },
    select: {
      id: true,
      anomalyKey: true,
      severity: true,
      status: true,
      sourceIds: true,
      confidence: true,
      metadata: true,
      lastDetectedAt: true,
      resolvedAt: true,
    },
  });

  const keepNodeIds: string[] = [];
  for (const row of rows) {
    const metadata = asRecord(row.metadata);
    const divergenceNode = await upsertMirrorNode(prismaClient, {
      type: 'divergence',
      sourceKind: 'divergence',
      sourceId: row.anomalyKey,
      label: asString(metadata.description) ?? row.anomalyKey,
      title: asString(metadata.description) ?? row.anomalyKey,
      groupKey: `divergence:${npi}`,
      tags: uniqueSorted([row.severity, ...row.sourceIds]),
      metadata: {
        anomalyHistoryId: row.id,
        npi,
        severity: row.severity,
        status: row.status,
        sourceIds: row.sourceIds,
        confidence: row.confidence,
        ...metadata,
      },
      sourceRefs: [row.id],
      sourceChecksum: sha256ForPayload({
        anomalyKey: row.anomalyKey,
        status: row.status,
        sourceIds: row.sourceIds,
        metadata: row.metadata,
      }),
      sourceUpdatedAt: row.lastDetectedAt,
    });
    keepNodeIds.push(divergenceNode.id);

    const edgeIds: string[] = [];
    if (clinicianNode) {
      const edge = await upsertMirrorEdge(prismaClient, {
        sourceNodeId: divergenceNode.id,
        targetNodeId: clinicianNode.id,
        edgeType: 'references',
        directed: true,
        confidence: row.confidence,
        provenance: { anomalyKey: row.anomalyKey, npi },
        explanation: 'Divergence references affected clinician',
        materialHash: sha256ForPayload({ anomalyKey: row.anomalyKey, npi }),
      });
      edgeIds.push(edge.id);
    }

    if (snapshotNodeId) {
      const edge = await upsertMirrorEdge(prismaClient, {
        sourceNodeId: divergenceNode.id,
        targetNodeId: snapshotNodeId,
        edgeType: 'depends_on',
        directed: true,
        confidence: row.confidence,
        provenance: { anomalyKey: row.anomalyKey, snapshotNodeId },
        explanation: 'Divergence attached to latest provider decision snapshot',
        materialHash: sha256ForPayload({ anomalyKey: row.anomalyKey, snapshotNodeId }),
      });
      edgeIds.push(edge.id);
    }

    for (const sourceId of row.sourceIds) {
      const sourceNode = await ensureSourceNode(prismaClient, sourceId);
      const edge = await upsertMirrorEdge(prismaClient, {
        sourceNodeId: divergenceNode.id,
        targetNodeId: sourceNode.id,
        edgeType: 'sourced_from',
        directed: true,
        confidence: row.confidence,
        provenance: { anomalyKey: row.anomalyKey, sourceId },
        explanation: 'Divergence sourced from conflicting authority',
        materialHash: sha256ForPayload({ anomalyKey: row.anomalyKey, sourceId }),
      });
      edgeIds.push(edge.id);
    }

    await supersedeEdgesFromSourceNode(prismaClient, divergenceNode.id, edgeIds);
  }

  await deactivateMirrorNodes(prismaClient, {
    type: 'divergence',
    groupKey: `divergence:${npi}`,
    keepNodeIds,
  });
}

export async function syncDecisionCapsule(
  capsuleId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const capsule = await prismaClient.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: {
      id: true,
      subjectDid: true,
      subjectNpi: true,
      decisionType: true,
      status: true,
      credentialIds: true,
      issuerIds: true,
      metadata: true,
      decisionTimestamp: true,
      updatedAt: true,
    },
  });

  if (!capsule) {
    return;
  }

  const metadata = asRecord(capsule.metadata);
  const decisionNode = await upsertMirrorNode(prismaClient, {
    type: 'decision',
    sourceKind: 'decision_capsule',
    sourceId: capsule.id,
    label: `${capsule.decisionType} ${capsule.status}`,
    title: `${capsule.decisionType} ${capsule.status}`,
    groupKey: capsule.decisionType,
    tags: uniqueSorted([capsule.decisionType, capsule.status]),
    metadata: {
      capsuleId: capsule.id,
      subjectDid: capsule.subjectDid,
      subjectNpi: capsule.subjectNpi,
      decisionType: capsule.decisionType,
      status: capsule.status,
      issuerIds: capsule.issuerIds,
      metadata,
    },
    sourceRefs: [capsule.id, ...capsule.credentialIds],
    sourceChecksum: sha256ForPayload({
      id: capsule.id,
      status: capsule.status,
      metadata: capsule.metadata,
      credentialIds: capsule.credentialIds,
    }),
    sourceUpdatedAt: capsule.updatedAt,
  });

  const edgeIds: string[] = [];
  const clinicianNode = await ensureClinicianNode(prismaClient, { npi: capsule.subjectNpi });
  if (clinicianNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: clinicianNode.id,
      edgeType: 'references',
      directed: true,
      confidence: 1,
      provenance: { capsuleId: capsule.id, subjectNpi: capsule.subjectNpi },
      explanation: 'Decision capsule references clinician subject',
      materialHash: sha256ForPayload({ capsuleId: capsule.id, subjectNpi: capsule.subjectNpi }),
    });
    edgeIds.push(edge.id);
  }

  for (const credentialId of capsule.credentialIds) {
    await syncVerificationArtifact(credentialId, prismaClient);
    const artifactNode = await upsertMirrorNode(prismaClient, {
      type: 'artifact',
      sourceKind: 'verification_artifact',
      sourceId: credentialId,
      label: 'Verification Artifact',
      metadata: { artifactId: credentialId },
    });
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: artifactNode.id,
      edgeType: 'depends_on',
      directed: true,
      confidence: 1,
      provenance: { capsuleId: capsule.id, credentialId },
      explanation: 'Decision capsule depends on credential evidence',
      materialHash: sha256ForPayload({ capsuleId: capsule.id, credentialId }),
    });
    edgeIds.push(edge.id);
  }

  const organizationId = asString(metadata.organizationId);
  const organizationName =
    asString(metadata.organizationName)
    ?? asString(metadata.employerId)
    ?? asString(metadata.verifierOrgId);
  const opportunityId = asString(metadata.opportunityId);

  if (organizationId) {
    const organizationNode = await ensureOrganizationNodeFromOrganizationId(prismaClient, organizationId);
    if (organizationNode) {
      const edge = await upsertMirrorEdge(prismaClient, {
        sourceNodeId: decisionNode.id,
        targetNodeId: organizationNode.id,
        edgeType: 'related_to',
        directed: true,
        confidence: 0.9,
        provenance: { capsuleId: capsule.id, organizationId },
        explanation: 'Decision capsule references employer organization',
        materialHash: sha256ForPayload({ capsuleId: capsule.id, organizationId }),
      });
      edgeIds.push(edge.id);
    }
  } else if (organizationName) {
    const organizationNode = await ensureOrganizationNodeFromLabel(prismaClient, organizationName, {
      organizationName,
    });
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: organizationNode.id,
      edgeType: 'related_to',
      directed: true,
      confidence: 0.8,
      provenance: { capsuleId: capsule.id, organizationName },
      explanation: 'Decision capsule references employer organization',
      materialHash: sha256ForPayload({ capsuleId: capsule.id, organizationName }),
    });
    edgeIds.push(edge.id);
  }

  if (opportunityId) {
    await syncOpportunityNode(opportunityId, prismaClient);
    const programNode = await upsertMirrorNode(prismaClient, {
      type: 'program',
      sourceKind: 'opportunity',
      sourceId: opportunityId,
      label: opportunityId,
      metadata: { opportunityId },
    });
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: programNode.id,
      edgeType: 'related_to',
      directed: true,
      confidence: 0.8,
      provenance: { capsuleId: capsule.id, opportunityId },
      explanation: 'Decision capsule tied to job opportunity',
      materialHash: sha256ForPayload({ capsuleId: capsule.id, opportunityId }),
    });
    edgeIds.push(edge.id);
  }

  const snapshotNode = await findSnapshotNodeForNpi(prismaClient, capsule.subjectNpi);

  if (snapshotNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: snapshotNode.id,
      edgeType: 'depends_on',
      directed: true,
      confidence: 0.75,
      provenance: { capsuleId: capsule.id, snapshotNpi: capsule.subjectNpi },
      explanation: 'Decision capsule anchored to latest provider decision snapshot',
      materialHash: sha256ForPayload({ capsuleId: capsule.id, snapshotNpi: capsule.subjectNpi }),
    });
    edgeIds.push(edge.id);
  }

  await supersedeEdgesFromSourceNode(prismaClient, decisionNode.id, edgeIds);
}

export async function syncEmployerDecisionEvent(
  eventId: string,
  prismaClient: PrismaClient,
): Promise<void> {
  const event = await prismaClient.employerDecisionEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      entityId: true,
      organizationContextId: true,
      decision: true,
      decidedAt: true,
      reviewerRole: true,
      readinessScoreAtDecision: true,
      trustSnapshotAtDecision: true,
      metadata: true,
    },
  });

  if (!event) {
    return;
  }

  const entity = await prismaClient.vcvEntity.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      npi: true,
      displayName: true,
    },
  });

  const context = event.organizationContextId
    ? await prismaClient.vcvOrganizationContext.findUnique({
        where: { id: event.organizationContextId },
        select: {
          id: true,
          requestorId: true,
          title: true,
          externalRefId: true,
          metadata: true,
        },
      })
    : null;

  const eventMetadata = asRecord(event.metadata);
  const decisionNode = await upsertMirrorNode(prismaClient, {
    type: 'decision',
    sourceKind: 'employer_decision_event',
    sourceId: event.id,
    label: `Employer ${event.decision}`,
    title: `Employer ${event.decision}`,
    groupKey: 'employer_decision',
    tags: uniqueSorted([event.decision, event.reviewerRole]),
    metadata: {
      eventId: event.id,
      entityId: event.entityId,
      organizationContextId: event.organizationContextId,
      decision: event.decision,
      reviewerRole: event.reviewerRole,
      readinessScoreAtDecision: event.readinessScoreAtDecision,
      trustSnapshotAtDecision: event.trustSnapshotAtDecision,
      metadata: event.metadata,
    },
    sourceRefs: uniqueSorted([event.id, event.entityId, event.organizationContextId ?? '']),
    sourceChecksum: sha256ForPayload({
      id: event.id,
      decision: event.decision,
      trustSnapshotAtDecision: event.trustSnapshotAtDecision,
    }),
    sourceUpdatedAt: event.decidedAt,
  });

  const edgeIds: string[] = [];
  const clinicianNode = await ensureClinicianNode(prismaClient, {
    npi: entity?.npi ?? null,
    entityId: entity?.id ?? event.entityId,
    displayName: entity?.displayName ?? null,
  });
  if (clinicianNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: clinicianNode.id,
      edgeType: 'references',
      directed: true,
      confidence: 0.9,
      provenance: { employerDecisionEventId: event.id, entityId: event.entityId },
      explanation: 'Employer decision event references clinician subject',
      materialHash: sha256ForPayload({ employerDecisionEventId: event.id, entityId: event.entityId }),
    });
    edgeIds.push(edge.id);
  }

  const requestorId = context?.requestorId ?? asString(eventMetadata.requestorId);
  const organizationNode =
    (requestorId ? await ensureOrganizationNodeFromEntityId(prismaClient, requestorId) : null)
    ?? (asString(eventMetadata.organizationId)
      ? await ensureOrganizationNodeFromOrganizationId(prismaClient, asString(eventMetadata.organizationId)!)
      : null)
    ?? (asString(eventMetadata.organizationName)
      ? await ensureOrganizationNodeFromLabel(prismaClient, asString(eventMetadata.organizationName)!)
      : null);

  if (organizationNode) {
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: organizationNode.id,
      edgeType: 'related_to',
      directed: true,
      confidence: 0.85,
      provenance: {
        employerDecisionEventId: event.id,
        organizationContextId: event.organizationContextId,
        requestorId,
      },
      explanation: 'Employer decision event tied to requesting organization',
      materialHash: sha256ForPayload({ employerDecisionEventId: event.id, requestorId }),
    });
    edgeIds.push(edge.id);
  }

  const subjectNpi = entity?.npi ?? null;
  if (looksLikeNpi(subjectNpi)) {
    await syncProviderDecisionSnapshot(subjectNpi, prismaClient);
    const snapshotNode = await findSnapshotNodeForNpi(prismaClient, subjectNpi);
    if (!snapshotNode) {
      await supersedeEdgesFromSourceNode(prismaClient, decisionNode.id, edgeIds);
      return;
    }
    const edge = await upsertMirrorEdge(prismaClient, {
      sourceNodeId: decisionNode.id,
      targetNodeId: snapshotNode.id,
      edgeType: 'depends_on',
      directed: true,
      confidence: 0.75,
      provenance: { employerDecisionEventId: event.id, subjectNpi },
      explanation: 'Employer decision event anchored to latest provider decision snapshot',
      materialHash: sha256ForPayload({ employerDecisionEventId: event.id, subjectNpi }),
    });
    edgeIds.push(edge.id);
  }

  await supersedeEdgesFromSourceNode(prismaClient, decisionNode.id, edgeIds);
}

export async function syncTrustGraphForPrismaWrite(
  prismaClient: PrismaClient,
  input: {
    model: string;
    action: string;
    record: Record<string, unknown>;
  },
): Promise<void> {
  const model = input.model.toLowerCase();
  const id = asString(input.record.id);
  switch (model) {
    case 'organization':
      if (id) await syncOrganizationNode(id, prismaClient);
      break;
    case 'opportunity':
      if (id) await syncOpportunityNode(id, prismaClient);
      break;
    case 'verificationartifact':
      if (id) await syncVerificationArtifact(id, prismaClient);
      break;
    case 'claimrecord':
      if (id) await syncClaimRecord(id, prismaClient);
      break;
    case 'providerdecisionstate': {
      const npi = asString(input.record.npi);
      if (npi) await syncProviderDecisionSnapshot(npi, prismaClient);
      break;
    }
    case 'decisioncapsule':
      if (id) await syncDecisionCapsule(id, prismaClient);
      break;
    case 'employerdecisionevent':
      if (id) await syncEmployerDecisionEvent(id, prismaClient);
      break;
    case 'anomalyhistory': {
      const subjectType = asString(input.record.subjectType);
      const subjectId = asString(input.record.subjectId);
      const anomalyKey = asString(input.record.anomalyKey);
      if (subjectType === 'NPI' && subjectId && anomalyKey?.startsWith('div_')) {
        await syncDivergencesForNpi(subjectId, prismaClient);
      }
      break;
    }
    default:
      break;
  }
}
