import type {
  EhrSynchronization,
  OrgProfile,
  PayerEnrollmentV2,
  PrismaClient,
  PrivilegeDependency as PrismaPrivilegeDependency,
  PrivilegeNode as PrismaPrivilegeNode,
} from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { buildCredentialGraphForClinician } from '../../graph/credential/credentialGraphBuilder.js';
import type { CredentialGraph } from '../../graph/credential/types.js';
import {
  getAuthorizedStatesDetailed,
  type CompactAuthorizationDetail,
} from '../../compacts/compactGraph.js';
import { normalizeStateCode } from '../../compacts/models/CompactParticipation.js';
import { PrivilegeGraphBuilder, type PrivilegeGraph } from '../../privyDep/buildGraph.js';
import type { PrivilegeNode } from '../../privyDep/models/PrivilegeNode.js';
import type { PrivilegeDependency } from '../../privyDep/models/PrivilegeDependency.js';
import {
  createWorkforceSupplyNode,
  mergeSupplyMetadata,
  type WorkforceSupplyMetadata,
  type WorkforceSupplyNode,
  type WorkforceSupplyNodeType,
} from '../models/WorkforceSupplyNode.js';
import {
  createWorkforceSupplyEdge,
  type WorkforceSupplyEdge,
  type WorkforceSupplyRelationType,
} from '../models/WorkforceSupplyEdge.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('workforce:supply-graph');

type PrismaPrivilegeDependencyRecord = PrismaPrivilegeDependency & {
  parentPrivilege: PrismaPrivilegeNode;
  childPrivilege: PrismaPrivilegeNode;
};

type PrismaLike = Pick<
  PrismaClient,
  | 'clinicianProfile'
  | 'privilegeGranted'
  | 'orgProfile'
  | 'clinicianCompactWallet'
  | 'payerEnrollmentV2'
  | 'ehrSynchronization'
  | 'privilegeNode'
  | 'privilegeDependency'
>;

const privilegeGraphCache = new Map<string, Promise<PrivilegeGraph | null>>();

export interface PrivilegeAssignment {
  grantId: string;
  privilegeCode: string;
  privilegeName?: string;
  privilegeSetId: string;
  orgId: string;
  orgName?: string;
  orgState?: string;
  status: string;
  grantedAt: Date;
  expiresAt: Date;
  dependencyCodes: string[];
}

export interface ClinicianCompactAuthorization extends CompactAuthorizationDetail {
  walletId: string;
  expiresAt?: Date | null;
}

export interface PayerEnrollmentSnapshot {
  id: string;
  payerId: string;
  clinicianId: string;
  payer: {
    id: string;
    name: string;
    states: string[];
    planTypes: string[];
  };
  status: PayerEnrollmentV2['status'];
  panelType?: string | null;
  effectiveDate?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface EhrRoleGrant {
  id: string;
  clinicianId: string;
  ehrSystem: string;
  privilegeCode: string;
  orgId?: string | null;
  status: EhrSynchronization['status'];
  lastSyncedAt?: Date | null;
}

export interface SupplyGraphBuilderSources {
  fetchCredentialGraph(clinicianId: string): Promise<CredentialGraph>;
  fetchPrivilegeAssignments(clinicianId: string): Promise<PrivilegeAssignment[]>;
  fetchCompactAuthorizations(clinicianId: string): Promise<ClinicianCompactAuthorization[]>;
  fetchPayerEnrollments(clinicianId: string): Promise<PayerEnrollmentSnapshot[]>;
  fetchEhrRoleGrants(clinicianId: string): Promise<EhrRoleGrant[]>;
}

export interface BuildSupplyGraphOptions {
  clinicianIds: string[];
  sources?: Partial<SupplyGraphBuilderSources>;
  prisma?: PrismaLike;
}

export interface ClinicianSupplySummary {
  clinicianId: string;
  licenses: number;
  privileges: number;
  enrollments: number;
  compacts: number;
  ehrRoles: number;
  statesLicensed: string[];
  statesViaCompacts: string[];
  orgsApproved: string[];
  payerCoverage: string[];
  privilegeCodes: string[];
}

export interface WorkforceSupplyGraph {
  nodes: WorkforceSupplyNode[];
  edges: WorkforceSupplyEdge[];
  clinicianSummaries: ClinicianSupplySummary[];
  generatedAt: Date;
}

const defaultSources = (client: PrismaLike): SupplyGraphBuilderSources => ({
  fetchCredentialGraph: (clinicianId) => buildCredentialGraphForClinician({ clinicianId }),
  fetchPrivilegeAssignments: (clinicianId) => loadPrivilegeAssignments(client, clinicianId),
  fetchCompactAuthorizations: (clinicianId) => loadCompactAuthorizations(client, clinicianId),
  fetchPayerEnrollments: (clinicianId) => loadPayerEnrollments(client, clinicianId),
  fetchEhrRoleGrants: (clinicianId) => loadEhrRoleGrants(client, clinicianId),
});

export async function buildSupplyGraph(
  options: BuildSupplyGraphOptions,
): Promise<WorkforceSupplyGraph> {
  if (!options.clinicianIds?.length) {
    return {
      nodes: [],
      edges: [],
      clinicianSummaries: [],
      generatedAt: new Date(),
    };
  }

  const client = options.prisma ?? prisma;
  const sources: SupplyGraphBuilderSources = {
    ...defaultSources(client),
    ...(options.sources ?? {}),
  };

  const nodeMap = new Map<string, WorkforceSupplyNode>();
  const edges: WorkforceSupplyEdge[] = [];
  const edgeKeys = new Set<string>();
  const summaries: ClinicianSupplySummary[] = [];

  for (const clinicianId of options.clinicianIds) {
    const summary = createEmptySummary(clinicianId);
    summaries.push(summary);

    const [
      credentialGraph,
      privilegeAssignments,
      compactAuthorizations,
      payerEnrollments,
      ehrRoleGrants,
    ] = await Promise.all([
      sources.fetchCredentialGraph(clinicianId).catch((error) => {
        log.error('Failed to build credential graph', { clinicianId, error });
        throw error;
      }),
      sources.fetchPrivilegeAssignments(clinicianId),
      sources.fetchCompactAuthorizations(clinicianId),
      sources.fetchPayerEnrollments(clinicianId),
      sources.fetchEhrRoleGrants(clinicianId),
    ]);

    const clinicianNodeId = credentialGraph.metadata.clinicianNodeId ?? `clinician:${clinicianId}`;
    const clinicianNode = upsertNode(nodeMap, {
      nodeId: clinicianNodeId,
      nodeType: 'CLINICIAN',
      metadata: {
        clinicianId,
        clinicianDid: credentialGraph.metadata.clinicianDid,
        name: credentialGraph.metadata.clinicianName,
        specialty: credentialGraph.metadata.specialty,
        homeState: credentialGraph.metadata.homeState,
      },
    });

    ingestCredentialGraphNodes(credentialGraph, clinicianNode, nodeMap, edges, edgeKeys, summary);
    ingestCompactAuthorizations(
      clinicianNode,
      compactAuthorizations,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestPrivilegeAssignments(
      clinicianNode,
      privilegeAssignments,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestPayerEnrollments(
      clinicianNode,
      payerEnrollments,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestEhrRoleGrants(clinicianNode, ehrRoleGrants, nodeMap, edges, edgeKeys, summary);
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    clinicianSummaries: summaries,
    generatedAt: new Date(),
  };
}

function ingestCredentialGraphNodes(
  graph: CredentialGraph,
  clinicianNode: WorkforceSupplyNode,
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  const stateCache = new Map<string, WorkforceSupplyNode>();

  for (const node of graph.nodes.filter((entry) => entry.type === 'state')) {
    const normalized = normalizeStateCode(node.label ?? node.id.replace('state:', ''));
    const stateNode = upsertNode(nodeMap, {
      nodeId: `state:${normalized}`,
      nodeType: 'STATE',
      metadata: {
        code: normalized,
        label: node.label,
      },
    });
    stateCache.set(normalized, stateNode);
  }

  for (const orgNode of graph.nodes.filter((entry) => entry.type === 'org')) {
    upsertNode(nodeMap, {
      nodeId: orgNode.id,
      nodeType: 'ORG',
      metadata: {
        name: orgNode.label,
        ...orgNode.metadata,
      },
    });
  }

  const licenseNodes = graph.nodes.filter((entry) => entry.type === 'license');
  summary.licenses += licenseNodes.length;

  for (const licenseNode of licenseNodes) {
    const supplyLicense = upsertNode(nodeMap, {
      nodeId: licenseNode.id,
      nodeType: 'LICENSE',
      metadata: {
        label: licenseNode.label,
        ...licenseNode.metadata,
        clinicianId: clinicianNode.metadata.clinicianId,
      },
    });

    const stateValue =
      typeof licenseNode.metadata?.state === 'string'
        ? licenseNode.metadata.state
        : undefined;
    if (!stateValue) {
      continue;
    }

    const normalized = normalizeStateCode(stateValue);
    const stateNode = stateCache.get(normalized) ?? ensureStateNode(nodeMap, normalized);
    stateCache.set(normalized, stateNode);

    if (!summary.statesLicensed.includes(normalized)) {
      summary.statesLicensed.push(normalized);
    }

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: supplyLicense.nodeId,
        targetNodeId: stateNode.nodeId,
        relationType: 'CAN_PRACTICE_IN',
        metadata: {
          via: 'LICENSE',
          licenseId: supplyLicense.nodeId,
        },
      },
      'LICENSE',
    );

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: stateNode.nodeId,
        relationType: 'CAN_PRACTICE_IN',
        metadata: {
          via: 'LICENSE',
          licenseId: supplyLicense.nodeId,
        },
      },
      `LICENSE:${normalized}`,
    );
  }
}

function ingestCompactAuthorizations(
  clinicianNode: WorkforceSupplyNode,
  authorizations: ClinicianCompactAuthorization[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.compacts += authorizations.length;

  for (const detail of authorizations) {
    const compactNode = upsertNode(nodeMap, {
      nodeId: `compact:${detail.compactType}:${detail.walletId}`,
      nodeType: 'COMPACT',
      metadata: {
        compactType: detail.compactType,
        homeState: detail.homeState,
        expiresAt: detail.expiresAt?.toISOString(),
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: compactNode.nodeId,
        relationType: 'ELIGIBLE_VIA_COMPACT',
        metadata: {
          compactType: detail.compactType,
        },
      },
      `COMPACT:${compactNode.nodeId}`,
    );

    for (const state of detail.states) {
      const normalized = normalizeStateCode(state);
      const stateNode = ensureStateNode(nodeMap, normalized);
      if (!summary.statesViaCompacts.includes(normalized)) {
        summary.statesViaCompacts.push(normalized);
      }

      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: compactNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'ELIGIBLE_VIA_COMPACT',
          metadata: {
            compactType: detail.compactType,
          },
        },
        `COMPACT_STATE:${compactNode.nodeId}:${normalized}`,
      );

      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: clinicianNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'CAN_PRACTICE_IN',
          metadata: {
            via: 'COMPACT',
            compactType: detail.compactType,
          },
        },
        `COMPACT_PRACTICE:${clinicianNode.nodeId}:${normalized}:${detail.compactType}`,
      );
    }
  }
}

function ingestPrivilegeAssignments(
  clinicianNode: WorkforceSupplyNode,
  assignments: PrivilegeAssignment[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.privileges += assignments.length;

  for (const assignment of assignments) {
    const privilegeNode = upsertNode(nodeMap, {
      nodeId: `privilege:${assignment.grantId}`,
      nodeType: 'PRIVILEGE',
      metadata: {
        privilegeCode: assignment.privilegeCode,
        privilegeName: assignment.privilegeName,
        orgId: assignment.orgId,
        status: assignment.status,
        grantedAt: assignment.grantedAt.toISOString(),
        expiresAt: assignment.expiresAt.toISOString(),
        dependencies: assignment.dependencyCodes,
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: privilegeNode.nodeId,
        relationType: 'CAN_PERFORM',
        metadata: {
          orgId: assignment.orgId,
          privilegeCode: assignment.privilegeCode,
        },
      },
      `CAN_PERFORM:${clinicianNode.nodeId}:${privilegeNode.nodeId}`,
    );

    if (!summary.privilegeCodes.includes(assignment.privilegeCode)) {
      summary.privilegeCodes.push(assignment.privilegeCode);
    }

    if (assignment.orgId) {
      const orgNode = upsertNode(nodeMap, {
        nodeId: `org:${assignment.orgId}`,
        nodeType: 'ORG',
        metadata: {
          orgId: assignment.orgId,
          name: assignment.orgName,
          state: assignment.orgState,
        },
      });

      if (!summary.orgsApproved.includes(assignment.orgId)) {
        summary.orgsApproved.push(assignment.orgId);
      }

      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: privilegeNode.nodeId,
          targetNodeId: orgNode.nodeId,
          relationType: 'APPROVED_AT_ORG',
          metadata: {
            privilegeCode: assignment.privilegeCode,
          },
        },
        `APPROVED:${privilegeNode.nodeId}:${orgNode.nodeId}`,
      );
    }
  }
}

function ingestPayerEnrollments(
  clinicianNode: WorkforceSupplyNode,
  enrollments: PayerEnrollmentSnapshot[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.enrollments += enrollments.length;

  for (const snapshot of enrollments) {
    const enrollmentNode = upsertNode(nodeMap, {
      nodeId: `enrollment:${snapshot.id}`,
      nodeType: 'ENROLLMENT',
      metadata: {
        status: snapshot.status,
        panelType: snapshot.panelType,
        effectiveDate: snapshot.effectiveDate?.toISOString(),
        metadata: snapshot.metadata ?? undefined,
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: enrollmentNode.nodeId,
        relationType: 'COVERED_BY_PAYER',
        metadata: {
          status: snapshot.status,
        },
      },
      `ENROLLMENT:${clinicianNode.nodeId}:${enrollmentNode.nodeId}`,
    );

    const payerNode = upsertNode(nodeMap, {
      nodeId: `payer:${snapshot.payer.id}`,
      nodeType: 'PAYER',
      metadata: {
        payerId: snapshot.payerId,
        name: snapshot.payer.name,
        states: snapshot.payer.states ?? [],
        planTypes: snapshot.payer.planTypes ?? [],
      },
    });

    if (!summary.payerCoverage.includes(snapshot.payer.id)) {
      summary.payerCoverage.push(snapshot.payer.id);
    }

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: enrollmentNode.nodeId,
        targetNodeId: payerNode.nodeId,
        relationType: 'COVERED_BY_PAYER',
        metadata: {
          status: snapshot.status,
        },
      },
      `PAYER_LINK:${enrollmentNode.nodeId}:${payerNode.nodeId}`,
    );

    for (const state of snapshot.payer.states ?? []) {
      const normalized = normalizeStateCode(state);
      const stateNode = ensureStateNode(nodeMap, normalized);
      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: payerNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'COVERED_BY_PAYER',
          metadata: {
            via: 'PAYER',
          },
        },
        `PAYER_STATE:${payerNode.nodeId}:${stateNode.nodeId}`,
      );
    }
  }
}

function ingestEhrRoleGrants(
  clinicianNode: WorkforceSupplyNode,
  grants: EhrRoleGrant[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.ehrRoles += grants.length;

  for (const grant of grants) {
    const roleNode = upsertNode(nodeMap, {
      nodeId: `ehr-role:${grant.id}`,
      nodeType: 'EHR_ROLE',
      metadata: {
        ehrSystem: grant.ehrSystem,
        privilegeCode: grant.privilegeCode,
        orgId: grant.orgId,
        status: grant.status,
        lastSyncedAt: grant.lastSyncedAt?.toISOString(),
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: roleNode.nodeId,
        relationType: 'EHR_ROLE_GRANTED',
        metadata: {
          ehrSystem: grant.ehrSystem,
        },
      },
      `EHR_ROLE:${clinicianNode.nodeId}:${roleNode.nodeId}`,
    );
  }
}

function upsertNode(
  nodeMap: Map<string, WorkforceSupplyNode>,
  init: {
    nodeId: string;
    nodeType: WorkforceSupplyNodeType;
    metadata?: WorkforceSupplyMetadata;
  },
): WorkforceSupplyNode {
  const existing = nodeMap.get(init.nodeId);
  if (existing) {
    const metadata = init.metadata
      ? mergeSupplyMetadata(existing.metadata, init.metadata)
      : existing.metadata;
    const updated = { ...existing, metadata };
    nodeMap.set(init.nodeId, updated);
    return updated;
  }

  const node = createWorkforceSupplyNode({
    nodeId: init.nodeId,
    nodeType: init.nodeType,
    metadata: init.metadata,
  });
  nodeMap.set(node.nodeId, node);
  return node;
}

function ensureStateNode(
  nodeMap: Map<string, WorkforceSupplyNode>,
  state: string,
  metadata: WorkforceSupplyMetadata = {},
): WorkforceSupplyNode {
  const normalized = normalizeStateCode(state);
  return upsertNode(nodeMap, {
    nodeId: `state:${normalized}`,
    nodeType: 'STATE',
    metadata: {
      code: normalized,
      ...metadata,
    },
  });
}

function pushEdge(
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  init: {
    sourceNodeId: string;
    targetNodeId: string;
    relationType: WorkforceSupplyRelationType;
    metadata?: WorkforceSupplyMetadata;
    weight?: number;
  },
  scope?: string,
) {
  const via =
    typeof init.metadata?.via === 'string'
      ? init.metadata.via
      : scope ?? 'default';
  const key = `${init.sourceNodeId}|${init.targetNodeId}|${init.relationType}|${via}`;
  if (edgeKeys.has(key)) {
    return;
  }

  edgeKeys.add(key);
  edges.push(
    createWorkforceSupplyEdge({
      sourceNodeId: init.sourceNodeId,
      targetNodeId: init.targetNodeId,
      relationType: init.relationType,
      weight: init.weight,
      metadata: init.metadata,
    }),
  );
}

function createEmptySummary(clinicianId: string): ClinicianSupplySummary {
  return {
    clinicianId,
    licenses: 0,
    privileges: 0,
    enrollments: 0,
    compacts: 0,
    ehrRoles: 0,
    statesLicensed: [],
    statesViaCompacts: [],
    orgsApproved: [],
    payerCoverage: [],
    privilegeCodes: [],
  };
}

async function loadPrivilegeAssignments(
  client: PrismaLike,
  clinicianId: string,
): Promise<PrivilegeAssignment[]> {
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        select: {
          did: true,
        },
      },
    },
  });
  const clinicianDid = clinician?.user?.did;
  if (!clinicianDid) {
    return [];
  }

  const grants = await client.privilegeGranted.findMany({
    where: { clinicianDid },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true,
        },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  const [privilegeGraph, orgs] = await Promise.all([
    getPrivilegeGraph(client),
    loadOrgProfiles(client, grants.map((grant) => grant.orgId)),
  ]);

  const orgMap = new Map(orgs.map((org) => [org.orgId, org]));

  return grants.map((grant) => {
    const privilegeCode =
      grant.privilegeRequest?.privilegeSet?.name ??
      grant.privilegeRequest?.privilegeSetId ??
      grant.privilegeSetId;
    const dependencies = privilegeCode
      ? getPrivilegeDependencies(privilegeGraph, privilegeCode)
      : [];
    const org = orgMap.get(grant.orgId);

    return {
      grantId: grant.id,
      privilegeCode,
      privilegeName: grant.privilegeRequest?.privilegeSet?.name ?? undefined,
      privilegeSetId: grant.privilegeSetId,
      orgId: grant.orgId,
      orgName: org?.name ?? undefined,
      orgState: extractOrgState(org),
      status: grant.status,
      grantedAt: grant.grantedAt,
      expiresAt: grant.expiresAt,
      dependencyCodes: dependencies,
    };
  });
}

async function loadCompactAuthorizations(
  client: PrismaLike,
  clinicianId: string,
): Promise<ClinicianCompactAuthorization[]> {
  const wallets = await client.clinicianCompactWallet.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });
  return wallets.map((wallet) => ({
    walletId: wallet.id,
    expiresAt: wallet.expiresAt,
    ...getAuthorizedStatesDetailed(wallet.compactType, wallet.homeState, {
      includeHomeState: wallet.compactType !== 'IMLC',
    }),
  }));
}

async function loadPayerEnrollments(
  client: PrismaLike,
  clinicianId: string,
): Promise<PayerEnrollmentSnapshot[]> {
  const enrollments = await client.payerEnrollmentV2.findMany({
    where: { clinicianId },
    include: { payer: true },
    orderBy: { updatedAt: 'desc' },
  });

  return enrollments.map((record) => ({
    id: record.id,
    clinicianId,
    payerId: record.payerId,
    payer: {
      id: record.payer.id,
      name: record.payer.name,
      states: record.payer.states ?? [],
      planTypes: record.payer.planTypes ?? [],
    },
    status: record.status,
    panelType: record.panelType,
    effectiveDate: record.effectiveDate,
    metadata: record.metadata as Record<string, unknown> | null,
  }));
}

async function loadEhrRoleGrants(
  client: PrismaLike,
  clinicianId: string,
): Promise<EhrRoleGrant[]> {
  const records = await client.ehrSynchronization.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
  return records.map((record) => ({
    id: record.id,
    clinicianId,
    ehrSystem: record.ehrSystem,
    privilegeCode: record.privilegeCode,
    orgId: record.orgId,
    status: record.status,
    lastSyncedAt: record.lastSyncedAt,
  }));
}

async function loadOrgProfiles(
  client: PrismaLike,
  orgIds: string[],
): Promise<OrgProfile[]> {
  const uniqueIds = Array.from(new Set(orgIds)).filter(Boolean);
  if (!uniqueIds.length) {
    return [];
  }
  return client.orgProfile.findMany({
    where: { orgId: { in: uniqueIds } },
  });
}

function extractOrgState(org?: OrgProfile): string | undefined {
  if (!org?.address) {
    return undefined;
  }
  const address = org.address as Record<string, unknown>;
  const state = address.state ?? address.region;
  return state ? normalizeStateCode(String(state)) : undefined;
}

async function getPrivilegeGraph(client: PrismaLike): Promise<PrivilegeGraph | null> {
  if (!privilegeGraphCache.has('default')) {
    privilegeGraphCache.set(
      'default',
      (async () => {
        const [nodes, dependencies] = await Promise.all([
          client.privilegeNode.findMany(),
          client.privilegeDependency.findMany({
            include: {
              parentPrivilege: true,
              childPrivilege: true,
            },
          }),
        ]);
        if (!nodes.length) {
          return null;
        }

        const graphNodes: PrivilegeNode[] = nodes.map(mapPrismaPrivilegeNode);
        const graphDependencies: PrivilegeDependency[] = (dependencies as PrismaPrivilegeDependencyRecord[]).map(
          mapPrismaPrivilegeDependency,
        );
        return new PrivilegeGraphBuilder(graphNodes, graphDependencies).build();
      })(),
    );
  }

  return privilegeGraphCache.get('default')!;
}

function mapPrismaPrivilegeNode(node: PrismaPrivilegeNode): PrivilegeNode {
  return {
    privilegeCode: node.privilegeCode,
    name: node.name,
    category: node.category as PrivilegeNode['category'],
    description: node.description,
    specialty: node.specialty,
    tags: node.tags,
    metadata: node.metadata ?? undefined,
  };
}

function mapPrismaPrivilegeDependency(edge: PrismaPrivilegeDependencyRecord): PrivilegeDependency {
  return {
    parentPrivilegeCode: edge.parentPrivilege.privilegeCode,
    childPrivilegeCode: edge.childPrivilege.privilegeCode,
    dependencyType: edge.dependencyType as PrivilegeDependency['dependencyType'],
    rationale: edge.rationale ?? undefined,
  };
}

function getPrivilegeDependencies(graph: PrivilegeGraph | null, privilegeCode: string): string[] {
  if (!graph) {
    return [];
  }
  const normalized = privilegeCode.trim().toUpperCase();
  const prerequisites = graph.reverseAdjacency[normalized] ?? [];
  return prerequisites.map((edge) => edge.code);
}
import type {
  EhrSynchronization,
  OrgProfile,
  PayerEnrollmentV2,
  PrismaClient,
  PrivilegeNode as PrismaPrivilegeNode,
  PrivilegeDependency as PrismaPrivilegeDependency,
} from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { buildCredentialGraphForClinician } from '../../graph/credential/credentialGraphBuilder.js';
import type { CredentialGraph } from '../../graph/credential/types.js';
import {
  getAuthorizedStatesDetailed,
  type CompactAuthorizationDetail,
} from '../../compacts/compactGraph.js';
import { normalizeStateCode } from '../../compacts/models/CompactParticipation.js';
import {
  PrivilegeGraphBuilder,
  type PrivilegeGraph,
  type PrivilegeAdjacencyList,
} from '../../privyDep/buildGraph.js';
import type { PrivilegeNode } from '../../privyDep/models/PrivilegeNode.js';
import type { PrivilegeDependency } from '../../privyDep/models/PrivilegeDependency.js';
import {
  createWorkforceSupplyNode,
  mergeSupplyMetadata,
  type WorkforceSupplyNode,
  type WorkforceSupplyNodeType,
  type WorkforceSupplyMetadata,
} from '../models/WorkforceSupplyNode.js';
import {
  createWorkforceSupplyEdge,
  type WorkforceSupplyEdge,
  type WorkforceSupplyRelationType,
} from '../models/WorkforceSupplyEdge.js';

type PrismaPrivilegeDependencyRecord = PrismaPrivilegeDependency & {
  parentPrivilege: PrismaPrivilegeNode;
  childPrivilege: PrismaPrivilegeNode;
};

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('workforce:supply-graph');

type PrismaLike = Pick<
  PrismaClient,
  | 'clinicianProfile'
  | 'privilegeGranted'
  | 'orgProfile'
  | 'clinicianCompactWallet'
  | 'payerEnrollmentV2'
  | 'payer'
  | 'ehrSynchronization'
  | 'privilegeNode'
  | 'privilegeDependency'
>;

const privilegeGraphCache = new Map<string, Promise<PrivilegeGraph | null>>();

export interface PrivilegeAssignment {
  grantId: string;
  privilegeCode: string;
  privilegeName?: string;
  privilegeSetId: string;
  orgId: string;
  orgName?: string;
  orgState?: string;
  status: string;
  grantedAt: Date;
  expiresAt: Date;
  dependencyCodes: string[];
}

export interface ClinicianCompactAuthorization extends CompactAuthorizationDetail {
  walletId: string;
  expiresAt?: Date | null;
}

export interface PayerEnrollmentSnapshot {
  id: string;
  payerId: string;
  clinicianId: string;
  payer: {
    id: string;
    name: string;
    states: string[];
    planTypes: string[];
  };
  status: PayerEnrollmentV2['status'];
  panelType?: string | null;
  effectiveDate?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface EhrRoleGrant {
  id: string;
  clinicianId: string;
  ehrSystem: string;
  privilegeCode: string;
  orgId?: string | null;
  status: EhrSynchronization['status'];
  lastSyncedAt?: Date | null;
}

export interface SupplyGraphBuilderSources {
  fetchCredentialGraph(clinicianId: string): Promise<CredentialGraph>;
  fetchPrivilegeAssignments(clinicianId: string): Promise<PrivilegeAssignment[]>;
  fetchCompactAuthorizations(clinicianId: string): Promise<ClinicianCompactAuthorization[]>;
  fetchPayerEnrollments(clinicianId: string): Promise<PayerEnrollmentSnapshot[]>;
  fetchEhrRoleGrants(clinicianId: string): Promise<EhrRoleGrant[]>;
}

export interface BuildSupplyGraphOptions {
  clinicianIds: string[];
  sources?: Partial<SupplyGraphBuilderSources>;
  prisma?: PrismaLike;
}

export interface ClinicianSupplySummary {
  clinicianId: string;
  licenses: number;
  privileges: number;
  enrollments: number;
  compacts: number;
  ehrRoles: number;
  statesLicensed: string[];
  statesViaCompacts: string[];
  orgsApproved: string[];
  payerCoverage: string[];
  privilegeCodes: string[];
}

export interface WorkforceSupplyGraph {
  nodes: WorkforceSupplyNode[];
  edges: WorkforceSupplyEdge[];
  clinicianSummaries: ClinicianSupplySummary[];
  generatedAt: Date;
}

const defaultSources = (client: PrismaLike): SupplyGraphBuilderSources => ({
  fetchCredentialGraph: (clinicianId) => buildCredentialGraphForClinician({ clinicianId }),
  fetchPrivilegeAssignments: (clinicianId) => loadPrivilegeAssignments(client, clinicianId),
  fetchCompactAuthorizations: (clinicianId) => loadCompactAuthorizations(client, clinicianId),
  fetchPayerEnrollments: (clinicianId) => loadPayerEnrollments(client, clinicianId),
  fetchEhrRoleGrants: (clinicianId) => loadEhrRoleGrants(client, clinicianId),
});

export async function buildSupplyGraph(
  options: BuildSupplyGraphOptions,
): Promise<WorkforceSupplyGraph> {
  if (!options.clinicianIds?.length) {
    return {
      nodes: [],
      edges: [],
      clinicianSummaries: [],
      generatedAt: new Date(),
    };
  }

  const client = options.prisma ?? prisma;
  const sources: SupplyGraphBuilderSources = {
    ...defaultSources(client),
    ...(options.sources ?? {}),
  };

  const nodeMap = new Map<string, WorkforceSupplyNode>();
  const edges: WorkforceSupplyEdge[] = [];
  const edgeKeys = new Set<string>();
  const summaries: ClinicianSupplySummary[] = [];

  for (const clinicianId of options.clinicianIds) {
    const summary = createEmptySummary(clinicianId);
    summaries.push(summary);

    const [
      credentialGraph,
      privilegeAssignments,
      compactAuthorizations,
      payerEnrollments,
      ehrRoleGrants,
    ] = await Promise.all([
      sources.fetchCredentialGraph(clinicianId).catch((error) => {
        log.error('Failed to fetch credential graph', { clinicianId, error });
        throw error;
      }),
      sources.fetchPrivilegeAssignments(clinicianId),
      sources.fetchCompactAuthorizations(clinicianId),
      sources.fetchPayerEnrollments(clinicianId),
      sources.fetchEhrRoleGrants(clinicianId),
    ]);

    const clinicianNodeId = credentialGraph.metadata.clinicianNodeId ?? `clinician:${clinicianId}`;
    const clinicianNode = upsertNode(nodeMap, {
      nodeId: clinicianNodeId,
      nodeType: 'CLINICIAN',
      metadata: {
        clinicianId,
        clinicianDid: credentialGraph.metadata.clinicianDid,
        name: credentialGraph.metadata.clinicianName,
        specialty: credentialGraph.metadata.specialty,
        homeState: credentialGraph.metadata.homeState,
      },
    });

    ingestCredentialGraphNodes(credentialGraph, clinicianNode, nodeMap, edges, edgeKeys, summary);
    ingestCompactAuthorizations(
      clinicianNode,
      compactAuthorizations,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestPrivilegeAssignments(
      clinicianNode,
      privilegeAssignments,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestPayerEnrollments(
      clinicianNode,
      payerEnrollments,
      nodeMap,
      edges,
      edgeKeys,
      summary,
    );
    ingestEhrRoleGrants(clinicianNode, ehrRoleGrants, nodeMap, edges, edgeKeys, summary);
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    clinicianSummaries: summaries,
    generatedAt: new Date(),
  };
}

function ingestCredentialGraphNodes(
  graph: CredentialGraph,
  clinicianNode: WorkforceSupplyNode,
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  const stateCache = new Map<string, WorkforceSupplyNode>();
  const stateNodes = graph.nodes.filter((node) => node.type === 'state');
  for (const stateNode of stateNodes) {
    const normalized = normalizeStateCode(stateNode.label ?? stateNode.id.replace('state:', ''));
    const node = upsertNode(nodeMap, {
      nodeId: `state:${normalized}`,
      nodeType: 'STATE',
      metadata: {
        code: normalized,
        label: stateNode.label,
      },
    });
    stateCache.set(normalized, node);
  }

  const orgNodes = graph.nodes.filter((node) => node.type === 'org');
  for (const orgNode of orgNodes) {
    upsertNode(nodeMap, {
      nodeId: orgNode.id,
      nodeType: 'ORG',
      metadata: {
        name: orgNode.label,
        ...orgNode.metadata,
      },
    });
  }

  const licenseNodes = graph.nodes.filter((node) => node.type === 'license');
  summary.licenses += licenseNodes.length;
  for (const licenseNode of licenseNodes) {
    const supplyLicense = upsertNode(nodeMap, {
      nodeId: licenseNode.id,
      nodeType: 'LICENSE',
      metadata: {
        label: licenseNode.label,
        ...licenseNode.metadata,
        clinicianId: clinicianNode.metadata.clinicianId,
      },
    });

    const stateValue =
      typeof licenseNode.metadata?.state === 'string'
        ? licenseNode.metadata.state
        : undefined;
    if (!stateValue) {
      continue;
    }

    const state = normalizeStateCode(stateValue);
    const stateNode = stateCache.get(state) ?? ensureStateNode(nodeMap, state);
    stateCache.set(state, stateNode);
    if (!summary.statesLicensed.includes(state)) {
      summary.statesLicensed.push(state);
    }

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: supplyLicense.nodeId,
        targetNodeId: stateNode.nodeId,
        relationType: 'CAN_PRACTICE_IN',
        metadata: {
          via: 'LICENSE',
          licenseId: supplyLicense.nodeId,
        },
      },
      'LICENSE',
    );

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: stateNode.nodeId,
        relationType: 'CAN_PRACTICE_IN',
        metadata: {
          via: 'LICENSE',
          licenseId: supplyLicense.nodeId,
        },
      },
      `LICENSE:${state}`,
    );
  }
}

function ingestCompactAuthorizations(
  clinicianNode: WorkforceSupplyNode,
  authorizations: ClinicianCompactAuthorization[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.compacts += authorizations.length;
  for (const detail of authorizations) {
    const compactNode = upsertNode(nodeMap, {
      nodeId: `compact:${detail.compactType}:${detail.walletId}`,
      nodeType: 'COMPACT',
      metadata: {
        compactType: detail.compactType,
        homeState: detail.homeState,
        expiresAt: detail.expiresAt?.toISOString(),
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: compactNode.nodeId,
        relationType: 'ELIGIBLE_VIA_COMPACT',
        metadata: {
          compactType: detail.compactType,
        },
      },
      `COMPACT:${compactNode.nodeId}`,
    );

    for (const state of detail.states) {
      const normalized = normalizeStateCode(state);
      const stateNode = ensureStateNode(nodeMap, normalized);
      if (!summary.statesViaCompacts.includes(normalized)) {
        summary.statesViaCompacts.push(normalized);
      }
      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: compactNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'ELIGIBLE_VIA_COMPACT',
          metadata: {
            compactType: detail.compactType,
          },
        },
        `COMPACT_STATE:${compactNode.nodeId}:${normalized}`,
      );
      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: clinicianNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'CAN_PRACTICE_IN',
          metadata: {
            via: 'COMPACT',
            compactType: detail.compactType,
          },
        },
        `COMPACT_PRACTICE:${clinicianNode.nodeId}:${normalized}:${detail.compactType}`,
      );
    }
  }
}

function ingestPrivilegeAssignments(
  clinicianNode: WorkforceSupplyNode,
  assignments: PrivilegeAssignment[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.privileges += assignments.length;
  for (const assignment of assignments) {
    const privilegeNode = upsertNode(nodeMap, {
      nodeId: `privilege:${assignment.grantId}`,
      nodeType: 'PRIVILEGE',
      metadata: {
        privilegeCode: assignment.privilegeCode,
        privilegeName: assignment.privilegeName,
        orgId: assignment.orgId,
        status: assignment.status,
        grantedAt: assignment.grantedAt.toISOString(),
        expiresAt: assignment.expiresAt.toISOString(),
        dependencies: assignment.dependencyCodes,
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: privilegeNode.nodeId,
        relationType: 'CAN_PERFORM',
        metadata: {
          orgId: assignment.orgId,
          privilegeCode: assignment.privilegeCode,
        },
      },
      `CAN_PERFORM:${clinicianNode.nodeId}:${privilegeNode.nodeId}`,
    );

    if (!summary.privilegeCodes.includes(assignment.privilegeCode)) {
      summary.privilegeCodes.push(assignment.privilegeCode);
    }

    if (assignment.orgId) {
      const orgNode = upsertNode(nodeMap, {
        nodeId: `org:${assignment.orgId}`,
        nodeType: 'ORG',
        metadata: {
          orgId: assignment.orgId,
          name: assignment.orgName,
          state: assignment.orgState,
        },
      });
      if (!summary.orgsApproved.includes(assignment.orgId)) {
        summary.orgsApproved.push(assignment.orgId);
      }
      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: privilegeNode.nodeId,
          targetNodeId: orgNode.nodeId,
          relationType: 'APPROVED_AT_ORG',
          metadata: {
            privilegeCode: assignment.privilegeCode,
          },
        },
        `APPROVED:${privilegeNode.nodeId}:${orgNode.nodeId}`,
      );
    }
  }
}

function ingestPayerEnrollments(
  clinicianNode: WorkforceSupplyNode,
  enrollments: PayerEnrollmentSnapshot[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.enrollments += enrollments.length;
  for (const snapshot of enrollments) {
    const enrollmentNode = upsertNode(nodeMap, {
      nodeId: `enrollment:${snapshot.id}`,
      nodeType: 'ENROLLMENT',
      metadata: {
        status: snapshot.status,
        panelType: snapshot.panelType,
        effectiveDate: snapshot.effectiveDate?.toISOString(),
        metadata: snapshot.metadata ?? undefined,
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: enrollmentNode.nodeId,
        relationType: 'COVERED_BY_PAYER',
        metadata: {
          status: snapshot.status,
        },
      },
      `ENROLLMENT:${clinicianNode.nodeId}:${enrollmentNode.nodeId}`,
    );

    const payerNode = upsertNode(nodeMap, {
      nodeId: `payer:${snapshot.payer.id}`,
      nodeType: 'PAYER',
      metadata: {
        payerId: snapshot.payerId,
        name: snapshot.payer.name,
        states: snapshot.payer.states,
        planTypes: snapshot.payer.planTypes,
      },
    });

    if (!summary.payerCoverage.includes(snapshot.payer.id)) {
      summary.payerCoverage.push(snapshot.payer.id);
    }

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: enrollmentNode.nodeId,
        targetNodeId: payerNode.nodeId,
        relationType: 'COVERED_BY_PAYER',
        metadata: {
          status: snapshot.status,
        },
      },
      `PAYER_LINK:${enrollmentNode.nodeId}:${payerNode.nodeId}`,
    );

    for (const state of snapshot.payer.states) {
      const normalized = normalizeStateCode(state);
      const stateNode = ensureStateNode(nodeMap, normalized);
      pushEdge(
        edges,
        edgeKeys,
        {
          sourceNodeId: payerNode.nodeId,
          targetNodeId: stateNode.nodeId,
          relationType: 'COVERED_BY_PAYER',
          metadata: {
            via: 'PAYER',
          },
        },
        `PAYER_STATE:${payerNode.nodeId}:${stateNode.nodeId}`,
      );
    }
  }
}

function ingestEhrRoleGrants(
  clinicianNode: WorkforceSupplyNode,
  grants: EhrRoleGrant[],
  nodeMap: Map<string, WorkforceSupplyNode>,
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  summary: ClinicianSupplySummary,
) {
  summary.ehrRoles += grants.length;
  for (const grant of grants) {
    const roleNode = upsertNode(nodeMap, {
      nodeId: `ehr-role:${grant.id}`,
      nodeType: 'EHR_ROLE',
      metadata: {
        ehrSystem: grant.ehrSystem,
        privilegeCode: grant.privilegeCode,
        orgId: grant.orgId,
        status: grant.status,
        lastSyncedAt: grant.lastSyncedAt?.toISOString(),
      },
    });

    pushEdge(
      edges,
      edgeKeys,
      {
        sourceNodeId: clinicianNode.nodeId,
        targetNodeId: roleNode.nodeId,
        relationType: 'EHR_ROLE_GRANTED',
        metadata: {
          ehrSystem: grant.ehrSystem,
        },
      },
      `EHR_ROLE:${clinicianNode.nodeId}:${roleNode.nodeId}`,
    );
  }
}

function upsertNode(
  nodeMap: Map<string, WorkforceSupplyNode>,
  init: {
    nodeId: string;
    nodeType: WorkforceSupplyNodeType;
    metadata?: WorkforceSupplyMetadata;
  },
): WorkforceSupplyNode {
  const existing = nodeMap.get(init.nodeId);
  if (existing) {
    const metadata = init.metadata ? mergeSupplyMetadata(existing.metadata, init.metadata) : existing.metadata;
    const updated = { ...existing, metadata };
    nodeMap.set(init.nodeId, updated);
    return updated;
  }

  const node = createWorkforceSupplyNode({
    nodeId: init.nodeId,
    nodeType: init.nodeType,
    metadata: init.metadata,
  });
  nodeMap.set(node.nodeId, node);
  return node;
}

function ensureStateNode(
  nodeMap: Map<string, WorkforceSupplyNode>,
  state: string,
  metadata: WorkforceSupplyMetadata = {},
): WorkforceSupplyNode {
  const normalized = normalizeStateCode(state);
  return upsertNode(nodeMap, {
    nodeId: `state:${normalized}`,
    nodeType: 'STATE',
    metadata: {
      code: normalized,
      ...metadata,
    },
  });
}

function pushEdge(
  edges: WorkforceSupplyEdge[],
  edgeKeys: Set<string>,
  init: {
    sourceNodeId: string;
    targetNodeId: string;
    relationType: WorkforceSupplyRelationType;
    metadata?: WorkforceSupplyMetadata;
    weight?: number;
  },
  scope?: string,
) {
  const via =
    typeof init.metadata?.via === 'string'
      ? init.metadata.via
      : scope ?? 'default';
  const key = `${init.sourceNodeId}|${init.targetNodeId}|${init.relationType}|${via}`;
  if (edgeKeys.has(key)) {
    return;
  }
  edgeKeys.add(key);
  edges.push(
    createWorkforceSupplyEdge({
      sourceNodeId: init.sourceNodeId,
      targetNodeId: init.targetNodeId,
      relationType: init.relationType,
      weight: init.weight,
      metadata: init.metadata,
    }),
  );
}

function createEmptySummary(clinicianId: string): ClinicianSupplySummary {
  return {
    clinicianId,
    licenses: 0,
    privileges: 0,
    enrollments: 0,
    compacts: 0,
    ehrRoles: 0,
    statesLicensed: [],
    statesViaCompacts: [],
    orgsApproved: [],
    payerCoverage: [],
    privilegeCodes: [],
  };
}

async function loadPrivilegeAssignments(
  client: PrismaLike,
  clinicianId: string,
): Promise<PrivilegeAssignment[]> {
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: {
        select: {
          did: true,
        },
      },
    },
  });
  const clinicianDid = clinician?.user?.did;
  if (!clinicianDid) {
    return [];
  }

  const grants = await client.privilegeGranted.findMany({
    where: { clinicianDid },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true,
        },
      },
    },
    orderBy: { grantedAt: 'desc' },
  });

  const [privilegeGraph, orgs] = await Promise.all([
    getPrivilegeGraph(client),
    loadOrgProfiles(client, grants.map((grant) => grant.orgId)),
  ]);

  const orgMap = new Map(orgs.map((org) => [org.orgId, org]));

  return grants.map((grant) => {
    const privilegeCode =
      grant.privilegeRequest?.privilegeSet?.name ??
      grant.privilegeRequest?.privilegeSetId ??
      grant.privilegeSetId;
    const dependencies = privilegeCode
      ? getPrivilegeDependencies(privilegeGraph, privilegeCode)
      : [];
    const org = orgMap.get(grant.orgId);
    return {
      grantId: grant.id,
      privilegeCode,
      privilegeName: grant.privilegeRequest?.privilegeSet?.name ?? undefined,
      privilegeSetId: grant.privilegeSetId,
      orgId: grant.orgId,
      orgName: org?.name ?? undefined,
      orgState: extractOrgState(org),
      status: grant.status,
      grantedAt: grant.grantedAt,
      expiresAt: grant.expiresAt,
      dependencyCodes: dependencies,
    };
  });
}

async function loadCompactAuthorizations(
  client: PrismaLike,
  clinicianId: string,
): Promise<ClinicianCompactAuthorization[]> {
  const wallets = await client.clinicianCompactWallet.findMany({
    where: { clinicianId },
    orderBy: { createdAt: 'asc' },
  });
  return wallets.map((wallet) => ({
    walletId: wallet.id,
    expiresAt: wallet.expiresAt,
    ...getAuthorizedStatesDetailed(wallet.compactType, wallet.homeState, {
      includeHomeState: wallet.compactType !== 'IMLC',
    }),
  }));
}

async function loadPayerEnrollments(
  client: PrismaLike,
  clinicianId: string,
): Promise<PayerEnrollmentSnapshot[]> {
  const enrollments = await client.payerEnrollmentV2.findMany({
    where: { clinicianId },
    include: { payer: true },
    orderBy: { updatedAt: 'desc' },
  });

  return enrollments.map((record) => ({
    id: record.id,
    clinicianId,
    payerId: record.payerId,
    payer: {
      id: record.payer.id,
      name: record.payer.name,
      states: record.payer.states ?? [],
      planTypes: record.payer.planTypes ?? [],
    },
    status: record.status,
    panelType: record.panelType,
    effectiveDate: record.effectiveDate,
    metadata: record.metadata as Record<string, unknown> | null,
  }));
}

async function loadEhrRoleGrants(
  client: PrismaLike,
  clinicianId: string,
): Promise<EhrRoleGrant[]> {
  const records = await client.ehrSynchronization.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
  return records.map((record) => ({
    id: record.id,
    clinicianId,
    ehrSystem: record.ehrSystem,
    privilegeCode: record.privilegeCode,
    orgId: record.orgId,
    status: record.status,
    lastSyncedAt: record.lastSyncedAt,
  }));
}

async function loadOrgProfiles(
  client: PrismaLike,
  orgIds: string[],
): Promise<OrgProfile[]> {
  const uniqueIds = Array.from(new Set(orgIds)).filter(Boolean);
  if (!uniqueIds.length) {
    return [];
  }
  return client.orgProfile.findMany({
    where: { orgId: { in: uniqueIds } },
  });
}

function extractOrgState(org?: OrgProfile): string | undefined {
  if (!org?.address) {
    return undefined;
  }
  const address = org.address as Record<string, unknown>;
  const state = address?.state ?? (address?.region as string | undefined);
  return state ? normalizeStateCode(String(state)) : undefined;
}

async function getPrivilegeGraph(client: PrismaLike): Promise<PrivilegeGraph | null> {
  if (!privilegeGraphCache.has('default')) {
    privilegeGraphCache.set(
      'default',
      (async () => {
        const [nodes, dependencies] = await Promise.all([
          client.privilegeNode.findMany(),
          client.privilegeDependency.findMany({
            include: {
              parentPrivilege: true,
              childPrivilege: true,
            },
          }),
        ]);
        if (!nodes.length) {
          return null;
        }

        const graphNodes: PrivilegeNode[] = nodes.map(mapPrismaPrivilegeNode);
        const graphDependencies: PrivilegeDependency[] = dependencies
          .filter((edge) => edge.parentPrivilege && edge.childPrivilege)
          .map(mapPrismaPrivilegeDependency);
        return new PrivilegeGraphBuilder(graphNodes, graphDependencies).build();
      })(),
    );
  }

  return privilegeGraphCache.get('default')!;
}

function mapPrismaPrivilegeNode(node: PrismaPrivilegeNode): PrivilegeNode {
  return {
    privilegeCode: node.privilegeCode,
    name: node.name,
    category: node.category as PrivilegeNode['category'],
    description: node.description,
    specialty: node.specialty,
    tags: node.tags,
    metadata: node.metadata ?? undefined,
  };
}

function mapPrismaPrivilegeDependency(edge: PrismaPrivilegeDependencyRecord): PrivilegeDependency {
  return {
    parentPrivilegeCode: edge.parentPrivilege.privilegeCode,
    childPrivilegeCode: edge.childPrivilege.privilegeCode,
    dependencyType: edge.dependencyType as PrivilegeDependency['dependencyType'],
    rationale: edge.rationale ?? undefined,
  };
}

function getPrivilegeDependencies(graph: PrivilegeGraph | null, privilegeCode: string): string[] {
  if (!graph) {
    return [];
  }
  const normalized = privilegeCode.trim().toUpperCase();
  const prerequisites =
    graph.reverseAdjacency?.[normalized as keyof PrivilegeAdjacencyList] ?? [];
  return prerequisites.map((edge) => edge.code);
}

