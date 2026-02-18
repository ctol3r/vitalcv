import { sha256Hex } from './deterministic';
import type { CanonicalClaim } from './claimHash';

export interface MerkleTree {
  root: string;
  leaves: string[];
  levels: string[][];
}

export interface MerkleProofPath {
  leafHash: string;
  proofPath: string[];
  root: string;
}

type NormalizedCanonicalClaim = Readonly<{
  type: string;
  value: string;
}>;

function normalizeClaims(claims: readonly CanonicalClaim[]): NormalizedCanonicalClaim[] {
  const normalizedClaims = new Map<string, string>();

  if (!Array.isArray(claims)) {
    throw new Error('claims must be an array');
  }

  for (const claim of claims) {
    if (!claim || typeof claim.type !== 'string' || claim.type.trim().length === 0) {
      throw new Error('invalid canonical claim type');
    }

    const normalizedType = claim.type.trim();
    const normalizedValue = String(claim.value);
    const existingValue = normalizedClaims.get(normalizedType);
    if (existingValue === undefined) {
      normalizedClaims.set(normalizedType, normalizedValue);
      continue;
    }

    if (existingValue !== normalizedValue) {
      throw new Error(`conflicting canonical claim values for type "${normalizedType}"`);
    }

    throw new Error(`duplicate canonical claim "${normalizedType}"`);
  }

  return [...normalizedClaims.entries()].map(([type, value]) => ({ type, value }));
}

export function hashMerkleConcat(left: string, right: string): string {
  return sha256Hex(`${left}${right}`);
}

export function buildMerkleTreeFromLeafHashes(leafHashes: readonly string[]): MerkleTree {
  if (leafHashes.length === 0) {
    throw new Error('cannot build Merkle tree for empty claim set');
  }

  if (new Set(leafHashes).size !== leafHashes.length) {
    throw new Error('duplicate leaves are not allowed');
  }

  const levels: string[][] = [];
  const sortedLeaves = [...leafHashes].sort((a, b) => a.localeCompare(b));
  levels.push(sortedLeaves);

  let currentLevel = sortedLeaves;

  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];

  for (let index = 0; index < currentLevel.length; index += 2) {
    const left = currentLevel[index];
    const right = currentLevel[index + 1] ?? currentLevel[index];
    nextLevel.push(hashMerkleConcat(left, right));
  }

    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0] ?? '',
    leaves: sortedLeaves,
    levels,
  };
}

export function buildMerkleTree(claims: readonly CanonicalClaim[]): MerkleTree {
  const normalizedClaims = normalizeClaims(claims);
  const leafHashes = normalizedClaims.map((claim) => sha256Hex(`${claim.type}:${claim.value}`));
  return buildMerkleTreeFromLeafHashes(leafHashes);
}

export function buildMerkleProofPath(
  claims: readonly CanonicalClaim[],
  targetClaimType: string,
): MerkleProofPath {
  const normalizedClaims = normalizeClaims(claims);
  const normalizedTarget = targetClaimType.trim();

  if (normalizedTarget.length === 0) {
    throw new Error('target claim type is required');
  }

  const leafNodes = normalizedClaims.map((claim) => ({
    ...claim,
    leafHash: sha256Hex(`${claim.type}:${claim.value}`),
  }));
  const sortedLeafNodes = [...leafNodes].sort((a, b) => a.leafHash.localeCompare(b.leafHash));

  const matchingClaims = sortedLeafNodes.filter((claim) => claim.type === normalizedTarget);
  if (matchingClaims.length === 0) {
    throw new Error(`claim type "${normalizedTarget}" not found`);
  }

  if (matchingClaims.length > 1) {
    throw new Error(`duplicate target claim type "${normalizedTarget}"`);
  }

  const merkleTree = buildMerkleTreeFromLeafHashes(sortedLeafNodes.map((node) => node.leafHash));
  const proofPath: string[] = [];
  const targetLeafIndex = sortedLeafNodes.findIndex((claim) => claim.type === normalizedTarget);
  let currentIndex = targetLeafIndex;

  for (let levelIndex = 0; levelIndex < merkleTree.levels.length - 1; levelIndex += 1) {
    const currentLevel = merkleTree.levels[levelIndex];
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex >= currentLevel.length) {
      proofPath.push(currentLevel[currentIndex] ?? currentLevel[currentLevel.length - 1]);
    } else {
      proofPath.push(currentLevel[siblingIndex]);
    }

    currentIndex = Math.floor(currentIndex / 2);
  }

  const targetLeafHash = sortedLeafNodes[targetLeafIndex]?.leafHash;
  if (!targetLeafHash) {
    throw new Error(`claim type "${normalizedTarget}" not found`);
  }

  return {
    leafHash: targetLeafHash,
    proofPath,
    root: merkleTree.root,
  };
}
