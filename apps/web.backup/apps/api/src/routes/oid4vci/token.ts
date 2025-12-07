/**
 * OID4VCI Token Endpoint
 *
 * Issues DPoP-bound access tokens for credential issuance.
 * Validates DPoP proofs and stores cnf.jkt in token claims.
 *
 * References:
 * - https://www.rfc-editor.org/rfc/rfc9449.html (DPoP)
 * - https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { SignJWT } from 'jose';
import { verifyDpopProof } from '../../services/security/dpop';
import { getParRequest } from './par';

const router = Router();

const TOKEN_TTL_SECONDS = 3600; // 1 hour
const ISSUER = process.env.OIDC4VCI_ISSUER_BASE || 'https://api.vitalcv.com';

// Token store (in production, use Redis or database)
const tokenStore = new Map<
  string,
  {
    token: string;
    clientId: string;
    jkt?: string; // DPoP key thumbprint
    scope?: string;
    purposeOfUse?: string;
    expiresAt: number;
    credentialType?: string;
  }
>();

/**
 * POST /api/oid4vci/token
 * Issue access token for credential issuance
 */
router.post('/', async (req: Request, res: Response) => {
  const grantType = req.body.grant_type;

  if (grantType === 'urn:ietf:params:oauth:grant-type:pre-authorized_code') {
    // Pre-authorized code flow (simplified)
    return handlePreAuthorizedCode(req, res);
  }

  if (grantType === 'authorization_code') {
    // Authorization code flow
    return handleAuthorizationCode(req, res);
  }

  if (grantType === 'urn:ietf:params:oauth:grant-type:device_code') {
    // Device code flow (for deferred issuance)
    return handleDeviceCode(req, res);
  }

  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: `Grant type not supported: ${grantType}`,
  });
});

/**
 * Handle pre-authorized code flow
 */
async function handlePreAuthorizedCode(req: Request, res: Response) {
  const preAuthorizedCode = req.body['pre-authorized_code'];
  const dpopProof = req.header('dpop') || req.header('DPoP');

  if (!preAuthorizedCode) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'pre-authorized_code is required',
    });
  }

  // Validate pre-authorized code (in production, check database)
  // For now, accept any code

  // Verify DPoP proof if provided
  let jkt: string | undefined;
  if (dpopProof) {
    try {
      const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const dpopResult = await verifyDpopProof({
        proof: dpopProof,
        method: req.method,
        url: requestUrl,
      });
      jkt = dpopResult.jkt;
    } catch (error) {
      return res.status(401).json({
        error: 'invalid_dpop_proof',
        error_description:
          error instanceof Error ? error.message : 'DPoP proof verification failed',
      });
    }
  }

  // Issue access token
  const accessToken = await issueAccessToken({
    clientId: 'pre-authorized',
    jkt,
    scope: req.body.scope,
    purposeOfUse: req.body.purpose_of_use,
    credentialType: req.body.credential_type,
  });

  res.json({
    access_token: accessToken.token,
    token_type: 'DPoP',
    expires_in: TOKEN_TTL_SECONDS,
    c_nonce: randomUUID(),
    c_nonce_expires_in: 300, // 5 minutes
  });
}

/**
 * Handle authorization code flow (with PAR)
 */
async function handleAuthorizationCode(req: Request, res: Response) {
  const code = req.body.code;
  const requestUri = req.body.request_uri;
  const dpopProof = req.header('dpop') || req.header('DPoP');

  // Get PAR request if request_uri is provided
  let parRequest: { request: Record<string, unknown>; clientId: string } | null = null;
  if (requestUri) {
    parRequest = getParRequest(requestUri);
    if (!parRequest) {
      return res.status(400).json({
        error: 'invalid_request_uri',
        error_description: 'Invalid or expired request URI',
      });
    }
  }

  // Validate authorization code (in production, check database)
  if (!code && !parRequest) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'code or request_uri is required',
    });
  }

  // Verify DPoP proof
  let jkt: string | undefined;
  if (dpopProof) {
    try {
      const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const dpopResult = await verifyDpopProof({
        proof: dpopProof,
        method: req.method,
        url: requestUrl,
      });
      jkt = dpopResult.jkt;
    } catch (error) {
      return res.status(401).json({
        error: 'invalid_dpop_proof',
        error_description:
          error instanceof Error ? error.message : 'DPoP proof verification failed',
      });
    }
  }

  // Issue access token
  const clientId = parRequest?.clientId || 'authorization_code_client';
  const credentialType =
    (parRequest?.request.credential_type as string) || req.body.credential_type;
  const scope = (parRequest?.request.scope as string) || req.body.scope;
  const purposeOfUse = (parRequest?.request.purpose_of_use as string) || req.body.purpose_of_use;

  const accessToken = await issueAccessToken({
    clientId,
    jkt,
    scope,
    purposeOfUse,
    credentialType,
  });

  res.json({
    access_token: accessToken.token,
    token_type: 'DPoP',
    expires_in: TOKEN_TTL_SECONDS,
    c_nonce: randomUUID(),
    c_nonce_expires_in: 300,
  });
}

/**
 * Handle device code flow (for deferred issuance)
 */
async function handleDeviceCode(req: Request, res: Response) {
  const deviceCode = req.body.device_code;

  if (!deviceCode) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'device_code is required',
    });
  }

  // Validate device code and check if user has authorized (in production, check database)
  // For now, issue token if code exists

  const accessToken = await issueAccessToken({
    clientId: 'device_code',
    scope: req.body.scope,
    credentialType: req.body.credential_type,
  });

  res.json({
    access_token: accessToken.token,
    token_type: 'Bearer', // Device code flow may not use DPoP
    expires_in: TOKEN_TTL_SECONDS,
  });
}

/**
 * Issue an access token
 */
async function issueAccessToken(params: {
  clientId: string;
  jkt?: string;
  scope?: string;
  purposeOfUse?: string;
  credentialType?: string;
}): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  // Build token claims
  const claims: Record<string, unknown> = {
    iss: ISSUER,
    sub: params.clientId,
    aud: `${ISSUER}/api/oid4vci/credential`,
    jti,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    scope: params.scope || 'credential:issue',
    ...(params.purposeOfUse && { purpose_of_use: params.purposeOfUse }),
    ...(params.credentialType && { credential_type: params.credentialType }),
  };

  // Add DPoP confirmation if jkt is provided
  if (params.jkt) {
    claims.cnf = { jkt: params.jkt };
  }

  // Sign token (in production, use proper signing key from KMS or config)
  // For now, use a placeholder - this should use the KMS signer
  const signingKey = await getSigningKey();
  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'at+jwt' })
    .sign(signingKey);

  // Store token for validation
  tokenStore.set(jti, {
    token,
    clientId: params.clientId,
    jkt: params.jkt,
    scope: params.scope,
    purposeOfUse: params.purposeOfUse,
    credentialType: params.credentialType,
    expiresAt: (now + TOKEN_TTL_SECONDS) * 1000,
  });

  return { token, jti };
}

/**
 * Get signing key (placeholder - should use KMS in production)
 */
async function getSigningKey(): Promise<any> {
  // In production, use JoseKmsSigner or load from config
  // For now, return a placeholder
  const { generateKeyPairSync, exportJWK, importJWK } = await import('crypto');
  const { SignJWT } = await import('jose');

  // This is a development-only fallback
  const { privateKey } = generateKeyPairSync('ed25519');
  return privateKey;
}

/**
 * Validate access token (used by credential endpoint)
 */
export function validateAccessToken(
  token: string,
  options?: { jkt?: string },
): {
  valid: boolean;
  clientId?: string;
  jkt?: string;
  scope?: string;
  purposeOfUse?: string;
  credentialType?: string;
} | null {
  // In production, verify JWT signature and decode
  // For now, check token store
  for (const [jti, stored] of tokenStore.entries()) {
    if (stored.token === token) {
      if (stored.expiresAt < Date.now()) {
        tokenStore.delete(jti);
        return null;
      }

      // Check DPoP key thumbprint if required
      if (options?.jkt && stored.jkt && stored.jkt !== options.jkt) {
        return null;
      }

      return {
        valid: true,
        clientId: stored.clientId,
        jkt: stored.jkt,
        scope: stored.scope,
        purposeOfUse: stored.purposeOfUse,
        credentialType: stored.credentialType,
      };
    }
  }

  return null;
}

export default router;
