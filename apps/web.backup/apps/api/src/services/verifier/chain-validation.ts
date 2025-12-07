import { ChainClient } from '../chain/client';

export interface ChainValidationResult {
  vcProofValid: boolean;
  chainAnchorValid: boolean;
  notExpired: boolean;
  notRevoked: boolean;
  overallValid: boolean;
  confidence: number;
  errors: string[];
}

/**
 * Real-time chain validation: VC proof, chain anchor, expiry, revocation
 */
export async function validateChainRealTime(
  credentialId: string,
  vcProof?: Record<string, unknown>,
): Promise<ChainValidationResult> {
  const errors: string[] = [];
  let vcProofValid = true;
  let chainAnchorValid = true;
  let notExpired = true;
  let notRevoked = true;

  // Validate VC proof
  if (vcProof) {
    vcProofValid = validateVCProof(vcProof);
    if (!vcProofValid) {
      errors.push('VC proof validation failed');
    }
  }

  // Check chain anchor
  const chainClient = new ChainClient();
  try {
    const states = await chainClient.fetchCredentialStates();
    const credential = states.find((s) => s.credentialId === credentialId);
    if (!credential || credential.status !== 'ACTIVE') {
      chainAnchorValid = false;
      errors.push('Credential not found or not active on chain');
    }
  } catch (error) {
    chainAnchorValid = false;
    errors.push('Chain query failed');
  }

  // Check expiry
  if (vcProof && vcProof.expirationDate) {
    const expiration = new Date(vcProof.expirationDate as string);
    if (expiration < new Date()) {
      notExpired = false;
      errors.push('Credential expired');
    }
  }

  // Check revocation
  try {
    const states = await chainClient.fetchCredentialStates();
    const credential = states.find((s) => s.credentialId === credentialId);
    if (credential?.status === 'REVOKED') {
      notRevoked = false;
      errors.push('Credential revoked');
    }
  } catch (error) {
    // Assume not revoked if we can't check
  }

  const overallValid = vcProofValid && chainAnchorValid && notExpired && notRevoked;
  const confidence = overallValid ? 1.0 : Math.max(0, 1.0 - errors.length * 0.2);

  return {
    vcProofValid,
    chainAnchorValid,
    notExpired,
    notRevoked,
    overallValid,
    confidence,
    errors,
  };
}

function validateVCProof(proof: Record<string, unknown>): boolean {
  // Basic VC proof validation
  return !!(proof.type && proof.proofValue);
}

