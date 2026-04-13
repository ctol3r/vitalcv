import { Prisma, type PrismaClient } from '@prisma/client';
import { sha256ForPayload } from '../../utils/deterministic';
import {
  createGraphEdgeCanonicalKey,
  createGraphEdgeId,
  createGraphEdgePairKey,
  createGraphNodeCanonicalKey,
  createGraphNodeId,
} from './ids';
import { COLOR_GROUPS, edgeLayer, nodeLayer } from './schema';

type JsonRecord = Record<string, unknown>;

export type MirrorNodeType =
  | 'artifact'
  | 'claim'
  | 'clinician'
  | 'decision'
  | 'divergence'
  | 'organization'
  | 'program'
  | 'snapshot'
  | 'source';

export type MirrorEdgeType =
  | 'child_of'
  | 'depends_on'
  | 'derived_from'
  | 'references'
  | 'related_to'
  | 'sourced_from'
  | 'verified_by'
  | 'verifies';

export type MirrorCreator = 'system' | 'ingest';
export type MirrorStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUPERSEDED';

export interface MirrorNodeSpec {
  type: MirrorNodeType;
  sourceKind: string;
  sourceId: string;
  label: string;
  title?: string | null;
  groupKey?: string | null;
  tags?: string[];
  metadata?: JsonRecord;
  sourceRefs?: string[];
  sourceChecksum?: string | null;
  sourceUpdatedAt?: Date | null;
  active?: boolean;
}

export interface MirrorEdgeSpec {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: MirrorEdgeType;
  directed?: boolean;
  reciprocal?: boolean;
  confidence?: number;
  status?: MirrorStatus;
  createdBy?: MirrorCreator;
  provenance?: JsonRecord;
  explanation?: string;
  materialHash?: string | null;
}

function uniqueSorted(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value) => value.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function colorGroupForNode(type: MirrorNodeType): string {
  const color = (COLOR_GROUPS as Record<string, string>)[type];
  if (color) return color;
  if (type === 'snapshot') return '#38bdf8';
  if (type === 'divergence') return '#ef4444';
  return '#64748b';
}

export function buildMirrorNodeInput(spec: MirrorNodeSpec): Prisma.GraphNodeUncheckedCreateInput {
  const canonicalKey = createGraphNodeCanonicalKey({
    type: spec.type,
    sourceKind: spec.sourceKind,
    sourceId: spec.sourceId,
  });
  const metadata = {
    ...(spec.metadata ?? {}),
    sourceKind: spec.sourceKind,
    sourceId: spec.sourceId,
    layer: nodeLayer(spec.type),
  };

  return {
    id: createGraphNodeId({
      type: spec.type,
      sourceKind: spec.sourceKind,
      sourceId: spec.sourceId,
    }),
    canonicalKey,
    type: spec.type,
    label: spec.label,
    title: spec.title ?? spec.label,
    colorGroup: colorGroupForNode(spec.type),
    groupKey: spec.groupKey ?? spec.type,
    tags: uniqueSorted(spec.tags),
    metadata: toJsonValue(metadata),
    sourceRefs: uniqueSorted(spec.sourceRefs ?? [spec.sourceId]),
    sourceChecksum: spec.sourceChecksum ?? sha256ForPayload(metadata),
    sourceUpdatedAt: spec.sourceUpdatedAt ?? new Date(),
    active: spec.active ?? true,
  };
}

export function buildMirrorEdgeInput(spec: MirrorEdgeSpec): Prisma.GraphEdgeUncheckedCreateInput {
  const directed = spec.directed ?? true;
  const createdBy = spec.createdBy ?? 'system';
  const canonicalKey = createGraphEdgeCanonicalKey({
    sourceNodeId: spec.sourceNodeId,
    targetNodeId: spec.targetNodeId,
    edgeType: spec.edgeType,
    directed,
    createdBy,
    materialHash: spec.materialHash ?? null,
  });
  const provenance = {
    ...(spec.provenance ?? {}),
    layer: edgeLayer(spec.edgeType),
  };

  return {
    id: createGraphEdgeId({
      sourceNodeId: spec.sourceNodeId,
      targetNodeId: spec.targetNodeId,
      edgeType: spec.edgeType,
      directed,
      createdBy,
      materialHash: spec.materialHash ?? null,
    }),
    canonicalKey,
    pairKey: createGraphEdgePairKey({
      sourceNodeId: spec.sourceNodeId,
      targetNodeId: spec.targetNodeId,
      edgeType: spec.edgeType,
      directed,
    }),
    sourceNodeId: spec.sourceNodeId,
    targetNodeId: spec.targetNodeId,
    edgeType: spec.edgeType,
    directed,
    reciprocal: spec.reciprocal ?? false,
    reverseEdgeId: null,
    confidence: spec.confidence ?? 1,
    status: spec.status ?? 'ACTIVE',
    createdBy,
    provenance: toJsonValue(provenance),
    explanation: spec.explanation ?? null,
    materialHash: spec.materialHash ?? null,
  };
}

export async function upsertMirrorNode(
  prismaClient: PrismaClient,
  spec: MirrorNodeSpec,
): Promise<Prisma.GraphNodeGetPayload<{ select: { id: true } }> & { id: string }> {
  const data = buildMirrorNodeInput(spec);
  return prismaClient.graphNode.upsert({
    where: { id: data.id },
    create: data,
    update: {
      canonicalKey: data.canonicalKey,
      type: data.type,
      label: data.label,
      title: data.title,
      colorGroup: data.colorGroup,
      groupKey: data.groupKey,
      tags: data.tags,
      metadata: data.metadata,
      sourceRefs: data.sourceRefs,
      sourceChecksum: data.sourceChecksum,
      sourceUpdatedAt: data.sourceUpdatedAt,
      active: data.active,
    },
    select: { id: true },
  });
}

export async function upsertMirrorEdge(
  prismaClient: PrismaClient,
  spec: MirrorEdgeSpec,
): Promise<Prisma.GraphEdgeGetPayload<{ select: { id: true } }> & { id: string }> {
  const data = buildMirrorEdgeInput(spec);
  return prismaClient.graphEdge.upsert({
    where: { id: data.id },
    create: data,
    update: {
      canonicalKey: data.canonicalKey,
      pairKey: data.pairKey,
      sourceNodeId: data.sourceNodeId,
      targetNodeId: data.targetNodeId,
      edgeType: data.edgeType,
      directed: data.directed,
      reciprocal: data.reciprocal,
      reverseEdgeId: null,
      confidence: data.confidence,
      status: data.status,
      createdBy: data.createdBy,
      provenance: data.provenance,
      explanation: data.explanation,
      materialHash: data.materialHash,
    },
    select: { id: true },
  });
}

export async function supersedeEdgesFromSourceNode(
  prismaClient: PrismaClient,
  sourceNodeId: string,
  keepEdgeIds: readonly string[],
): Promise<void> {
  await prismaClient.graphEdge.updateMany({
    where: {
      sourceNodeId,
      status: 'ACTIVE',
      id: {
        notIn: keepEdgeIds.length > 0 ? [...keepEdgeIds] : ['__keep_none__'],
      },
    },
    data: { status: 'SUPERSEDED' },
  });
}

export async function deactivateMirrorNodes(
  prismaClient: PrismaClient,
  input: {
    type: MirrorNodeType;
    groupKey: string;
    keepNodeIds: readonly string[];
  },
): Promise<void> {
  const staleNodes = await prismaClient.graphNode.findMany({
    where: {
      type: input.type,
      groupKey: input.groupKey,
      active: true,
      id: {
        notIn: input.keepNodeIds.length > 0 ? [...input.keepNodeIds] : ['__keep_none__'],
      },
    },
    select: { id: true },
  });

  if (staleNodes.length === 0) {
    return;
  }

  const staleNodeIds = staleNodes.map((row) => row.id);

  await prismaClient.graphEdge.updateMany({
    where: {
      OR: [
        { sourceNodeId: { in: staleNodeIds } },
        { targetNodeId: { in: staleNodeIds } },
      ],
      status: 'ACTIVE',
    },
    data: { status: 'SUPERSEDED' },
  });

  await prismaClient.graphNode.updateMany({
    where: { id: { in: staleNodeIds } },
    data: { active: false },
  });
}
