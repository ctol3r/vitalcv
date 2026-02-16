/**
 * Wave C: Selective disclosure proof using Merkle inclusion paths.
 * A ClaimProof proves that a single claim is part of a credential's
 * Merkle tree without revealing any other claims.
 *
 * leafIndex encodes the position of the leaf in the sorted leaf array.
 * The verifier uses it to determine left/right placement at each level:
 *   level N: if (index % 2 === 0) → current is left, sibling is right
 *            else → sibling is left, current is right
 *   then index = Math.floor(index / 2) for the next level.
 */
export type ClaimProof = {
  claimType: string;
  claimValue: string | number | boolean;
  leafHash: string;
  leafIndex: number;
  proofPath: string[];
  merkleRoot: string;
  fingerprint: string;
};
