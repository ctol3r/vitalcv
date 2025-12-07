import { createHash } from 'crypto';
import type { StatusListSnapshot } from '../status/statusList';

export interface StatusListProof {
  listId: string;
  index: number;
  bit: boolean;
  leaf: string;
  credentialHash: string;
  branch: string[];
  root: string;
  hashAlgorithm: 'sha256';
}

const ZERO_HASH = createHash('sha256').update(Buffer.alloc(0)).digest('hex');

export function buildStatusListProof(
  snapshot: StatusListSnapshot,
  index: number,
): StatusListProof {
  if (index < 0 || index >= snapshot.length) {
    throw new Error(`index ${index} outside of status list bounds (${snapshot.length})`);
  }

  const bits = decodeBitset(snapshot.encodedList, snapshot.length);
  const treeSize = nextPowerOfTwo(bits.length);
  const leaves = new Array<string>(treeSize);

  for (let i = 0; i < treeSize; i += 1) {
    const bit = bits[i] ?? false;
    const credentialHash =
      snapshot.leafHashes[i] ?? hashFallback(snapshot.listId, i);
    leaves[i] = hashLeaf(i, bit, credentialHash);
  }

  const branch: string[] = [];
  let currentIndex = index;
  let level = leaves;

  while (level.length > 1) {
    const siblingIndex = currentIndex ^ 1;
    const siblingHash = level[siblingIndex] ?? ZERO_HASH;
    branch.push(siblingHash);
    currentIndex = Math.floor(currentIndex / 2);
    level = buildParentLevel(level);
  }

  const root = level[0] ?? ZERO_HASH;
  const credentialHash =
    snapshot.leafHashes[index] ?? hashFallback(snapshot.listId, index);

  return {
    listId: snapshot.listId,
    index,
    bit: bits[index] ?? false,
    leaf: leaves[index],
    credentialHash,
    branch,
    root,
    hashAlgorithm: 'sha256',
  };
}

export function verifyStatusListProof(proof: StatusListProof): boolean {
  const recomputedLeaf = hashLeaf(proof.index, proof.bit, proof.credentialHash);
  if (recomputedLeaf !== proof.leaf) {
    return false;
  }

  let hash = proof.leaf;
  let index = proof.index;

  for (const sibling of proof.branch) {
    if (index % 2 === 0) {
      hash = hashPair(hash, sibling);
    } else {
      hash = hashPair(sibling, hash);
    }
    index = Math.floor(index / 2);
  }

  return hash === proof.root;
}

function decodeBitset(encoded: string, length: number): boolean[] {
  const buffer = Buffer.from(encoded, 'base64url');
  const bits: boolean[] = [];
  for (const byte of buffer) {
    for (let bitIndex = 7; bitIndex >= 0; bitIndex -= 1) {
      bits.push(Boolean((byte >> bitIndex) & 1));
      if (bits.length === length) {
        return bits;
      }
    }
  }
  while (bits.length < length) {
    bits.push(false);
  }
  return bits;
}

function buildParentLevel(children: string[]): string[] {
  const parents: string[] = [];
  for (let i = 0; i < children.length; i += 2) {
    const left = children[i] ?? ZERO_HASH;
    const right = children[i + 1] ?? ZERO_HASH;
    parents.push(hashPair(left, right));
  }
  return parents;
}

function hashLeaf(index: number, bit: boolean, credentialHash: string): string {
  const normalizedHash = credentialHash.replace(/^0x/, '');
  return createHash('sha256')
    .update(`leaf:${index}:${bit ? 1 : 0}:${normalizedHash}`)
    .digest('hex');
}

function hashFallback(listId: string, index: number): string {
  return createHash('sha256').update(`${listId}:${index}`).digest('hex');
}

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(Buffer.from(left + right, 'hex')).digest('hex');
}

function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  return 2 ** Math.ceil(Math.log2(value));
}

