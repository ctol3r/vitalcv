import {
  ClinicianProfile,
  CompactsStatus,
  Credential,
  CredentialTimelineEvent,
  NCINode,
  NCINodeType,
  NCIVerifiableProof,
  NCITrustAnchor,
  PECOSProvider,
  Payer,
  PayerEnrollment,
  PrismaClient,
  PrivilegeGranted,
  StateLicenseVerification,
  TrustEntityType,
} from '@prisma/client';
import { GraphBuilder, GraphBuilderInput } from '../graph/builder/graphBuilder.js';
import { GraphData, createEmptyGraph } from '../graph/types.js';
import { createGraphNode, GraphNodeType } from '../graph/models/GraphNode.js';
import { createGraphEdge } from '../graph/models/GraphEdge.js';

const prisma = new PrismaClient();
const builder = new GraphBuilder();

export interface BuildNciGraphParams {
  did: string;
  includeProofs?: boolean;
  prismaClient?: PrismaClient;
}

export async function buildNciGraph(params: BuildNciGraphParams): Promise<GraphData> {
  const client = params.prismaClient ?? prisma;
  const node = await client.nCINode.findUnique({
    where: { did: params.did },
    include: { trustAnchor: true },
  });

  if (!node) {
    throw new Error(`No NCI node registered for DID ${params.did}`);
  }

  if (node.nodeType !== NCINodeType.CLINICIAN) {
    return buildRegistryGraph(node, node.trustAnchor ?? undefined);
  }

  const clinician = await client.clinicianProfile.findFirst({
    where: { user: { did: params.did } },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician profile not found for DID ${params.did}`);
  }

  const [licenses, pecos, payerEnrollments, privileges, credentials, events, compacts, proofs] =
    await Promise.all([
      client.stateLicenseVerification.findMany({ where: { clinicianId: clinician.id } }),
      client.pECOSProvider.findFirst({ where: { clinicianId: clinician.id } }),
      client.payerEnrollment.findMany({
        where: { clinicianDid: params.did },
        include: { payer: true },
      }),
      client.privilegeGranted.findMany({ where: { clinicianDid: params.did } }),
      client.credential.findMany({ where: { userId: clinician.userId } }),
      client.credentialTimelineEvent.findMany({
        where: { clinicianId: clinician.id },
        orderBy: { timestamp: 'desc' },
      }),
      client.compactsStatus.findUnique({ where: { clinicianDid: params.did } }),
      params.includeProofs
        ? client.nCIVerifiableProof.findMany({
            where: { did: params.did },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as NCIVerifiableProof[]),
    ]);

  const graphInput = buildGraphInput({
    clinician,
    nciNode: node,
    licenses,
    pecos,
    payerEnrollments,
    privileges,
    credentials,
    events,
    compacts,
  });

  const graph = builder.build(graphInput);
  augmentGraphWithRegistry(graph, node, node.trustAnchor ?? undefined, proofs);
  return graph;
}

function buildGraphInput(data: {
  clinician: ClinicianProfile & { user?: { name: string | null } | null };
  nciNode: NCINode & { metadata?: unknown };
  licenses: StateLicenseVerification[];
  pecos: PECOSProvider | null;
  payerEnrollments: Array<PayerEnrollment & { payer: Payer }>;
  privileges: PrivilegeGranted[];
  credentials: Credential[];
  events: CredentialTimelineEvent[];
  compacts: CompactsStatus | null;
}): GraphBuilderInput {
  const orgContext = resolveOrgMetadata(data.nciNode);

  return {
    clinician: {
      id: data.clinician.id,
      npi: data.clinician.npi,
      name: data.clinician.user?.name ?? (data.nciNode.metadata as any)?.name ?? 'Unknown clinician',
      state: data.clinician.state,
      org: orgContext,
      metadata: {
        did: data.nciNode.did,
        nodeId: data.nciNode.nodeId,
        ...extractMetadata(data.nciNode.metadata),
      },
    },
    licenses: data.licenses.map((license) => ({
      id: license.id,
      state: license.state,
      number: license.licenseNumber,
      status: license.status,
      metadata: license.metadata as Record<string, unknown> | undefined,
    })),
    pecosEnrollment: data.pecos
      ? {
          id: data.pecos.id,
          status: data.pecos.status,
          orgId: data.pecos.orgId ?? orgContext.id,
          metadata: {
            enrollmentType: data.pecos.enrollmentType,
            revalidationDate: data.pecos.revalidationDate,
          },
        }
      : undefined,
    payerEnrollments: data.payerEnrollments.map((enrollment) => ({
      id: enrollment.id,
      payerId: enrollment.payerId,
      payerName: enrollment.payer.name,
      requiresPecos: Boolean(enrollment.payer.requiresPecos),
      requiresMedicaid: Boolean(enrollment.payer.requiresMedicaid),
      metadata: enrollment.metadata as Record<string, unknown> | undefined,
    })),
    privileges: data.privileges.map((priv) => ({
      id: priv.id,
      facilityId: priv.orgId,
      facilityName: priv.orgId,
      licenseIds: [],
      metadata: {
        status: priv.status,
        expiresAt: priv.expiresAt,
      },
    })),
    vcs: data.credentials.map((credential) => ({
      id: credential.id,
      type: credential.type,
      subjectId: credential.userId,
      metadata: credential.metadata as Record<string, unknown> | undefined,
    })),
    events: data.events.map((event) => ({
      id: event.id,
      type: event.eventType,
      relatesToId: (event.metadata?.relatesToId as string | undefined) ?? data.clinician.id,
      metadata: event.metadata as Record<string, unknown> | undefined,
    })),
    compactMemberships: buildCompactMemberships(data.compacts),
  };
}

function buildCompactMemberships(compacts: CompactsStatus | null): GraphBuilderInput['compactMemberships'] {
  if (!compacts) {
    return [];
  }

  const memberships: NonNullable<GraphBuilderInput['compactMemberships']> = [];
  compacts.imlcCompactStates.forEach((state) => {
    memberships.push({
      id: `imlc:${state}`,
      compactCode: 'IMLC',
      state,
    });
  });
  compacts.psypactStates.forEach((state) => {
    memberships.push({
      id: `psypact:${state}`,
      compactCode: 'PSYPACT',
      state,
    });
  });
  compacts.counselingStates.forEach((state) => {
    memberships.push({
      id: `counseling:${state}`,
      compactCode: 'COUNSELING',
      state,
    });
  });
  return memberships;
}

function resolveOrgMetadata(node: NCINode): { id: string; name: string; type?: string; state?: string } {
  const metadata = extractMetadata(node.metadata);
  const orgId = typeof metadata.orgId === 'string' ? metadata.orgId : `org:${node.nodeId}`;
  const orgName = typeof metadata.orgName === 'string' ? metadata.orgName : 'Vital Credential Network';
  return {
    id: orgId,
    name: orgName,
    type: typeof metadata.orgType === 'string' ? metadata.orgType : undefined,
    state: typeof metadata.orgState === 'string' ? metadata.orgState : undefined,
  };
}

function buildRegistryGraph(node: NCINode, anchor?: NCITrustAnchor): GraphData {
  const graph = createEmptyGraph();
  const nodeType = mapNodeType(node.nodeType);
  graph.nodes.set(
    node.nodeId,
    createGraphNode({
      nodeId: node.nodeId,
      nodeType,
      metadata: {
        did: node.did,
        jurisdiction: node.jurisdiction,
        ...extractMetadata(node.metadata),
      },
    })
  );

  if (anchor) {
    attachTrustAnchor(graph, node.nodeId, anchor);
  }
  return graph;
}

function augmentGraphWithRegistry(
  graph: GraphData,
  node: NCINode,
  anchor: NCITrustAnchor | undefined,
  proofs: NCIVerifiableProof[]
): void {
  if (!graph.nodes.has(node.nodeId)) {
    graph.nodes.set(
      node.nodeId,
      createGraphNode({
        nodeId: node.nodeId,
        nodeType: mapNodeType(node.nodeType),
        metadata: {
          did: node.did,
          jurisdiction: node.jurisdiction,
          ...extractMetadata(node.metadata),
        },
      })
    );
  }

  if (anchor) {
    attachTrustAnchor(graph, node.nodeId, anchor);
  }

  proofs.forEach((proof) => {
    const proofNodeId = `proof:${proof.id}`;
    graph.nodes.set(
      proofNodeId,
      createGraphNode({
        nodeId: proofNodeId,
        nodeType: 'EVENT',
        metadata: {
          proofType: proof.proofType,
          eventType: proof.eventType,
          anchorTxHash: proof.anchorTxHash,
          chainId: proof.chainId,
          issuedFor: proof.issuedFor,
        },
      })
    );
    graph.edges.push(
      createGraphEdge({
        sourceNodeId: proofNodeId,
        targetNodeId: node.nodeId,
        relationType: 'BELONGS_TO',
        metadata: { scope: 'verifiable_proof' },
      })
    );
  });
}

function attachTrustAnchor(graph: GraphData, nodeId: string, anchor: NCITrustAnchor): void {
  const anchorNodeId = `anchor:${anchor.entityId}`;
  graph.nodes.set(
    anchorNodeId,
    createGraphNode({
      nodeId: anchorNodeId,
      nodeType: mapAnchorNodeType(anchor.entityType),
      metadata: {
        entityId: anchor.entityId,
        jurisdiction: anchor.jurisdiction,
        accreditation: anchor.accreditation,
      },
    })
  );

  graph.edges.push(
    createGraphEdge({
      sourceNodeId: nodeId,
      targetNodeId: anchorNodeId,
      relationType: 'VERIFIED_BY',
      metadata: { accreditation: anchor.accreditation },
    })
  );
}

function mapNodeType(nodeType: NCINodeType): GraphNodeType {
  switch (nodeType) {
    case NCINodeType.CLINICIAN:
      return 'CLINICIAN';
    case NCINodeType.STATE_BOARD:
      return 'BOARD';
    case NCINodeType.PAYER:
      return 'PAYER';
    case NCINodeType.COMPACT_AUTHORITY:
      return 'COMPACT';
    default:
      return 'ORG';
  }
}

function mapAnchorNodeType(entityType: TrustEntityType): GraphNodeType {
  switch (entityType) {
    case TrustEntityType.STATE_BOARD:
      return 'BOARD';
    case TrustEntityType.PAYER:
      return 'PAYER';
    case TrustEntityType.COMPACT_AUTHORITY:
      return 'COMPACT';
    default:
      return 'ORG';
  }
}

function extractMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}
import {
  ClinicianProfile,
  CompactsStatus,
  Credential,
  CredentialTimelineEvent,
  NCINode,
  NCINodeType,
  NCIVerifiableProof,
  NCITrustAnchor,
  PECOSProvider,
  Payer,
  PayerEnrollment,
  PrismaClient,
  PrivilegeGranted,
  StateLicenseVerification,
  TrustEntityType,
} from '@prisma/client';
import { GraphBuilder, GraphBuilderInput } from '../graph/builder/graphBuilder.js';
import { GraphData, createEmptyGraph } from '../graph/types.js';
import { createGraphNode, GraphNodeType } from '../graph/models/GraphNode.js';
import { createGraphEdge } from '../graph/models/GraphEdge.js';

const prisma = new PrismaClient();

export interface BuildNciGraphParams {
  did: string;
  includeProofs?: boolean;
  prismaClient?: PrismaClient;
}

const builder = new GraphBuilder();

export async function buildNciGraph(params: BuildNciGraphParams): Promise<GraphData> {
  const client = params.prismaClient ?? prisma;
  const node = await client.nCINode.findUnique({
    where: { did: params.did },
    include: { trustAnchor: true },
  });

  if (!node) {
    throw new Error(`No NCI node registered for DID ${params.did}`);
  }

  if (node.nodeType !== NCINodeType.CLINICIAN) {
    return buildRegistryGraph(node, node.trustAnchor ?? undefined);
  }

  const clinician = await client.clinicianProfile.findFirst({
    where: { user: { did: params.did } },
    include: { user: true },
  });

  if (!clinician) {
    throw new Error(`Clinician profile not found for DID ${params.did}`);
  }

  const [licenses, pecos, payerEnrollments, privileges, credentials, events, compacts, proofs] =
    await Promise.all([
      client.stateLicenseVerification.findMany({ where: { clinicianId: clinician.id } }),
      client.pECOSProvider.findFirst({ where: { clinicianId: clinician.id } }),
      client.payerEnrollment.findMany({
        where: { clinicianDid: params.did },
        include: { payer: true },
      }),
      client.privilegeGranted.findMany({ where: { clinicianDid: params.did } }),
      client.credential.findMany({ where: { userId: clinician.userId } }),
      client.credentialTimelineEvent.findMany({
        where: { clinicianId: clinician.id },
        orderBy: { timestamp: 'desc' },
      }),
      client.compactsStatus.findUnique({ where: { clinicianDid: params.did } }),
      params.includeProofs
        ? client.nCIVerifiableProof.findMany({
            where: { did: params.did },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as NCIVerifiableProof[]),
    ]);

  const graphInput = buildGraphInput({
    clinician,
    nciNode: node,
    licenses,
    pecos,
    payerEnrollments,
    privileges,
    credentials,
    events,
    compacts,
  });

  const graph = builder.build(graphInput);
  augmentGraphWithRegistry(graph, node, node.trustAnchor ?? undefined, proofs);
  return graph;
}

function buildGraphInput(data: {
  clinician: ClinicianProfile & { user?: { name: string | null } | null };
  nciNode: NCINode & { metadata?: unknown };
  licenses: StateLicenseVerification[];
  pecos: PECOSProvider | null;
  payerEnrollments: Array<PayerEnrollment & { payer: Payer }>;
  privileges: PrivilegeGranted[];
  credentials: Credential[];
  events: CredentialTimelineEvent[];
  compacts: CompactsStatus | null;
}): GraphBuilderInput {
  const orgContext = resolveOrgMetadata(data.nciNode);

  return {
    clinician: {
      id: data.clinician.id,
      npi: data.clinician.npi,
      name: data.clinician.user?.name ?? (data.nciNode.metadata as any)?.name ?? 'Unknown clinician',
      state: data.clinician.state,
      org: orgContext,
      metadata: {
        did: data.nciNode.did,
        nodeId: data.nciNode.nodeId,
        ...extractMetadata(data.nciNode.metadata),
      },
    },
    pecosEnrollment: data.pecos
      ? {
          id: data.pecos.id,
          status: data.pecos.status,
          orgId: data.pecos.orgId ?? orgContext.id,
          metadata: {
            enrollmentType: data.pecos.enrollmentType,
            revalidationDate: data.pecos.revalidationDate,
          },
        }
      : undefined,
    payerEnrollments: data.payerEnrollments.map((enrollment) => ({
      id: enrollment.id,
      payerId: enrollment.payerId,
      payerName: enrollment.payer.name,
      requiresPecos: Boolean(enrollment.payer.requiresPecos),
      requiresMedicaid: Boolean(enrollment.payer.requiresMedicaid),
      metadata: enrollment.metadata as Record<string, unknown> | undefined,
    })),
    privileges: data.privileges.map((priv) => ({
      id: priv.id,
      facilityId: priv.orgId,
      facilityName: priv.orgId,
      licenseIds: [],
      metadata: {
        status: priv.status,
        expiresAt: priv.expiresAt,
      },
    })),
    vcs: data.credentials.map((credential) => ({
      id: credential.id,
      type: credential.type,
      subjectId: credential.userId,
      metadata: credential.metadata as Record<string, unknown> | undefined,
    })),
    events: data.events.map((event) => ({
      id: event.id,
      type: event.eventType,
      relatesToId: event.metadata?.relatesToId ?? data.clinician.id,
      metadata: event.metadata as Record<string, unknown> | undefined,
    })),
    licenses: data.licenses.map((license) => ({
      id: license.id,
      state: license.state,
      number: license.licenseNumber,
      status: license.status,
      metadata: license.metadata as Record<string, unknown> | undefined,
    })),
    compactMemberships: buildCompactMemberships(data.compacts),
  };
}

function buildCompactMemberships(
  compacts: CompactsStatus | null
): GraphBuilderInput['compactMemberships'] {
  if (!compacts) {
    return [];
  }

  const memberships = [];
  compacts.imlcCompactStates.forEach((state) => {
    memberships.push({
      id: `imlc:${state}`,
      compactCode: 'IMLC',
      state,
    });
  });
  compacts.psypactStates.forEach((state) => {
    memberships.push({
      id: `psypact:${state}`,
      compactCode: 'PSYPACT',
      state,
    });
  });
  compacts.counselingStates.forEach((state) => {
    memberships.push({
      id: `counseling:${state}`,
      compactCode: 'COUNSELING',
      state,
    });
  });
  return memberships;
}

function resolveOrgMetadata(node: NCINode): { id: string; name: string; type?: string; state?: string } {
  const metadata =
    node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
      ? (node.metadata as Record<string, unknown>)
      : {};
  const orgId = typeof metadata.orgId === 'string' ? metadata.orgId : `org:${node.nodeId}`;
  const orgName = typeof metadata.orgName === 'string' ? metadata.orgName : 'Vital Credential Network';
  return {
    id: orgId,
    name: orgName,
    type: typeof metadata.orgType === 'string' ? metadata.orgType : undefined,
    state: typeof metadata.orgState === 'string' ? metadata.orgState : undefined,
  };
}

function buildRegistryGraph(node: NCINode, anchor?: NCITrustAnchor): GraphData {
  const graph = createEmptyGraph();
  const nodeType = mapNodeType(node.nodeType);
  graph.nodes.set(
    node.nodeId,
    createGraphNode({
      nodeId: node.nodeId,
      nodeType,
      metadata: {
        did: node.did,
        jurisdiction: node.jurisdiction,
        ...((node.metadata as Record<string, unknown> | null) ?? {}),
      },
    })
  );

  if (anchor) {
    attachTrustAnchor(graph, node.nodeId, anchor);
  }
  return graph;
}

function augmentGraphWithRegistry(
  graph: GraphData,
  node: NCINode,
  anchor: NCITrustAnchor | undefined,
  proofs: NCIVerifiableProof[]
): void {
  if (!graph.nodes.has(node.nodeId)) {
    graph.nodes.set(
      node.nodeId,
      createGraphNode({
        nodeId: node.nodeId,
        nodeType: mapNodeType(node.nodeType),
        metadata: {
          did: node.did,
          jurisdiction: node.jurisdiction,
          ...((node.metadata as Record<string, unknown> | null) ?? {}),
        },
      })
    );
  }

  if (anchor) {
    attachTrustAnchor(graph, node.nodeId, anchor);
  }

  proofs.forEach((proof) => {
    const proofNodeId = `proof:${proof.id}`;
    graph.nodes.set(
      proofNodeId,
      createGraphNode({
        nodeId: proofNodeId,
        nodeType: 'EVENT',
        metadata: {
          proofType: proof.proofType,
          eventType: proof.eventType,
          anchorTxHash: proof.anchorTxHash,
          chainId: proof.chainId,
          issuedFor: proof.issuedFor,
        },
      })
    );
    graph.edges.push(
      createGraphEdge({
        sourceNodeId: proofNodeId,
        targetNodeId: node.nodeId,
        relationType: 'BELONGS_TO',
        metadata: { scope: 'verifiable_proof' },
      })
    );
  });
}

function attachTrustAnchor(graph: GraphData, nodeId: string, anchor: NCITrustAnchor): void {
  const anchorNodeId = `anchor:${anchor.entityId}`;
  graph.nodes.set(
    anchorNodeId,
    createGraphNode({
      nodeId: anchorNodeId,
      nodeType: mapAnchorNodeType(anchor.entityType),
      metadata: {
        entityId: anchor.entityId,
        jurisdiction: anchor.jurisdiction,
        accreditation: anchor.accreditation,
      },
    })
  );

  graph.edges.push(
    createGraphEdge({
      sourceNodeId: nodeId,
      targetNodeId: anchorNodeId,
      relationType: 'VERIFIED_BY',
      metadata: { accreditation: anchor.accreditation },
    })
  );
}

function mapNodeType(nodeType: NCINodeType): GraphNodeType {
  switch (nodeType) {
    case NCINodeType.CLINICIAN:
      return 'CLINICIAN';
    case NCINodeType.STATE_BOARD:
      return 'BOARD';
    case NCINodeType.PAYER:
      return 'PAYER';
    case NCINodeType.COMPACT_AUTHORITY:
      return 'COMPACT';
    default:
      return 'ORG';
  }
}

function mapAnchorNodeType(entityType: TrustEntityType): GraphNodeType {
  switch (entityType) {
    case 'STATE_BOARD':
      return 'BOARD';
    case 'PAYER':
      return 'PAYER';
    case 'COMPACT_AUTHORITY':
      return 'COMPACT';
    default:
      return 'ORG';
  }
}

