/**
 * Sanctions graph collector
 * Collects sanctions/OFAC graph metadata
 */

import type { PrismaClient } from '@prisma/client';

export interface SanctionsGraphState {
  totalNodes: number;
  totalEdges: number;
  lastUpdated?: string;
  graphActive: boolean;
}

export async function collectSanctionsGraph(
  prisma: PrismaClient
): Promise<SanctionsGraphState> {
  try {
    // Try to query sanctions graph tables
    const nodeCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "SanctionsNode"
    `.catch(() => [{ count: 0n }]);

    const edgeCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "SanctionsEdge"
    `.catch(() => [{ count: 0n }]);

    const lastUpdate = await prisma.$queryRaw<Array<{ updatedAt: Date }>>`
      SELECT MAX("updatedAt") as "updatedAt"
      FROM "SanctionsNode"
    `.catch(() => []);

    return {
      totalNodes: Number(nodeCount[0]?.count || 0),
      totalEdges: Number(edgeCount[0]?.count || 0),
      lastUpdated: lastUpdate[0]?.updatedAt?.toISOString(),
      graphActive: Number(nodeCount[0]?.count || 0) > 0,
    };
  } catch (error) {
    // Return safe defaults
    return {
      totalNodes: 0,
      totalEdges: 0,
      graphActive: false,
    };
  }
}

