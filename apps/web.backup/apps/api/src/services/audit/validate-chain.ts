import { createHash } from 'crypto';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type MerklePathNode = {
  position: 'left' | 'right';
  hash: string;
};

export interface ChainProofValidationResult {
  valid: boolean;
  computedRoot: string;
  expectedRoot?: string | null;
  leafHash: string;
  mismatchReasons: string[];
  pathLength: number;
}

export async function validateChainProof(eventId: string): Promise<ChainProofValidationResult> {
  const proof = await prisma.blockProof.findUnique({
    where: { eventId },
  });
  if (!proof) {
    return {
      valid: false,
      computedRoot: '',
      expectedRoot: null,
      leafHash: '',
      mismatchReasons: ['No block proof stored for event'],
      pathLength: 0,
    };
  }

  const path = coerceMerklePath(proof.merklePath);
  const leafHash = computeLeafHash(eventId, proof.eventType ?? '');
  const computedRoot = computeRoot(leafHash, path);
  const expectedRoot = normalizeHash(proof.blockHash);

  const valid = expectedRoot === computedRoot && Boolean(computedRoot);
  const mismatchReasons = valid
    ? []
    : [`Computed root ${computedRoot || 'unknown'} does not match stored ${expectedRoot || 'unknown'}`];

  return {
    valid,
    computedRoot,
    expectedRoot,
    leafHash,
    mismatchReasons,
    pathLength: path.length,
  };
}

function coerceMerklePath(raw: unknown): MerklePathNode[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((node) =>
        typeof node === 'string'
          ? { position: 'right', hash: node }
          : {
              position:
                typeof node.position === 'string' && node.position.toLowerCase() === 'left'
                  ? 'left'
                  : 'right',
              hash: typeof node.hash === 'string' ? node.hash : '',
            },
      )
      .filter((node) => Boolean(node.hash))
      .map((node) => ({
        position: node.position,
        hash: normalizeHash(node.hash),
      }));
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.nodes)) {
      return record.nodes
        .map((node) => ({
          position:
            typeof node === 'object' && node && 'position' in node && typeof node.position === 'string'
              ? (node.position.toLowerCase() === 'left' ? 'left' : 'right')
              : 'right',
          hash:
            typeof node === 'object' && node && 'hash' in node && typeof node.hash === 'string'
              ? normalizeHash(node.hash)
              : '',
        }))
        .filter((node) => Boolean(node.hash));
    }
  }

  return [];
}

function computeLeafHash(eventId: string, eventType: string): string {
  return normalizeHash(
    createHash('sha256')
      .update(JSON.stringify({ eventId, eventType }))
      .digest('hex'),
  );
}

function computeRoot(leafHash: string, path: MerklePathNode[]): string {
  if (!leafHash) return '';
  let current = leafHash;
  for (const node of path) {
    if (!node.hash) continue;
    current =
      node.position === 'left'
        ? hashPair(node.hash, current)
        : hashPair(current, node.hash);
  }
  return normalizeHash(current);
}

function hashPair(left: string, right: string): string {
  return normalizeHash(createHash('sha256').update(`${left}${right}`).digest('hex'));
}

function normalizeHash(value: string | null): string {
  if (!value) return '';
  return value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`;
}










