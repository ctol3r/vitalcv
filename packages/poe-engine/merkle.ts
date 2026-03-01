import { hashMerkleConcat } from './crypto';

export interface MerkleTree {
  root: string;
  leaves: string[];
  levels: string[][];
}

/**
 * Build a Merkle tree from pre-hashed leaf values.
 *
 * Algorithm matches apps/api/backend/src/utils/merkle.ts:buildMerkleTreeFromLeafHashes exactly:
 * - Leaves are sorted lexicographically for determinism
 * - Odd-count levels duplicate the last node
 * - Internal nodes are sha256(left + right)
 */
export function buildMerkleTreeFromLeafHashes(leafHashes: readonly string[]): MerkleTree {
  if (leafHashes.length === 0) {
    throw new Error('cannot build Merkle tree for empty encounter set');
  }

  if (new Set(leafHashes).size !== leafHashes.length) {
    throw new Error('duplicate encounter hashes are not allowed');
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
