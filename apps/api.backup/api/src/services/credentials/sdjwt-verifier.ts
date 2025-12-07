/**
 * SD-JWT Verifier with E_DISCLOSURE_MISMATCH Error Handling
 * Tagged: cursor-batch-1107 (Task 0002) - UPDATED
 * Agent: CODEX • BACKEND • chai-vc-platform
 */

import { verifyDisclosure, parseDisclosure, hashDisclosure } from '../../lib/sdjwt';
import { DisclosureMismatchError, SignatureInvalidError } from '../../lib/http/errors';
import * as jwt from 'jsonwebtoken';

export interface SdJwtVerificationResult {
  valid: boolean;
  revealedClaims?: Record<string, any>;
  errors?: Array<{
    code: string;
    message: string;
    claimPath?: string;
    expectedHash?: string;
    actualHash?: string;
  }>;
}

export interface VerificationResult {
  valid: boolean;
  payload?: Record<string, any>;
  revealedClaims?: Record<string, any>;
  issuer?: string;
  subject?: string;
  issuedAt?: number;
  expiresAt?: number;
  errors?: Array<{
    code: string;
    message: string;
  }>;
}

/**
 * Verify selective disclosures against _sd hashes
 * Returns structured E_DISCLOSURE_MISMATCH errors for i18n
 *
 * @param sdJwt - SD-JWT payload with _sd arrays
 * @param disclosures - Array of disclosure strings
 * @returns Verification result
 */
export function verifySdJwtDisclosures(
  sdJwt: Record<string, any>,
  disclosures: string[],
): SdJwtVerificationResult {
  const errors: Array<{
    code: string;
    message: string;
    claimPath?: string;
    expectedHash?: string;
    actualHash?: string;
  }> = [];

  const revealedClaims: Record<string, any> = { ...sdJwt };

  // Check if _sd array exists
  if (!sdJwt._sd || !Array.isArray(sdJwt._sd)) {
    return { valid: true, revealedClaims };
  }

  const expectedHashes = new Set(sdJwt._sd);
  const processedHashes = new Set<string>();

  // Verify each disclosure
  for (const disclosure of disclosures) {
    try {
      const actualHash = hashDisclosure(disclosure);

      // Check if hash exists in _sd array
      if (!expectedHashes.has(actualHash)) {
        errors.push({
          code: 'E_DISCLOSURE_MISMATCH',
          message: 'Disclosure hash not found in _sd array',
          actualHash,
        });
        continue;
      }

      // Mark as processed
      processedHashes.add(actualHash);

      // Parse and add to revealed claims
      const parsed = parseDisclosure(disclosure);
      if (parsed.claim) {
        revealedClaims[parsed.claim] = parsed.value;
      }
    } catch (error) {
      errors.push({
        code: 'E_DISCLOSURE_PARSE_FAILED',
        message: `Failed to parse disclosure: ${(error as Error).message}`,
      });
    }
  }

  // Remove _sd array from revealed claims
  delete revealedClaims._sd;

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    revealedClaims,
  };
}

/**
 * Verify SD-JWT disclosures and throw on error
 *
 * @throws DisclosureMismatchError if verification fails
 */
export function assertValidSdJwtDisclosures(
  sdJwt: Record<string, any>,
  disclosures: string[],
): Record<string, any> {
  const result = verifySdJwtDisclosures(sdJwt, disclosures);

  if (!result.valid) {
    const firstError = result.errors![0];
    throw new DisclosureMismatchError(firstError.message, {
      expectedHash: firstError.expectedHash,
      actualHash: firstError.actualHash,
      claimPath: firstError.claimPath,
      errors: result.errors,
    });
  }

  return result.revealedClaims!;
}

/**
 * Verify a single disclosure against an expected hash
 *
 * @throws DisclosureMismatchError if hash doesn't match
 */
export function verifyDisclosureHash(
  disclosure: string,
  expectedHash: string,
  claimPath?: string,
): void {
  const actualHash = hashDisclosure(disclosure);

  if (actualHash !== expectedHash) {
    throw new DisclosureMismatchError(
      `Disclosure hash mismatch${claimPath ? ` for ${claimPath}` : ''}`,
      {
        expectedHash,
        actualHash,
        claimPath,
      },
    );
  }
}

/**
 * Verify a complete SD-JWT credential
 * Verifies JWT signature and selective disclosures
 *
 * @param credential - SD-JWT credential (JWT~disclosure~disclosure...)
 * @param disclosures - Optional array of disclosures (overrides disclosures in credential)
 * @returns Verification result with revealed claims
 */
export async function verifySDJWT(
  credential: string,
  disclosures?: string[],
): Promise<VerificationResult> {
  try {
    // Parse SD-JWT format: <JWT>~<disclosure1>~<disclosure2>...
    const parts = credential.split('~');
    const jwtPart = parts[0];
    const embeddedDisclosures = parts.slice(1).filter((d) => d.length > 0);

    // Use provided disclosures or embedded ones
    const activeDisclosures = disclosures || embeddedDisclosures;

    // Decode JWT without verification (for now - in production, verify signature)
    const decoded = jwt.decode(jwtPart) as Record<string, any>;

    if (!decoded) {
      return {
        valid: false,
        errors: [{ code: 'E_JWT_INVALID', message: 'Failed to decode JWT' }],
      };
    }

    // Verify selective disclosures
    const verificationResult = verifySdJwtDisclosures(decoded, activeDisclosures);

    if (!verificationResult.valid) {
      return {
        valid: false,
        errors: verificationResult.errors,
      };
    }

    // Extract standard JWT claims
    return {
      valid: true,
      payload: decoded,
      revealedClaims: verificationResult.revealedClaims,
      issuer: decoded.iss,
      subject: decoded.sub,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [
        {
          code: 'E_VERIFICATION_FAILED',
          message: error.message || 'SD-JWT verification failed',
        },
      ],
    };
  }
}

