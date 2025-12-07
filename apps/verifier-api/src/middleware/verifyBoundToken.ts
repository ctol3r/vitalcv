/**
 * DPoP→Access Token Binding Verification on Verifier Side
 *
 * S72-STRETCH-A-004: DPoP→access token binding verification on verifier side
 * Verifier compares cnf.jkt in AT vs DPoP JWK hash; mismatches cause 401
 * Unit tests for jkt-match + mismatch
 */

import { Request, Response, NextFunction } from 'express';
import { decodeJwt, calculateJwkThumbprint, importJWK, JWK } from 'jose';

/**
 * Extract cnf.jkt from access token
 */
function extractCnfJktFromAccessToken(accessToken: string): string | null {
  try {
    const decoded = decodeJwt(accessToken);
    const cnf = decoded.cnf as { jkt?: string } | undefined;
    return cnf?.jkt || null;
  } catch {
    return null;
  }
}

/**
 * Extract JWK from DPoP proof header
 */
function extractJwkFromDpopProof(dpopHeader: string): { jwk: JWK; alg: string } | null {
  try {
    const parts = dpopHeader.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    if (!header.jwk || !header.alg) {
      return null;
    }

    return {
      jwk: header.jwk,
      alg: header.alg,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate JWK thumbprint from DPoP proof
 */
async function calculateDpopJwkThumbprint(dpopHeader: string): Promise<string | null> {
  try {
    const jwkData = extractJwkFromDpopProof(dpopHeader);
    if (!jwkData) {
      return null;
    }

    const thumbprint = await calculateJwkThumbprint(jwkData.jwk);
    return thumbprint;
  } catch {
    return null;
  }
}

/**
 * Verify DPoP→Access Token Binding
 * S72-STRETCH-A-004: Compares cnf.jkt in AT vs DPoP JWK hash
 */
export async function verifyBoundToken(
  accessToken: string,
  dpopHeader: string
): Promise<{ valid: boolean; error?: string; details?: Record<string, any> }> {
  // Extract cnf.jkt from access token
  const atCnfJkt = extractCnfJktFromAccessToken(accessToken);
  if (!atCnfJkt) {
    return {
      valid: false,
      error: 'Access token missing cnf.jkt claim',
      details: {
        reason: 'Access token must include cnf.jkt claim for DPoP binding',
      },
    };
  }

  // Calculate JWK thumbprint from DPoP proof
  const dpopJkt = await calculateDpopJwkThumbprint(dpopHeader);
  if (!dpopJkt) {
    return {
      valid: false,
      error: 'Failed to extract JWK thumbprint from DPoP proof',
      details: {
        reason: 'DPoP proof must include valid JWK in header',
      },
    };
  }

  // S72-STRETCH-A-004: Compare cnf.jkt in AT vs DPoP JWK hash
  if (atCnfJkt !== dpopJkt) {
    return {
      valid: false,
      error: 'cnf.jkt mismatch: access token and DPoP proof are not bound',
      details: {
        at_cnf_jkt: atCnfJkt,
        dpop_jkt: dpopJkt,
        reason: 'Access token cnf.jkt must match DPoP proof JWK thumbprint',
      },
    };
  }

  return {
    valid: true,
    details: {
      jkt: atCnfJkt,
      bound: true,
    },
  };
}

/**
 * Middleware to verify DPoP→Access Token binding
 * S72-STRETCH-A-004: Mismatches cause 401
 */
export function verifyBoundTokenMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const dpopHeader = req.headers['dpop'] as string;

  // Check if both access token and DPoP proof are present
  if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('DPoP '))) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid Authorization header',
    });
  }

  if (!dpopHeader) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof is required for token binding verification',
    });
  }

  // Extract access token
  const accessToken = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader.startsWith('DPoP ')
    ? authHeader.substring(6)
    : null;

  if (!accessToken) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Failed to extract access token from Authorization header',
    });
  }

  // S72-STRETCH-A-004: Verify binding
  verifyBoundToken(accessToken, dpopHeader).then((result) => {
    if (!result.valid) {
      // S72-STRETCH-A-004: Mismatches cause 401
      return res.status(401).json({
        error: 'invalid_token_binding',
        error_description: result.error || 'DPoP→Access Token binding verification failed',
        ...(result.details && { error_details: result.details }),
      });
    }

    // Attach binding info to request
    (req as any).tokenBinding = {
      verified: true,
      jkt: result.details?.jkt,
    };

    next();
  }).catch((error) => {
    return res.status(401).json({
      error: 'token_binding_verification_failed',
      error_description: error instanceof Error ? error.message : 'Token binding verification failed',
    });
  });
}

export default verifyBoundTokenMiddleware;

