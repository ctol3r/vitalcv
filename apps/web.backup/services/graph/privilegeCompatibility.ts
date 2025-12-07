import { PrismaClient, type PrivilegeMatrix } from '@prisma/client';
import { COMPACT_TYPES } from '../compacts/models/CompactParticipation';
import { getActiveStates } from '../compacts/compactGraph';
import { normalizeStateCode } from '../compacts/models/CompactParticipation';

const prisma = new PrismaClient();

export interface PrivilegeCompatibilityEntry {
  orgId: string;
  orgName: string;
  states: string[];
  privilegeSetId: string;
  privilegeSetName: string;
  specialty: string;
  ehrType?: string | null;
  compacts: string[];
  lastUpdated: string;
}

export interface PrivilegeCompatibilitySummary {
  orgCount: number;
  stateCoverage: Record<string, number>;
  ehrVendors: Record<string, number>;
  compactSupport: Record<string, string[]>;
}

export interface PrivilegeCompatibilityResponse {
  privilegeCode: string;
  privilege: PrivilegeMatrix;
  support: PrivilegeCompatibilityEntry[];
  summary: PrivilegeCompatibilitySummary;
}

export async function getPrivilegeCompatibility(privilegeCode: string): Promise<PrivilegeCompatibilityResponse> {
  const privilege = await prisma.privilegeMatrix.findUnique({
    where: { privilegeCode },
  });

  if (!privilege) {
    const error = new Error(`privilege_not_found:${privilegeCode}`);
    (error as any).statusCode = 404;
    throw error;
  }

  const links = await prisma.privilegeSetV2Privilege.findMany({
    where: { privilegeCode },
    include: {
      privilegeSet: true,
    },
  });

  if (!links.length) {
    return {
      privilegeCode,
      privilege,
      support: [],
      summary: {
        orgCount: 0,
        stateCoverage: {},
        ehrVendors: {},
        compactSupport: {},
      },
    };
  }

  const orgIds = Array.from(new Set(links.map((link) => link.privilegeSet.orgId))).filter(Boolean);
  const [orgProfiles, ehrConfigs] = await Promise.all([
    prisma.orgProfile.findMany({
      where: { orgId: { in: orgIds } },
    }),
    prisma.ehrConfig.findMany({
      where: { orgId: { in: orgIds } },
    }),
  ]);

  const orgMap = new Map(orgProfiles.map((org) => [org.orgId, org]));
  const ehrMap = new Map(ehrConfigs.map((config) => [config.orgId, config.ehrType]));
  const compactsByState = buildCompactsByState();

  const support: PrivilegeCompatibilityEntry[] = links
    .map((link) => {
      const org = orgMap.get(link.privilegeSet.orgId);
      if (!org) return null;

      const state = extractOrgState(org.address);
      const states = state ? [state] : [];
      const compacts = dedupe(states.flatMap((code) => compactsByState.get(code) ?? []));

      return {
        orgId: org.orgId,
        orgName: org.name,
        states,
        privilegeSetId: link.privilegeSet.id,
        privilegeSetName: link.privilegeSet.name,
        specialty: link.privilegeSet.specialty,
        ehrType: ehrMap.get(org.orgId),
        compacts,
        lastUpdated: org.updatedAt.toISOString(),
      };
    })
    .filter((entry): entry is PrivilegeCompatibilityEntry => Boolean(entry));

  const summary = buildSummary(support, compactsByState);

  return {
    privilegeCode,
    privilege,
    support,
    summary,
  };
}

function buildCompactsByState(): Map<string, string[]> {
  const compacts = new Map<string, string[]>();
  for (const compact of COMPACT_TYPES) {
    const states = getActiveStates(compact, undefined);
    for (const state of states) {
      const bucket = compacts.get(state) ?? [];
      bucket.push(compact);
      compacts.set(state, bucket);
    }
  }
  return compacts;
}

function extractOrgState(address: Record<string, unknown> | null): string | undefined {
  if (!address) return undefined;
  const state =
    (address as any).state ??
    (address as any).State ??
    (address as any).region ??
    (address as any).province ??
    null;
  return state ? normalizeStateCode(String(state)) : undefined;
}

function buildSummary(
  support: PrivilegeCompatibilityEntry[],
  compactsByState: Map<string, string[]>,
): PrivilegeCompatibilitySummary {
  const stateCoverage: Record<string, number> = {};
  const ehrVendors: Record<string, number> = {};
  const compactSupport: Record<string, Set<string>> = {};

  for (const entry of support) {
    for (const state of entry.states) {
      stateCoverage[state] = (stateCoverage[state] ?? 0) + 1;
      const compacts = compactsByState.get(state) ?? [];
      for (const compact of compacts) {
        if (!compactSupport[compact]) {
          compactSupport[compact] = new Set();
        }
        compactSupport[compact].add(state);
      }
    }

    if (entry.ehrType) {
      ehrVendors[entry.ehrType] = (ehrVendors[entry.ehrType] ?? 0) + 1;
    } else {
      ehrVendors['unknown'] = (ehrVendors['unknown'] ?? 0) + 1;
    }
  }

  const normalizedCompactSupport: Record<string, string[]> = {};
  Object.entries(compactSupport).forEach(([compact, states]) => {
    normalizedCompactSupport[compact] = Array.from(states.values()).sort();
  });

  return {
    orgCount: support.length,
    stateCoverage,
    ehrVendors,
    compactSupport: normalizedCompactSupport,
  };
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

