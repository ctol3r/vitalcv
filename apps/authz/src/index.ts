import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { jwtVerify, importJWK, calculateJwkThumbprint, decodeJwt, compactVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { issueAccessToken, issueRefreshToken, validateAndRotateRefreshToken } from './services/tokenService';

const app = express();
app.use(cors());
app.use(express.json());

/**
 * B99A-TBIND-001: DPoP default; mTLS enterprise-optional (issuer/verifier)
 *
 * Configuration:
 * - MTLS_REQUIRED: Set to 'true' to require mTLS for all confidential clients (default: false)
 * - MTLS_ALLOWED_FOR_CONFIDENTIAL: Set to 'true' to allow mTLS for confidential backends (default: true)
 * - DPoP_REQUIRED: Set to 'false' to disable DPoP requirement (default: true, wallets always require DPoP)
 *
 * Behavior:
 * - Wallet clients: Always require DPoP with cnf.jkt in token
 * - Confidential clients: Can use mTLS if MTLS_ALLOWED_FOR_CONFIDENTIAL=true
 * - Enterprise mode: Set MTLS_REQUIRED=true to enforce mTLS for all confidential clients
 */


// Pre-authorized code store (in production, use Redis/database)
interface PreAuthorizedCode {
  code: string;
  scope: string[];
  expiresAt: number;
  clientId?: string;
  requiresPAR?: boolean; // High-risk requests require PAR
}

const preAuthorizedCodes = new Map<string, PreAuthorizedCode>();

// B118A-TBIND-002: JTI replay cache for DPoP proofs (one-shot)
const jtiReplayCache = new Map<string, { timestamp: number }>();
const JTI_REPLAY_TTL_MS = 60000; // 60 seconds

/**
 * Check if jti was already used (replay protection)
 * Returns true if jti is reused, false otherwise
 */
function checkAndStoreJti(jti: string): boolean {
  if (!jti) {
    return false; // No jti means we can't check, but it's not a replay
  }

  // Check if jti was already used
  if (jtiReplayCache.has(jti)) {
    return true; // Already used - replay detected
  }

  // Store jti with timestamp to prevent future reuse
  jtiReplayCache.set(jti, { timestamp: Date.now() });

  // Cleanup old entries
  const now = Date.now();
  for (const [cachedJti, data] of jtiReplayCache.entries()) {
    if (now - data.timestamp > JTI_REPLAY_TTL_MS) {
      jtiReplayCache.delete(cachedJti);
    }
  }

  return false; // Not reused
}

// Pushed Authorization Request (PAR) store
interface PARRequest {
  request_uri: string;
  request: any; // OAuth 2.0 authorization request
  expiresAt: number;
  clientId: string;
}

const parRequests = new Map<string, PARRequest>();

/**
 * Extract JWK thumbprint (cnf.jkt) from token
 */
function extractJwkThumbprint(token: any): string | null {
  return token?.cnf?.jkt || null;
}

/**
 * Verify DPoP proof (RFC 9449)
 * Validates JWS signature, htu/htm matching, and iat freshness
 * B113A-TBIND-002: Returns detailed error messages for JOSE policy violations (alg, typ, kid)
 */
async function verifyDPoP(dpopHeader: string, htu: string, htm: string): Promise<{ valid: boolean; jwk?: any; thumbprint?: string; error?: string }> {
  try {
    const parts = dpopHeader.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid DPoP proof format' };
    }

    // Decode header to extract JWK
    const headerObj = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const jwk = headerObj.jwk;
    const alg = headerObj.alg;
    const typ = headerObj.typ;
    const kid = headerObj.kid;

    if (!jwk) {
      return { valid: false, error: 'Missing JWK in DPoP proof header' };
    }

    // B113A-TBIND-002: JOSE allowlist for DPoP proofs (alg ∈ {ES256,EdDSA})
    const ALLOWED_ALGORITHMS = ['ES256', 'EdDSA'];
    if (!alg || !ALLOWED_ALGORITHMS.includes(alg)) {
      return { valid: false, error: `invalid_alg: algorithm '${alg || 'missing'}' not allowed. Allowed algorithms: ${ALLOWED_ALGORITHMS.join(', ')}` };
    }

    // B113A-TBIND-002: Check typ='dpop+jwt' presence (returns 400 for invalid typ)
    if (typ !== 'dpop+jwt') {
      return { valid: false, error: `invalid_typ: expected 'dpop+jwt', got '${typ || 'missing'}'` };
    }

    // B113A-TBIND-002: Check kid presence (required per JOSE policy)
    if (!kid) {
      return { valid: false, error: 'invalid_kid: Missing kid in DPoP proof header' };
    }

    // B118A-TBIND-002: Verify JWS signature using jose library
    try {
      // Import JWK and verify signature
      const publicKey = await importJWK(jwk, alg);

      // Verify the JWT signature (only allowlisted algorithms)
      const verified = await jwtVerify(dpopHeader, publicKey, {
        algorithms: ALLOWED_ALGORITHMS,
      });

      const payload = verified.payload;

      // Verify htu matches (must match exactly)
      if (payload.htu !== htu) {
        return { valid: false, error: `htu mismatch: expected ${htu}, got ${payload.htu}` };
      }

      // Verify htm matches (must match exactly)
      if (payload.htm?.toUpperCase() !== htm.toUpperCase()) {
        return { valid: false, error: `htm mismatch: expected ${htm.toUpperCase()}, got ${payload.htm}` };
      }

      // B107A-TBIND-002: Verify iat is recent (within 60s skew)
      const now = Math.floor(Date.now() / 1000);
      if (!payload.iat || Math.abs(payload.iat - now) > 60) {
        return { valid: false, error: `iat too old or missing: ${payload.iat ? Math.abs(payload.iat - now) + 's ago' : 'missing'} (max skew: 60s)` };
      }

      // B118A-TBIND-002: Validate jti (JWT ID) for replay protection
      if (!payload.jti) {
        return { valid: false, error: 'Missing jti in DPoP proof' };
      }

      // B118A-TBIND-002: Check for jti reuse (one-shot)
      if (checkAndStoreJti(payload.jti as string)) {
        return { valid: false, error: `jti reused: ${payload.jti} (replay attack detected)` };
      }

      // Compute JWK thumbprint (cnf.jkt)
      const thumbprint = await calculateJwkThumbprint(jwk);

      return { valid: true, jwk, thumbprint };
    } catch (error) {
      return { valid: false, error: `DPoP proof signature verification failed: ${error instanceof Error ? error.message : 'unknown'}` };
    }
  } catch (error) {
    return { valid: false, error: `DPoP proof parsing error: ${error instanceof Error ? error.message : 'unknown'}` };
  }
}

/**
 * DPoP middleware - validates DPoP proof and embeds cnf.jkt in token
 * B99A-TBIND-001: Wallet calls require DPoP with cnf.jkt
 */
export function dpopMiddleware(req: Request, res: Response, next: NextFunction) {
  const dpopHeader = req.headers['dpop'] as string;
  const authHeader = req.headers['authorization'];
  const clientType = req.headers['x-client-type'] as string || 'wallet';

  // Check if DPoP is required (default: true for wallets)
  const dpopRequired = process.env.DPOP_REQUIRED !== 'false';
  const isWallet = clientType === 'wallet' || !clientType;

  if (!authHeader || !authHeader.startsWith('Bearer ') && !authHeader.startsWith('DPoP ')) {
    return res.status(401).json({ error: 'missing_token' });
  }

  // Wallets always require DPoP (B99A-TBIND-001)
  if (isWallet && (!dpopHeader || !dpopRequired)) {
    return res.status(401).json({
      error: 'dpop_required',
      error_description: 'DPoP proof required for wallet clients with cnf.jkt'
    });
  }

  // If DPoP header is present, verify it
  if (dpopHeader) {
    const htu = `${req.protocol}://${req.get('host')}${req.path}`;
    const htm = req.method;

    verifyDPoP(dpopHeader, htu, htm).then(result => {
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

      // Attach cnf.jkt to request for token issuance
      if (result.thumbprint) {
        (req as any).cnfJkt = result.thumbprint;
        (req as any).dpopValidated = true;
      }
      next();
    }).catch(() => {
      res.status(401).json({ error: 'dpop_verification_failed' });
    });
  } else {
    // No DPoP header - allow if not required for this client type
    next();
  }
}

/**
 * mTLS middleware - validates client certificate for confidential clients
 * B99A-TBIND-001: mTLS allowed only for confidential backends; config flag documented
 */
export function mtlsMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientCert = (req as any).socket?.getPeerCertificate?.();
  const clientCertHeader = req.headers['x-client-cert'] as string;
  const clientType = req.headers['x-client-type'] as string || 'wallet';

  // Configuration flags (B99A-TBIND-001)
  const requireMtls = process.env.MTLS_REQUIRED === 'true';
  const mtlsAllowedForConfidential = process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL !== 'false'; // Default: true

  // Only confidential clients can use mTLS
  const isConfidential = clientType === 'confidential';

  if (isConfidential) {
    // Check if mTLS is allowed for confidential clients
    if (!mtlsAllowedForConfidential) {
      // Confidential clients must use DPoP if mTLS is disabled
      return res.status(401).json({
        error: 'mtls_not_allowed',
        error_description: 'mTLS is disabled for confidential clients. Use DPoP instead.'
      });
    }

    // Enterprise mode: require mTLS for all confidential clients
    if (requireMtls) {
      if (!clientCert && !clientCertHeader) {
        return res.status(401).json({
          error: 'mtls_required',
          error_description: 'Client certificate required for confidential clients (enterprise mode)'
        });
      }
    }

    // If certificate is provided, validate and attach
    if (clientCert || clientCertHeader) {
      // In production, validate certificate chain and extract subject
      // For now, basic presence check
      (req as any).clientCert = clientCert || clientCertHeader;
      (req as any).mtlsValidated = true;
    }
  }

  // Wallet clients use DPoP by default (handled by dpopMiddleware)
  next();
}

/**
 * Pushed Authorization Request (PAR) endpoint
 * POST /par
 *
 * Accepts authorization requests and returns request_uri for later use
 * Required for high-risk requests per OIDC4VCI spec
 */
app.post('/par', mtlsMiddleware, async (req: Request, res: Response) => {
  const { request, client_id, scope } = req.body;

  if (!request && !scope) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing request or scope parameter'
    });
  }

  // Determine if this is a high-risk request requiring PAR
  const highRiskScopes = ['credential:issue', 'credential:batch', 'credential:deferred'];
  const scopes = scope?.split(' ') || [];
  const requiresPAR = scopes.some(s => highRiskScopes.includes(s));

  if (requiresPAR && !request) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'PAR required for high-risk scopes'
    });
  }

  // Generate request_uri
  const requestUri = `urn:ietf:params:oauth:request_uri:${randomBytes(16).toString('base64url')}`;

  // Store PAR request
  parRequests.set(requestUri, {
    request_uri: requestUri,
    request: request || { scope, client_id },
    expiresAt: Date.now() + 60000, // 1 minute expiry
    clientId: client_id || 'unknown',
  });

  res.json({
    request_uri: requestUri,
    expires_in: 60,
  });
});

/**
 * Pre-Authorized Code grant endpoint
 * POST /token (with grant_type=urn:ietf:params:oauth:grant-type:pre-authorized_code)
 *
 * Issues tokens using pre-authorized codes
 * Limited to specified scopes
 *
 * B99B-TBIND-042: Access token issuance embeds cnf.jkt when DPoP used
 */
app.post('/token', dpopMiddleware, mtlsMiddleware, async (req: Request, res: Response) => {
  const { grant_type, client_id, pre_authorized_code, request_uri, refresh_token } = req.body;

  // B100B-TBIND-039: Refresh token grant (rotate-on-use)
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing refresh_token',
      });
    }

    const cnfJkt = (req as any).cnfJkt;
    const clientCert = (req as any).clientCert;
    const clientCertFingerprint = clientCert ? createHash('sha256').update(clientCert).digest('hex') : undefined;

    try {
      const result = await validateAndRotateRefreshToken(refresh_token, cnfJkt, clientCertFingerprint);

      return res.json({
        access_token: result.accessToken,
        token_type: cnfJkt ? 'DPoP' : 'Bearer',
        expires_in: 3600,
        refresh_token: result.refreshToken,
        scope: result.scope.join(' '),
      });
    } catch (error: any) {
      const errorMap: Record<string, { status: number; error: string }> = {
        invalid_refresh_token: { status: 400, error: 'invalid_grant' },
        refresh_token_expired: { status: 400, error: 'invalid_grant' },
        refresh_token_already_used: { status: 400, error: 'invalid_grant' },
        sender_constraint_mismatch: { status: 401, error: 'invalid_grant' },
        refresh_token_not_constrained: { status: 400, error: 'invalid_grant' },
      };

      const mapped = errorMap[error.message] || { status: 500, error: 'server_error' };
      return res.status(mapped.status).json({
        error: mapped.error,
        error_description: error.message,
      });
    }
  }

  // Pre-Authorized Code grant
  if (grant_type === 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    if (!pre_authorized_code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing pre_authorized_code'
      });
    }

    const preAuthCode = preAuthorizedCodes.get(pre_authorized_code);

    if (!preAuthCode) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired pre-authorized code'
      });
    }

    if (Date.now() > preAuthCode.expiresAt) {
      preAuthorizedCodes.delete(pre_authorized_code);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Pre-authorized code expired'
      });
    }

    // B107A-OIDC-003: PAR required for high-risk scopes (credential:issue:*)
    const highRiskScopes = preAuthCode.scope.filter((s: string) => s.startsWith('credential:issue:'));
    if (highRiskScopes.length > 0) {
      if (!request_uri) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'PAR (request_uri) required for high-risk scopes. Scopes requiring PAR: ' + highRiskScopes.join(', ')
        });
      }

      // Validate PAR request
      const parRequest = parRequests.get(request_uri);
      if (!parRequest) {
        return res.status(400).json({
          error: 'invalid_request_uri',
          error_description: 'Invalid or expired request_uri'
        });
      }

      if (Date.now() > parRequest.expiresAt) {
        parRequests.delete(request_uri);
        return res.status(400).json({
          error: 'expired_request_uri',
          error_description: 'Request URI expired'
        });
      }

      // Validate PAR scopes match pre-authorized code scopes
      const parScopes = parRequest.request.scope?.split(' ') || [];
      const scopeMatch = highRiskScopes.every((scope: string) => parScopes.includes(scope));
      if (!scopeMatch) {
        return res.status(400).json({
          error: 'invalid_scope',
          error_description: 'PAR request scopes do not match pre-authorized code scopes'
        });
      }

      // Clean up used PAR request
      parRequests.delete(request_uri);
    }

    // Validate client_id if specified
    if (preAuthCode.clientId && preAuthCode.clientId !== client_id) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client ID mismatch'
      });
    }

    // B100B-TBIND-039: Issue access token with cnf.jkt embedded
    const cnfJkt = (req as any).cnfJkt;
    const clientCert = (req as any).clientCert;

    try {
      const accessToken = await issueAccessToken({
        clientId: client_id || preAuthCode.clientId,
        scope: preAuthCode.scope,
        cnfJkt,
        expiresIn: 3600,
      });

      // B100B-TBIND-039: Issue refresh token (sender-constrained)
      const refreshTokenResult = await issueRefreshToken({
        clientId: client_id || preAuthCode.clientId,
        scope: preAuthCode.scope,
        cnfJkt,
        clientCert: clientCert ? createHash('sha256').update(clientCert).digest('hex') : undefined,
        expiresIn: 604800, // 7 days
      });

      // Clean up used code
      preAuthorizedCodes.delete(pre_authorized_code);

      return res.json({
        access_token: accessToken,
        token_type: cnfJkt ? 'DPoP' : 'Bearer',
        expires_in: 3600,
        refresh_token: refreshTokenResult.token,
        scope: preAuthCode.scope.join(' '),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'server_error',
        error_description: error.message || 'Failed to issue tokens',
      });
    }
  }

  // Authorization Code grant with PAR
  if (grant_type === 'authorization_code' && request_uri) {
    const parRequest = parRequests.get(request_uri);

    if (!parRequest) {
      return res.status(400).json({
        error: 'invalid_request_uri',
        error_description: 'Invalid or expired request_uri'
      });
    }

    if (Date.now() > parRequest.expiresAt) {
      parRequests.delete(request_uri);
      return res.status(400).json({
        error: 'expired_request_uri',
        error_description: 'Request URI expired'
      });
    }

    // Validate client_id
    if (parRequest.clientId !== client_id) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client ID mismatch'
      });
    }

    // B100B-TBIND-039: Issue access token with cnf.jkt embedded
    const cnfJkt = (req as any).cnfJkt;
    const clientCert = (req as any).clientCert;

    try {
      const scope = parRequest.request.scope?.split(' ') || ['openid'];
      const accessToken = await issueAccessToken({
        clientId: client_id,
        scope,
        cnfJkt,
        expiresIn: 3600,
      });

      // B100B-TBIND-039: Issue refresh token (sender-constrained)
      const refreshTokenResult = await issueRefreshToken({
        clientId: client_id,
        scope,
        cnfJkt,
        clientCert: clientCert ? createHash('sha256').update(clientCert).digest('hex') : undefined,
        expiresIn: 604800, // 7 days
      });

      // Clean up used PAR request
      parRequests.delete(request_uri);

      return res.json({
        access_token: accessToken,
        token_type: cnfJkt ? 'DPoP' : 'Bearer',
        expires_in: 3600,
        refresh_token: refreshTokenResult.token,
        scope: scope.join(' '),
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'server_error',
        error_description: error.message || 'Failed to issue tokens',
      });
    }
  }

  // Original token endpoint logic (for other grant types)
  // B99A-TBIND-001: Enforce DPoP for wallets, mTLS optional for confidential
  const clientType = req.headers['x-client-type'] as string || 'wallet';
  const cnfJkt = (req as any).cnfJkt;
  const dpopValidated = (req as any).dpopValidated;
  const clientCert = (req as any).clientCert;
  const mtlsValidated = (req as any).mtlsValidated;

  if (clientType === 'wallet') {
    // Wallets require DPoP with cnf.jkt (B99A-TBIND-001)
    if (!dpopValidated || !cnfJkt) {
      return res.status(401).json({
        error: 'dpop_required',
        error_description: 'DPoP proof required for wallet clients with cnf.jkt'
      });
    }

    // B100B-TBIND-039: Issue access token with cnf.jkt embedded
    try {
      const accessToken = await issueAccessToken({
        clientId: client_id,
        scope: ['openid'],
        cnfJkt,
        expiresIn: 3600,
      });

      // Issue refresh token (sender-constrained)
      const refreshTokenResult = await issueRefreshToken({
        clientId: client_id,
        scope: ['openid'],
        cnfJkt,
        expiresIn: 604800,
      });

      return res.json({
        access_token: accessToken,
        token_type: 'DPoP',
        expires_in: 3600,
        refresh_token: refreshTokenResult.token,
        scope: 'openid',
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'server_error',
        error_description: error.message || 'Failed to issue tokens',
      });
    }
  } else if (clientType === 'confidential') {
    // Confidential clients can use mTLS (if allowed) or DPoP
    const requireMtls = process.env.MTLS_REQUIRED === 'true';
    const mtlsAllowed = process.env.MTLS_ALLOWED_FOR_CONFIDENTIAL !== 'false';

    if (requireMtls && !mtlsValidated) {
      return res.status(401).json({
        error: 'mtls_required',
        error_description: 'Client certificate required for confidential clients (enterprise mode)'
      });
    }

    // B100B-TBIND-039: Issue tokens with proper binding
    try {
      const clientCertFingerprint = clientCert ? createHash('sha256').update(clientCert).digest('hex') : undefined;

      if (mtlsValidated && mtlsAllowed) {
        // Confidential client using mTLS
        const accessToken = await issueAccessToken({
          clientId: client_id,
          scope: ['openid'],
          expiresIn: 3600,
        });

        const refreshTokenResult = await issueRefreshToken({
          clientId: client_id,
          scope: ['openid'],
          clientCert: clientCertFingerprint,
          expiresIn: 604800,
        });

        return res.json({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: refreshTokenResult.token,
          scope: 'openid',
        });
      } else if (dpopValidated && cnfJkt) {
        // Confidential client using DPoP
        const accessToken = await issueAccessToken({
          clientId: client_id,
          scope: ['openid'],
          cnfJkt,
          expiresIn: 3600,
        });

        const refreshTokenResult = await issueRefreshToken({
          clientId: client_id,
          scope: ['openid'],
          cnfJkt,
          expiresIn: 604800,
        });

        return res.json({
          access_token: accessToken,
          token_type: 'DPoP',
          expires_in: 3600,
          refresh_token: refreshTokenResult.token,
          scope: 'openid',
        });
      } else {
        return res.status(401).json({
          error: 'token_binding_required',
          error_description: 'Confidential clients must use either mTLS or DPoP',
        });
      }
    } catch (error: any) {
      return res.status(500).json({
        error: 'server_error',
        error_description: error.message || 'Failed to issue tokens',
      });
    }
  } else {
    res.status(400).json({ error: 'invalid_client_type' });
  }
});

/**
 * Generate pre-authorized code
 * POST /pre-authorized-code
 *
 * Generates a pre-authorized code for wallet clients
 * Limited to specified scopes
 */
app.post('/pre-authorized-code', async (req: Request, res: Response) => {
  const { scope, client_id, expires_in = 600 } = req.body;

  if (!scope) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing scope parameter'
    });
  }

  const scopes = Array.isArray(scope) ? scope : scope.split(' ');

  // Limit scopes for pre-authorized codes (security best practice)
  // B107A-OIDC-003: Allow credential:issue:* patterns (high-risk scopes)
  const allowedScopes = ['openid', 'credential:issue'];
  const limitedScopes = scopes.filter(s =>
    allowedScopes.includes(s) || s.startsWith('credential:issue:')
  );

  if (limitedScopes.length === 0) {
    return res.status(400).json({
      error: 'invalid_scope',
      error_description: 'No allowed scopes specified'
    });
  }

  // B107A-OIDC-003: Mark high-risk scopes (credential:issue:*) as requiring PAR
  const highRiskScopes = limitedScopes.filter((s: string) => s.startsWith('credential:issue:'));
  const requiresPAR = highRiskScopes.length > 0 || scopes.some(s => ['credential:batch', 'credential:deferred'].includes(s));

  // Generate pre-authorized code
  const code = randomBytes(16).toString('base64url');

  preAuthorizedCodes.set(code, {
    code,
    scope: limitedScopes,
    expiresAt: Date.now() + (expires_in * 1000),
    clientId: client_id,
    requiresPAR,
  });

  res.json({
    pre_authorized_code: code,
    expires_in,
    scope: limitedScopes.join(' '),
  });
});

/**
 * Credential endpoint guard - blocks bearer-only tokens
 * B99A-TBIND-003: Credential endpoint requires sender-constrained tokens
 */
app.post('/credential', dpopMiddleware, mtlsMiddleware, (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const clientType = req.headers['x-client-type'] as string || 'wallet';

  // Extract token (supports both Bearer and DPoP token types)
  const token = authHeader?.replace(/^(Bearer|DPoP)\s+/, '');

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  // B99A-TBIND-003: Reject bearer-only tokens (must have DPoP or mTLS)
  const dpopValidated = (req as any).dpopValidated;
  const mtlsValidated = (req as any).mtlsValidated;
  const cnfJkt = (req as any).cnfJkt;

  if (!dpopValidated && !mtlsValidated) {
    return res.status(401).json({
      error: 'sender_constraint_required',
      error_description: 'Credential endpoint requires sender-constrained tokens (DPoP or mTLS). Bearer-only tokens are rejected.'
    });
  }

  // If we got here, DPoP or mTLS was validated
  res.json({
    message: 'Credential endpoint accessed with proper token binding',
    binding: cnfJkt ? 'DPoP' : 'mTLS',
    cnf: cnfJkt ? { jkt: cnfJkt } : undefined,
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'authz' });
});

const PORT = process.env.PORT || 4003;

app.listen(PORT);

export default app;

