import type { CanonicalClaim } from '../utils/claimHash';
import { hashClaim } from '../utils/claimHash';
import {
  buildMerkleProofPath,
  buildMerkleTree,
  buildMerkleTreeFromLeafHashes,
  type MerkleProofPath,
  type MerkleTree,
} from '../utils/merkle';

export { buildMerkleTree };
export { buildMerkleProofPath };
export { buildMerkleTreeFromLeafHashes };
