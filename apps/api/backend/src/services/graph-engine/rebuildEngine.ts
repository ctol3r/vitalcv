import { Prisma, type GraphBuildRun as PrismaGraphBuildRun, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload, stableStringify } from '../../utils/deterministic';
import {
  COLOR_GROUPS,
  EDGE_TYPES,
  GRAPH_SCHEMA_VERSION,
  NODE_TYPES,
  edgeLayer,
  nodeLayer,
  type EdgeCreator,
  type EdgeStatus,
  type EdgeType,
  type GraphLayer,
  type NodeType,
} from './schema';
import {
  createGraphBuildRequestFingerprint,
  createGraphBuildRunId,
  createGraphEdgeCanonicalKey,
  createGraphEdgeId,
  createGraphNodeCanonicalKey,
  createGraphNodeId,
} from './ids';
import { expandGraphModes, invalidateAllGraphSnapshots, invalidateGraphSnapshots } from './invalidation';
import {
  ensureReciprocalEdgeRules,
  loadReciprocalRuleMap,
  type ReciprocalRule,
} from './reciprocity';

type JsonRecord = Record<string, unknown>;

type DesiredNode = {
  id: string;
  canonicalKey: string;
  type: NodeType;
  label: string;
  title: string;
  colorGroup: string;
  groupKey?: string | null;
  tags: string[];
  metadata: JsonRecord;
  sourceRefs: string[];
  sourceChecksum?: string | null;
  sourceUpdatedAt?: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DesiredEdge = {
  id: string;
  canonicalKey: string;
  pairKey: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  directed: boolean;
  reciprocal: boolean;
  reverseEdgeId?: string | null;
  confidence: number;
  status: EdgeStatus;
  createdBy: EdgeCreator;
  provenance: JsonRecord;
  explanation?: string;
  materialHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProjectionContext = {
  nodes: Map<string, DesiredNode>;
  edges: Map<string, DesiredEdge>;
};

export type GraphRebuildType = 'full' | 'incremental' | 'node' | 'stale';

export interface GraphRebuildInput {
  buildType: GraphRebuildType;
  graphMode?: GraphLayer | null;
  targetNodeId?: string | null;
  invalidationReasons?: string[];
  requestedBy?: string | null;
}

export interface GraphRebuildResult {
  buildRunId: string;
  status: string;
  executionMode: 'targeted' | 'fallback_full';
  nodeCount: number;
  edgeCount: number;
  orphanNodeIds: string[];
  reciprocalIssues: Array<{ edgeId: string; reason: string }>;
  staleNodeIds: string[];
  snapshotIds: string[];
  startedAt: string;
  completedAt: string;
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

async function safeOptionalFindMany<T>(
  label: string,
  operation: () => Promise<T[]>,
): Promise<T[]> {
  try {
    return await operation();
  } catch (error) {
    if (isMissingTableError(error)) {
      log('warn', 'graph rebuild skipped optional source table because it is unavailable', {
        component: 'graph-engine',
        table: label,
      });
      return [];
    }
    throw error;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function coerceNodeType(value: string, fallback: NodeType): NodeType {
  return NODE_TYPES.includes(value as NodeType) ? (value as NodeType) : fallback;
}

function coerceEdgeType(value: string, fallback: EdgeType): EdgeType {
  return EDGE_TYPES.includes(value as EdgeType) ? (value as EdgeType) : fallback;
}

function pickColorGroup(type: NodeType): string {
  return COLOR_GROUPS[type] ?? '#64748b';
}

function buildNode(params: {
  type: NodeType;
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
  now: Date;
}): DesiredNode {
  const canonicalKey = createGraphNodeCanonicalKey({
    type: params.type,
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
  });

  const metadata = {
    ...(params.metadata ?? {}),
    sourceKind: params.sourceKind,
    sourceId: params.sourceId,
    layer: nodeLayer(params.type),
  };

  return {
    id: createGraphNodeId({
      type: params.type,
      sourceKind: params.sourceKind,
      sourceId: params.sourceId,
    }),
    canonicalKey,
    type: params.type,
    label: params.label,
    title: params.title ?? params.label,
    colorGroup: pickColorGroup(params.type),
    groupKey: params.groupKey ?? params.type,
    tags: uniqueSorted(params.tags ?? []),
    metadata,
    sourceRefs: uniqueSorted(params.sourceRefs ?? [params.sourceId]),
    sourceChecksum: params.sourceChecksum ?? sha256ForPayload(metadata),
    sourceUpdatedAt: params.sourceUpdatedAt ?? params.now,
    active: true,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function buildEdge(params: {
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: EdgeType;
  directed: boolean;
  reciprocal: boolean;
  confidence: number;
  status: EdgeStatus;
  createdBy: EdgeCreator;
  provenance?: JsonRecord;
  explanation?: string;
  materialHash?: string | null;
  now: Date;
}): DesiredEdge {
  const canonicalKey = createGraphEdgeCanonicalKey({
    sourceNodeId: params.sourceNodeId,
    targetNodeId: params.targetNodeId,
    edgeType: params.edgeType,
    directed: params.directed,
    createdBy: params.createdBy,
    materialHash: params.materialHash,
  });

  return {
    id: createGraphEdgeId({
      sourceNodeId: params.sourceNodeId,
      targetNodeId: params.targetNodeId,
      edgeType: params.edgeType,
      directed: params.directed,
      createdBy: params.createdBy,
      materialHash: params.materialHash,
    }),
    canonicalKey,
    pairKey: stableStringify({
      edgeType: params.edgeType,
      directed: params.directed,
      sourceNodeId: params.directed ? params.sourceNodeId : [params.sourceNodeId, params.targetNodeId].sort()[0],
      targetNodeId: params.directed ? params.targetNodeId : [params.sourceNodeId, params.targetNodeId].sort()[1],
    }),
    sourceNodeId: params.sourceNodeId,
    targetNodeId: params.targetNodeId,
    edgeType: params.edgeType,
    directed: params.directed,
    reciprocal: params.reciprocal,
    confidence: params.confidence,
    status: params.status,
    createdBy: params.createdBy,
    provenance: {
      ...(params.provenance ?? {}),
      layer: edgeLayer(params.edgeType),
    },
    explanation: params.explanation,
    materialHash: params.materialHash ?? null,
    createdAt: params.now,
    updatedAt: params.now,
  };
}

function mergeNode(existing: DesiredNode | undefined, incoming: DesiredNode): DesiredNode {
  if (!existing) return incoming;

  return {
    ...existing,
    label: incoming.label || existing.label,
    title: incoming.title || existing.title,
    colorGroup: incoming.colorGroup || existing.colorGroup,
    groupKey: incoming.groupKey ?? existing.groupKey,
    tags: uniqueSorted([...existing.tags, ...incoming.tags]),
    metadata: {
      ...existing.metadata,
      ...incoming.metadata,
    },
    sourceRefs: uniqueSorted([...existing.sourceRefs, ...incoming.sourceRefs]),
    sourceChecksum: incoming.sourceChecksum ?? existing.sourceChecksum,
    sourceUpdatedAt: incoming.sourceUpdatedAt && existing.sourceUpdatedAt
      ? (incoming.sourceUpdatedAt > existing.sourceUpdatedAt ? incoming.sourceUpdatedAt : existing.sourceUpdatedAt)
      : incoming.sourceUpdatedAt ?? existing.sourceUpdatedAt,
    updatedAt: incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : existing.updatedAt,
  };
}

function addNode(context: ProjectionContext, node: DesiredNode): DesiredNode {
  const merged = mergeNode(context.nodes.get(node.id), node);
  context.nodes.set(node.id, merged);
  return merged;
}

function addEdge(context: ProjectionContext, edge: DesiredEdge): DesiredEdge {
  const existing = context.edges.get(edge.id);
  if (!existing || existing.confidence < edge.confidence) {
    context.edges.set(edge.id, existing
      ? {
          ...existing,
          ...edge,
          provenance: {
            ...existing.provenance,
            ...edge.provenance,
          },
        }
      : edge);
  }

  return context.edges.get(edge.id)!;
}

function addTagNodes(context: ProjectionContext, node: DesiredNode, now: Date): void {
  for (const tag of node.tags) {
    const tagNode = addNode(context, buildNode({
      type: 'tag',
      sourceKind: 'tag',
      sourceId: slugify(tag),
      label: tag,
      title: tag,
      groupKey: 'tag',
      tags: [tag],
      metadata: { value: tag },
      sourceRefs: node.sourceRefs,
      now,
    }));

    addEdge(context, buildEdge({
      sourceNodeId: node.id,
      targetNodeId: tagNode.id,
      edgeType: 'tagged_with',
      directed: true,
      reciprocal: false,
      confidence: 1,
      status: 'active',
      createdBy: 'system',
      provenance: { ownerNodeId: node.id, tag },
      explanation: `Node tagged with "${tag}"`,
      materialHash: sha256ForPayload({ ownerNodeId: node.id, tag }),
      now,
    }));
  }
}

function addAttachmentNodes(
  context: ProjectionContext,
  ownerNode: DesiredNode,
  attachments: unknown,
  now: Date,
): void {
  const attachmentEntries = Array.isArray(attachments) ? attachments : [];
  for (const attachment of attachmentEntries) {
    const attachmentRecord = asRecord(attachment);
    const url = asString(attachmentRecord.url) ?? asString(attachmentRecord.href);
    const label = asString(attachmentRecord.name)
      ?? asString(attachmentRecord.title)
      ?? url
      ?? asString(attachment);

    if (!label) continue;

    const attachmentId = url ?? label;
    const attachmentNode = addNode(context, buildNode({
      type: 'attachment',
      sourceKind: 'attachment',
      sourceId: attachmentId,
      label,
      title: label,
      groupKey: ownerNode.groupKey,
      tags: ownerNode.tags,
      metadata: {
        url,
        ownerNodeId: ownerNode.id,
        raw: attachmentRecord,
      },
      sourceRefs: ownerNode.sourceRefs,
      now,
    }));

    addEdge(context, buildEdge({
      sourceNodeId: attachmentNode.id,
      targetNodeId: ownerNode.id,
      edgeType: 'attached_to',
      directed: true,
      reciprocal: false,
      confidence: 1,
      status: 'active',
      createdBy: 'system',
      provenance: { ownerNodeId: ownerNode.id },
      explanation: 'Attachment indexed for owner node',
      materialHash: sha256ForPayload({ attachmentId, ownerNodeId: ownerNode.id }),
      now,
    }));
  }
}

function addSemanticEdges(context: ProjectionContext, now: Date): void {
  const candidates = [...context.nodes.values()].filter((node) =>
    node.type !== 'tag'
    && node.type !== 'attachment'
    && node.tags.length > 0,
  );

  const tagIndex = new Map<string, string[]>();
  for (const node of candidates) {
    for (const tag of node.tags) {
      const bucket = tagIndex.get(tag) ?? [];
      bucket.push(node.id);
      tagIndex.set(tag, bucket);
    }
  }

  const pairScores = new Map<string, { score: number; tags: Set<string> }>();
  for (const [tag, nodeIds] of tagIndex.entries()) {
    const limited = [...nodeIds].sort((left, right) => left.localeCompare(right)).slice(0, 24);
    for (let index = 0; index < limited.length; index += 1) {
      for (let inner = index + 1; inner < limited.length; inner += 1) {
        const left = limited[index];
        const right = limited[inner];
        const key = `${left}|${right}`;
        const current = pairScores.get(key) ?? { score: 0, tags: new Set<string>() };
        current.score += 1;
        current.tags.add(tag);
        pairScores.set(key, current);
      }
    }
  }

  const perNodeBudget = new Map<string, number>();
  const sortedPairs = [...pairScores.entries()].sort((left, right) =>
    right[1].score - left[1].score
    || left[0].localeCompare(right[0]));
  for (const [pairKey, value] of sortedPairs) {
    if (value.score < 2) continue;
    const [sourceNodeId, targetNodeId] = pairKey.split('|');
    const sourceBudget = perNodeBudget.get(sourceNodeId) ?? 0;
    const targetBudget = perNodeBudget.get(targetNodeId) ?? 0;
    if (sourceBudget >= 5 || targetBudget >= 5) continue;

    addEdge(context, buildEdge({
      sourceNodeId,
      targetNodeId,
      edgeType: 'semantic_similarity',
      directed: false,
      reciprocal: true,
      confidence: Math.min(0.35 + value.score * 0.15, 0.9),
      status: 'active',
      createdBy: 'system',
      provenance: { sharedTags: [...value.tags].sort() },
      explanation: `Shared semantic tags: ${[...value.tags].sort().join(', ')}`,
      materialHash: sha256ForPayload({ sourceNodeId, targetNodeId, tags: [...value.tags].sort() }),
      now,
    }));
    perNodeBudget.set(sourceNodeId, sourceBudget + 1);
    perNodeBudget.set(targetNodeId, targetBudget + 1);
  }
}

function applyReciprocalRules(
  context: ProjectionContext,
  rules: Map<string, ReciprocalRule>,
  now: Date,
): void {
  const edges = [...context.edges.values()];
  for (const edge of edges) {
    const rule = rules.get(edge.edgeType);
    if (!rule || !rule.autoCreate) continue;

    const reverseEdge = buildEdge({
      sourceNodeId: edge.targetNodeId,
      targetNodeId: edge.sourceNodeId,
      edgeType: coerceEdgeType(rule.reverseEdgeType, edge.edgeType),
      directed: rule.relationshipMode === 'BACKLINK',
      reciprocal: rule.reciprocal,
      confidence: edge.confidence,
      status: edge.status,
      createdBy: edge.createdBy,
      provenance: {
        ...edge.provenance,
        reciprocalOf: edge.id,
        reciprocalRule: rule.relationshipMode,
      },
      explanation: rule.relationshipMode === 'BACKLINK'
        ? `Backlink mirror of ${edge.id}`
        : `Reciprocal mirror of ${edge.id}`,
      materialHash: edge.materialHash,
      now,
    });

    const storedReverse = addEdge(context, reverseEdge);
    const storedForward = context.edges.get(edge.id);
    if (storedForward) {
      storedForward.reverseEdgeId = storedReverse.id;
    }
    storedReverse.reverseEdgeId = edge.id;
  }
}

function extractNodeTags(metadata: JsonRecord, base: Array<string | null | undefined>): string[] {
  const tags = [
    ...base,
    ...asStringArray(metadata.tags),
    ...asStringArray(metadata.keywords),
    asString(metadata.specialty),
    asString(metadata.state),
    asString(metadata.type),
    asString(metadata.category),
  ];
  return uniqueSorted(tags.filter((value): value is string => Boolean(value)));
}

function captureNpiFromNodeMetadata(metadata: JsonRecord): string | null {
  return asString(metadata.npi)
    ?? asString(metadata.subjectNpi)
    ?? asString(metadata.referenceId);
}

async function resolveTargetedScopes(
  prismaClient: PrismaClient,
  input: GraphRebuildInput,
): Promise<{
  executionMode: 'targeted' | 'fallback_full';
  npiScope: string[];
  searchScope: string[];
  organizationScope: string[];
  staleNodeIds: string[];
}> {
  const npiScope = new Set<string>();
  const searchScope = new Set<string>();
  const organizationScope = new Set<string>();
  const staleNodeIds: string[] = [];

  if (input.buildType === 'incremental') {
    for (const reason of input.invalidationReasons ?? []) {
      if (reason.startsWith('npi:')) npiScope.add(reason.slice(4));
      if (reason.startsWith('search:')) searchScope.add(reason.slice(7));
      if (reason.startsWith('organization:')) organizationScope.add(reason.slice(13));
    }
  }

  if (input.buildType === 'node' && input.targetNodeId) {
    const targetNode = await prismaClient.graphNode.findUnique({
      where: { id: input.targetNodeId },
      select: { metadata: true },
    });
    const metadata = asRecord(targetNode?.metadata);
    const npi = captureNpiFromNodeMetadata(metadata);
    const searchId = asString(metadata.sourceId);
    const organizationId = asString(metadata.organizationId);
    if (npi) npiScope.add(npi);
    if (metadata.sourceKind === 'search_object' && searchId) searchScope.add(searchId);
    if (organizationId) organizationScope.add(organizationId);
  }

  if (input.buildType === 'stale') {
    const staleRows = await prismaClient.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM graph_nodes
      WHERE source_updated_at IS NOT NULL
        AND source_updated_at > updated_at
        AND active = true
    `;

    staleNodeIds.push(...staleRows.map((row) => row.id));
    if (staleRows.length > 0) {
      const nodes = await prismaClient.graphNode.findMany({
        where: { id: { in: staleRows.map((row) => row.id) } },
        select: { metadata: true },
      });
      for (const node of nodes) {
        const metadata = asRecord(node.metadata);
        const npi = captureNpiFromNodeMetadata(metadata);
        const searchId = metadata.sourceKind === 'search_object' ? asString(metadata.sourceId) : null;
        const organizationId = asString(metadata.organizationId);
        if (npi) npiScope.add(npi);
        if (searchId) searchScope.add(searchId);
        if (organizationId) organizationScope.add(organizationId);
      }
    }
  }

  const executionMode = npiScope.size > 0 || searchScope.size > 0 || organizationScope.size > 0
    ? 'targeted'
    : 'fallback_full';

  return {
    executionMode,
    npiScope: uniqueSorted(npiScope),
    searchScope: uniqueSorted(searchScope),
    organizationScope: uniqueSorted(organizationScope),
    staleNodeIds,
  };
}

// WorkspaceMembership has NO Prisma relations to PersonProfile or
// OrganizationProfile (plain FK columns), so relation-style filters/selects
// throw P2009 at runtime. Resolve the npi/organization scopes to FK ids
// first, filter on the FK columns, then stitch npi + organizationId back in
// JS (same pattern as hydrateWorkspaceUser in workspaceService.ts).
async function loadWorkspaceMembershipRows(
  prismaClient: PrismaClient,
  npiScope: string[],
  organizationScope: string[],
): Promise<Array<{
  role: string;
  active: boolean;
  createdAt: Date;
  personProfile: { npi: string | null };
  organizationProfile: { organizationId: string | null };
}>> {
  let scopedPersonProfiles: Array<{ id: string; npi: string | null }> | null = null;
  let scopedOrgProfiles: Array<{ id: string; organizationId: string }> | null = null;

  if (npiScope.length > 0) {
    scopedPersonProfiles = await prismaClient.personProfile.findMany({
      where: { npi: { in: npiScope } },
      select: { id: true, npi: true },
    });
  } else if (organizationScope.length > 0) {
    scopedOrgProfiles = await prismaClient.organizationProfile.findMany({
      where: { organizationId: { in: organizationScope } },
      select: { id: true, organizationId: true },
    });
  }

  const memberships = await prismaClient.workspaceMembership.findMany({
    where: scopedPersonProfiles
      ? { personProfileId: { in: scopedPersonProfiles.map((profile) => profile.id) } }
      : scopedOrgProfiles
        ? { organizationProfileId: { in: scopedOrgProfiles.map((profile) => profile.id) } }
        : undefined,
    select: {
      role: true,
      active: true,
      createdAt: true,
      personProfileId: true,
      organizationProfileId: true,
    },
  });

  if (memberships.length === 0) {
    return [];
  }

  const npiByProfileId = new Map<string, string | null>(
    (scopedPersonProfiles ?? []).map((profile) => [profile.id, profile.npi]),
  );
  const orgIdByProfileId = new Map<string, string>(
    (scopedOrgProfiles ?? []).map((profile) => [profile.id, profile.organizationId]),
  );

  const missingPersonProfileIds = [
    ...new Set(memberships.map((membership) => membership.personProfileId)),
  ].filter((id) => !npiByProfileId.has(id));
  const missingOrgProfileIds = [
    ...new Set(memberships.map((membership) => membership.organizationProfileId)),
  ].filter((id) => !orgIdByProfileId.has(id));

  const [personProfiles, orgProfiles] = await Promise.all([
    missingPersonProfileIds.length > 0
      ? prismaClient.personProfile.findMany({
          where: { id: { in: missingPersonProfileIds } },
          select: { id: true, npi: true },
        })
      : Promise.resolve([]),
    missingOrgProfileIds.length > 0
      ? prismaClient.organizationProfile.findMany({
          where: { id: { in: missingOrgProfileIds } },
          select: { id: true, organizationId: true },
        })
      : Promise.resolve([]),
  ]);
  personProfiles.forEach((profile) => npiByProfileId.set(profile.id, profile.npi));
  orgProfiles.forEach((profile) => orgIdByProfileId.set(profile.id, profile.organizationId));

  // A dangling FK resolves to null npi/organizationId; the projection loop
  // skips memberships it cannot link to both nodes.
  return memberships.map((membership) => ({
    role: membership.role,
    active: membership.active,
    createdAt: membership.createdAt,
    personProfile: { npi: npiByProfileId.get(membership.personProfileId) ?? null },
    organizationProfile: {
      organizationId: orgIdByProfileId.get(membership.organizationProfileId) ?? null,
    },
  }));
}

async function buildProjection(
  prismaClient: PrismaClient,
  input: GraphRebuildInput,
  now: Date,
): Promise<{
  context: ProjectionContext;
  executionMode: 'targeted' | 'fallback_full';
  staleNodeIds: string[];
}> {
  const { executionMode, npiScope, searchScope, organizationScope, staleNodeIds } =
    await resolveTargetedScopes(prismaClient, input);

  const [
    personProfiles,
    organizations,
    workspaceMemberships,
    opportunities,
    applications,
    verificationArtifacts,
    decisionCapsules,
    sourceRecords,
    claimRecords,
    searchObjects,
  ] = await Promise.all([
    prismaClient.personProfile.findMany({
      where: npiScope.length > 0 ? { npi: { in: npiScope } } : undefined,
      select: {
        id: true,
        npi: true,
        firstName: true,
        lastName: true,
        specialty: true,
        stateOfPractice: true,
        resumeUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prismaClient.organization.findMany({
      where: organizationScope.length > 0 ? { id: { in: organizationScope } } : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        organizationProfile: {
          select: {
            id: true,
            npi: true,
            specialties: true,
            statesCovered: true,
            website: true,
            trustScore: true,
            verified: true,
            updatedAt: true,
          },
        },
      },
    }),
    loadWorkspaceMembershipRows(prismaClient, npiScope, organizationScope),
    safeOptionalFindMany('Opportunity', () =>
      prismaClient.opportunity.findMany({
        where: organizationScope.length > 0 ? { organizationId: { in: organizationScope } } : undefined,
        select: {
          id: true,
          title: true,
          specialty: true,
          state: true,
          status: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),
    safeOptionalFindMany('Application', () =>
      prismaClient.application.findMany({
        where: npiScope.length > 0 ? { npi: { in: npiScope } } : undefined,
        select: {
          id: true,
          opportunityId: true,
          npi: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ),
    prismaClient.verificationArtifact.findMany({
      where: npiScope.length > 0 ? { npi: { in: npiScope } } : undefined,
      select: {
        id: true,
        npi: true,
        source: true,
        artifactType: true,
        status: true,
        lifecycleState: true,
        trustTier: true,
        confidenceScore: true,
        rawPayload: true,
        verifiedAt: true,
        expiresAt: true,
        checksum: true,
        statusLastChecked: true,
        createdAt: true,
      },
    }),
    prismaClient.decisionCapsule.findMany({
      where: npiScope.length > 0 ? { subjectNpi: { in: npiScope } } : undefined,
      select: {
        id: true,
        subjectNpi: true,
        decisionType: true,
        status: true,
        credentialIds: true,
        issuerIds: true,
        metadata: true,
        decisionTimestamp: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prismaClient.sourceRecord.findMany({
      where: npiScope.length > 0 ? { subjectNpi: { in: npiScope } } : undefined,
      select: {
        id: true,
        sourceId: true,
        subjectNpi: true,
        sourceRecordKey: true,
        sourceUrl: true,
        checksum: true,
        metadata: true,
        trustTier: true,
        fetchedAt: true,
        observedAt: true,
        createdAt: true,
      },
    }),
    prismaClient.claimRecord.findMany({
      where: npiScope.length > 0 ? { subjectNpi: { in: npiScope } } : undefined,
      select: {
        id: true,
        claimId: true,
        subjectNpi: true,
        claimType: true,
        value: true,
        sourceId: true,
        verificationArtifactId: true,
        confidenceScore: true,
        observedAt: true,
        createdAt: true,
      },
    }),
    prismaClient.searchObject.findMany({
      where: searchScope.length > 0
        ? { id: { in: searchScope } }
        : npiScope.length > 0
          ? { referenceId: { in: npiScope } }
          : { active: true },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        sourceUrl: true,
        referenceId: true,
        metadata: true,
        indexedAt: true,
        freshAt: true,
        active: true,
      },
    }),
  ]);

  const context: ProjectionContext = {
    nodes: new Map(),
    edges: new Map(),
  };

  const clinicianNodeByNpi = new Map<string, DesiredNode>();
  const organizationNodeById = new Map<string, DesiredNode>();
  const opportunityNodeById = new Map<string, DesiredNode>();
  const artifactNodeById = new Map<string, DesiredNode>();
  const sourceNodeBySourceId = new Map<string, DesiredNode>();

  const allNpis = new Set<string>();
  personProfiles.forEach((profile) => {
    if (profile.npi) allNpis.add(profile.npi);
  });
  verificationArtifacts.forEach((artifact) => allNpis.add(artifact.npi));
  decisionCapsules.forEach((decision) => allNpis.add(decision.subjectNpi));
  sourceRecords.forEach((record) => allNpis.add(record.subjectNpi));
  claimRecords.forEach((claim) => allNpis.add(claim.subjectNpi));

  for (const npi of allNpis) {
    const profile = personProfiles.find((item) => item.npi === npi);
    const fullName = uniqueSorted([profile?.firstName ?? '', profile?.lastName ?? '']).join(' ').trim();
    const metadata: JsonRecord = {
      npi,
      specialty: profile?.specialty,
      state: profile?.stateOfPractice,
      resumeUrl: profile?.resumeUrl,
      linkedinUrl: profile?.linkedinUrl,
      portfolioUrl: profile?.portfolioUrl,
    };
    const clinicianNode = addNode(context, buildNode({
      type: 'clinician',
      sourceKind: 'npi',
      sourceId: npi,
      label: fullName || `Clinician ${npi}`,
      title: fullName || `Clinician ${npi}`,
      groupKey: profile?.specialty ?? 'clinician',
      tags: extractNodeTags(metadata, [profile?.specialty, profile?.stateOfPractice]),
      metadata,
      sourceRefs: uniqueSorted([
        ...(profile ? [profile.id] : []),
        ...verificationArtifacts.filter((artifact) => artifact.npi === npi).map((artifact) => artifact.id),
      ]),
      sourceChecksum: sha256ForPayload({
        npi,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        specialty: profile?.specialty,
        stateOfPractice: profile?.stateOfPractice,
      }),
      sourceUpdatedAt: profile?.updatedAt ?? now,
      now,
    }));
    clinicianNodeByNpi.set(npi, clinicianNode);
  }

  for (const organization of organizations) {
    const profile = organization.organizationProfile;
    const metadata: JsonRecord = {
      organizationId: organization.id,
      slug: organization.slug,
      npi: profile?.npi,
      specialties: profile?.specialties ?? [],
      statesCovered: profile?.statesCovered ?? [],
      website: profile?.website,
      trustScore: profile?.trustScore,
      verified: profile?.verified ?? false,
    };
    const orgNode = addNode(context, buildNode({
      type: 'organization',
      sourceKind: 'organization',
      sourceId: organization.id,
      label: organization.name,
      title: organization.name,
      groupKey: organization.slug,
      tags: extractNodeTags(metadata, [...(profile?.specialties ?? []), ...(profile?.statesCovered ?? [])]),
      metadata,
      sourceRefs: uniqueSorted([organization.id, ...(profile ? [profile.id] : [])]),
      sourceChecksum: sha256ForPayload({
        organizationId: organization.id,
        name: organization.name,
        slug: organization.slug,
        profile,
      }),
      sourceUpdatedAt: profile?.updatedAt ?? organization.updatedAt,
      now,
    }));
    organizationNodeById.set(organization.id, orgNode);
  }

  for (const membership of workspaceMemberships) {
    if (!membership.active) continue;
    const clinicianNode = membership.personProfile.npi
      ? clinicianNodeByNpi.get(membership.personProfile.npi)
      : undefined;
    const orgNode = membership.organizationProfile.organizationId
      ? organizationNodeById.get(membership.organizationProfile.organizationId)
      : undefined;
    if (!clinicianNode || !orgNode) continue;

    addEdge(context, buildEdge({
      sourceNodeId: clinicianNode.id,
      targetNodeId: orgNode.id,
      edgeType: 'affiliated_with',
      directed: true,
      reciprocal: false,
      confidence: 0.9,
      status: 'active',
      createdBy: 'system',
      provenance: { role: membership.role },
      explanation: `Workspace membership role ${membership.role}`,
      materialHash: sha256ForPayload({ clinicianNodeId: clinicianNode.id, orgNodeId: orgNode.id, role: membership.role }),
      now,
    }));
  }

  for (const opportunity of opportunities) {
    const organizationNode = organizationNodeById.get(opportunity.organizationId);
    if (!organizationNode) continue;
    const metadata: JsonRecord = {
      opportunityId: opportunity.id,
      specialty: opportunity.specialty,
      state: opportunity.state,
      status: opportunity.status,
      organizationId: opportunity.organizationId,
    };
    const programNode = addNode(context, buildNode({
      type: 'program',
      sourceKind: 'opportunity',
      sourceId: opportunity.id,
      label: opportunity.title,
      title: opportunity.title,
      groupKey: opportunity.specialty,
      tags: extractNodeTags(metadata, [opportunity.specialty, opportunity.state]),
      metadata,
      sourceRefs: [opportunity.id],
      sourceChecksum: sha256ForPayload(opportunity),
      sourceUpdatedAt: opportunity.updatedAt,
      now,
    }));
    opportunityNodeById.set(opportunity.id, programNode);

    addEdge(context, buildEdge({
      sourceNodeId: organizationNode.id,
      targetNodeId: programNode.id,
      edgeType: 'parent_of',
      directed: true,
      reciprocal: false,
      confidence: 1,
      status: 'active',
      createdBy: 'system',
      provenance: { organizationId: opportunity.organizationId },
      explanation: 'Organization publishes opportunity/program node',
      materialHash: sha256ForPayload({ organizationId: opportunity.organizationId, opportunityId: opportunity.id }),
      now,
    }));
  }

  for (const application of applications) {
    if (!application.npi) continue;
    const clinicianNode = clinicianNodeByNpi.get(application.npi);
    const programNode = opportunityNodeById.get(application.opportunityId);
    if (!clinicianNode || !programNode) continue;

    addEdge(context, buildEdge({
      sourceNodeId: clinicianNode.id,
      targetNodeId: programNode.id,
      edgeType: 'related_to',
      directed: false,
      reciprocal: true,
      confidence: application.status === 'ACCEPTED' ? 0.85 : 0.55,
      status: 'active',
      createdBy: 'system',
      provenance: { applicationId: application.id, status: application.status },
      explanation: `Clinician application ${application.status.toLowerCase()}`,
      materialHash: sha256ForPayload({ applicationId: application.id, status: application.status }),
      now,
    }));
  }

  for (const artifact of verificationArtifacts) {
    const artifactPayload = asRecord(artifact.rawPayload);
    const clinicianNode = clinicianNodeByNpi.get(artifact.npi);
    const sourceNode = sourceNodeBySourceId.get(artifact.source) ?? addNode(context, buildNode({
      type: 'source',
      sourceKind: 'source',
      sourceId: artifact.source,
      label: artifact.source,
      title: artifact.source,
      groupKey: artifact.source,
      tags: extractNodeTags(artifactPayload, [artifact.source, artifact.artifactType, artifact.trustTier]),
      metadata: {
        sourceId: artifact.source,
        trustTier: artifact.trustTier,
      },
      sourceRefs: [artifact.id],
      sourceChecksum: sha256ForPayload({ sourceId: artifact.source }),
      sourceUpdatedAt: artifact.statusLastChecked,
      now,
    }));
    sourceNodeBySourceId.set(artifact.source, sourceNode);

    const artifactNode = addNode(context, buildNode({
      type: coerceNodeType(artifact.artifactType.toLowerCase() === 'license' ? 'license' : 'artifact', 'artifact'),
      sourceKind: 'verification_artifact',
      sourceId: artifact.id,
      label: asString(artifactPayload.credentialType)
        ?? asString(artifactPayload.licenseType)
        ?? `${artifact.source} ${artifact.artifactType}`.trim(),
      title: asString(artifactPayload.title) ?? `${artifact.source} ${artifact.artifactType}`.trim(),
      groupKey: artifact.source,
      tags: extractNodeTags(artifactPayload, [artifact.source, artifact.artifactType, artifact.trustTier]),
      metadata: {
        artifactId: artifact.id,
        npi: artifact.npi,
        source: artifact.source,
        status: artifact.status,
        lifecycleState: artifact.lifecycleState,
        trustTier: artifact.trustTier,
        confidenceScore: artifact.confidenceScore,
        expiresAt: artifact.expiresAt?.toISOString(),
      },
      sourceRefs: [artifact.id],
      sourceChecksum: artifact.checksum,
      sourceUpdatedAt: artifact.statusLastChecked,
      now,
    }));
    artifactNodeById.set(artifact.id, artifactNode);

    addAttachmentNodes(context, artifactNode, artifactPayload.attachments, now);

    if (clinicianNode) {
      addEdge(context, buildEdge({
        sourceNodeId: artifactNode.id,
        targetNodeId: clinicianNode.id,
        edgeType: 'verifies',
        directed: true,
        reciprocal: false,
        confidence: artifact.confidenceScore ?? 0.8,
        status: 'active',
        createdBy: 'system',
        provenance: { artifactId: artifact.id, source: artifact.source },
        explanation: 'Verification artifact verifies clinician subject',
        materialHash: artifact.checksum,
        now,
      }));
    }

    addEdge(context, buildEdge({
      sourceNodeId: artifactNode.id,
      targetNodeId: sourceNode.id,
      edgeType: 'verified_by',
      directed: true,
      reciprocal: false,
      confidence: artifact.confidenceScore ?? 0.85,
      status: 'active',
      createdBy: 'system',
      provenance: { artifactId: artifact.id, source: artifact.source },
      explanation: 'Verification artifact anchored to source authority',
      materialHash: artifact.checksum,
      now,
    }));
  }

  for (const sourceRecord of sourceRecords) {
    const clinicianNode = clinicianNodeByNpi.get(sourceRecord.subjectNpi);
    const sourceNode = sourceNodeBySourceId.get(sourceRecord.sourceId) ?? addNode(context, buildNode({
      type: 'source',
      sourceKind: 'source',
      sourceId: sourceRecord.sourceId,
      label: sourceRecord.sourceId,
      title: sourceRecord.sourceId,
      groupKey: sourceRecord.sourceId,
      tags: extractNodeTags(asRecord(sourceRecord.metadata), [sourceRecord.sourceId, sourceRecord.trustTier]),
      metadata: { sourceId: sourceRecord.sourceId, sourceUrl: sourceRecord.sourceUrl },
      sourceRefs: [sourceRecord.id],
      sourceChecksum: sourceRecord.checksum,
      sourceUpdatedAt: sourceRecord.observedAt ?? sourceRecord.fetchedAt,
      now,
    }));
    sourceNodeBySourceId.set(sourceRecord.sourceId, sourceNode);
    if (!clinicianNode) continue;

    addEdge(context, buildEdge({
      sourceNodeId: clinicianNode.id,
      targetNodeId: sourceNode.id,
      edgeType: 'sourced_from',
      directed: true,
      reciprocal: false,
      confidence: 0.6,
      status: 'active',
      createdBy: 'system',
      provenance: { sourceRecordId: sourceRecord.id, sourceUrl: sourceRecord.sourceUrl },
      explanation: 'Clinician has indexed source record provenance',
      materialHash: sourceRecord.checksum,
      now,
    }));
  }

  for (const claim of claimRecords) {
    const metadata = asRecord(claim.value);
    const claimNode = addNode(context, buildNode({
      type: 'claim',
      sourceKind: 'claim_record',
      sourceId: claim.id,
      label: claim.claimType,
      title: claim.claimType,
      groupKey: claim.claimType,
      tags: extractNodeTags(metadata, [claim.claimType, claim.sourceId]),
      metadata: {
        claimId: claim.claimId,
        subjectNpi: claim.subjectNpi,
        confidenceScore: claim.confidenceScore,
        sourceId: claim.sourceId,
      },
      sourceRefs: [claim.id],
      sourceChecksum: sha256ForPayload({
        claimId: claim.claimId,
        claimType: claim.claimType,
        value: claim.value,
      }),
      sourceUpdatedAt: claim.observedAt,
      now,
    }));

    const clinicianNode = clinicianNodeByNpi.get(claim.subjectNpi);
    if (clinicianNode) {
      addEdge(context, buildEdge({
        sourceNodeId: claimNode.id,
        targetNodeId: clinicianNode.id,
        edgeType: 'references',
        directed: true,
        reciprocal: false,
        confidence: claim.confidenceScore,
        status: 'active',
        createdBy: 'system',
        provenance: { claimRecordId: claim.id },
        explanation: 'Claim references clinician subject',
        materialHash: sha256ForPayload({ claimId: claim.claimId, subjectNpi: claim.subjectNpi }),
        now,
      }));
    }

    if (claim.verificationArtifactId) {
      const artifactNode = artifactNodeById.get(claim.verificationArtifactId);
      if (artifactNode) {
        addEdge(context, buildEdge({
          sourceNodeId: claimNode.id,
          targetNodeId: artifactNode.id,
          edgeType: 'derived_from',
          directed: true,
          reciprocal: false,
          confidence: claim.confidenceScore,
          status: 'active',
          createdBy: 'system',
          provenance: { claimRecordId: claim.id, verificationArtifactId: claim.verificationArtifactId },
          explanation: 'Claim derived from verification artifact',
          materialHash: sha256ForPayload({ claimId: claim.claimId, verificationArtifactId: claim.verificationArtifactId }),
          now,
        }));
      }
    }
  }

  for (const decision of decisionCapsules) {
    const metadata = asRecord(decision.metadata);
    const clinicianNode = clinicianNodeByNpi.get(decision.subjectNpi);
    const organizationName = asString(metadata.organizationName) ?? asString(metadata.employerId);
    const organizationNode = organizationName
      ? addNode(context, buildNode({
          type: 'institution',
          sourceKind: 'decision_organization',
          sourceId: slugify(organizationName),
          label: organizationName,
          title: organizationName,
          groupKey: slugify(organizationName),
          tags: extractNodeTags(metadata, [organizationName]),
          metadata: {
            organizationId: asString(metadata.organizationId),
            organizationName,
          },
          sourceRefs: [decision.id],
          sourceChecksum: sha256ForPayload({ organizationName }),
          sourceUpdatedAt: decision.updatedAt,
          now,
        }))
      : null;

    const decisionNode = addNode(context, buildNode({
      type: 'decision',
      sourceKind: 'decision_capsule',
      sourceId: decision.id,
      label: `${decision.decisionType} ${decision.status}`,
      title: `${decision.decisionType} ${decision.status}`,
      groupKey: decision.decisionType,
      tags: extractNodeTags(metadata, [decision.decisionType, decision.status]),
      metadata: {
        decisionId: decision.id,
        subjectNpi: decision.subjectNpi,
        decisionType: decision.decisionType,
        status: decision.status,
        issuerIds: decision.issuerIds,
      },
      sourceRefs: [decision.id, ...decision.credentialIds],
      sourceChecksum: sha256ForPayload({
        id: decision.id,
        status: decision.status,
        credentialIds: decision.credentialIds,
        metadata: decision.metadata,
      }),
      sourceUpdatedAt: decision.updatedAt,
      now,
    }));

    if (clinicianNode) {
      addEdge(context, buildEdge({
        sourceNodeId: decisionNode.id,
        targetNodeId: clinicianNode.id,
        edgeType: 'derived_from',
        directed: true,
        reciprocal: false,
        confidence: 0.8,
        status: 'active',
        createdBy: 'system',
        provenance: { decisionId: decision.id },
        explanation: 'Decision capsule references clinician subject',
        materialHash: sha256ForPayload({ decisionId: decision.id, subjectNpi: decision.subjectNpi }),
        now,
      }));
    }

    if (clinicianNode && organizationNode) {
      addEdge(context, buildEdge({
        sourceNodeId: clinicianNode.id,
        targetNodeId: organizationNode.id,
        edgeType: 'accepted_by',
        directed: true,
        reciprocal: false,
        confidence: decision.status === 'VALID' ? 0.9 : 0.5,
        status: 'active',
        createdBy: 'system',
        provenance: { decisionId: decision.id, decisionType: decision.decisionType },
        explanation: 'Decision capsule associates clinician with organization',
        materialHash: sha256ForPayload({ decisionId: decision.id, organizationName }),
        now,
      }));
    }

    for (const credentialId of decision.credentialIds) {
      const artifactNode = artifactNodeById.get(credentialId);
      if (!artifactNode) continue;
      addEdge(context, buildEdge({
        sourceNodeId: decisionNode.id,
        targetNodeId: artifactNode.id,
        edgeType: 'depends_on',
        directed: true,
        reciprocal: false,
        confidence: 1,
        status: 'active',
        createdBy: 'system',
        provenance: { decisionId: decision.id, credentialId },
        explanation: 'Decision depends on credential evidence',
        materialHash: sha256ForPayload({ decisionId: decision.id, credentialId }),
        now,
      }));
    }
  }

  const searchObjectIdSet = new Set(searchObjects.map((searchObject) => searchObject.id));

  for (const searchObject of searchObjects) {
    const metadata = asRecord(searchObject.metadata);
    const explicitLinks = uniqueSorted([
      ...asStringArray(metadata.explicitLinks),
      ...asStringArray(metadata.relatedIds),
      ...asStringArray(metadata.links),
    ]);

    const documentNode = addNode(context, buildNode({
      type: 'document',
      sourceKind: 'search_object',
      sourceId: searchObject.id,
      label: searchObject.title,
      title: searchObject.title,
      groupKey: searchObject.type,
      tags: extractNodeTags(metadata, [searchObject.type, searchObject.referenceId]),
      metadata: {
        searchObjectId: searchObject.id,
        referenceId: searchObject.referenceId,
        sourceUrl: searchObject.sourceUrl,
        bodyPreview: searchObject.body.slice(0, 160),
        active: searchObject.active,
      },
      sourceRefs: [searchObject.id],
      sourceChecksum: sha256ForPayload({
        id: searchObject.id,
        title: searchObject.title,
        body: searchObject.body,
        metadata: searchObject.metadata,
      }),
      sourceUpdatedAt: searchObject.freshAt ?? searchObject.indexedAt,
      now,
    }));

    addAttachmentNodes(context, documentNode, metadata.attachments, now);

    for (const linkedSearchId of explicitLinks) {
      if (!searchObjectIdSet.has(linkedSearchId)) {
        addNode(context, buildNode({
          type: 'document',
          sourceKind: 'search_object',
          sourceId: linkedSearchId,
          label: `Unresolved document ${linkedSearchId}`,
          title: `Unresolved document ${linkedSearchId}`,
          groupKey: 'unresolved',
          tags: ['unresolved-link'],
          metadata: {
            unresolved: true,
            linkedFrom: searchObject.id,
          },
          sourceRefs: [searchObject.id],
          sourceChecksum: sha256ForPayload({
            linkedSearchId,
            linkedFrom: searchObject.id,
          }),
          sourceUpdatedAt: searchObject.freshAt ?? searchObject.indexedAt,
          now,
        }));
      }

      const targetNodeId = createGraphNodeId({
        type: 'document',
        sourceKind: 'search_object',
        sourceId: linkedSearchId,
      });
      addEdge(context, buildEdge({
        sourceNodeId: documentNode.id,
        targetNodeId,
        edgeType: 'explicit_link',
        directed: true,
        reciprocal: true,
        confidence: 1,
        status: 'active',
        createdBy: 'ingest',
        provenance: { searchObjectId: searchObject.id, linkedSearchId },
        explanation: 'Explicit content graph link from indexed search object metadata',
        materialHash: sha256ForPayload({ searchObjectId: searchObject.id, linkedSearchId }),
        now,
      }));
    }
  }

  for (const node of [...context.nodes.values()]) {
    addTagNodes(context, node, now);
  }

  addSemanticEdges(context, now);

  const ruleMap = await loadReciprocalRuleMap(prismaClient);
  applyReciprocalRules(context, ruleMap, now);

  return { context, executionMode, staleNodeIds };
}

async function upsertProjection(
  prismaClient: PrismaClient,
  context: ProjectionContext,
  buildType: GraphRebuildType,
): Promise<void> {
  for (const node of context.nodes.values()) {
    await prismaClient.graphNode.upsert({
      where: { id: node.id },
      update: {
        canonicalKey: node.canonicalKey,
        type: node.type,
        label: node.label,
        title: node.title,
        colorGroup: node.colorGroup,
        groupKey: node.groupKey,
        tags: node.tags,
        metadata: toJsonValue(node.metadata),
        sourceRefs: node.sourceRefs,
        sourceChecksum: node.sourceChecksum,
        sourceUpdatedAt: node.sourceUpdatedAt,
        active: node.active,
      },
      create: {
        id: node.id,
        canonicalKey: node.canonicalKey,
        type: node.type,
        label: node.label,
        title: node.title,
        colorGroup: node.colorGroup,
        groupKey: node.groupKey,
        tags: node.tags,
        metadata: toJsonValue(node.metadata),
        sourceRefs: node.sourceRefs,
        sourceChecksum: node.sourceChecksum,
        sourceUpdatedAt: node.sourceUpdatedAt,
        active: node.active,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      },
    });
  }

  for (const edge of context.edges.values()) {
    await prismaClient.graphEdge.upsert({
      where: { id: edge.id },
      update: {
        canonicalKey: edge.canonicalKey,
        pairKey: edge.pairKey,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        edgeType: edge.edgeType,
        directed: edge.directed,
        reciprocal: edge.reciprocal,
        reverseEdgeId: null,
        confidence: edge.confidence,
        status: edge.status.toUpperCase(),
        createdBy: edge.createdBy,
        provenance: toJsonValue(edge.provenance),
        explanation: edge.explanation,
        materialHash: edge.materialHash,
      },
      create: {
        id: edge.id,
        canonicalKey: edge.canonicalKey,
        pairKey: edge.pairKey,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        edgeType: edge.edgeType,
        directed: edge.directed,
        reciprocal: edge.reciprocal,
        reverseEdgeId: null,
        confidence: edge.confidence,
        status: edge.status.toUpperCase(),
        createdBy: edge.createdBy,
        provenance: toJsonValue(edge.provenance),
        explanation: edge.explanation,
        materialHash: edge.materialHash,
        createdAt: edge.createdAt,
        updatedAt: edge.updatedAt,
      },
    });
  }

  for (const edge of context.edges.values()) {
    if (!edge.reverseEdgeId) continue;

    await prismaClient.graphEdge.update({
      where: { id: edge.id },
      data: { reverseEdgeId: edge.reverseEdgeId },
    });
  }

  if (buildType === 'full') {
    const desiredNodeIds = [...context.nodes.keys()];
    const desiredEdgeIds = [...context.edges.values()]
      .filter((edge) => edge.createdBy === 'system' || edge.createdBy === 'ingest')
      .map((edge) => edge.id);

    await prismaClient.graphNode.updateMany({
      where: {
        active: true,
        id: { notIn: desiredNodeIds.length > 0 ? desiredNodeIds : ['__none__'] },
      },
      data: { active: false },
    });

    await prismaClient.graphEdge.updateMany({
      where: {
        createdBy: { in: ['system', 'ingest'] },
        id: { notIn: desiredEdgeIds.length > 0 ? desiredEdgeIds : ['__none__'] },
        status: { not: 'SUPERSEDED' },
      },
      data: { status: 'SUPERSEDED' },
    });
  }
}

async function recomputeDegrees(prismaClient: PrismaClient): Promise<void> {
  await prismaClient.$executeRaw`
    WITH active_nodes AS (
      SELECT id
      FROM graph_nodes
      WHERE active = true
    ),
    outgoing AS (
      SELECT source_node_id AS id, COUNT(*)::INTEGER AS count
      FROM graph_edges
      WHERE status = 'ACTIVE'
      GROUP BY source_node_id
    ),
    incoming AS (
      SELECT target_node_id AS id, COUNT(*)::INTEGER AS count
      FROM graph_edges
      WHERE status = 'ACTIVE'
      GROUP BY target_node_id
    ),
    counters AS (
      SELECT
        active_nodes.id,
        COALESCE(outgoing.count, 0) + COALESCE(incoming.count, 0) AS degree,
        COALESCE(incoming.count, 0) AS in_degree,
        COALESCE(outgoing.count, 0) AS out_degree
      FROM active_nodes
      LEFT JOIN outgoing USING (id)
      LEFT JOIN incoming USING (id)
    )
    UPDATE graph_nodes AS graph_node
    SET
      degree = counters.degree,
      in_degree = counters.in_degree,
      out_degree = counters.out_degree,
      updated_at = CURRENT_TIMESTAMP
    FROM counters
    WHERE graph_node.id = counters.id
  `;

  await prismaClient.graphNode.updateMany({
    where: { active: false },
    data: {
      degree: 0,
      inDegree: 0,
      outDegree: 0,
    },
  });
}

async function validateReciprocalIntegrity(
  prismaClient: PrismaClient,
): Promise<Array<{ edgeId: string; reason: string }>> {
  const ruleMap = await loadReciprocalRuleMap(prismaClient);
  const edges = await prismaClient.graphEdge.findMany({
    where: {
      reciprocal: true,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      edgeType: true,
      sourceNodeId: true,
      targetNodeId: true,
      reverseEdgeId: true,
    },
  });

  const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  const issues: Array<{ edgeId: string; reason: string }> = [];

  for (const edge of edges) {
    const rule = ruleMap.get(edge.edgeType);
    if (!rule) {
      issues.push({ edgeId: edge.id, reason: 'Missing reciprocal rule' });
      continue;
    }

    if (!edge.reverseEdgeId) {
      issues.push({ edgeId: edge.id, reason: 'Missing reverseEdgeId' });
      continue;
    }

    const reverse = edgeMap.get(edge.reverseEdgeId);
    if (!reverse) {
      issues.push({ edgeId: edge.id, reason: 'Reverse edge row missing' });
      continue;
    }

    if (reverse.sourceNodeId !== edge.targetNodeId || reverse.targetNodeId !== edge.sourceNodeId) {
      issues.push({ edgeId: edge.id, reason: 'Reverse edge direction mismatch' });
    }

    if (reverse.edgeType !== rule.reverseEdgeType) {
      issues.push({ edgeId: edge.id, reason: `Expected reverse edge type ${rule.reverseEdgeType}, found ${reverse.edgeType}` });
    }
  }

  return issues;
}

async function collectOrphanNodeIds(prismaClient: PrismaClient): Promise<string[]> {
  const nodes = await prismaClient.graphNode.findMany({
    where: { active: true, degree: 0 },
    select: { id: true },
  });
  return nodes.map((node) => node.id);
}

async function primeSnapshotsAfterRebuild(
  buildRunId: string,
  input: GraphRebuildInput,
): Promise<string[]> {
  const { primeGraphSnapshots } = await import('./queryService');
  return primeGraphSnapshots({
    buildRunId,
    graphMode: input.graphMode ?? 'blended',
    targetNodeId: input.targetNodeId ?? null,
  });
}

function graphModesForMutation(graphMode?: GraphLayer | null): GraphLayer[] {
  if (graphMode === 'knowledge') return ['knowledge', 'blended'];
  if (graphMode === 'trust') return ['trust', 'blended'];
  return ['knowledge', 'trust', 'blended'];
}

function buildRunRequestFingerprint(input: GraphRebuildInput): string {
  return createGraphBuildRequestFingerprint({
    buildType: input.buildType,
    graphMode: input.graphMode ?? null,
    scopeKey: input.targetNodeId ?? (input.graphMode ?? 'blended'),
    targetNodeId: input.targetNodeId ?? null,
    invalidationReasons: input.invalidationReasons ?? [],
  });
}

async function createBuildRun(
  prismaClient: PrismaClient,
  input: GraphRebuildInput,
  startedAt: Date,
  existingBuildRunId?: string,
): Promise<PrismaGraphBuildRun> {
  const requestFingerprint = buildRunRequestFingerprint(input);
  if (existingBuildRunId) {
    return prismaClient.graphBuildRun.update({
      where: { id: existingBuildRunId },
      data: {
        status: 'RUNNING',
        errorText: null,
        startedAt,
        completedAt: null,
        invalidationReasons: input.invalidationReasons ?? [],
        requestFingerprint,
        summary: toJsonValue({
          buildType: input.buildType,
          startedAt: startedAt.toISOString(),
          resumed: true,
        }),
      },
    });
  }

  return prismaClient.graphBuildRun.create({
    data: {
      id: createGraphBuildRunId({
        buildType: input.buildType,
        graphMode: input.graphMode ?? null,
        scopeKey: input.buildType,
        targetNodeId: input.targetNodeId ?? null,
      }),
      buildType: input.buildType.toUpperCase(),
      status: 'RUNNING',
      requestedBy: input.requestedBy ?? null,
      requestFingerprint,
      graphMode: input.graphMode ?? null,
      scopeType: input.targetNodeId ? 'NODE' : 'GLOBAL',
      scopeKey: input.targetNodeId ?? (input.graphMode ?? 'blended'),
      targetNodeId: input.targetNodeId ?? null,
      invalidationReasons: input.invalidationReasons ?? [],
      summary: toJsonValue({
        buildType: input.buildType,
        startedAt: startedAt.toISOString(),
      }),
      startedAt,
    },
  });
}

export async function runGraphRebuild(
  input: GraphRebuildInput,
  prismaClient: PrismaClient = prisma,
  existingBuildRunId?: string,
): Promise<GraphRebuildResult> {
  const now = new Date();
  await ensureReciprocalEdgeRules(prismaClient);
  const buildRun = await createBuildRun(prismaClient, input, now, existingBuildRunId);

  try {
    const { context, executionMode, staleNodeIds } = await buildProjection(prismaClient, input, now);
    await upsertProjection(prismaClient, context, input.buildType);
    await recomputeDegrees(prismaClient);
    if (input.buildType === 'full' || executionMode === 'fallback_full') {
      await invalidateAllGraphSnapshots(prismaClient, `graph_rebuild:${input.buildType}`);
    } else {
      await invalidateGraphSnapshots(prismaClient, {
        reason: `graph_rebuild:${input.buildType}`,
        graphModes: graphModesForMutation(input.graphMode ?? null),
        focusNodeIds: [...context.nodes.keys()],
        invalidateGlobal: true,
        metadata: {
          buildRunId: buildRun.id,
          buildType: input.buildType,
          executionMode,
        },
      });
    }
    const [orphanNodeIds, reciprocalIssues, snapshotIds] = await Promise.all([
      collectOrphanNodeIds(prismaClient),
      validateReciprocalIntegrity(prismaClient),
      primeSnapshotsAfterRebuild(buildRun.id, input),
    ]);

    const completedAt = new Date();
    await prismaClient.graphBuildRun.update({
      where: { id: buildRun.id },
      data: {
        status: reciprocalIssues.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        completedAt,
        summary: toJsonValue({
          executionMode,
          nodeCount: context.nodes.size,
          edgeCount: context.edges.size,
          orphanCount: orphanNodeIds.length,
          reciprocalIssueCount: reciprocalIssues.length,
          staleNodeIds,
          snapshotIds,
        }),
      },
    });

    log('info', 'graph_rebuild: completed', {
      buildRunId: buildRun.id,
      buildType: input.buildType,
      executionMode,
      nodeCount: context.nodes.size,
      edgeCount: context.edges.size,
      orphanCount: orphanNodeIds.length,
      reciprocalIssueCount: reciprocalIssues.length,
    });

    return {
      buildRunId: buildRun.id,
      status: reciprocalIssues.length > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
      executionMode,
      nodeCount: context.nodes.size,
      edgeCount: context.edges.size,
      orphanNodeIds,
      reciprocalIssues,
      staleNodeIds,
      snapshotIds,
      startedAt: now.toISOString(),
      completedAt: completedAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prismaClient.graphBuildRun.update({
      where: { id: buildRun.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorText: message,
      },
    });
    log('error', 'graph_rebuild: failed', {
      buildRunId: buildRun.id,
      error: message,
    });
    throw error;
  }
}

export async function enqueueGraphRebuild(
  input: GraphRebuildInput,
  prismaClient: PrismaClient = prisma,
): Promise<{ buildRunId: string }> {
  const requestFingerprint = buildRunRequestFingerprint(input);
  const existing = await prismaClient.graphBuildRun.findFirst({
    where: {
      requestFingerprint,
      status: { in: ['QUEUED', 'CLAIMED', 'RUNNING'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing) {
    return { buildRunId: existing.id };
  }

  const runId = createGraphBuildRunId({
    buildType: input.buildType,
    graphMode: input.graphMode ?? null,
    scopeKey: input.buildType,
    targetNodeId: input.targetNodeId ?? null,
  });

  await prismaClient.graphBuildRun.create({
    data: {
      id: runId,
      buildType: input.buildType.toUpperCase(),
      status: 'QUEUED',
      requestedBy: input.requestedBy ?? null,
      requestFingerprint,
      graphMode: input.graphMode ?? null,
      scopeType: input.targetNodeId ? 'NODE' : 'GLOBAL',
      scopeKey: input.targetNodeId ?? (input.graphMode ?? 'blended'),
      targetNodeId: input.targetNodeId ?? null,
      invalidationReasons: input.invalidationReasons ?? [],
      summary: toJsonValue({
        enqueuedAt: new Date().toISOString(),
      }),
    },
  });

  return { buildRunId: runId };
}

export async function processQueuedGraphBuilds(
  prismaClient: PrismaClient = prisma,
): Promise<GraphRebuildResult[]> {
  const queuedRuns = await prismaClient.graphBuildRun.findMany({
    where: { status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });

  const results: GraphRebuildResult[] = [];
  for (const run of queuedRuns) {
    const claim = await prismaClient.graphBuildRun.updateMany({
      where: {
        id: run.id,
        status: 'QUEUED',
      },
      data: { status: 'CLAIMED' },
    });
    if (claim.count === 0) continue;

    const result = await runGraphRebuild({
      buildType: run.buildType.toLowerCase() as GraphRebuildType,
      graphMode: (run.graphMode as GraphLayer | null) ?? 'blended',
      targetNodeId: run.targetNodeId ?? null,
      invalidationReasons: run.invalidationReasons,
      requestedBy: run.requestedBy ?? null,
    }, prismaClient, run.id);
    results.push(result);
  }

  return results;
}

export async function getGraphDiagnostics(
  prismaClient: PrismaClient = prisma,
): Promise<{
  lastBuildRun: PrismaGraphBuildRun | null;
  recentBuildRuns: PrismaGraphBuildRun[];
  snapshotFreshness: {
    total: number;
    stale: number;
    fresh: number;
    oldestFreshBuiltAt: string | null;
    newestFreshBuiltAt: string | null;
  };
  staleSnapshotCount: number;
  orphanNodeCount: number;
  orphanNodes: Array<{ id: string; label: string; type: string }>;
  rejectMemoryCount: number;
  rejectMemoryInventory: Array<{
    id: string;
    pairKey: string;
    edgeType: string;
    rationale: string | null;
    reviewerId: string | null;
    suppressionCount: number;
    lastRejectedAt: string;
    reconsiderAfter: string | null;
  }>;
  reciprocalIssueCount: number;
  reciprocalIssues: Array<{ edgeId: string; reason: string }>;
  payloadSizeDiagnostics: Array<{
    snapshotId: string;
    scopeType: string;
    scopeKey: string;
    graphMode: string;
    payloadBytes: number;
    builtAt: string;
    invalidatedAt: string | null;
  }>;
}> {
  const [
    lastBuildRun,
    recentBuildRuns,
    staleSnapshotCount,
    totalSnapshotCount,
    freshestSnapshots,
    orphanNodeCount,
    orphanNodes,
    rejectMemoryCount,
    rejectMemoryRows,
    reciprocalIssues,
    payloadSizeDiagnostics,
  ] = await Promise.all([
    prismaClient.graphBuildRun.findFirst({ orderBy: { createdAt: 'desc' } }),
    prismaClient.graphBuildRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prismaClient.graphSnapshot.count({ where: { invalidatedAt: { not: null } } }),
    prismaClient.graphSnapshot.count(),
    prismaClient.graphSnapshot.findMany({
      where: { invalidatedAt: null },
      orderBy: [{ builtAt: 'asc' }],
      select: { builtAt: true },
    }),
    prismaClient.graphNode.count({ where: { active: true, degree: 0 } }),
    prismaClient.graphNode.findMany({
      where: { active: true, degree: 0 },
      select: { id: true, label: true, type: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 50,
    }),
    prismaClient.graphRejectMemory.count(),
    prismaClient.graphRejectMemory.findMany({
      orderBy: [{ lastRejectedAt: 'desc' }, { suppressionCount: 'desc' }],
      take: 50,
      select: {
        id: true,
        pairKey: true,
        edgeType: true,
        rationale: true,
        reviewerId: true,
        suppressionCount: true,
        lastRejectedAt: true,
        reconsiderAfter: true,
      },
    }),
    validateReciprocalIntegrity(prismaClient),
    prismaClient.graphSnapshot.findMany({
      orderBy: [{ payloadBytes: 'desc' }, { builtAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        scopeType: true,
        scopeKey: true,
        graphMode: true,
        payloadBytes: true,
        builtAt: true,
        invalidatedAt: true,
      },
    }),
  ]);

  const oldestFreshBuiltAt = freshestSnapshots[0]?.builtAt ?? null;
  const newestFreshBuiltAt = freshestSnapshots[freshestSnapshots.length - 1]?.builtAt ?? null;

  return {
    lastBuildRun,
    recentBuildRuns,
    snapshotFreshness: {
      total: totalSnapshotCount,
      stale: staleSnapshotCount,
      fresh: totalSnapshotCount - staleSnapshotCount,
      oldestFreshBuiltAt: oldestFreshBuiltAt ? oldestFreshBuiltAt.toISOString() : null,
      newestFreshBuiltAt: newestFreshBuiltAt ? newestFreshBuiltAt.toISOString() : null,
    },
    staleSnapshotCount,
    orphanNodeCount,
    orphanNodes,
    rejectMemoryCount,
    rejectMemoryInventory: rejectMemoryRows.map((row) => ({
      id: row.id,
      pairKey: row.pairKey,
      edgeType: row.edgeType,
      rationale: row.rationale,
      reviewerId: row.reviewerId,
      suppressionCount: row.suppressionCount,
      lastRejectedAt: row.lastRejectedAt.toISOString(),
      reconsiderAfter: row.reconsiderAfter?.toISOString() ?? null,
    })),
    reciprocalIssueCount: reciprocalIssues.length,
    reciprocalIssues,
    payloadSizeDiagnostics: payloadSizeDiagnostics.map((snapshot) => ({
      snapshotId: snapshot.id,
      scopeType: snapshot.scopeType,
      scopeKey: snapshot.scopeKey,
      graphMode: snapshot.graphMode,
      payloadBytes: snapshot.payloadBytes,
      builtAt: snapshot.builtAt.toISOString(),
      invalidatedAt: snapshot.invalidatedAt?.toISOString() ?? null,
    })),
  };
}
