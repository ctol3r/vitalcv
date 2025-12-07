import { PrismaClient } from '@prisma/client';

import { enforceLatencySlo } from '../services/chain/slo';

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_RPC_URL = process.env.SUBSTRATE_RPC_URL ?? 'http://localhost:9933';
const LOOKBACK_WINDOW_MS = 5 * 60 * 1000;

interface ChainTelemetryOptions {
  intervalMs?: number;
  rpcUrl?: string;
  prismaClient?: PrismaClient;
}

interface BlockHeader {
  number: number;
  hash: string;
}

export class ChainTelemetryWorker {
  private timer?: NodeJS.Timer;
  private readonly interval: number;
  private readonly rpcUrl: string;
  private readonly prisma: PrismaClient;
  private lastBlockNumber?: number;
  private lastSampleAt?: number;
  private lastBlockTimeMs: number = 6000;

  constructor(options: ChainTelemetryOptions = {}) {
    this.interval = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.rpcUrl = options.rpcUrl ?? DEFAULT_RPC_URL;
    this.prisma = options.prismaClient ?? new PrismaClient();
  }

  start(): void {
    if (this.timer) return;
    void this.collect();
    this.timer = setInterval(() => {
      void this.collect();
    }, this.interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async collect(): Promise<void> {
    try {
      const [latestHeader, finalizedHeader] = await Promise.all([
        this.fetchHead(),
        this.fetchFinalizedHead(),
      ]);
      if (!latestHeader) {
        throw new Error('Unable to fetch latest block header');
      }

      const blockTimeMs = this.deriveBlockTime(latestHeader.number);
      const finalityLag = Math.max(0, latestHeader.number - (finalizedHeader?.number ?? latestHeader.number));
      const queueDepth = await estimateQueueDepth(this.prisma);

      const metrics = await this.prisma.chainMetrics.create({
        data: {
          blockTimeMs,
          finalityLag,
          queueDepth,
        },
      });

      await enforceLatencySlo({
        metrics,
        prismaClient: this.prisma,
        handlers: {
          alert: async (payload) => {
            console.warn('[chain][slo] breach detected', payload);
          },
          enableFallbackAnchoring: async (reason) => {
            console.warn('[chain][slo] activating fallback anchoring:', reason);
          },
        },
      });
    } catch (error) {
      console.error('[chain][telemetry] collection failed', error);
    }
  }

  private async fetchHead(hash?: string): Promise<BlockHeader | null> {
    const result = await this.callRpc(hash ? 'chain_getHeader' : 'chain_getHeader', hash ? [hash] : undefined);
    if (!result) return null;
    return {
      number: hexToNumber(result.number),
      hash: result.hash ?? result.parentHash ?? '0x0',
    };
  }

  private async fetchFinalizedHead(): Promise<BlockHeader | null> {
    const hash = await this.callRpc('chain_getFinalizedHead');
    if (!hash || typeof hash !== 'string') return null;
    return this.fetchHead(hash);
  }

  private deriveBlockTime(currentBlockNumber: number): number {
    const now = Date.now();
    if (this.lastBlockNumber !== undefined && this.lastSampleAt !== undefined && currentBlockNumber > this.lastBlockNumber) {
      const blockDelta = currentBlockNumber - this.lastBlockNumber;
      const timeDelta = now - this.lastSampleAt;
      this.lastBlockTimeMs = Math.max(1000, Math.round(timeDelta / blockDelta));
    }
    this.lastBlockNumber = currentBlockNumber;
    this.lastSampleAt = now;
    return this.lastBlockTimeMs;
  }

  private async callRpc(method: string, params: unknown[] = []): Promise<any> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: params ?? [],
      }),
    });
    if (!response.ok) {
      throw new Error(`RPC ${method} failed with status ${response.status}`);
    }
    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message ?? `RPC ${method} failed`);
    }
    return payload.result;
  }
}

async function estimateQueueDepth(client: PrismaClient): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_WINDOW_MS);
  const anchors = await client.auditEvidence.count({
    where: { createdAt: { gte: since } },
  });
  const proofs = await client.blockProof.count({
    where: { timestamp: { gte: since } },
  });
  return Math.max(0, anchors - proofs);
}

function hexToNumber(value?: string | null): number {
  if (!value) return 0;
  try {
    return parseInt(value, 16);
  } catch {
    return 0;
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  const worker = new ChainTelemetryWorker();
  worker.start();
  const shutdown = () => {
    worker.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

