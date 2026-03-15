import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { generateGraphLinkSuggestions, processQueuedSuggestionBatches } from './aiLinker';
import { processQueuedGraphBuilds, runGraphRebuild, type GraphRebuildInput } from './rebuildEngine';

export async function runGraphWorkerOnce(prismaClient: PrismaClient = prisma): Promise<{
  rebuildsProcessed: number;
  suggestionBatchesProcessed: number;
}> {
  const [rebuilds, batches] = await Promise.all([
    processQueuedGraphBuilds(prismaClient),
    processQueuedSuggestionBatches(prismaClient),
  ]);

  return {
    rebuildsProcessed: rebuilds.length,
    suggestionBatchesProcessed: batches.length,
  };
}

export async function runSynchronousGraphMaintenance(
  rebuildInput: GraphRebuildInput,
  prismaClient: PrismaClient = prisma,
): Promise<{
  rebuild: Awaited<ReturnType<typeof runGraphRebuild>>;
  suggestions: Awaited<ReturnType<typeof generateGraphLinkSuggestions>>;
}> {
  const rebuild = await runGraphRebuild(rebuildInput, prismaClient);
  const suggestions = await generateGraphLinkSuggestions({
    graphMode: rebuildInput.graphMode ?? 'blended',
    targetNodeId: rebuildInput.targetNodeId ?? null,
  }, prismaClient);

  return { rebuild, suggestions };
}
