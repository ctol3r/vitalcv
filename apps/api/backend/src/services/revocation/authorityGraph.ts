import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

export interface DependentDecisionCapsule {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  status: string;
  metadata: Record<string, unknown>;
}

type VerificationArtifactNode = {
  id: string;
  npi: string;
  source: string;
  status: string;
  organizationId: string | null;
};

type DecisionCapsuleNode = {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  status: string;
  metadata: unknown;
  credentialIds: string[];
};

function toJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

async function upsertKnowledgeNode(params: {
  entityType: string;
  entityId: string;
  label: string;
  attributes: Record<string, unknown>;
}): Promise<{ id: string; entityType: string; entityId: string }> {
  return prisma.knowledgeNode.upsert({
    where: {
      entityType_entityId: {
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
    create: {
      entityType: params.entityType,
      entityId: params.entityId,
      label: params.label,
      attributes: params.attributes as Prisma.InputJsonValue,
    },
    update: {
      label: params.label,
      attributes: params.attributes as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
    },
  });
}

async function ensureDependsOnEdge(
  decisionNodeId: string,
  credentialNodeId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const existingEdge = await prisma.authorityEdge.findFirst({
    where: {
      sourceNodeId: decisionNodeId,
      targetNodeId: credentialNodeId,
      relationType: 'DEPENDS_ON',
    },
    select: { id: true },
  });

  if (existingEdge) {
    return;
  }

  await prisma.authorityEdge.create({
    data: {
      sourceNodeId: decisionNodeId,
      targetNodeId: credentialNodeId,
      relationType: 'DEPENDS_ON',
      weight: 1.0,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}

async function getVerificationArtifact(credentialId: string): Promise<VerificationArtifactNode> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: credentialId },
    select: {
      id: true,
      npi: true,
      source: true,
      status: true,
      organizationId: true,
    },
  });

  if (!artifact) {
    throw new Error(`VerificationArtifact ${credentialId} not found.`);
  }

  return artifact;
}

async function getDecisionCapsule(capsuleId: string): Promise<DecisionCapsuleNode> {
  const capsule = await prisma.decisionCapsule.findUnique({
    where: { id: capsuleId },
    select: {
      id: true,
      subjectDid: true,
      subjectNpi: true,
      decisionType: true,
      status: true,
      metadata: true,
      credentialIds: true,
    },
  });

  if (!capsule) {
    throw new Error(`DecisionCapsule ${capsuleId} not found.`);
  }

  return capsule;
}

export async function ensureDecisionCapsuleAuthorityGraph(capsuleId: string): Promise<void> {
  const capsule = await getDecisionCapsule(capsuleId);
  const decisionNode = await upsertKnowledgeNode({
    entityType: 'DECISION_CAPSULE',
    entityId: capsule.id,
    label: `${capsule.decisionType} Decision Capsule`,
    attributes: {
      subjectDid: capsule.subjectDid,
      subjectNpi: capsule.subjectNpi,
      status: capsule.status,
    },
  });

  for (const credentialId of capsule.credentialIds) {
    const artifact = await getVerificationArtifact(credentialId);
    const credentialNode = await upsertKnowledgeNode({
      entityType: 'CREDENTIAL',
      entityId: artifact.id,
      label: `${artifact.source} Credential`,
      attributes: {
        npi: artifact.npi,
        source: artifact.source,
        status: artifact.status,
        organizationId: artifact.organizationId,
      },
    });

    await ensureDependsOnEdge(decisionNode.id, credentialNode.id, {
      capsuleId: capsule.id,
      credentialId: artifact.id,
      subjectNpi: capsule.subjectNpi,
      decisionType: capsule.decisionType,
    });
  }
}

export async function ensureCredentialDecisionAuthorityGraph(
  credentialId: string,
): Promise<{ credentialNodeId: string }> {
  const artifact = await getVerificationArtifact(credentialId);
  const credentialNode = await upsertKnowledgeNode({
    entityType: 'CREDENTIAL',
    entityId: artifact.id,
    label: `${artifact.source} Credential`,
    attributes: {
      npi: artifact.npi,
      source: artifact.source,
      status: artifact.status,
      organizationId: artifact.organizationId,
    },
  });

  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      credentialIds: { has: credentialId },
    },
    select: {
      id: true,
      subjectDid: true,
      subjectNpi: true,
      decisionType: true,
      status: true,
    },
  });

  for (const capsule of capsules) {
    const decisionNode = await upsertKnowledgeNode({
      entityType: 'DECISION_CAPSULE',
      entityId: capsule.id,
      label: `${capsule.decisionType} Decision Capsule`,
      attributes: {
        subjectDid: capsule.subjectDid,
        subjectNpi: capsule.subjectNpi,
        status: capsule.status,
      },
    });

    await ensureDependsOnEdge(decisionNode.id, credentialNode.id, {
      capsuleId: capsule.id,
      credentialId,
      subjectNpi: capsule.subjectNpi,
      decisionType: capsule.decisionType,
    });
  }

  return { credentialNodeId: credentialNode.id };
}

export async function findDecisionCapsulesByCredential(
  credentialId: string,
): Promise<DependentDecisionCapsule[]> {
  const { credentialNodeId } = await ensureCredentialDecisionAuthorityGraph(credentialId);

  const dependencyEdges = await prisma.authorityEdge.findMany({
    where: {
      targetNodeId: credentialNodeId,
      relationType: 'DEPENDS_ON',
    },
    include: {
      source: true,
    },
  });

  const capsuleIds = dependencyEdges
    .filter((edge) => edge.source.entityType === 'DECISION_CAPSULE')
    .map((edge) => edge.source.entityId);

  if (capsuleIds.length === 0) {
    return [];
  }

  const capsules = await prisma.decisionCapsule.findMany({
    where: {
      id: { in: capsuleIds },
    },
    orderBy: [
      { decisionTimestamp: 'desc' },
      { id: 'asc' },
    ],
    select: {
      id: true,
      subjectDid: true,
      subjectNpi: true,
      decisionType: true,
      status: true,
      metadata: true,
    },
  });

  return capsules.map((capsule) => ({
    id: capsule.id,
    subjectDid: capsule.subjectDid,
    subjectNpi: capsule.subjectNpi,
    decisionType: capsule.decisionType,
    status: capsule.status,
    metadata: toJsonRecord(capsule.metadata),
  }));
}
