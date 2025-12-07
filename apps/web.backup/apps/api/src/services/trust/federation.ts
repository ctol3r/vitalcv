import { PrismaClient, type IssuerFederation } from '@prisma/client';
import { anchorFederationChange } from '../audit/anchor';

const prisma = new PrismaClient();

export interface FederationLinkInput {
  parentDid: string;
  childDid: string;
  trustLevel: number;
  metadata?: Record<string, any>;
}

export interface FederationMembership {
  parentDid: string;
  childDid: string;
  trustLevel: number;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

export interface FederationResolution {
  parentDid: string;
  candidateDid: string;
  path: string[];
  minimumTrustLevel: number;
  hops: number;
}

const MIN_TRUST = 1;
const MAX_TRUST = 5;

export async function addFederatedIssuer(input: FederationLinkInput): Promise<IssuerFederation> {
  const sanitizedTrust = clampTrust(input.trustLevel);
  const record = await prisma.issuerFederation.upsert({
    where: {
      parentDid_childDid: {
        parentDid: input.parentDid,
        childDid: input.childDid,
      },
    },
    create: {
      parentDid: input.parentDid,
      childDid: input.childDid,
      trustLevel: sanitizedTrust,
      metadata: input.metadata ?? {},
    },
    update: {
      trustLevel: sanitizedTrust,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });

  anchorFederationChange('federationAdded', {
    parentDid: record.parentDid,
    childDid: record.childDid,
    trustLevel: record.trustLevel,
  });

  return record;
}

export async function removeFederatedIssuer(parentDid: string, childDid: string): Promise<boolean> {
  const existing = await prisma.issuerFederation.findUnique({
    where: {
      parentDid_childDid: {
        parentDid,
        childDid,
      },
    },
  });

  if (!existing) {
    return false;
  }

  await prisma.issuerFederation.delete({
    where: {
      parentDid_childDid: {
        parentDid,
        childDid,
      },
    },
  });

  anchorFederationChange('federationRemoved', {
    parentDid: existing.parentDid,
    childDid: existing.childDid,
    trustLevel: existing.trustLevel,
  });

  return true;
}

export async function getFederatedIssuers(parentDid: string): Promise<FederationMembership[]> {
  const rows = await prisma.issuerFederation.findMany({
    where: { parentDid },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    parentDid: row.parentDid,
    childDid: row.childDid,
    trustLevel: row.trustLevel,
    metadata: (row.metadata as Record<string, any> | null) ?? null,
    createdAt: row.createdAt,
  }));
}

export async function listFederationGraph(): Promise<IssuerFederation[]> {
  return prisma.issuerFederation.findMany({
    orderBy: [{ parentDid: 'asc' }, { childDid: 'asc' }],
  });
}

export async function isInFederation(
  parentDid: string,
  candidateDid: string,
): Promise<FederationResolution | null> {
  if (!parentDid || !candidateDid || parentDid === candidateDid) {
    return null;
  }

  const links = await prisma.issuerFederation.findMany();
  if (!links.length) {
    return null;
  }

  const adjacency = buildAdjacency(links);
  const visited = new Set<string>();
  type State = { did: string; path: string[]; minTrust: number };
  const stack: State[] = [{ did: parentDid, path: [parentDid], minTrust: MAX_TRUST }];

  while (stack.length) {
    const node = stack.pop()!;
    if (visited.has(node.did)) {
      continue;
    }
    visited.add(node.did);

    const children = adjacency.get(node.did) ?? [];
    for (const link of children) {
      const updatedPath = [...node.path, link.childDid];
      const nextMinTrust = Math.min(node.minTrust, clampTrust(link.trustLevel));
      if (link.childDid === candidateDid) {
        return {
          parentDid,
          candidateDid,
          path: updatedPath,
          minimumTrustLevel: nextMinTrust,
          hops: updatedPath.length - 1,
        };
      }
      if (!visited.has(link.childDid)) {
        stack.push({
          did: link.childDid,
          path: updatedPath,
          minTrust: nextMinTrust,
        });
      }
    }
  }

  return null;
}

function clampTrust(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_TRUST;
  }
  return Math.min(MAX_TRUST, Math.max(MIN_TRUST, Math.round(value)));
}

function buildAdjacency(links: IssuerFederation[]): Map<string, IssuerFederation[]> {
  const map = new Map<string, IssuerFederation[]>();
  for (const link of links) {
    if (!map.has(link.parentDid)) {
      map.set(link.parentDid, []);
    }
    map.get(link.parentDid)!.push(link);
  }
  return map;
}

