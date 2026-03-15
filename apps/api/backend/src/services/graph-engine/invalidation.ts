import type { PrismaClient } from '@prisma/client';

let graphCacheEpoch = 0;

export function getGraphCacheEpoch(): number {
  return graphCacheEpoch;
}

export function clearGraphResponseCache(): void {
  graphCacheEpoch += 1;
}

export async function invalidateAllGraphSnapshots(
  prisma: PrismaClient,
  reason: string,
): Promise<void> {
  try {
    await prisma.graphSnapshot.updateMany({
      where: { invalidatedAt: null },
      data: {
        invalidatedAt: new Date(),
      },
    });
  } catch {
    // During early bootstrap/tests the graph tables may not exist yet.
  } finally {
    clearGraphResponseCache();
  }

  void reason;
}
