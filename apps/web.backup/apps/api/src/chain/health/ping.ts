import { PrismaClient } from '@prisma/client';
import { performance } from 'node:perf_hooks';
import { resolveValidatorNodes } from './config';
import type { NodeHeartbeat, ValidatorNodeConfig } from './types';

const DEFAULT_TIMEOUT_MS = 6_000;
const defaultPrisma = new PrismaClient();

export interface PingOptions {
  nodes?: ValidatorNodeConfig[];
  timeoutMs?: number;
  prismaClient?: PrismaClient;
}

export async function pingValidatorNodes(options: PingOptions = {}): Promise<NodeHeartbeat[]> {
  const nodes = resolveValidatorNodes(options.nodes);
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const prisma = options.prismaClient ?? defaultPrisma;

  const heartbeats = await Promise.all(
    nodes.map((node) => pingSingleNode({ node, timeout, prisma })),
  );

  return heartbeats;
}

async function pingSingleNode({
  node,
  timeout,
  prisma,
}: {
  node: ValidatorNodeConfig;
  timeout: number;
  prisma: PrismaClient;
}): Promise<NodeHeartbeat> {
  const started = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const [health, head, finalizedHash] = await Promise.all([
      callRpc(node.rpcUrl, 'system_health', [], timeout),
      callRpc(node.rpcUrl, 'chain_getHeader', [], timeout),
      callRpc(node.rpcUrl, 'chain_getFinalizedHead', [], timeout),
    ]);

    const finalizedHeader = finalizedHash
      ? await callRpc(node.rpcUrl, 'chain_getHeader', [finalizedHash], timeout)
      : null;

    const block = parseBlockNumber(head);
    const finalizedBlock = parseBlockNumber(finalizedHeader);
    const finalityLag = Math.max(0, block - finalizedBlock);
    const peers = Number(health?.peers ?? 0);
    const synced = !health?.isSyncing && finalityLag <= 6;
    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    await prisma.chainHealth
      .create({
        data: {
          nodeId: node.id,
          block,
          latencyMs,
          synced,
        },
      })
      .catch((error) => {
        console.warn(`[chain][health][${node.id}] failed to persist heartbeat`, error);
      });

    return {
      nodeId: node.id,
      label: node.label,
      rpcUrl: node.rpcUrl,
      region: node.region,
      latencyMs,
      block,
      finalizedBlock,
      finalityLag,
      peers,
      synced,
      timestamp,
    };
  } catch (error) {
    console.warn(`[chain][health][${node.id}] heartbeat failed`, error);
    return {
      nodeId: node.id,
      label: node.label,
      rpcUrl: node.rpcUrl,
      region: node.region,
      latencyMs: timeout,
      block: 0,
      finalizedBlock: 0,
      finalityLag: 0,
      peers: 0,
      synced: false,
      timestamp,
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

async function callRpc(
  rpcUrl: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`RPC ${method} failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message ?? `RPC ${method} failed`);
    }
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

function parseBlockNumber(header: any): number {
  if (!header) return 0;
  if (typeof header.number === 'string') {
    return parseInt(header.number, 16) || 0;
  }
  if (typeof header.number === 'number') {
    return header.number;
  }
  if (typeof header.height === 'number') {
    return header.height;
  }
  return 0;
}

