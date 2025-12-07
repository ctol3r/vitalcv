import { PrismaClient, type OrgProfile, type Payer } from '@prisma/client';
import type { ClinicianWithUser } from '../../timeline/getClinicianTimeline';
import { buildClinicianTimeline } from '../../timeline/getClinicianTimeline';
import { projectTimelineToGraph, mergeTimelineProjection } from '../../timeline/graphIntegration';
import {
  DEFAULT_STATE_GRAPH,
  getAuthorizedStatesDetailed,
  normalizeStateCode,
} from '../../compacts/compactGraph';
import type { GraphEdge, GraphNode, CredentialGraph } from './types';
import { detectGraphInconsistencies } from '../detectors/inconsistencyDetector';

const prisma = new PrismaClient();

export interface CredentialGraphBuildOptions {
  clinicianId: string;
  includeTimeline?: boolean;
}

interface OrgWithEhr extends OrgProfile {
  ehrType?: string | null;
}

export async function buildCredentialGraphForClinician(
  options: CredentialGraphBuildOptions,
): Promise<CredentialGraph> {
  const clinician = await prisma.clinicianProfile.findUnique({
    where: { id: options.clinicianId },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          roles: true,
          name: true,
        },
      },
    },
  });

  if (!clinician) {
    const error = new Error(`clinician_not_found:${options.clinicianId}`);
    (error as any).statusCode = 404;
    throw error;
  }

  const clinicianWithUser = clinician as ClinicianWithUser;
  const clinicianNodeId = `clinician:${clinician.id}`;

  const [licenses, compacts, privilegeGrants, enrollments, timeline] = await Promise.all([
    prisma.stateLicenseVerification.findMany({
      where: { clinicianId: clinician.id },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.clinicianCompactWallet.findMany({
      where: { clinicianId: clinician.id },
    }),
    clinician.user?.did
      ? prisma.privilegeGranted.findMany({
          where: { clinicianDid: clinician.user.did },
          include: {
            privilegeRequest: {
              include: {
                privilegeSet: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.payerEnrollmentV2.findMany({
      where: { clinicianId: clinician.id },
      include: { payer: true },
      orderBy: { updatedAt: 'desc' },
    }),
    options.includeTimeline
      ? buildClinicianTimeline({
          clinician: clinicianWithUser,
          sortDirection: 'asc',
        })
      : Promise.resolve(null),
  ]);

  const orgMap = await hydrateOrgProfiles(
    privilegeGrants
      .map((grant) => grant.privilegeRequest?.orgId)
      .filter((value): value is string => Boolean(value)),
  );

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];

  const ensureNode = (node: GraphNode) => {
    nodes.set(node.id, node);
    return node.id;
  };

  const ensureStateNode = (state: string, metadata: Record<string, unknown> = {}) => {
    const normalized = normalizeStateCode(state);
    const nodeId = `state:${normalized}`;
    if (!nodes.has(nodeId)) {
      nodes.set(nodeId, {
        id: nodeId,
        type: 'state',
        label: normalized,
        metadata: { code: normalized, ...metadata },
      });
    }
    return nodeId;
  };

  ensureNode({
    id: clinicianNodeId,
    type: 'clinician',
    label: clinician.user?.name ?? clinician.npi ?? clinician.id,
    metadata: {
      npi: clinician.npi,
      specialty: clinician.specialty,
      state: clinician.state,
      did: clinician.user?.did,
    },
  });

  addLicenseNodes(licenses, clinicianNodeId, ensureNode, ensureStateNode, edges, warnings);
  addCompactNodes(compacts, clinicianNodeId, ensureNode, ensureStateNode, edges);
  addPrivilegeNodes(privilegeGrants, clinicianNodeId, ensureNode, ensureStateNode, orgMap, edges, warnings);
  addPayerNodes(enrollments, clinicianNodeId, ensureNode, ensureStateNode, edges);

  let graph: CredentialGraph = {
    nodes: Array.from(nodes.values()),
    edges,
    warnings,
    issues: [],
    metadata: {
      clinicianId: clinician.id,
      clinicianNodeId,
      clinicianName: clinician.user?.name,
      clinicianDid: clinician.user?.did,
      npi: clinician.npi,
      specialty: clinician.specialty,
      homeState: clinician.state,
      compactTypes: compacts.map((entry) => entry.compactType),
      generatedAt: new Date().toISOString(),
    },
  };

  graph.issues = detectGraphInconsistencies(graph, { clinicianNodeId });
  graph.warnings = dedupe([...graph.warnings, ...graph.issues.map((issue) => issue.message)]);

  if (timeline?.events?.length) {
    const projection = projectTimelineToGraph(timeline.events);
    graph = mergeTimelineProjection(graph, projection, clinicianNodeId);
  }

  return graph;
}

function addLicenseNodes(
  licenses: Awaited<ReturnType<typeof prisma.stateLicenseVerification.findMany>>,
  clinicianNodeId: string,
  ensureNode: (node: GraphNode) => string,
  ensureStateNode: (state: string, metadata?: Record<string, unknown>) => string,
  edges: GraphEdge[],
  warnings: string[],
) {
  for (const license of licenses) {
    const licenseNodeId = ensureNode({
      id: `license:${license.id}`,
      type: 'license',
      label: `${license.state} license`,
      status: license.status,
      metadata: {
        status: license.status,
        licenseNumber: license.licenseNumber,
        issueDate: license.issueDate?.toISOString(),
        expiryDate: license.expiryDate?.toISOString(),
        lastCheckedAt: license.lastCheckedAt?.toISOString(),
      },
    });

    edges.push({
      id: `edge:${clinicianNodeId}->${licenseNodeId}`,
      source: clinicianNodeId,
      target: licenseNodeId,
      type: 'holds_license',
      active: license.status === 'ACTIVE',
      metadata: {
        state: license.state,
      },
    });

    const stateNodeId = ensureStateNode(license.state);
    edges.push({
      id: `edge:${licenseNodeId}->${stateNodeId}`,
      source: licenseNodeId,
      target: stateNodeId,
      type: 'licensed_in',
      active: license.status === 'ACTIVE',
      metadata: {
        expiresAt: license.expiryDate?.toISOString(),
      },
    });

    if (license.expiryDate) {
      const daysRemaining = (license.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysRemaining < 45) {
        warnings.push(`License in ${license.state} expires in ${Math.max(0, Math.round(daysRemaining))} days`);
      }
    }
  }
}

function addCompactNodes(
  compacts: Awaited<ReturnType<typeof prisma.clinicianCompactWallet.findMany>>,
  clinicianNodeId: string,
  ensureNode: (node: GraphNode) => string,
  ensureStateNode: (state: string) => string,
  edges: GraphEdge[],
) {
  for (const wallet of compacts) {
    const compactNodeId = ensureNode({
      id: `compact:${wallet.compactType}:${wallet.id}`,
      type: 'compact',
      label: `${wallet.compactType} compact`,
      metadata: {
        compactType: wallet.compactType,
        homeState: wallet.homeState,
        expiresAt: wallet.expiresAt?.toISOString(),
      },
    });

    edges.push({
      id: `edge:${clinicianNodeId}->${compactNodeId}`,
      source: clinicianNodeId,
      target: compactNodeId,
      type: 'member_of_compact',
      active: !wallet.expiresAt || wallet.expiresAt > new Date(),
      metadata: {
        homeState: wallet.homeState,
      },
    });

    const detail = getAuthorizedStatesDetailed(wallet.compactType, wallet.homeState, {
      graph: DEFAULT_STATE_GRAPH,
      includeHomeState: wallet.compactType !== 'IMLC',
    });

    for (const state of detail.states) {
      const stateNodeId = ensureStateNode(state);
      edges.push({
        id: `edge:${compactNodeId}->${stateNodeId}`,
        source: compactNodeId,
        target: stateNodeId,
        type: 'compact_extends_to',
        active: true,
        metadata: { compactType: wallet.compactType },
      });
    }
  }
}

function addPrivilegeNodes(
  privilegeGrants: Awaited<ReturnType<typeof prisma.privilegeGranted.findMany>>,
  clinicianNodeId: string,
  ensureNode: (node: GraphNode) => string,
  ensureStateNode: (state: string) => string,
  orgMap: Map<string, OrgWithEhr>,
  edges: GraphEdge[],
  warnings: string[],
) {
  for (const grant of privilegeGrants) {
    const privilegeNodeId = ensureNode({
      id: `privilege:${grant.id}`,
      type: 'privilege',
      label: grant.privilegeRequest?.privilegeSet?.name ?? 'Privilege grant',
      status: grant.status,
      metadata: {
        privilegeSetId: grant.privilegeSetId,
        grantedAt: grant.grantedAt.toISOString(),
        expiresAt: grant.expiresAt.toISOString(),
      },
    });

    edges.push({
      id: `edge:${clinicianNodeId}->${privilegeNodeId}`,
      source: clinicianNodeId,
      target: privilegeNodeId,
      type: 'granted_privilege',
      active: grant.status === 'ACTIVE',
      metadata: {
        orgId: grant.orgId,
      },
    });

    const org = orgMap.get(grant.orgId);
    if (org) {
      const orgNodeId = ensureNode({
        id: `org:${org.orgId}`,
        type: 'org',
        label: org.name,
        metadata: {
          orgId: org.orgId,
          state: extractStateFromAddress(org.address),
          ehrType: org.ehrType,
        },
      });

      edges.push({
        id: `edge:${privilegeNodeId}->${orgNodeId}`,
        source: privilegeNodeId,
        target: orgNodeId,
        type: 'affiliated_with',
        active: grant.status === 'ACTIVE',
      });

      const orgState = extractStateFromAddress(org.address);
      if (orgState) {
        const stateNodeId = ensureStateNode(orgState);
        edges.push({
          id: `edge:${orgNodeId}->${stateNodeId}`,
          source: orgNodeId,
          target: stateNodeId,
          type: 'operates_in',
          active: true,
        });
      }
    } else {
      warnings.push(`Missing org profile for ${grant.orgId}`);
    }
  }
}

function addPayerNodes(
  enrollments: Awaited<ReturnType<typeof prisma.payerEnrollmentV2.findMany>>,
  clinicianNodeId: string,
  ensureNode: (node: GraphNode) => string,
  ensureStateNode: (state: string) => string,
  edges: GraphEdge[],
) {
  for (const enrollment of enrollments) {
    const payer = enrollment.payer as Payer;
    const payerNodeId = ensureNode({
      id: `payer:${payer.id}`,
      type: 'payer',
      label: payer.name,
      metadata: {
        payerId: payer.payerId,
        states: payer.states,
        planTypes: payer.planTypes,
      },
    });

    edges.push({
      id: `edge:${clinicianNodeId}->${payerNodeId}`,
      source: clinicianNodeId,
      target: payerNodeId,
      type: 'enrolled_with',
      active: enrollment.status === 'ENROLLED',
      metadata: {
        status: enrollment.status,
        effectiveDate: enrollment.effectiveDate?.toISOString(),
      },
    });

    for (const state of payer.states) {
      const stateNodeId = ensureStateNode(state);
      edges.push({
        id: `edge:${payerNodeId}->${stateNodeId}:${state}`,
        source: payerNodeId,
        target: stateNodeId,
        type: 'covers_state',
        active: true,
      });
    }
  }
}

async function hydrateOrgProfiles(orgIds: string[]): Promise<Map<string, OrgWithEhr>> {
  const uniqueOrgIds = dedupe(orgIds).filter(Boolean);
  if (!uniqueOrgIds.length) {
    return new Map();
  }

  const [profiles, ehrConfigs] = await Promise.all([
    prisma.orgProfile.findMany({
      where: { orgId: { in: uniqueOrgIds } },
    }),
    prisma.ehrConfig.findMany({
      where: { orgId: { in: uniqueOrgIds } },
    }),
  ]);

  const ehrMap = new Map(ehrConfigs.map((config) => [config.orgId, config.ehrType]));
  const result = new Map<string, OrgWithEhr>();
  profiles.forEach((profile) => {
    result.set(profile.orgId, {
      ...profile,
      ehrType: ehrMap.get(profile.orgId),
    });
  });
  return result;
}

function extractStateFromAddress(address: OrgProfile['address']): string | undefined {
  if (!address || typeof address !== 'object') {
    return undefined;
  }
  const maybeState =
    (address as any).state ??
    (address as any).State ??
    (address as any).region ??
    (address as any).province;
  return maybeState ? normalizeStateCode(String(maybeState)) : undefined;
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
