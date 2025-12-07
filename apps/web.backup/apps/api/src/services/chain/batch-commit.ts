import { createHash, randomUUID } from 'crypto';
import { ChainClient, type BatchCommitPayload, type ChainReceipt } from './client';

export type BatchEntryType = 'issuance' | 'verification' | 'psv';

export interface BatchEntryInput {
  type: BatchEntryType;
  payload: Record<string, unknown>;
  hash?: string;
  timestamp?: string;
}

export interface BatchCommitOptions {
  intervalMs?: number;
  maxEntries?: number;
  chainClient?: ChainClient;
}

export interface BatchCommitResult {
  merkleRoot: string;
  receipt: ChainReceipt;
  entryCount: number;
  committedAt: string;
}

interface InternalEntry {
  id: string;
  type: BatchEntryType;
  hash: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const DEFAULT_INTERVAL = 60_000;
const DEFAULT_MAX_ENTRIES = 512;

export class AuditBatchCommitPipeline {
  private readonly intervalMs: number;
  private readonly maxEntries: number;
  private readonly client: ChainClient;
  private buffer: InternalEntry[] = [];
  private timer?: NodeJS.Timeout;

  constructor(options: BatchCommitOptions = {}) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.client = options.chainClient ?? new ChainClient();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((error) => console.error('[BatchCommit] flush failed', error));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  enqueue(entry: BatchEntryInput): void {
    const normalized: InternalEntry = {
      id: randomUUID(),
      type: entry.type,
      payload: entry.payload,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      hash: entry.hash ?? hashPayload(entry.payload),
    };
    this.buffer.push(normalized);
    if (this.buffer.length >= this.maxEntries) {
      void this.flush();
    }
  }

  async flush(): Promise<BatchCommitResult | null> {
    if (this.buffer.length === 0) {
      return null;
    }

    const entries = this.buffer;
    this.buffer = [];

    const merkleRoot = buildMerkleRoot(entries.map((entry) => entry.hash));
    const committedAt = new Date().toISOString();

    const payload: BatchCommitPayload = {
      merkleRoot,
      entryCount: entries.length,
      committedAt,
      entries: entries.map((entry) => ({
        type: entry.type,
        hash: entry.hash,
        metadata: {
          id: entry.id,
          timestamp: entry.timestamp,
        },
      })),
    };

    const receipt = await this.client.commitBatchRoot(payload);

    return {
      merkleRoot,
      receipt,
      entryCount: entries.length,
      committedAt,
    };
  }
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function buildMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return hashPayload({ empty: true });
  }
  if (hashes.length === 1) {
    return hashes[0];
  }

  let level = hashes.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] ?? left;
      next.push(hashPair(left, right));
    }
    level = next;
  }
  return level[0];
}

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(`${left}${right}`).digest('hex');
}











