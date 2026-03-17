import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { createGraphNodeId } from '../graph-engine/ids';
import {
  getWorkbenchContext,
  type WorkbenchAnchor,
  type WorkbenchContext,
} from '../investigation/workbenchContextService';
import {
  INVESTIGATION_SEED_MARKER,
  INVESTIGATION_SEED_PROVIDER_NPIS,
} from '../investigators/seedInvestigationData';
import { listInvestigatorFindings } from '../investigators/investigatorEngineService';
import {
  generateDirectory,
  type DirectoryEntry,
  type ProviderDirectory,
} from '../providers/providerDirectory';
import { listStorylines } from '../storylines/storylineService';

const SEEDED_NPI_SET = new Set(INVESTIGATION_SEED_PROVIDER_NPIS);
export const DEFAULT_PUBLIC_SNAPSHOT_NPI = INVESTIGATION_SEED_PROVIDER_NPIS[0] ?? '1902301456';

type PublicGraphNodeRow = Awaited<ReturnType<typeof prisma.graphNode.findMany>>[number];
type PublicGraphEdgeRow = Awaited<ReturnType<typeof prisma.graphEdge.findMany>>[number];
type PublicFindingRecord = Awaited<ReturnType<typeof listInvestigatorFindings>>['findings'][number];
type PublicStorylineRecord = Awaited<ReturnType<typeof listStorylines>>['storylines'][number];

interface PublicSnapshotGraphNode {
  id: string;
  type: string;
  label: string;
  title: string;
  color: string;
  group: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  layer: 'blended';
  metadata: Record<string, unknown>;
  tags: string[];
  sourceRefs: string[];
  trustTier?: string;
  trustBand?: string;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicSnapshotGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  directed: boolean;
  reciprocal: boolean;
  confidence: number;
  createdBy: string;
  explanation: string;
  status: string;
  weight: number;
  metadata: Record<string, unknown>;
  layer: 'blended';
  createdAt: string;
  updatedAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseStringList(value: string | undefined): string[] | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function isSeededNpi(value: string | null | undefined): value is string {
  return typeof value === 'string' && SEEDED_NPI_SET.has(value);
}

function findSeededProviderNpi(entityIds: string[], metadata: Record<string, unknown>): string | null {
  if (typeof metadata.npi === 'string' && SEEDED_NPI_SET.has(metadata.npi)) {
    return metadata.npi;
  }

  for (const entityId of entityIds) {
    if (SEEDED_NPI_SET.has(entityId)) {
      return entityId;
    }

    const match = entityId.match(/(\d{10})/);
    if (match?.[1] && SEEDED_NPI_SET.has(match[1])) {
      return match[1];
    }
  }

  return null;
}

function matchesTextQuery(entry: DirectoryEntry, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return true;
  }

  return [
    entry.npi,
    entry.fullName,
    entry.primaryIssuer ?? '',
    ...entry.specialties,
  ].join(' ').toLowerCase().includes(trimmed);
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize);
  return items.slice(start, start + pageSize);
}

function publicProviderNodeId(npi: string): string {
  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: npi,
  });
}

function mapGraphEdgeType(edgeType: string): string {
  switch (edgeType) {
    case 'co_author':
    case 'co_investigator':
    case 'affiliated_with':
    case 'works_at':
    case 'related_to':
      return edgeType;
    case 'credentialed_at':
    case 'employed_by':
    case 'member_of':
    case 'practices_at':
      return 'works_at';
    default:
      return 'related_to';
  }
}

function toPublicGraphNode(row: PublicGraphNodeRow): PublicSnapshotGraphNode {
  const metadata = asRecord(row.metadata);
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    title: row.title,
    color: row.colorGroup,
    group: row.groupKey ?? row.type,
    degree: row.degree,
    inDegree: row.inDegree,
    outDegree: row.outDegree,
    layer: 'blended',
    metadata,
    tags: [...row.tags],
    sourceRefs: [...row.sourceRefs],
    trustTier: typeof metadata.trustTier === 'string' ? metadata.trustTier : undefined,
    trustBand: typeof metadata.trustBand === 'string' ? metadata.trustBand : undefined,
    confidence: typeof metadata.confidenceScore === 'number' ? metadata.confidenceScore : undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicGraphEdge(row: PublicGraphEdgeRow): PublicSnapshotGraphEdge {
  const metadata = asRecord(row.provenance);
  return {
    id: row.id,
    source: row.sourceNodeId,
    target: row.targetNodeId,
    type: mapGraphEdgeType(row.edgeType),
    directed: row.directed,
    reciprocal: row.reciprocal,
    confidence: row.confidence,
    createdBy: 'system',
    explanation: typeof metadata.institution === 'string'
      ? `${row.edgeType.replace(/_/g, ' ')}: ${metadata.institution}`
      : row.edgeType.replace(/_/g, ' '),
    status: 'active',
    weight: row.confidence,
    metadata,
    layer: 'blended',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function snapshotReady(prismaClient: PrismaClient): Promise<boolean> {
  const marker = await prismaClient.sourceRun.findUnique({
    where: { idempotencyKey: INVESTIGATION_SEED_MARKER },
    select: { id: true },
  });

  return Boolean(marker);
}

export async function listPublicProvidersSnapshot(
  input: {
    query?: string;
    page?: number;
    pageSize?: number;
    minTrustScore?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<ProviderDirectory & { snapshotReady: boolean; seedMarker: string }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(1, input.pageSize ?? 12), 100);
  const query = input.query ?? '';
  const ready = await snapshotReady(prismaClient);
  const directory = await generateDirectory({
    page: 1,
    pageSize: Math.max(pageSize * page, pageSize, 24),
    minTrustScore: input.minTrustScore,
  });

  const filtered = directory.entries
    .filter((entry) => SEEDED_NPI_SET.has(entry.npi))
    .filter((entry) => matchesTextQuery(entry, query));
  const paged = paginate(filtered, page, pageSize);

  return {
    ...directory,
    entries: paged,
    totalProviders: filtered.length,
    verifiedProviders: filtered.filter((entry) => entry.credentialHealth === 'VERIFIED').length,
    pageInfo: {
      page,
      pageSize,
      returned: paged.length,
      totalAvailable: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      hasNextPage: page * pageSize < filtered.length,
    },
    snapshotReady: ready && filtered.length > 0,
    seedMarker: INVESTIGATION_SEED_MARKER,
  };
}

export async function listPublicFindingsSnapshot(
  input: {
    provider?: string;
    severity?: string;
    status?: string;
    findingType?: string;
    investigatorId?: string;
    dateFrom?: string;
    dateTo?: string;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<{
  findings: Array<{
    findingId: string;
    investigatorId: string;
    findingType: string;
    severity: string;
    status: string;
    title: string;
    summary: string;
    explanation: string;
    entityIds: string[];
    entities: PublicFindingRecord['entities'];
    metadata: PublicFindingRecord['metadata'];
    priorityScore: number;
    confidence: number;
    storylineKey: string | null;
    supportingEvidence: PublicFindingRecord['supportingEvidence'];
    firstSeenAt: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  generatedAt: string;
  snapshotReady: boolean;
  seedMarker: string;
}> {
  const provider = input.provider?.trim();
  if (provider && !isSeededNpi(provider)) {
    return {
      findings: [],
      total: 0,
      generatedAt: new Date().toISOString(),
      snapshotReady: await snapshotReady(prismaClient),
      seedMarker: INVESTIGATION_SEED_MARKER,
    };
  }

  const limit = Math.min(Math.max(1, input.limit ?? 10), 100);
  const offset = Math.max(0, input.offset ?? 0);
  const rawLimit = Math.min(Math.max(limit + offset, 40), 250);
  const ready = await snapshotReady(prismaClient);
  const result = await listInvestigatorFindings({
    provider: provider ?? null,
    severity: parseStringList(input.severity),
    status: parseStringList(input.status),
    findingType: parseStringList(input.findingType),
    investigatorId: parseStringList(input.investigatorId),
    dateFrom: input.dateFrom ?? null,
    dateTo: input.dateTo ?? null,
    minConfidence: input.minConfidence ?? null,
    limit: rawLimit,
    offset: 0,
  });

  const filtered = result.findings.filter((finding) => (
    Boolean(findSeededProviderNpi(finding.entityIds, finding.metadata))
  ));
  const paged = filtered.slice(offset, offset + limit);

  return {
    findings: paged.map((finding) => ({
      findingId: finding.findingId,
      investigatorId: finding.investigatorId,
      findingType: finding.findingType,
      severity: finding.severity,
      status: finding.status,
      title: finding.title,
      summary: finding.summary,
      explanation: finding.explanation,
      entityIds: [...finding.entityIds],
      entities: [...finding.entities],
      metadata: finding.metadata,
      priorityScore: finding.priorityScore,
      confidence: finding.confidence,
      storylineKey: finding.storylineKey,
      supportingEvidence: [...finding.supportingEvidence],
      firstSeenAt: finding.firstSeenAt,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })),
    total: filtered.length,
    generatedAt: new Date().toISOString(),
    snapshotReady: ready && filtered.length > 0,
    seedMarker: INVESTIGATION_SEED_MARKER,
  };
}

export async function listPublicStorylinesSnapshot(
  input: {
    provider?: string;
    severity?: string;
    status?: string;
    storylineType?: string;
    perspective?: string;
    limit?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<{
  storylines: PublicStorylineRecord[];
  total: number;
  syncedAt: string;
  snapshotReady: boolean;
  seedMarker: string;
}> {
  const provider = input.provider?.trim();
  if (provider && !isSeededNpi(provider)) {
    return {
      storylines: [],
      total: 0,
      syncedAt: new Date().toISOString(),
      snapshotReady: await snapshotReady(prismaClient),
      seedMarker: INVESTIGATION_SEED_MARKER,
    };
  }

  const ready = await snapshotReady(prismaClient);
  const result = await listStorylines({
    provider,
    severity: input.severity as never,
    status: input.status as never,
    storylineType: input.storylineType as never,
    perspective: input.perspective as never,
    limit: Math.min(Math.max(1, input.limit ?? 24), 100),
    sync: false,
  });

  const filtered = result.storylines.filter((storyline) => storyline.entityIds.some((entityId) => isSeededNpi(entityId)));
  return {
    storylines: filtered,
    total: filtered.length,
    syncedAt: result.syncedAt,
    snapshotReady: ready && filtered.length > 0,
    seedMarker: INVESTIGATION_SEED_MARKER,
  };
}

export async function getPublicGraphSnapshot(
  input: {
    npi?: string;
    limit?: number;
  } = {},
  prismaClient: PrismaClient = prisma,
): Promise<{
  nodes: PublicSnapshotGraphNode[];
  edges: PublicSnapshotGraphEdge[];
  focusNodeId: string | null;
  generatedAt: string;
  snapshotReady: boolean;
  seedMarker: string;
}> {
  const requestedNpi = input.npi?.trim();
  const focusNpi = isSeededNpi(requestedNpi)
    ? requestedNpi
    : requestedNpi
      ? null
      : DEFAULT_PUBLIC_SNAPSHOT_NPI;
  const ready = await snapshotReady(prismaClient);

  if (requestedNpi && !focusNpi) {
    return {
      nodes: [],
      edges: [],
      focusNodeId: null,
      generatedAt: new Date().toISOString(),
      snapshotReady: ready,
      seedMarker: INVESTIGATION_SEED_MARKER,
    };
  }

  const limit = Math.min(Math.max(12, input.limit ?? 60), 240);
  const focusNodeId = focusNpi ? publicProviderNodeId(focusNpi) : null;
  const edgeRows = focusNodeId
    ? await prismaClient.graphEdge.findMany({
        where: {
          createdBy: INVESTIGATION_SEED_MARKER,
          status: 'ACTIVE',
          OR: [
            { sourceNodeId: focusNodeId },
            { targetNodeId: focusNodeId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(12, Math.floor(limit * 1.5)),
      })
    : await prismaClient.graphEdge.findMany({
        where: {
          createdBy: INVESTIGATION_SEED_MARKER,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

  const nodeIds = new Set<string>();
  for (const edge of edgeRows) {
    nodeIds.add(edge.sourceNodeId);
    nodeIds.add(edge.targetNodeId);
  }
  if (focusNodeId) {
    nodeIds.add(focusNodeId);
  }

  const nodeRows = await prismaClient.graphNode.findMany({
    where: focusNodeId
      ? { id: { in: [...nodeIds] }, active: true }
      : {
          active: true,
          sourceRefs: { has: 'seed:investigation' },
        },
    orderBy: [
      { degree: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: limit,
  });

  const allowedNodeIds = new Set(nodeRows.map((row) => row.id));
  const filteredEdges = edgeRows.filter((edge) => (
    allowedNodeIds.has(edge.sourceNodeId) && allowedNodeIds.has(edge.targetNodeId)
  ));

  return {
    nodes: nodeRows.map((row) => toPublicGraphNode(row)),
    edges: filteredEdges.map((row) => toPublicGraphEdge(row)),
    focusNodeId,
    generatedAt: new Date().toISOString(),
    snapshotReady: ready && nodeRows.length > 0,
    seedMarker: INVESTIGATION_SEED_MARKER,
  };
}

export async function getPublicWorkbenchSnapshot(
  anchor: WorkbenchAnchor,
  prismaClient: PrismaClient = prisma,
): Promise<(WorkbenchContext & { snapshotReady: boolean; seedMarker: string }) | null> {
  const resolvedAnchor: WorkbenchAnchor = {
    npi: anchor.npi?.trim() || undefined,
    findingId: anchor.findingId?.trim() || undefined,
    storylineId: anchor.storylineId?.trim() || undefined,
  };

  if (!resolvedAnchor.npi && !resolvedAnchor.findingId && !resolvedAnchor.storylineId) {
    resolvedAnchor.npi = DEFAULT_PUBLIC_SNAPSHOT_NPI;
  }

  if (resolvedAnchor.npi && !isSeededNpi(resolvedAnchor.npi)) {
    return null;
  }

  const context = await getWorkbenchContext(resolvedAnchor);
  const providerNpi = context.provider?.npi ?? context.anchor.npi ?? null;
  if (providerNpi && !isSeededNpi(providerNpi)) {
    return null;
  }

  return {
    ...context,
    relatedFindings: context.relatedFindings.filter((finding) => {
      const findingNpi = finding.href.match(/npi=(\d{10})/)?.[1]
        ?? finding.href.match(/\/providers\/(\d{10})/)?.[1]
        ?? providerNpi;
      return isSeededNpi(findingNpi);
    }),
    snapshotReady: await snapshotReady(prismaClient),
    seedMarker: INVESTIGATION_SEED_MARKER,
  };
}
