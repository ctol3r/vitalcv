import type { ClaimProof } from '../types/selectiveProof';
import type { CanonicalClaim } from '../utils/claimHash';
import { hashClaim } from '../utils/claimHash';
import { buildCanonicalClaimsFromArtifact } from './auditBundleClaims';
import { buildMerkleProofPath } from './merkleTree';
import { validateMerkleIntegrity } from './merkleIntegrity';
import { hashMerkleConcat } from '../utils/merkle';

/**
 * Minimal artifact shape required by the proof engine.
 * Avoids coupling to Prisma types while staying compatible with DB records.
 */
export type ProofArtifact = {
  npi: string;
  status: string;
  rawPayload: unknown;
  checksum: string;
  merkleRoot: string | null;
  claimHashes: unknown;
  verifiedAt: Date;
  expiresAt: Date | null;
};

// ── Claim reconstruction ────────────────────────────────────

/**
 * Reconstruct canonical claims from a stored artifact.
 *
 * This mirrors the canonicalization logic in artifactService but operates
 * on persisted artifact data rather than a live VerificationResult.
 * Claim ordering is deterministic: explicit fields first, then rawPayload
 * entries sorted alphabetically.
 */
export function reconstructCanonicalClaims(artifact: ProofArtifact): CanonicalClaim[] {
  return buildCanonicalClaimsFromArtifact({
    npi: artifact.npi,
    status: artifact.status,
    rawPayload: artifact.rawPayload,
  });
}

// ── Helpers ─────────────────────────────────────────────────

function parseStoredClaimHashes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const hashes: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) return [];
    hashes.push(entry);
  }
  return hashes;
}

// ── Proof generation ────────────────────────────────────────

/**
 * Generate a selective disclosure proof for a single claim within an artifact.
 *
 * The proof allows a verifier to confirm that a specific claim (e.g. "jurisdiction: CA")
 * is part of the credential's Merkle tree without seeing any other claims.
 *
 * Throws if:
 * - Artifact lacks Merkle data
 * - claimType not found in reconstructed claims
 * - Reconstructed tree root doesn't match stored merkleRoot (integrity failure)
 */
export function generateClaimProof(
  artifact: ProofArtifact,
  claimType: string,
): ClaimProof {
  const normalizedType = claimType.trim();
  if (normalizedType.length === 0) {
    throw new Error('claimType is required');
  }

  if (!artifact.merkleRoot || typeof artifact.merkleRoot !== 'string') {
    throw new Error('Artifact has no Merkle root');
  }

  const storedHashes = parseStoredClaimHashes(artifact.claimHashes);
  if (storedHashes.length === 0) {
    throw new Error('Artifact has no claim hashes');
  }

  // Validate stored Merkle integrity before generating proof
  const integrityValid = validateMerkleIntegrity({
    merkleRoot: artifact.merkleRoot,
    claimHashes: artifact.claimHashes,
  });
  if (!integrityValid) {
    throw new Error('Artifact Merkle integrity check failed');
  }

  // Reconstruct claims and find the target
  const claims = reconstructCanonicalClaims(artifact);
  const targetClaim = claims.find((c) => c.type === normalizedType);
  if (!targetClaim) {
    throw new Error(`Claim type "${normalizedType}" not found in artifact`);
  }

  // Generate proof path using the canonical claims
  const proofResult = buildMerkleProofPath(claims, normalizedType);

  // Cross-check: proof root must match stored root
  if (proofResult.root !== artifact.merkleRoot) {
    throw new Error(
      'Reconstructed Merkle root does not match stored root — artifact may have been tampered with',
    );
  }

  // Determine the leaf index in the sorted leaf array.
  // generateMerkleProofPath sorts leaves lexicographically by hash,
  // so we find the position of our leaf in that sorted order.
  const sortedHashes = [...storedHashes].sort((a, b) => a.localeCompare(b));
  const leafIndex = sortedHashes.indexOf(proofResult.leafHash);
  if (leafIndex === -1) {
    throw new Error('Leaf hash not found in stored claim hashes');
  }

  return {
    claimType: normalizedType,
    claimValue: targetClaim.value as string | number | boolean,
    leafHash: proofResult.leafHash,
    leafIndex,
    proofPath: proofResult.proofPath,
    merkleRoot: artifact.merkleRoot,
    fingerprint: artifact.checksum,
  };
}

// ── Proof verification ──────────────────────────────────────

/**
 * Verify a selective disclosure claim proof.
 *
 * This is a standalone, stateless function that a verifier can run
 * with no access to the original artifact. It recomputes the leaf hash
 * from the claim data, walks the proof path using the leafIndex to
 * determine left/right positioning, and compares the resulting root
 * against the declared merkleRoot.
 *
 * Returns true only if the recomputed root matches exactly.
 */
export function verifyClaimProof(proof: ClaimProof): boolean {
  if (proof.leafIndex < 0 || !Number.isInteger(proof.leafIndex)) {
    return false;
  }

  // Recompute leaf hash from claim data
  const recomputedLeaf = hashClaim({
    type: proof.claimType,
    value: proof.claimValue,
  });

  if (recomputedLeaf !== proof.leafHash) {
    return false;
  }

  // Walk the proof path, using leafIndex to determine positioning.
  // At each level: even index means current is left, odd means current is right.
  let currentHash = recomputedLeaf;
  let index = proof.leafIndex;

  for (const sibling of proof.proofPath) {
    if (index % 2 === 0) {
      // Current node is left child, sibling is right
      currentHash = hashMerkleConcat(currentHash, sibling);
    } else {
      // Current node is right child, sibling is left
      currentHash = hashMerkleConcat(sibling, currentHash);
    }
    index = Math.floor(index / 2);
  }

  return currentHash === proof.merkleRoot;
}
