import { createHash } from 'crypto';

import type { PrismaClient } from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';

const prisma = new DefaultPrismaClient();

type DocumentHashChainRecord = {
  id: string;
  docId: string;
  hashSeq: string[];
  createdAt: Date;
};

export type HashChainStatus = 'created' | 'appended' | 'duplicate' | 'out_of_order';

export interface HashAppendRequest {
  docId: string;
  nextHash: string;
  prevHashHint?: string | null;
  prisma?: PrismaClient;
}

export interface HashAppendResult {
  docId: string;
  appended: boolean;
  valid: boolean;
  status: HashChainStatus;
  digest: string;
  chain: DocumentHashChainRecord;
  reason?: string;
}

export interface HashChainValidationResult {
  docId: string;
  valid: boolean;
  issues: string[];
  digest: string;
  chainLength: number;
  hashSeq: string[];
  persisted: boolean;
}

export interface SignatureLayerInput {
  signerId: string;
  algorithm: string;
  signature: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface SignatureLayerExport extends SignatureLayerInput {
  sequence: number;
  layerHash: string;
  previousLayerHash?: string | null;
}

export interface SignatureChainExport {
  docId: string;
  rootHash: string;
  chainLength: number;
  layers: SignatureLayerExport[];
  generatedAt: string;
  seedDigest?: string;
}

export async function appendDocumentHash(request: HashAppendRequest): Promise<HashAppendResult> {
  if (!request.docId) {
    throw new Error('docId is required to append to a hash chain');
  }
  if (!request.nextHash) {
    throw new Error('nextHash is required to append to a hash chain');
  }

  const client = request.prisma ?? prisma;
  const normalizedHash = normalizeHash(request.nextHash);

  const result = await client.$transaction(async (tx) => {
    const delegate = getDocumentHashChainDelegate(tx);
    const existing = await delegate.findUnique({
      where: { docId: request.docId },
    });

    if (!existing) {
      const created = await delegate.create({
        data: {
          docId: request.docId,
          hashSeq: [normalizedHash],
        },
      });
      return {
        docId: request.docId,
        appended: true,
        valid: true,
        status: 'created' as HashChainStatus,
        digest: computeChainDigest(created.hashSeq),
        chain: created,
      };
    }

    const lastHash = existing.hashSeq.at(-1) ?? null;
    if (request.prevHashHint && lastHash && normalizeHash(request.prevHashHint) !== lastHash) {
      return {
        docId: request.docId,
        appended: false,
        valid: false,
        status: 'out_of_order' as HashChainStatus,
        digest: computeChainDigest(existing.hashSeq),
        chain: existing,
        reason: `Expected previous hash ${lastHash} but received ${normalizeHash(request.prevHashHint)}`,
      };
    }

    if (existing.hashSeq.includes(normalizedHash)) {
      return {
        docId: request.docId,
        appended: false,
        valid: false,
        status: 'duplicate' as HashChainStatus,
        digest: computeChainDigest(existing.hashSeq),
        chain: existing,
        reason: 'Hash already recorded in chain',
      };
    }

    const updated = await delegate.update({
      where: { id: existing.id },
      data: {
        hashSeq: {
          set: [...existing.hashSeq, normalizedHash],
        },
      },
    });

    return {
      docId: request.docId,
      appended: true,
      valid: true,
      status: 'appended' as HashChainStatus,
      digest: computeChainDigest(updated.hashSeq),
      chain: updated,
    };
  });

  return result;
}

export async function validateDocumentHashChain(
  docId: string,
  options: { fallbackSequence?: string[]; prisma?: PrismaClient } = {},
): Promise<HashChainValidationResult> {
  if (!docId) {
    throw new Error('docId is required to validate a hash chain');
  }

  const client = options.prisma ?? prisma;
  const delegate = getDocumentHashChainDelegate(client);
  const record = await delegate.findUnique({ where: { docId } });
  const sequence = record?.hashSeq ?? options.fallbackSequence ?? [];

  if (!sequence.length) {
    return {
      docId,
      valid: false,
      issues: ['missing_chain'],
      digest: '',
      chainLength: 0,
      hashSeq: [],
      persisted: Boolean(record),
    };
  }

  const normalized = sequence.map(normalizeHash).filter(Boolean);
  const issues: string[] = [];

  if (!normalized.length) {
    issues.push('empty_sequence');
  }

  const invalidEntries = normalized
    .map((hash, index) => ({ hash, index }))
    .filter((entry) => !/^(0x)?[a-f0-9]{64}$/i.test(entry.hash));
  if (invalidEntries.length) {
    issues.push('invalid_hash_format');
  }

  const duplicates = findDuplicates(normalized);
  if (duplicates.length) {
    issues.push('duplicate_hash');
  }

  const digest = computeChainDigest(normalized);

  return {
    docId,
    valid: issues.length === 0,
    issues,
    digest,
    chainLength: normalized.length,
    hashSeq: normalized,
    persisted: Boolean(record),
  };
}

export function exportSignatureChain(params: {
  docId: string;
  signatureLayers: SignatureLayerInput[];
  previousDigest?: string | null;
}): SignatureChainExport {
  const generatedAt = new Date().toISOString();
  const seedDigest = params.previousDigest ? normalizeHash(params.previousDigest) : undefined;

  if (!params.signatureLayers.length) {
    const rootSeed =
      seedDigest ?? normalizeHash(createHash('sha256').update(`${params.docId}:genesis`).digest('hex'));
    return {
      docId: params.docId,
      rootHash: rootSeed,
      chainLength: 0,
      layers: [],
      generatedAt,
      seedDigest,
    };
  }

  let rollingHash =
    seedDigest ??
    normalizeHash(createHash('sha256').update(`${params.docId}:signature-seed`).digest('hex'));

  const layers: SignatureLayerExport[] = params.signatureLayers.map((layer, index) => {
    const timestamp = layer.timestamp ?? new Date(Date.now() - (params.signatureLayers.length - index) * 1000).toISOString();
    const payload = `${params.docId}:${layer.signerId}:${layer.signature}:${timestamp}:${JSON.stringify(layer.metadata ?? {})}:${rollingHash}`;
    const layerHash = normalizeHash(createHash('sha256').update(payload).digest('hex'));
    const exportRow: SignatureLayerExport = {
      ...layer,
      timestamp,
      sequence: index + 1,
      previousLayerHash: rollingHash,
      layerHash,
    };
    rollingHash = layerHash;
    return exportRow;
  });

  return {
    docId: params.docId,
    rootHash: layers.at(-1)?.layerHash ?? rollingHash,
    chainLength: layers.length,
    layers,
    generatedAt,
    seedDigest,
  };
}

function normalizeHash(value: string): string {
  if (!value) {
    return '';
  }
  const trimmed = value.trim().toLowerCase().replace(/^0x/, '');
  if (!trimmed) {
    return '';
  }
  return `0x${trimmed}`;
}

function computeChainDigest(sequence: string[]): string {
  if (!sequence.length) {
    return '';
  }
  let digest = '0x00';
  for (const hash of sequence) {
    const canonical = `${digest}:${normalizeHash(hash)}`;
    digest = normalizeHash(createHash('sha256').update(canonical).digest('hex'));
  }
  return digest;
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  });
  return Array.from(duplicates);
}

function getDocumentHashChainDelegate(client: PrismaClient) {
  const delegate = (client as PrismaClient & { documentHashChain?: any }).documentHashChain;
  if (!delegate) {
    throw new Error('DocumentHashChain delegate is not available on the Prisma client');
  }
  return delegate as {
    findUnique: (args: any) => Promise<DocumentHashChainRecord | null>;
    create: (args: any) => Promise<DocumentHashChainRecord>;
    update: (args: any) => Promise<DocumentHashChainRecord>;
  };
}

