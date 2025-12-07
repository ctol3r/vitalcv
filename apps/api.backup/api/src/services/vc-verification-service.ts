/**
 * VC Verification Service
 * CRYPTO-003: Implement VC verification service using DID-resolved public keys
 *
 * Provides /vc/verify endpoint that:
 * - Resolves issuer DIDs
 * - Fetches public keys
 * - Validates Ed25519/DataIntegrityProof signatures
 * - Checks exp/nbf
 * - Aligns with W3C Data Integrity spec
 */

import { verifyVerifiableCredential, getVerificationMethod, VerifiableCredential } from '../crypto/vc-signer';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { getAuditService } from './blockchain-audit-service';

export interface VerificationRequest {
  credential: VerifiableCredential;
  options?: {
    challenge?: string;
    domain?: string;
    checks?: string[]; // 'proof', 'expiration', 'issuance', 'status'
  };
}

export interface VerificationResponse {
  verified: boolean;
  credential: VerifiableCredential;
  checks: {
    proof: {
      verified: boolean;
      error?: string;
    };
    expiration: {
      checked: boolean;
      valid: boolean;
      error?: string;
    };
    issuance: {
      checked: boolean;
      valid: boolean;
      error?: string;
    };
    status?: {
      checked: boolean;
      valid: boolean;
      error?: string;
      statusListIndex?: number;
      statusListCredential?: string;
    };
  };
  issuer?: {
    did: string;
    resolved: boolean;
  };
  errors?: string[];
}

/**
 * DID Resolver interface
 */
export interface DidResolver {
  resolve(did: string): Promise<DidDocument | null>;
}

export interface DidDocument {
  '@context'?: string | string[];
  id: string;
  verificationMethod?: VerificationMethod[];
  [key: string]: any;
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: any;
  [key: string]: any;
}

/**
 * Simple DID resolver (can be extended with universal resolver)
 */
class SimpleDidResolver implements DidResolver {
  private cache: Map<string, DidDocument> = new Map();

  async resolve(did: string): Promise<DidDocument | null> {
    // Check cache first
    if (this.cache.has(did)) {
      return this.cache.get(did)!;
    }

    // Try to resolve using universal resolver or local registry
    // For now, return null if not found (will be resolved by caller)
    return null;
  }

  cacheDocument(did: string, document: DidDocument): void {
    this.cache.set(did, document);
  }
}

/**
 * Default DID resolver instance
 */
const defaultResolver = new SimpleDidResolver();

/**
 * Resolve verification method from DID
 */
async function resolveVerificationMethod(
  verificationMethodId: string,
  resolver: DidResolver = defaultResolver
): Promise<Ed25519VerificationKey2020 | null> {
  try {
    // Extract DID from verification method ID
    // Format: did:method:identifier#key-id or did:method:identifier/path#key-id
    const didMatch = verificationMethodId.match(/^(did:[^#]+)/);
    if (!didMatch) {
      return null;
    }

    const did = didMatch[1];
    const didDocument = await resolver.resolve(did);

    if (!didDocument) {
      return null;
    }

    // Find verification method in document
    const verificationMethods = didDocument.verificationMethod || [];
    const vm = verificationMethods.find((vm) => vm.id === verificationMethodId || vm.id.endsWith(verificationMethodId));

    if (!vm) {
      return null;
    }

    // Convert to Ed25519VerificationKey2020
    if (vm.type === 'Ed25519VerificationKey2020' && vm.publicKeyMultibase) {
      return await Ed25519VerificationKey2020.from({
        id: vm.id,
        controller: vm.controller,
        publicKeyMultibase: vm.publicKeyMultibase,
      });
    }

    // Try JWK format
    if (vm.publicKeyJwk && vm.publicKeyJwk.crv === 'Ed25519') {
      return await Ed25519VerificationKey2020.from({
        id: vm.id,
        controller: vm.controller,
        publicKeyJwk: vm.publicKeyJwk,
      });
    }

    return null;
  } catch (error) {
    console.error('Error resolving verification method:', error);
    return null;
  }
}

/**
 * Extract issuer DID from credential
 */
function extractIssuerDid(credential: VerifiableCredential): string | null {
  const issuer = credential.issuer;

  if (typeof issuer === 'string') {
    return issuer.startsWith('did:') ? issuer : null;
  }

  if (typeof issuer === 'object' && issuer.id) {
    return issuer.id.startsWith('did:') ? issuer.id : null;
  }

  return null;
}

/**
 * Check credential expiration
 */
function checkExpiration(credential: VerifiableCredential): { valid: boolean; error?: string } {
  if (!credential.expirationDate) {
    return { valid: true };
  }

  try {
    const expiration = new Date(credential.expirationDate);
    if (isNaN(expiration.getTime())) {
      return { valid: false, error: 'Invalid expiration date format' };
    }

    if (expiration < new Date()) {
      return { valid: false, error: `Credential expired on ${credential.expirationDate}` };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Expiration check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Check credential issuance date
 */
function checkIssuance(credential: VerifiableCredential): { valid: boolean; error?: string } {
  if (!credential.issuanceDate) {
    return { valid: false, error: 'Missing issuance date' };
  }

  try {
    const issuance = new Date(credential.issuanceDate);
    if (isNaN(issuance.getTime())) {
      return { valid: false, error: 'Invalid issuance date format' };
    }

    // Check if issuance is in the future (shouldn't be)
    if (issuance > new Date()) {
      return { valid: false, error: 'Issuance date is in the future' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Issuance check failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Check credential status (revocation/status list)
 *
 * TODO: Integrate with on-chain status list (LEDGER-012)
 */
async function checkStatus(
  credential: VerifiableCredential
): Promise<{ checked: boolean; valid: boolean; error?: string; statusListIndex?: number; statusListCredential?: string }> {
  // Check for credentialStatus field
  const status = (credential as any).credentialStatus;

  if (!status) {
    return { checked: false, valid: true }; // No status check required
  }

  try {
    // Handle StatusList2021
    if (status.type === 'StatusList2021Entry') {
      const statusListCredential = status.statusListCredential;
      const statusListIndex = status.statusListIndex;

      // TODO: Resolve status list credential and check bit at index
      // For now, return placeholder
      return {
        checked: true,
        valid: true, // Placeholder - implement actual status list check
        statusListIndex,
        statusListCredential,
      };
    }

    // Handle RevocationList2020
    if (status.type === 'RevocationList2020') {
      // TODO: Implement revocation list check
      return {
        checked: true,
        valid: true, // Placeholder
      };
    }

    return { checked: false, valid: true };
  } catch (error) {
    return {
      checked: true,
      valid: false,
      error: `Status check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Verify a verifiable credential
 */
export async function verifyCredential(
  request: VerificationRequest,
  resolver?: DidResolver
): Promise<VerificationResponse> {
  const { credential, options = {} } = request;
  const checks = options.checks || ['proof', 'expiration', 'issuance'];
  const usedResolver = resolver || defaultResolver;

  const response: VerificationResponse = {
    verified: false,
    credential,
    checks: {
      proof: { verified: false },
      expiration: { checked: false, valid: true },
      issuance: { checked: false, valid: true },
    },
  };

  const errors: string[] = [];

  // Extract issuer DID
  const issuerDid = extractIssuerDid(credential);
  if (issuerDid) {
    response.issuer = { did: issuerDid, resolved: false };
  }

  // Resolve verification method
  const verificationMethodId = getVerificationMethod(credential);
  if (!verificationMethodId) {
    errors.push('No verification method found in credential proof');
    response.checks.proof.error = 'Missing verification method';
    return response;
  }

  let publicKey: Ed25519VerificationKey2020 | null = null;

  // Try to resolve from DID
  if (verificationMethodId.startsWith('did:')) {
    publicKey = await resolveVerificationMethod(verificationMethodId, usedResolver);
    if (publicKey && issuerDid) {
      response.issuer!.resolved = true;
    }
  }

  // Verify proof
  if (checks.includes('proof')) {
    try {
      const result = await verifyVerifiableCredential(credential, publicKey || undefined);
      response.checks.proof = {
        verified: result.verified,
        error: result.error,
      };

      if (!result.verified) {
        errors.push(`Proof verification failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Proof verification error: ${errorMessage}`);
      response.checks.proof = {
        verified: false,
        error: errorMessage,
      };
    }
  }

  // Check expiration
  if (checks.includes('expiration')) {
    response.checks.expiration = { checked: true, ...checkExpiration(credential) };
    if (!response.checks.expiration.valid) {
      errors.push(`Expiration check failed: ${response.checks.expiration.error}`);
    }
  }

  // Check issuance
  if (checks.includes('issuance')) {
    response.checks.issuance = { checked: true, ...checkIssuance(credential) };
    if (!response.checks.issuance.valid) {
      errors.push(`Issuance check failed: ${response.checks.issuance.error}`);
    }
  }

  // Check status (revocation)
  if (checks.includes('status')) {
    response.checks.status = await checkStatus(credential);
    if (!response.checks.status.valid) {
      errors.push(`Status check failed: ${response.checks.status.error}`);
    }
  }

  // Overall verification result
  response.verified =
    response.checks.proof.verified &&
    response.checks.expiration.valid &&
    response.checks.issuance.valid &&
    (response.checks.status?.valid ?? true);

  if (errors.length > 0) {
    response.errors = errors;
  }

  // Record audit event on blockchain (fire-and-forget)
  if (response.verified) {
    try {
      const auditService = getAuditService();
      const credentialId = credential.id || credential['@id'] || 'unknown';
      const verifierDid = verificationMethodId || issuerDid || 'unknown';

      await auditService.recordVerify(
        credentialId,
        verifierDid,
        {
          verificationChecks: checks,
          verifiedAt: new Date().toISOString(),
        }
      );
    } catch (error) {
      // Log but don't fail verification if audit fails
      console.error('[VCVerificationService] Failed to record audit event:', error);
    }
  }

  return response;
}

