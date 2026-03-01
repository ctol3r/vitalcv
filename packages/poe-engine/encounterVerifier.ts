import { buildMerkleTreeFromLeafHashes } from './merkle';

export interface EncounterRootVerification {
  valid: boolean;
  expectedRoot: string;
  actualRoot: string;
  volumeCount: number;
}

/**
 * Verify that a set of leaf hashes produces the claimed Merkle root.
 * This is the verifier-side operation: given the leaf hashes from the
 * PoE credential, rebuild the tree and check the root matches.
 */
export function verifyEncounterRoot(
  leafHashes: readonly string[],
  claimedRoot: string,
): EncounterRootVerification {
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    return {
      valid: false,
      expectedRoot: claimedRoot,
      actualRoot: '',
      volumeCount: 0,
    };
  }

  try {
    const tree = buildMerkleTreeFromLeafHashes(leafHashes);
    return {
      valid: tree.root === claimedRoot,
      expectedRoot: claimedRoot,
      actualRoot: tree.root,
      volumeCount: leafHashes.length,
    };
  } catch {
    return {
      valid: false,
      expectedRoot: claimedRoot,
      actualRoot: '',
      volumeCount: leafHashes.length,
    };
  }
}
