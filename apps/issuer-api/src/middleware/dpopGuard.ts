import { Request, Response, NextFunction } from 'express';
import { calculateJwkThumbprint, decodeJwt, jwtVerify, importJWK } from 'jose';
import { getTenantMtlsConfig, isDpopRequired, getDpopAlgorithms } from '../../../api/config/security-loader';

/**
 * B119A-SEC-001: DPoP as default; mTLS optional via tenant flag
 * B103A-TBIND-001: Credential endpoint: enforce DPoP sender-constrained tokens
 *
 * This middleware validates that requests include either:
 * - DPoP proof with cnf.jkt (wallet clients) - DEFAULT and REQUIRED
 * - mTLS client certificate (confidential clients) - OPTIONAL per tenant flag
 *
 * Bearer-only tokens are rejected with use_dpop error.
 * DPoP proof validates signature, htm/htu/iat/jti; cnf.jkt in AT matches DPoP proof.
 */

// JTI replay cache (in production, use Redis or database)
// B103A-TBIND-001: Track jti values to prevent reuse (one-shot)
const jtiCache = new Map<string, { timestamp: number }>();
const JTI_CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Check if jti was already used (replay protection)
 * Returns true if jti is reused, false otherwise
 * Also stores the jti after checking to prevent future reuse
 */
function checkAndStoreJti(jti: string): boolean {
  if (!jti) {
    return false; // No jti means we can't check, but it's not a replay
  }

  // Check if jti was already used
  if (jtiCache.has(jti)) {
    return true; // Already used - replay detected
  }

  // Store jti with timestamp to prevent future reuse
  jtiCache.set(jti, { timestamp: Date.now() });

  // Cleanup old entries
  const now = Date.now();
  for (const [cachedJti, data] of jtiCache.entries()) {
    if (now - data.timestamp > JTI_CACHE_TTL_MS) {
      jtiCache.delete(cachedJti);
    }
  }

  return false; // Not reused
}

/**
 * Decode access token and extract cnf.jkt claim
 */
function extractCnfJktFromAccessToken(token: string): string | null {
  try {
    const decoded = decodeJwt(token);
    const cnf = decoded.cnf as { jkt?: string } | undefined;
    return cnf?.jkt || null;
  } catch {
    return null;
  }
}

/**
 * Verify DPoP proof structure, signature, and extract JWK thumbprint
 * B103A-TBIND-001: Validates htm/htu/iat/jti; verifies signature; checks cnf.jkt in AT
 */
async function verifyDPoPProof(
  dpopHeader: string,
  htu: string,
  htm: string,
  accessToken?: string
): Promise<{ valid: boolean; thumbprint?: string; error?: string }> {
  try {
    // First, verify the JWT signature using jose
    let payload: any;
    let jwk: any;

    try {
      // Decode header to extract JWK before verification
      const parts = dpopHeader.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid DPoP proof format' };
      }

      const headerObj = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      jwk = headerObj.jwk;
      const alg = headerObj.alg;
      const typ = headerObj.typ;
      const kid = headerObj.kid;

      if (!jwk) {
        return { valid: false, error: 'Missing JWK in DPoP proof header' };
      }

      if (!alg) {
        return { valid: false, error: 'Missing alg in DPoP proof header' };
      }

      // B119A-SEC-001: Load allowed algorithms from security config
      // B109A-TBIND-002: JOSE allowlist for DPoP proofs (alg ∈ {ES256,EdDSA})
      const ALLOWED_ALGORITHMS = getDpopAlgorithms();
      if (!ALLOWED_ALGORITHMS.includes(alg)) {
        return { valid: false, error: `invalid_alg: algorithm '${alg}' not allowed. Allowed algorithms: ${ALLOWED_ALGORITHMS.join(', ')}` };
      }

      // B109A-TBIND-002: Check typ='dpop+jwt' presence (returns 400 for invalid typ)
      if (typ !== 'dpop+jwt') {
        return { valid: false, error: `invalid_typ: expected 'dpop+jwt', got '${typ || 'missing'}'` };
      }

      // B113A-TBIND-002: Check kid presence (required per JOSE policy)
      if (!kid) {
        return { valid: false, error: 'invalid_kid: Missing kid in DPoP proof header' };
      }

      // Import JWK and verify signature
      const publicKey = await importJWK(jwk, alg);

      // Verify the JWT signature (only allowlisted algorithms)
      const verified = await jwtVerify(dpopHeader, publicKey, {
        algorithms: ALLOWED_ALGORITHMS,
      });

      payload = verified.payload;
    } catch (verifyError) {
      return {
        valid: false,
        error: `DPoP proof signature verification failed: ${verifyError instanceof Error ? verifyError.message : 'unknown'}`
      };
    }

    // Verify htu matches (case-sensitive exact match per RFC 9449)
    if (payload.htu !== htu) {
      return { valid: false, error: `htu mismatch: expected ${htu}, got ${payload.htu}` };
    }

    // Verify htm matches (case-insensitive per RFC 9449)
    if (payload.htm?.toUpperCase() !== htm.toUpperCase()) {
      return { valid: false, error: `htm mismatch: expected ${htm.toUpperCase()}, got ${payload.htm}` };
    }

    // Verify iat is recent (within 60s skew)
    const now = Math.floor(Date.now() / 1000);
    if (!payload.iat || Math.abs(payload.iat - now) > 60) {
      return { valid: false, error: `iat too old or missing: ${payload.iat ? Math.abs(payload.iat - now) + 's ago' : 'missing'} (max skew: 60s)` };
    }

    // B103A-TBIND-001: Validate jti (JWT ID) for replay protection
    if (!payload.jti) {
      return { valid: false, error: 'Missing jti in DPoP proof' };
    }

    // B103A-TBIND-001: Check for jti reuse (one-shot)
    if (checkAndStoreJti(payload.jti)) {
      return { valid: false, error: `jti reused: ${payload.jti} (replay attack detected)` };
    }

    // Compute JWK thumbprint (cnf.jkt)
    const thumbprint = await calculateJwkThumbprint(jwk);

    // B110A-TBIND-001: STRICT enforcement - Verify cnf.jkt in access token matches DPoP proof thumbprint
    // For credential endpoints, this check is mandatory (already validated above)
    if (accessToken) {
      const atCnfJkt = extractCnfJktFromAccessToken(accessToken);
      if (!atCnfJkt) {
        return { valid: false, error: 'Access token missing cnf.jkt claim' };
      }
      if (atCnfJkt !== thumbprint) {
        return {
          valid: false,
          error: `cnf.jkt mismatch: AT has ${atCnfJkt}, DPoP proof has ${thumbprint}`
        };
      }
    } else {
      // B110A-TBIND-001: For credential endpoints, access token with cnf.jkt is mandatory
      // This should not happen if pre-validation above works, but adding as safety check
      const isCredentialEndpoint = htu.includes('/credential') || htu.includes('/deferred');
      if (isCredentialEndpoint) {
        return { valid: false, error: 'Access token with cnf.jkt required for credential endpoints' };
      }
    }

    return { valid: true, thumbprint };
  } catch (error) {
    return { valid: false, error: `DPoP proof validation error: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

/**
 * DPoP/mTLS guard middleware
 * B119A-SEC-001: DPoP is default and required; mTLS optional via tenant flag
 * B106A-TBIND-001: Enforces strict sender-constrained tokens
 * B121A-SEC-001: Issuer endpoint: DPoP enforcement with cnf.jkt claim validation
 * Bearer-only returns use_dpop error; DPoP proof validates signature, htm/htu/iat/jti; cnf.jkt in AT
 *
 * For credential endpoints, access token with cnf.jkt is REQUIRED when DPoP is used.
 * B121A-SEC-001: Reject bearer tokens; require valid DPoP header; validate jti+htu+htm; validate cnf.jkt claim
 */
export function dpopGuard(req: Request, res: Response, next: NextFunction) {
  const dpopHeader = req.headers['dpop'] as string;
  const authHeader = req.headers['authorization'];
  const clientType = req.headers['x-client-type'] as string || 'wallet';
  const tenantId = req.headers['x-tenant-id'] as string | undefined;

  // B119A-SEC-001: Load tenant-specific mTLS configuration
  const mtlsConfig = getTenantMtlsConfig(tenantId);
  const mtlsAllowedForConfidential = mtlsConfig.allowed_for_confidential;
  const mtlsEnabled = mtlsConfig.enabled;

  // Check for client certificate (mTLS)
  const clientCert = (req as any).socket?.getPeerCertificate?.();
  const clientCertHeader = req.headers['x-client-cert'] as string;
  const hasMtls = !!(clientCert || clientCertHeader);

  const isConfidential = clientType === 'confidential';

  // B119A-SEC-001: DPoP is always required as default
  const dpopRequired = isDpopRequired();

  // Extract token
  if (!authHeader || (!authHeader.startsWith('Bearer ') && !authHeader.startsWith('DPoP '))) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid Authorization header'
    });
  }

  // Extract access token from Authorization header
  const accessToken = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader.startsWith('DPoP ')
    ? authHeader.substring(6)
    : null;

  // B121A-SEC-001: STRICT enforcement - Reject bearer-only tokens for issuer endpoints
  // All issuer endpoints require DPoP proof; bearer tokens without DPoP are rejected
  if (!dpopHeader && (!hasMtls || !mtlsEnabled)) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof is required. Bearer-only tokens are rejected. Provide DPoP proof header.',
      error_hint: 'Include DPoP header with valid proof. mTLS is optional and tenant-specific.'
    });
  }

  // Validate DPoP if present
  if (dpopHeader) {
    const htu = `${req.protocol}://${req.get('host')}${req.path}`;
    const htm = req.method;

    // B120A-TBIND-001: STRICT enforcement - For credential endpoints, access token with cnf.jkt is REQUIRED
    // Enforce DPoP sender-constrained AT (cnf.jkt) everywhere - all credential-related endpoints
    const isCredentialEndpoint = req.path.includes('/credential') || req.path.includes('/deferred') || req.path.includes('/batch');
    if (isCredentialEndpoint) {
      if (!accessToken) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Access token required for credential endpoints when using DPoP',
          error_hint: 'Bearer token with cnf.jkt claim must be provided'
        });
      }
      // B120A-TBIND-001: Pre-validate that access token has cnf.jkt before full DPoP verification
      // Returns invalid_dpop error to match test expectations and be consistent with DPoP-related errors
      const atCnfJkt = extractCnfJktFromAccessToken(accessToken);
      if (!atCnfJkt) {
        return res.status(401).json({
          error: 'invalid_dpop',
          error_description: 'Access token missing cnf.jkt claim (required for credential endpoints)',
          error_hint: 'Access token must include cnf.jkt claim matching DPoP proof thumbprint'
        });
      }
    }

    verifyDPoPProof(dpopHeader, htu, htm, accessToken || undefined).then(result => {
      if (!result.valid) {
        // B113A-TBIND-002: Return 400 for invalid_alg, invalid_typ, or invalid_kid; 401 for other errors
        const isInvalidAlgOrTypOrKid = result.error?.includes('invalid_alg') ||
                                       result.error?.includes('invalid_typ') ||
                                       result.error?.includes('invalid_kid');
        const statusCode = isInvalidAlgOrTypOrKid ? 400 : 401;
        const errorCode = result.error?.includes('invalid_alg') ? 'invalid_alg'
          : result.error?.includes('invalid_typ') ? 'invalid_typ'
          : result.error?.includes('invalid_kid') ? 'invalid_kid'
          : 'invalid_dpop';
        return res.status(statusCode).json({
          error: errorCode,
          error_description: result.error || 'DPoP proof validation failed'
        });
      }

      // Attach cnf.jkt to request
      if (result.thumbprint) {
        (req as any).cnfJkt = result.thumbprint;
        (req as any).dpopValidated = true;
      }
      next();
    }).catch((error) => {
      res.status(401).json({
        error: 'dpop_verification_failed',
        error_description: error instanceof Error ? error.message : 'DPoP verification failed'
      });
    });
    return; // Exit early, next() called in promise
  }

  // B119A-SEC-001: Validate mTLS for confidential clients (only if enabled per tenant)
  if (hasMtls && isConfidential && mtlsEnabled && mtlsAllowedForConfidential) {
    // In production, validate certificate chain
    // For now, basic presence check
    (req as any).clientCert = clientCert || clientCertHeader;
    (req as any).mtlsValidated = true;
    next();
    return;
  }

  // B119A-SEC-001: If mTLS is attempted but not enabled for tenant, require DPoP
  if (hasMtls && !mtlsEnabled) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'mTLS is not enabled for this tenant. DPoP proof is required.',
      error_hint: 'Include DPoP header with valid proof'
    });
  }

  // B119A-SEC-001: If confidential client but mTLS not allowed, require DPoP
  if (isConfidential && (!mtlsEnabled || !mtlsAllowedForConfidential)) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof is required. mTLS is not enabled for this tenant.',
      error_hint: 'Include DPoP header with valid proof'
    });
  }

  // B119A-SEC-001: Fallback - DPoP is always required as default
  return res.status(401).json({
    error: 'use_dpop',
    error_description: 'DPoP proof is required (default enforcement)',
    error_hint: 'Include DPoP header with valid proof'
  });
}
