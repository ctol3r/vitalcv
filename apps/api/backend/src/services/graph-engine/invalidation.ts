import { Prisma, type PrismaClient } from '@prisma/client';
import { stableStringify } from '../../utils/deterministic';
import type { GraphLayer } from './schema';

let graphCacheEpoch = 0;

export function getGraphCacheEpoch(): number {
  return graphCacheEpoch;
}

export function clearGraphResponseCache(): void {
  graphCacheEpoch += 1;
}

export interface GraphInvalidationInput {
  reason: string;
  graphModes?: GraphLayer[];
  focusNodeIds?: string[];
  scopeKeys?: string[];
  querySignatures?: string[];
  invalidateGlobal?: boolean;
  invalidateAll?: boolean;
  metadata?: Record<string, unknown>;
}

const ALL_GRAPH_MODES: GraphLayer[] = ['knowledge', 'trust', 'blended'];

export function expandGraphModes(graphModes?: GraphLayer[]): GraphLayer[] {
  const normalized = new Set<GraphLayer>(graphModes ?? ALL_GRAPH_MODES);
  return ALL_GRAPH_MODES.filter((mode) => normalized.has(mode));
}

function buildInvalidationWhere(input: GraphInvalidationInput): Prisma.GraphSnapshotWhereInput {
  if (
    input.invalidateAll
    || (
      (input.focusNodeIds?.length ?? 0) === 0
      && (input.scopeKeys?.length ?? 0) === 0
      && (input.querySignatures?.length ?? 0) === 0
      && input.invalidateGlobal !== false
      && (!input.graphModes || input.graphModes.length === 0 || expandGraphModes(input.graphModes).length === ALL_GRAPH_MODES.length)
    )
  ) {
    return { invalidatedAt: null };
  }

  const graphModes = expandGraphModes(input.graphModes);
  const scopes: Prisma.GraphSnapshotWhereInput[] = [];

  if (input.invalidateGlobal !== false) {
    scopes.push({
      scopeType: 'global',
      graphMode: { in: graphModes },
    });
  }

  if ((input.focusNodeIds?.length ?? 0) > 0) {
    scopes.push({
      scopeType: 'local',
      focusNodeId: { in: [...new Set(input.focusNodeIds)] },
      graphMode: { in: graphModes },
    });
  }

  if ((input.scopeKeys?.length ?? 0) > 0) {
    scopes.push({
      scopeKey: { in: [...new Set(input.scopeKeys)] },
      graphMode: { in: graphModes },
    });
  }

  if ((input.querySignatures?.length ?? 0) > 0) {
    scopes.push({
      querySignature: { in: [...new Set(input.querySignatures)] },
    });
  }

  return {
    invalidatedAt: null,
    OR: scopes.length > 0 ? scopes : [{ invalidatedAt: null }],
  };
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';
}

export async function invalidateGraphSnapshots(
  prisma: PrismaClient,
  input: GraphInvalidationInput,
): Promise<{ invalidatedCount: number }> {
  try {
    const where = buildInvalidationWhere(input);
    const invalidationScope = {
      graphModes: expandGraphModes(input.graphModes),
      focusNodeIds: [...new Set(input.focusNodeIds ?? [])].sort(),
      scopeKeys: [...new Set(input.scopeKeys ?? [])].sort(),
      querySignatures: [...new Set(input.querySignatures ?? [])].sort(),
      invalidateGlobal: input.invalidateGlobal !== false,
      invalidateAll: Boolean(input.invalidateAll),
      metadata: input.metadata ?? {},
    };

    const result = await prisma.graphSnapshot.updateMany({
      where,
      data: {
        invalidatedAt: new Date(),
        lastInvalidationReason: input.reason,
        lastInvalidationScope: JSON.parse(stableStringify(invalidationScope)),
      },
    });

    return { invalidatedCount: result.count };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { invalidatedCount: 0 };
    }
    throw error;
  } finally {
    clearGraphResponseCache();
  }
}

export async function invalidateAllGraphSnapshots(
  prisma: PrismaClient,
  reason: string,
): Promise<void> {
  await invalidateGraphSnapshots(prisma, {
    reason,
    invalidateAll: true,
  });
}
