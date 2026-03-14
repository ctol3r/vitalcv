import type { Prisma } from '@prisma/client';
import prisma from '../src/graphql/prisma_client';

export type DecisionTriggerEvent =
  | 'verifier_decision'
  | 'start_attestation'
  | 'employment_acceptance'
  | 'privilege_recommendation';

export interface DecisionCapsuleRepositoryRecord {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: string;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  status: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDecisionCapsuleInput {
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionAction?: string | null;
  decisionTimestamp: Date;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  metadata?: Record<string, unknown>;
  triggerEvent: DecisionTriggerEvent;
  sourceReferenceId: string;
  status?: string;
}

export interface CreateDecisionCapsuleResult {
  capsule: DecisionCapsuleRepositoryRecord;
  idempotent: boolean;
}

export interface CreateAuthorityEdgesInput {
  capsuleId: string;
  subjectDid: string;
  subjectNpi: string;
  verifierOrgId?: string | null;
  decisionType: string;
  decisionAction?: string | null;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodologyVersion: string;
  decisionTimestamp: string;
  triggerEvent: DecisionTriggerEvent;
}

type DecisionCapsuleRow = {
  id: string;
  subjectDid: string;
  subjectNpi: string;
  decisionType: string;
  decisionTimestamp: Date;
  credentialIds: string[];
  issuerIds: string[];
  artifactHash: string;
  methodology: string;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeIdList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => (
    left.localeCompare(right)
  ));
}

function cloneMetadata(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ? JSON.parse(JSON.stringify(value)) as Record<string, unknown> : {};
}

function buildCapsuleMetadata(input: CreateDecisionCapsuleInput): Record<string, unknown> {
  return {
    ...cloneMetadata(input.metadata),
    triggerEvent: input.triggerEvent,
    sourceReferenceId: input.sourceReferenceId,
    ...(input.decisionAction ? { decisionAction: input.decisionAction } : {}),
  };
}

function mapCapsule(row: DecisionCapsuleRow): DecisionCapsuleRepositoryRecord {
  return {
    id: row.id,
    subjectDid: row.subjectDid,
    subjectNpi: row.subjectNpi,
    decisionType: row.decisionType,
    decisionTimestamp: row.decisionTimestamp.toISOString(),
    credentialIds: row.credentialIds,
    issuerIds: row.issuerIds,
    artifactHash: row.artifactHash,
    methodology: row.methodology,
    status: row.status,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function findDecisionCapsuleByTriggerSource(
  triggerEvent: DecisionTriggerEvent,
  sourceReferenceId: string,
  decisionAction?: string | null,
): Promise<DecisionCapsuleRepositoryRecord | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM "DecisionCapsule"
    WHERE metadata->>'triggerEvent' = ${triggerEvent}
      AND metadata->>'sourceReferenceId' = ${sourceReferenceId}
      AND COALESCE(metadata->>'decisionAction', '') = ${decisionAction ?? ''}
    ORDER BY "decisionTimestamp" DESC
    LIMIT 1
  `;

  const capsuleId = rows[0]?.id;
  if (!capsuleId) {
    return null;
  }

  return findDecisionCapsuleById(capsuleId);
}

export async function createDecisionCapsule(
  input: CreateDecisionCapsuleInput,
): Promise<CreateDecisionCapsuleResult> {
  const existing = await findDecisionCapsuleByTriggerSource(
    input.triggerEvent,
    input.sourceReferenceId,
    input.decisionAction,
  );
  if (existing) {
    return { capsule: existing, idempotent: true };
  }

  const capsule = await prisma.decisionCapsule.create({
    data: {
      subjectDid: input.subjectDid,
      subjectNpi: input.subjectNpi,
      decisionType: input.decisionType,
      decisionTimestamp: input.decisionTimestamp,
      credentialIds: normalizeIdList(input.credentialIds),
      issuerIds: normalizeIdList(input.issuerIds),
      artifactHash: input.artifactHash,
      methodology: input.methodology,
      status: input.status ?? 'VALID',
      metadata: buildCapsuleMetadata(input) as Prisma.InputJsonValue,
    },
  });

  return { capsule: mapCapsule(capsule), idempotent: false };
}

export async function findDecisionCapsulesByNpi(
  subjectNpi: string,
): Promise<DecisionCapsuleRepositoryRecord[]> {
  const rows = await prisma.decisionCapsule.findMany({
    where: { subjectNpi },
    orderBy: { decisionTimestamp: 'desc' },
  });

  return rows.map(mapCapsule);
}

export async function findDecisionCapsuleById(
  id: string,
): Promise<DecisionCapsuleRepositoryRecord | null> {
  const row = await prisma.decisionCapsule.findUnique({ where: { id } });
  return row ? mapCapsule(row) : null;
}

type KnowledgeNodeInput = {
  entityType: string;
  entityId: string;
  label: string;
  attributes?: Record<string, unknown>;
};

async function ensureKnowledgeNode(input: KnowledgeNodeInput): Promise<{ id: string }> {
  return prisma.knowledgeNode.upsert({
    where: {
      entityType_entityId: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    create: {
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label,
      attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      label: input.label,
      attributes: (input.attributes ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
}

type AuthorityEdgeInput = {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  metadata: Record<string, unknown>;
};

async function ensureAuthorityEdge(input: AuthorityEdgeInput): Promise<void> {
  const existing = await prisma.authorityEdge.findFirst({
    where: {
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relationType: input.relationType,
    },
    select: { id: true },
  });

  if (existing) {
    return;
  }

  await prisma.authorityEdge.create({
    data: {
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      relationType: input.relationType,
      weight: 1.0,
      metadata: cloneMetadata(input.metadata) as Prisma.InputJsonValue,
    },
  });
}

function buildEdgeMetadata(input: CreateAuthorityEdgesInput): Record<string, unknown> {
  return {
    capsuleId: input.capsuleId,
    decisionType: input.decisionType,
    ...(input.decisionAction ? { decisionAction: input.decisionAction } : {}),
    artifactHash: input.artifactHash,
    decisionTimestamp: input.decisionTimestamp,
    methodologyVersion: input.methodologyVersion,
    triggerEvent: input.triggerEvent,
  };
}

export async function createAuthorityEdges(input: CreateAuthorityEdgesInput): Promise<void> {
  const edgeMetadata = buildEdgeMetadata(input);

  const clinicianNode = await ensureKnowledgeNode({
    entityType: 'CLINICIAN',
    entityId: input.subjectNpi,
    label: `Clinician ${input.subjectNpi}`,
    attributes: {
      subjectDid: input.subjectDid,
    },
  });

  const decisionNode = await ensureKnowledgeNode({
    entityType: 'DECISION',
    entityId: input.capsuleId,
    label: `${input.decisionType} (${input.triggerEvent})`,
    attributes: {
      artifactHash: input.artifactHash,
      decisionTimestamp: input.decisionTimestamp,
      methodologyVersion: input.methodologyVersion,
      triggerEvent: input.triggerEvent,
    },
  });

  await ensureAuthorityEdge({
    sourceNodeId: clinicianNode.id,
    targetNodeId: decisionNode.id,
    relationType: 'DECISION_SUBJECT',
    metadata: edgeMetadata,
  });

  for (const credentialId of normalizeIdList(input.credentialIds)) {
    const credentialNode = await ensureKnowledgeNode({
      entityType: 'CREDENTIAL',
      entityId: credentialId,
      label: `Credential ${credentialId.slice(0, 8)}`,
    });

    await ensureAuthorityEdge({
      sourceNodeId: credentialNode.id,
      targetNodeId: decisionNode.id,
      relationType: 'DECISION_EVIDENCE',
      metadata: {
        ...edgeMetadata,
        credentialId,
      },
    });
  }

  for (const issuerId of normalizeIdList(input.issuerIds)) {
    const issuerNode = await ensureKnowledgeNode({
      entityType: 'ISSUER',
      entityId: issuerId,
      label: issuerId,
    });

    await ensureAuthorityEdge({
      sourceNodeId: issuerNode.id,
      targetNodeId: decisionNode.id,
      relationType: 'DECISION_ISSUER',
      metadata: {
        ...edgeMetadata,
        issuerId,
      },
    });
  }

  const verifierOrgId = input.verifierOrgId?.trim();
  if (!verifierOrgId) {
    return;
  }

  const employerNode = await ensureKnowledgeNode({
    entityType: 'EMPLOYER',
    entityId: verifierOrgId,
    label: verifierOrgId,
  });

  await ensureAuthorityEdge({
    sourceNodeId: employerNode.id,
    targetNodeId: decisionNode.id,
    relationType: 'DECISION_EMPLOYER',
    metadata: {
      ...edgeMetadata,
      verifierOrgId,
    },
  });

  const facilityNode = await ensureKnowledgeNode({
    entityType: 'FACILITY',
    entityId: verifierOrgId,
    label: verifierOrgId,
  });

  await ensureAuthorityEdge({
    sourceNodeId: clinicianNode.id,
    targetNodeId: facilityNode.id,
    relationType: 'ACCEPTED_BY',
    metadata: {
      ...edgeMetadata,
      verifierOrgId,
      compatibility: true,
    },
  });
}
