/**
 * OID4VCI Pushed Authorization Request (PAR) Endpoint
 *
 * Implements OAuth 2.0 PAR (RFC 9126) for credential issuance requests.
 * Accepts pushed authorization requests, validates client auth, and returns
 * request_uri + expires_in.
 *
 * References:
 * - https://www.rfc-editor.org/rfc/rfc9126.html
 * - https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';

const router = Router();

// Store for PAR requests (in production, use Redis or similar)
const parStore = new Map<
  string,
  {
    request: Record<string, unknown>;
    expiresAt: number;
    clientId: string;
  }
>();

const PAR_TTL_SECONDS = 60; // PAR requests expire after 60 seconds

/**
 * POST /api/oid4vci/par
 * Accepts a pushed authorization request
 */
router.post('/', async (req: Request, res: Response) => {
  // Validate client authentication (basic auth or client assertion)
  const authHeader = req.header('authorization');
  if (!authHeader) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required',
    });
  }

  // Extract client credentials (simplified - in production, validate properly)
  const clientId = extractClientId(authHeader);
  if (!clientId) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials',
    });
  }

  // Parse request parameters
  const requestParams = req.body;

  // Validate required parameters
  if (!requestParams.response_type || !requestParams.client_id) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing required parameters',
    });
  }

  // Validate credential_type if present
  if (requestParams.credential_type) {
    const { getCredentialType } = await import('../../vc/registry/credentialTypes');
    const typeDef = getCredentialType(requestParams.credential_type);
    if (!typeDef) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: `Unsupported credential type: ${requestParams.credential_type}`,
      });
    }
  }

  // Generate request_uri
  const requestUri = `urn:ietf:params:oauth:request_uri:${randomUUID()}`;
  const expiresAt = Date.now() + PAR_TTL_SECONDS * 1000;

  // Store the request
  parStore.set(requestUri, {
    request: requestParams,
    expiresAt,
    clientId,
  });

  // Clean up expired entries (in production, use TTL-based cleanup)
  cleanupExpiredParRequests();

  // Return response
  res.json({
    request_uri: requestUri,
    expires_in: PAR_TTL_SECONDS,
  });
});

/**
 * GET /api/oid4vci/par/:requestUri
 * Retrieve a stored PAR request (for debugging/admin purposes)
 */
router.get('/:requestUri', (req: Request, res: Response) => {
  const requestUri = `urn:ietf:params:oauth:request_uri:${req.params.requestUri}`;
  const stored = parStore.get(requestUri);

  if (!stored) {
    return res.status(404).json({
      error: 'invalid_request_uri',
      error_description: 'Request URI not found or expired',
    });
  }

  if (stored.expiresAt < Date.now()) {
    parStore.delete(requestUri);
    return res.status(404).json({
      error: 'expired_request_uri',
      error_description: 'Request URI has expired',
    });
  }

  res.json({
    request: stored.request,
    expires_in: Math.floor((stored.expiresAt - Date.now()) / 1000),
  });
});

/**
 * Extract client ID from authorization header
 */
function extractClientId(authHeader: string): string | null {
  // Basic auth: "Basic base64(client_id:client_secret)"
  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
      const [clientId] = decoded.split(':');
      return clientId || null;
    } catch {
      return null;
    }
  }

  // Bearer token (client assertion JWT)
  if (authHeader.startsWith('Bearer ')) {
    // In production, decode and validate JWT, extract client_id from claims
    // For now, return a placeholder
    return 'client_assertion';
  }

  return null;
}

/**
 * Clean up expired PAR requests
 */
function cleanupExpiredParRequests(): void {
  const now = Date.now();
  for (const [uri, stored] of parStore.entries()) {
    if (stored.expiresAt < now) {
      parStore.delete(uri);
    }
  }
}

/**
 * Get stored PAR request (used by token endpoint)
 */
export function getParRequest(requestUri: string): {
  request: Record<string, unknown>;
  clientId: string;
} | null {
  const stored = parStore.get(requestUri);
  if (!stored || stored.expiresAt < Date.now()) {
    return null;
  }
  return {
    request: stored.request,
    clientId: stored.clientId,
  };
}

export default router;
