import { createHash } from 'crypto';
import {
  NCIVerifiableProof as NCIVerifiableProofRecord,
  NCIVerifiableProofType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

export interface RecordProofInput {
  did: string;
  proofType: NCIVerifiableProofType;
  eventType: string;
  payload: unknown;
  anchorTxHash?: string | null;
  chainId?: string | null;
  metadata?: Record<string, unknown> | null;
  issuedFor?: string | null;
}

export class VerifiableProofRegistry {
  constructor(private readonly client: PrismaClient = prisma) {}

  async recordProof(input: RecordProofInput): Promise<NCIVerifiableProofRecord> {
    const payloadHash = VerifiableProofRegistry.hashPayload(input.payload);

    return this.client.nCIVerifiableProof.upsert({
      where: {
        payloadHash_proofType: {
          payloadHash,
          proofType: input.proofType,
        },
      },
      update: {
        did: input.did,
        eventType: input.eventType,
        anchorTxHash: input.anchorTxHash ?? null,
        chainId: input.chainId ?? null,
        metadata: input.metadata ?? null,
        issuedFor: input.issuedFor ?? null,
      },
      create: {
        did: input.did,
        proofType: input.proofType,
        eventType: input.eventType,
        payloadHash,
        anchorTxHash: input.anchorTxHash ?? null,
        chainId: input.chainId ?? null,
        metadata: input.metadata ?? null,
        issuedFor: input.issuedFor ?? null,
      },
    });
  }

  async hasProof(did: string, proofType: NCIVerifiableProofType, payload: unknown): Promise<boolean> {
    const payloadHash = VerifiableProofRegistry.hashPayload(payload);
    const existing = await this.client.nCIVerifiableProof.findUnique({
      where: {
        payloadHash_proofType: {
          payloadHash,
          proofType,
        },
      },
      select: { id: true, did: true },
    });
    return Boolean(existing && existing.did === did);
  }

  async listProofs(did: string, proofType?: NCIVerifiableProofType): Promise<NCIVerifiableProofRecord[]> {
    return this.client.nCIVerifiableProof.findMany({
      where: {
        did,
        proofType: proofType ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static hashPayload(payload: unknown): string {
    const normalized = normalizePayload(payload);
    return createHash('sha256').update(normalized).digest('hex');
  }
}

function normalizePayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return 'null';
  }
  if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
    return JSON.stringify(payload);
  }
  if (Array.isArray(payload)) {
    return `[${payload.map((entry) => normalizePayload(entry)).join(',')}]`;
  }

  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `"${key}":${normalizePayload(value)}`);

  return `{${entries.join(',')}}`;
}
import { createHash } from 'crypto';
import {
  NCIVerifiableProof as NCIVerifiableProofRecord,
  NCIVerifiableProofType,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

export interface RecordProofInput {
  did: string;
  proofType: NCIVerifiableProofType;
  eventType: string;
  payload: unknown;
  anchorTxHash?: string | null;
  chainId?: string | null;
  metadata?: Record<string, unknown> | null;
  issuedFor?: string | null;
}

export class VerifiableProofRegistry {
  constructor(private readonly client: PrismaClient = prisma) {}

  async recordProof(input: RecordProofInput): Promise<NCIVerifiableProofRecord> {
    const payloadHash = VerifiableProofRegistry.hashPayload(input.payload);

    return this.client.nCIVerifiableProof.upsert({
      where: {
        payloadHash_proofType: {
          payloadHash,
          proofType: input.proofType,
        },
      },
      update: {
        did: input.did,
        eventType: input.eventType,
        anchorTxHash: input.anchorTxHash ?? null,
        chainId: input.chainId ?? null,
        metadata: input.metadata ?? null,
        issuedFor: input.issuedFor ?? null,
      },
      create: {
        did: input.did,
        proofType: input.proofType,
        eventType: input.eventType,
        payloadHash,
        anchorTxHash: input.anchorTxHash ?? null,
        chainId: input.chainId ?? null,
        metadata: input.metadata ?? null,
        issuedFor: input.issuedFor ?? null,
      },
    });
  }

  async hasProof(did: string, proofType: NCIVerifiableProofType, payload: unknown): Promise<boolean> {
    const payloadHash = VerifiableProofRegistry.hashPayload(payload);
    const existing = await this.client.nCIVerifiableProof.findUnique({
      where: {
        payloadHash_proofType: {
          payloadHash,
          proofType,
        },
      },
      select: { id: true, did: true },
    });
    return Boolean(existing && existing.did === did);
  }

  async listProofs(did: string, proofType?: NCIVerifiableProofType): Promise<NCIVerifiableProofRecord[]> {
    return this.client.nCIVerifiableProof.findMany({
      where: {
        did,
        proofType: proofType ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static hashPayload(payload: unknown): string {
    const normalized = normalizePayload(payload);
    return createHash('sha256').update(normalized).digest('hex');
  }
}

function normalizePayload(payload: unknown): string {
  if (payload === null || payload === undefined) {
    return 'null';
  }
  if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
    return JSON.stringify(payload);
  }
  if (Array.isArray(payload)) {
    return `[${payload.map((entry) => normalizePayload(entry)).join(',')}]`;
  }

  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `"${key}":${normalizePayload(value)}`);

  return `{${entries.join(',')}}`;
}

