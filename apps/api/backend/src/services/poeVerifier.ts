import { importSPKI, jwtVerify } from 'jose';
import type { SignedPoeVerifiableCredential } from './poeCredential';
import { buildMerkleTreeFromLeafHashes } from '../utils/merkle';
import { log } from '../obs/logger';

export interface PoeVerificationResult {
  valid: boolean;
  merkleRootValid: boolean;
  signatureValid: boolean;
  volumeCount: number;
  errors: string[];
}

/**
 * Verify a signed PoE credential:
 * 1. Rebuild the Merkle tree from leaf_hashes and check it matches non_phi_hash_tree
 * 2. Verify the ES256 signature over the credential hash
 */
export async function verifyPoeCredential(
  credential: SignedPoeVerifiableCredential,
  publicKeyPem: string,
): Promise<PoeVerificationResult> {
  const errors: string[] = [];
  let merkleRootValid = false;
  let signatureValid = false;

  const { credentialSubject } = credential;
  const leafHashes = credentialSubject.leaf_hashes;

  // Step 1: Merkle root verification
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    errors.push('leaf_hashes is empty or missing');
  } else {
    try {
      const tree = buildMerkleTreeFromLeafHashes(leafHashes);
      if (tree.root === credentialSubject.non_phi_hash_tree) {
        merkleRootValid = true;
      } else {
        errors.push('Merkle root mismatch: reconstructed root does not match non_phi_hash_tree');
      }
    } catch (err) {
      errors.push(`Merkle tree reconstruction failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  // Step 2: Signature verification
  if (credential.signature) {
    try {
      const publicKey = await importSPKI(publicKeyPem, 'ES256');
      await jwtVerify(credential.signature, publicKey, {
        algorithms: ['ES256'],
        issuer: 'vitalcv',
      });
      signatureValid = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      errors.push(`Signature verification failed: ${message}`);
      log('warn', 'poe_signature_verification_failed', { error: message });
    }
  } else {
    errors.push('No signature present on credential');
  }

  return {
    valid: merkleRootValid && signatureValid,
    merkleRootValid,
    signatureValid,
    volumeCount: credentialSubject.volume_count,
    errors,
  };
}
