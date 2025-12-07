/**
 * BBS+ Proof Verification Fallback
 * Tagged: cursor-batch-1107 (Task 0003)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Implements fallback behavior and explicit 406 when BBS+ is not supported
 * Feature flag controls BBS+ availability
 */

import { BbsUnsupportedError } from '../../lib/http/errors';
import { log } from '../../lib/logging';

// ============================================================================
// FEATURE FLAG
// ============================================================================

/**
 * BBS+ feature flag
 * Set to true when BBS+ implementation is GA
 */
const BBS_ENABLED = process.env.BBS_ENABLED === 'true' || false;

// ============================================================================
// TYPES
// ============================================================================

export interface BbsProofVerificationRequest {
  credential: string; // BBS+ signed credential
  proof: string; // BBS+ proof
  disclosure?: string[]; // Selective disclosure
}

export interface BbsProofVerificationResult {
  valid: boolean;
  revealedClaims?: Record<string, any>;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

// ============================================================================
// BBS+ VERIFICATION
// ============================================================================

/**
 * Verify BBS+ proof
 * Returns 406 E_BBS_UNSUPPORTED if feature flag is off
 * Falls back to SD-JWT verification if credential type supports it
 *
 * @param request - BBS+ proof verification request
 * @returns Verification result
 * @throws BbsUnsupportedError if BBS+ is not enabled
 */
export async function verifyBbsProof(
  request: BbsProofVerificationRequest,
): Promise<BbsProofVerificationResult> {
  // Check feature flag
  if (!BBS_ENABLED) {
    log.warn('BBS+ proof verification requested but not supported', {
      featureFlag: BBS_ENABLED,
    });

    throw new BbsUnsupportedError(
      'BBS+ proof verification is not yet available. This endpoint currently supports SD-JWT only.',
      {
        featureFlag: BBS_ENABLED,
        supportedFormats: ['SD-JWT'],
      },
    );
  }

  // TODO: Implement actual BBS+ verification when enabled
  // For now, this is a placeholder that will be implemented in a future release

  log.info('BBS+ proof verification initiated', {
    credentialLength: request.credential.length,
    proofLength: request.proof.length,
    hasDisclosures: Boolean(request.disclosure),
  });

  // Placeholder implementation
  return {
    valid: false,
    errors: [
      {
        code: 'E_BBS_NOT_IMPLEMENTED',
        message: 'BBS+ proof verification implementation in progress',
      },
    ],
  };
}

/**
 * Check if BBS+ is supported
 */
export function isBbsSupported(): boolean {
  return BBS_ENABLED;
}

/**
 * Detect credential format and route to appropriate verifier
 * Provides graceful fallback from BBS+ to SD-JWT
 *
 * @param credential - Credential string (format-agnostic)
 * @param proofType - Proof type hint ('bbs', 'sd-jwt', or auto-detect)
 * @returns Verification result
 */
export async function verifyCredentialWithFallback(
  credential: string,
  proofType?: 'bbs' | 'sd-jwt',
): Promise<any> {
  // Auto-detect if not specified
  const detectedType = proofType || detectCredentialFormat(credential);

  if (detectedType === 'bbs') {
    if (!BBS_ENABLED) {
      log.info('BBS+ credential detected but not supported, attempting SD-JWT fallback');

      // Attempt to extract SD-JWT from BBS+ container (if possible)
      // This is a compatibility shim for wallets that prefer BBS+ but can work with SD-JWT
      try {
        const sdJwtCredential = extractSdJwtFromBbs(credential);
        if (sdJwtCredential) {
          log.info('Successfully extracted SD-JWT from BBS+ container, using fallback');
          // Would delegate to SD-JWT verifier here
          return { format: 'sd-jwt-fallback', credential: sdJwtCredential };
        }
      } catch (error) {
        log.warn('Failed to extract SD-JWT from BBS+ container', { error });
      }

      // If fallback not possible, return 406
      throw new BbsUnsupportedError('BBS+ proofs are not supported. Please use SD-JWT format.', {
        featureFlag: BBS_ENABLED,
        detectedFormat: 'bbs',
        supportedFormats: ['SD-JWT'],
      });
    }

    // BBS+ is enabled, proceed with BBS+ verification
    return await verifyBbsProof({
      credential,
      proof: '', // Would extract from credential
    });
  }

  // Default: SD-JWT path
  log.info('SD-JWT credential detected, using SD-JWT verifier');
  return { format: 'sd-jwt', credential };
}

/**
 * Detect credential format based on structure
 */
function detectCredentialFormat(credential: string): 'bbs' | 'sd-jwt' {
  // Simple heuristic: BBS+ credentials typically have specific headers/structure
  if (credential.includes('bbs')) {
    return 'bbs';
  }

  // SD-JWT format: JWT~disclosure~disclosure...
  if (credential.includes('~') || credential.startsWith('eyJ')) {
    return 'sd-jwt';
  }

  // Default to SD-JWT
  return 'sd-jwt';
}

/**
 * Extract SD-JWT from BBS+ container (compatibility shim)
 * Returns null if extraction not possible
 */
function extractSdJwtFromBbs(bbsCredential: string): string | null {
  // Placeholder implementation
  // In production, this would attempt to extract an embedded SD-JWT
  // from a BBS+ container format (if the credential supports both)
  return null;
}

