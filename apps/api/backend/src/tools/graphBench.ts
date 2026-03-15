import { performance } from 'node:perf_hooks';
import prisma from '../graphql/prisma_client';
import { applySuggestionDecisions, generateGraphLinkSuggestions } from '../services/graph-engine/aiLinker';
import { queryGraph } from '../services/graph-engine/queryService';
import { runGraphRebuild } from '../services/graph-engine/rebuildEngine';
import { runGraphWorkerOnce } from '../services/graph-engine/worker';
import type { GraphLayer } from '../services/graph-engine/schema';

type Command = 'summary' | 'global' | 'local' | 'suggest' | 'apply' | 'worker';

type Options = {
  graphMode: GraphLayer;
  nodeId?: string;
  iterations: number;
  limit: number;
  depth: number;
  threshold: number;
  maxSuggestionsPerNode: number;
  minConfidence: number;
};

function usage(): string {
  return [
    'Usage:',
    '  pnpm exec ts-node src/tools/graphBench.ts summary [--graph-mode blended] [--node <graphNodeId>] [--iterations 5]',
    '  pnpm exec ts-node src/tools/graphBench.ts global [--graph-mode blended] [--iterations 5] [--limit 500]',
    '  pnpm exec ts-node src/tools/graphBench.ts local --node <graphNodeId> [--depth 2] [--iterations 5]',
    '  pnpm exec ts-node src/tools/graphBench.ts suggest [--graph-mode blended] [--node <graphNodeId>] [--max-suggestions 10] [--min-confidence 0.3]',
    '  pnpm exec ts-node src/tools/graphBench.ts apply [--threshold 0.85]',
    '  pnpm exec ts-node src/tools/graphBench.ts worker',
  ].join('\n');
}

function parseArgs(argv: string[]): { command: Command | null; options: Options } {
  const [commandCandidate, ...rest] = argv;
  const options: Options = {
    graphMode: 'blended',
    iterations: 5,
    limit: 500,
    depth: 2,
    threshold: 0.85,
    maxSuggestionsPerNode: 10,
    minConfidence: 0.3,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    const next = rest[index + 1];
    if (token === '--graph-mode' && (next === 'knowledge' || next === 'trust' || next === 'blended')) {
      options.graphMode = next;
      index += 1;
      continue;
    }
    if (token === '--node' && next) {
      options.nodeId = next;
      index += 1;
      continue;
    }
    if (token === '--iterations' && next) {
      options.iterations = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === '--limit' && next) {
      options.limit = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === '--depth' && next) {
      options.depth = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === '--threshold' && next) {
      options.threshold = Math.min(1, Math.max(0, Number.parseFloat(next) || 0));
      index += 1;
      continue;
    }
    if (token === '--max-suggestions' && next) {
      options.maxSuggestionsPerNode = Math.max(1, Number.parseInt(next, 10) || 1);
      index += 1;
      continue;
    }
    if (token === '--min-confidence' && next) {
      options.minConfidence = Math.min(1, Math.max(0, Number.parseFloat(next) || 0));
      index += 1;
      continue;
    }
  }

  const command = commandCandidate === 'summary'
    || commandCandidate === 'global'
    || commandCandidate === 'local'
    || commandCandidate === 'suggest'
    || commandCandidate === 'apply'
    || commandCandidate === 'worker'
    ? commandCandidate
    : null;

  return { command, options };
}

async function measure<T>(iterations: number, fn: () => Promise<T>): Promise<{
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  lastResult: T;
}> {
  const samples: number[] = [];
  let lastResult!: T;
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    lastResult = await fn();
    samples.push(performance.now() - startedAt);
  }

  return {
    iterations,
    avgMs: Math.round((samples.reduce((sum, value) => sum + value, 0) / samples.length) * 100) / 100,
    minMs: Math.round(Math.min(...samples) * 100) / 100,
    maxMs: Math.round(Math.max(...samples) * 100) / 100,
    lastResult,
  };
}

async function benchmarkGlobal(options: Options): Promise<unknown> {
  const stats = await measure(options.iterations, () => queryGraph({
    graphMode: options.graphMode,
    scope: 'global',
    limit: options.limit,
  }, prisma));

  return {
    operation: 'global_query',
    ...stats,
    snapshotId: stats.lastResult.snapshotId,
    nodes: stats.lastResult.chunk.nodes.length,
    edges: stats.lastResult.chunk.edges.length,
    payloadBytes: stats.lastResult.stats.payloadBytes,
    cacheStatus: stats.lastResult.cacheStatus,
  };
}

async function benchmarkLocal(options: Options): Promise<unknown> {
  if (!options.nodeId) {
    throw new Error('local benchmark requires --node <graphNodeId>');
  }

  const stats = await measure(options.iterations, () => queryGraph({
    graphMode: options.graphMode,
    scope: 'local',
    focusNodeId: options.nodeId,
    depth: options.depth,
    limit: options.limit,
  }, prisma));

  return {
    operation: 'local_query',
    focusNodeId: options.nodeId,
    ...stats,
    snapshotId: stats.lastResult.snapshotId,
    nodes: stats.lastResult.chunk.nodes.length,
    edges: stats.lastResult.chunk.edges.length,
    payloadBytes: stats.lastResult.stats.payloadBytes,
    cacheStatus: stats.lastResult.cacheStatus,
  };
}

async function benchmarkSuggest(options: Options): Promise<unknown> {
  const stats = await measure(options.iterations, () => generateGraphLinkSuggestions({
    graphMode: options.graphMode,
    targetNodeId: options.nodeId ?? null,
    maxSuggestionsPerNode: options.maxSuggestionsPerNode,
    minConfidence: options.minConfidence,
  }, prisma));

  return {
    operation: 'suggestions',
    targetNodeId: options.nodeId ?? null,
    ...stats,
    batchId: stats.lastResult.batchId,
    generated: stats.lastResult.generated,
    suppressedByRejectMemory: stats.lastResult.suppressedByRejectMemory,
    superseded: stats.lastResult.superseded,
  };
}

async function benchmarkApply(options: Options): Promise<unknown> {
  const candidates = await prisma.graphLinkSuggestion.findMany({
    where: {
      state: 'PENDING',
      confidence: { gte: options.threshold },
    },
    orderBy: [{ confidence: 'desc' }, { id: 'asc' }],
    take: 50,
    select: { id: true },
  });

  const suggestionIds = candidates.map((row) => row.id);
  const stats = await measure(1, () => applySuggestionDecisions({
    suggestionIds,
    action: 'accept',
    reviewerId: 'graph-bench',
    rationale: 'graph benchmark apply throughput',
  }, prisma));

  return {
    operation: 'apply_suggestions',
    threshold: options.threshold,
    candidateCount: suggestionIds.length,
    ...stats,
    edgeIds: stats.lastResult.edgeIds.length,
    rejectMemoryIds: stats.lastResult.rejectMemoryIds.length,
  };
}

async function benchmarkWorker(): Promise<unknown> {
  const stats = await measure(1, () => runGraphWorkerOnce(prisma));
  return {
    operation: 'worker_once',
    ...stats,
  };
}

async function benchmarkSummary(options: Options): Promise<unknown> {
  const rebuild = await measure(1, () => runGraphRebuild({
    buildType: 'full',
    graphMode: options.graphMode,
    targetNodeId: options.nodeId ?? null,
    requestedBy: 'graph-bench',
  }, prisma));

  const global = await benchmarkGlobal(options);
  const local = options.nodeId ? await benchmarkLocal(options) : null;

  return {
    operation: 'summary',
    rebuild: {
      avgMs: rebuild.avgMs,
      nodeCount: rebuild.lastResult.nodeCount,
      edgeCount: rebuild.lastResult.edgeCount,
      executionMode: rebuild.lastResult.executionMode,
    },
    global,
    local,
  };
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command) {
    process.stderr.write(`${usage()}\n`);
    process.exitCode = 1;
    return;
  }

  let result: unknown;
  if (command === 'summary') {
    result = await benchmarkSummary(options);
  } else if (command === 'global') {
    result = await benchmarkGlobal(options);
  } else if (command === 'local') {
    result = await benchmarkLocal(options);
  } else if (command === 'suggest') {
    result = await benchmarkSuggest(options);
  } else if (command === 'apply') {
    result = await benchmarkApply(options);
  } else {
    result = await benchmarkWorker();
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
