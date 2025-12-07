/**
 * Rigorous DPoP JOSE Validation & Clock Skew Handling
 *
 * S72-STRETCH-A-003: Rigorous DPoP JOSE validation & clock skew handling
 * Validates alg whitelist; ensures iat within ±N sec; htm/htu match; jti uniqueness enforced
 * Error reasons logged for observability
 */

import { Request, Response, NextFunction } from 'express';
import { calculateJwkThumbprint, decodeJwt, jwtVerify, importJWK, JWK } from 'jose';

/**
 * Configuration for DPoP validation
 */
export interface DPoPConfig {
  /**
   * Allowed algorithms for DPoP proof signatures
   * S72-STRETCH-A-003: Alg whitelist enforced
   */
  allowedAlgorithms: string[];

  /**
   * Clock skew tolerance in seconds
   * S72-STRETCH-A-003: iat must be within ±clockSkewTolerance seconds
   */
  clockSkewTolerance: number;

  /**
   * JTI replay cache TTL in milliseconds
   */
  jtiCacheTtl: number;
}

/**
 * Default DPoP configuration
 */
const DEFAULT_DPOP_CONFIG: DPoPConfig = {
  allowedAlgorithms: ['ES256', 'EdDSA'], // S72-STRETCH-A-003: Alg whitelist
  clockSkewTolerance: 60, // S72-STRETCH-A-003: ±60 seconds clock skew tolerance
  jtiCacheTtl: 60000, // 60 seconds
};

/**
 * JTI replay cache
 * S72-STRETCH-A-003: jti uniqueness enforced
 */
const jtiCache = new Map<string, { timestamp: number }>();

/**
 * Validation error with detailed reason
 * S72-STRETCH-A-003: Error reasons logged for observability
 */
export interface DPoPValidationError {
  code: string;
  message: string;
  reason: string;
  details?: Record<string, any>;
}

/**
 * Check if jti was already used (replay protection)
 * S72-STRETCH-A-003: jti uniqueness enforced
 */
function checkAndStoreJti(jti: string, config: DPoPConfig): { isReplay: boolean; error?: DPoPValidationError } {
  if (!jti) {
    return {
      isReplay: false,
      error: {
        code: 'missing_jti',
        message: 'Missing jti in DPoP proof',
        reason: 'jti is required for replay protection',
      },
    };
  }

  // Check if jti was already used
  if (jtiCache.has(jti)) {
    const cached = jtiCache.get(jti)!;
    const age = Date.now() - cached.timestamp;

    return {
      isReplay: true,
      error: {
        code: 'jti_reused',
        message: `jti reused: ${jti} (replay attack detected)`,
        reason: 'jti must be unique and not reused',
        details: {
          jti,
          first_used_at: new Date(cached.timestamp).toISOString(),
          age_ms: age,
        },
      },
    };
  }

  // Store jti with timestamp
  jtiCache.set(jti, { timestamp: Date.now() });

  // Cleanup old entries
  const now = Date.now();
  for (const [cachedJti, data] of jtiCache.entries()) {
    if (now - data.timestamp > config.jtiCacheTtl) {
      jtiCache.delete(cachedJti);
    }
  }

  return { isReplay: false };
}

/**
 * Validate DPoP proof with rigorous JOSE validation
 * S72-STRETCH-A-003: Validates alg whitelist; ensures iat within ±N sec; htm/htu match; jti uniqueness
 */
export async function validateDPoPProof(
  dpopHeader: string,
  htu: string,
  htm: string,
  config: DPoPConfig = DEFAULT_DPOP_CONFIG
): Promise<{ valid: boolean; thumbprint?: string; error?: DPoPValidationError }> {
  try {
    // Parse JWT structure
    const parts = dpopHeader.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: {
          code: 'invalid_format',
          message: 'Invalid DPoP proof format',
          reason: 'DPoP proof must be a valid JWT with 3 parts (header.payload.signature)',
        },
      };
    }

    // Decode header
    let header: any;
    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    } catch {
      return {
        valid: false,
        error: {
          code: 'invalid_header',
          message: 'Invalid DPoP proof header',
          reason: 'Header must be valid base64url-encoded JSON',
        },
      };
    }

    // S72-STRETCH-A-003: Validate alg whitelist
    const alg = header.alg;
    if (!alg) {
      return {
        valid: false,
        error: {
          code: 'missing_alg',
          message: 'Missing alg in DPoP proof header',
          reason: 'alg is required in JOSE header',
        },
      };
    }

    if (!config.allowedAlgorithms.includes(alg)) {
      return {
        valid: false,
        error: {
          code: 'invalid_alg',
          message: `Algorithm '${alg}' not allowed`,
          reason: `Only algorithms ${config.allowedAlgorithms.join(', ')} are allowed`,
          details: {
            provided: alg,
            allowed: config.allowedAlgorithms,
          },
        },
      };
    }

    // Validate typ
    const typ = header.typ;
    if (typ !== 'dpop+jwt') {
      return {
        valid: false,
        error: {
          code: 'invalid_typ',
          message: `Invalid typ: expected 'dpop+jwt', got '${typ || 'missing'}'`,
          reason: 'DPoP proof must have typ=dpop+jwt in header',
          details: {
            provided: typ,
            expected: 'dpop+jwt',
          },
        },
      };
    }

    // Extract JWK
    const jwk: JWK = header.jwk;
    if (!jwk) {
      return {
        valid: false,
        error: {
          code: 'missing_jwk',
          message: 'Missing JWK in DPoP proof header',
          reason: 'JWK is required for DPoP proof signature verification',
        },
      };
    }

    // Import JWK and verify signature
    let payload: any;
    try {
      const publicKey = await importJWK(jwk, alg);
      const verified = await jwtVerify(dpopHeader, publicKey, {
        algorithms: config.allowedAlgorithms,
      });
      payload = verified.payload;
    } catch (verifyError) {
      return {
        valid: false,
        error: {
          code: 'signature_verification_failed',
          message: 'DPoP proof signature verification failed',
          reason: verifyError instanceof Error ? verifyError.message : 'Unknown signature error',
          details: {
            algorithm: alg,
          },
        },
      };
    }

    // S72-STRETCH-A-003: Validate htu match (case-sensitive exact match per RFC 9449)
    if (payload.htu !== htu) {
      return {
        valid: false,
        error: {
          code: 'htu_mismatch',
          message: `htu mismatch: expected ${htu}, got ${payload.htu}`,
          reason: 'htu must exactly match the HTTP request URI',
          details: {
            expected: htu,
            provided: payload.htu,
          },
        },
      };
    }

    // S72-STRETCH-A-003: Validate htm match (case-insensitive per RFC 9449)
    if (payload.htm?.toUpperCase() !== htm.toUpperCase()) {
      return {
        valid: false,
        error: {
          code: 'htm_mismatch',
          message: `htm mismatch: expected ${htm.toUpperCase()}, got ${payload.htm}`,
          reason: 'htm must match the HTTP request method (case-insensitive)',
          details: {
            expected: htm.toUpperCase(),
            provided: payload.htm,
          },
        },
      };
    }

    // S72-STRETCH-A-003: Validate iat within ±clockSkewTolerance seconds
    const now = Math.floor(Date.now() / 1000);
    if (!payload.iat || typeof payload.iat !== 'number') {
      return {
        valid: false,
        error: {
          code: 'missing_iat',
          message: 'Missing iat in DPoP proof',
          reason: 'iat (issued at) is required for clock skew validation',
        },
      };
    }

    const iatSkew = Math.abs(payload.iat - now);
    if (iatSkew > config.clockSkewTolerance) {
      return {
        valid: false,
        error: {
          code: 'iat_out_of_range',
          message: `iat too old or too far in future: ${iatSkew}s skew (max: ±${config.clockSkewTolerance}s)`,
          reason: 'iat must be within clock skew tolerance',
          details: {
            iat: payload.iat,
            now,
            skew_seconds: iatSkew,
            max_skew_seconds: config.clockSkewTolerance,
          },
        },
      };
    }

    // S72-STRETCH-A-003: Validate jti uniqueness
    const jtiValidation = checkAndStoreJti(payload.jti, config);
    if (jtiValidation.isReplay || jtiValidation.error) {
      return {
        valid: false,
        error: jtiValidation.error!,
      };
    }

    // Compute JWK thumbprint (cnf.jkt)
    const thumbprint = await calculateJwkThumbprint(jwk);

    return { valid: true, thumbprint };
  } catch (error) {
    return {
      valid: false,
      error: {
        code: 'validation_error',
        message: 'DPoP proof validation error',
        reason: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * DPoP Guard Middleware with rigorous validation
 * S72-STRETCH-A-003: Error reasons logged for observability
 */
export function dpopGuard(config: DPoPConfig = DEFAULT_DPOP_CONFIG) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const dpopHeader = req.headers['dpop'] as string;

    if (!dpopHeader) {
      const error = {
        code: 'missing_dpop',
        message: 'DPoP proof is required',
        reason: 'DPoP header is missing from request',
      };

      // S72-STRETCH-A-003: Log error reason for observability
      console.warn('[DPoP] Validation failed:', error);

      return res.status(401).json({
        error: 'use_dpop',
        error_description: error.message,
        error_reason: error.reason,
      });
    }

    const htu = `${req.protocol}://${req.get('host')}${req.path}`;
    const htm = req.method;

    const result = await validateDPoPProof(dpopHeader, htu, htm, config);

    if (!result.valid) {
      // S72-STRETCH-A-003: Log error reason for observability
      console.warn('[DPoP] Validation failed:', result.error);

      const statusCode = result.error?.code === 'invalid_alg' ||
                        result.error?.code === 'invalid_typ' ||
                        result.error?.code === 'invalid_format' ||
                        result.error?.code === 'invalid_header' ||
                        result.error?.code === 'missing_alg' ||
                        result.error?.code === 'missing_jwk' ||
                        result.error?.code === 'missing_iat' ||
                        result.error?.code === 'missing_jti'
        ? 400 // Bad request for malformed proofs
        : 401; // Unauthorized for validation failures

      return res.status(statusCode).json({
        error: result.error?.code || 'invalid_dpop',
        error_description: result.error?.message || 'DPoP proof validation failed',
        error_reason: result.error?.reason,
        ...(result.error?.details && { error_details: result.error.details }),
      });
    }

    // Attach DPoP info to request
    if (result.thumbprint) {
      (req as any).dpop = {
        jkt: result.thumbprint,
        validated: true,
      };
    }

    next();
  };
}

export default dpopGuard;

