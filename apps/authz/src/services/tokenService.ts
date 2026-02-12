/**
 * B100B-TBIND-039: Access/Refresh Token Service
 *
 * Implements:
 * - Access tokens with cnf.jkt claim embedded when DPoP is used
 * - Refresh tokens that are sender-constrained (require DPoP/mTLS)
 * - Refresh token rotation (rotate-on-use)
 */

import { SignJWT, jwtVerify, importJWK, generateKeyPair, exportJWK, JWK } from 'jose';
import { randomBytes } from 'crypto';

// Refresh token store (in production, use Redis/database)
interface RefreshTokenRecord {
  tokenId: string;
  clientId?: string;
  userId?: string;
  scope: string[];
  cnfJkt?: string; // JWK thumbprint for sender-constraint
  clientCert?: string; // mTLS certificate fingerprint
  issuedAt: number;
  expiresAt: number;
  rotated: boolean; // True if this token was used and rotated
  rotatedTo?: string; // ID of the new token if rotated
}

type StrictAccessTokenVerificationOptions = {
  audience: string;
  maxClockSkewSeconds: number;
};

const refreshTokenStore = new Map<string, RefreshTokenRecord>();

// Signing key for JWT tokens (in production, use proper key management)
let signingKey: JWK | null = null;

/**
 * Initialize signing key (in production, load from secure storage)
 */
async function initializeSigningKey(): Promise<JWK> {
  if (!signingKey) {
    // Generate a key pair for signing (in production, use a persistent key)
    const { privateKey } = await generateKeyPair('ES256');
    signingKey = await exportJWK(privateKey);
  }
  return signingKey;
}

/**
 * Generate a unique token ID
 */
function generateTokenId(): string {
  return `token_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Issue an access token with cnf.jkt claim
 * B100B-TBIND-039: AT embeds cnf.jkt
 */
export async function issueAccessToken(params: {
  clientId?: string;
  userId?: string;
  scope: string[];
  cnfJkt?: string; // JWK thumbprint from DPoP proof
  expiresIn?: number;
}): Promise<string> {
  const { clientId, userId, scope, cnfJkt, expiresIn = 3600 } = params;

  const key = await initializeSigningKey();
  const privateKey = await importJWK(key, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const payload: any = {
    iss: process.env.TOKEN_ISSUER || 'https://authz.vitalcv.ai',
    sub: userId || clientId || 'anonymous',
    aud: process.env.TOKEN_AUDIENCE || 'https://api.vitalcv.ai',
    exp: now + expiresIn,
    iat: now,
    scope: scope.join(' '),
  };

  // B100B-TBIND-039: Embed cnf.jkt claim when DPoP is used
  if (cnfJkt) {
    payload.cnf = {
      jkt: cnfJkt,
    };
  }

  if (clientId) {
    payload.client_id = clientId;
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);

  return token;
}

/**
 * Issue a refresh token with sender-constraint
 * B100B-TBIND-039: RT sender-constrained & rotates
 */
export async function issueRefreshToken(params: {
  clientId?: string;
  userId?: string;
  scope: string[];
  cnfJkt?: string; // JWK thumbprint for DPoP constraint
  clientCert?: string; // Certificate fingerprint for mTLS constraint
  expiresIn?: number;
}): Promise<{ token: string; tokenId: string }> {
  const { clientId, userId, scope, cnfJkt, clientCert, expiresIn = 604800 } = params; // Default 7 days

  // B100B-TBIND-039: Refresh tokens must be sender-constrained
  if (!cnfJkt && !clientCert) {
    throw new Error('Refresh tokens must be sender-constrained (require DPoP or mTLS)');
  }

  const tokenId = generateTokenId();
  const now = Date.now();

  // Store refresh token record
  const record: RefreshTokenRecord = {
    tokenId,
    clientId,
    userId,
    scope,
    cnfJkt,
    clientCert,
    issuedAt: now,
    expiresAt: now + (expiresIn * 1000),
    rotated: false,
  };

  refreshTokenStore.set(tokenId, record);

  // Generate opaque refresh token (in production, use cryptographically secure random)
  const token = Buffer.from(JSON.stringify({
    id: tokenId,
    type: 'refresh',
    iat: Math.floor(now / 1000),
  })).toString('base64url');

  return { token, tokenId };
}

/**
 * Validate and rotate refresh token
 * B100B-TBIND-039: RT rotates on use
 */
export async function validateAndRotateRefreshToken(
  refreshToken: string,
  cnfJkt?: string,
  clientCert?: string
): Promise<{ accessToken: string; refreshToken: string; scope: string[] }> {
  // Decode refresh token
  let tokenData: any;
  try {
    const decoded = Buffer.from(refreshToken, 'base64url').toString('utf-8');
    tokenData = JSON.parse(decoded);
  } catch {
    throw new Error('invalid_refresh_token');
  }

  if (!tokenData.id || tokenData.type !== 'refresh') {
    throw new Error('invalid_refresh_token');
  }

  const record = refreshTokenStore.get(tokenData.id);

  if (!record) {
    throw new Error('invalid_refresh_token');
  }

  // Check if token was already rotated
  if (record.rotated) {
    throw new Error('refresh_token_already_used');
  }

  // Check expiration
  if (Date.now() > record.expiresAt) {
    refreshTokenStore.delete(tokenData.id);
    throw new Error('refresh_token_expired');
  }

  // B100B-TBIND-039: Validate sender-constraint
  if (record.cnfJkt) {
    // Token requires DPoP
    if (!cnfJkt || cnfJkt !== record.cnfJkt) {
      throw new Error('sender_constraint_mismatch');
    }
  } else if (record.clientCert) {
    // Token requires mTLS
    if (!clientCert || clientCert !== record.clientCert) {
      throw new Error('sender_constraint_mismatch');
    }
  } else {
    // Should not happen, but fail safe
    throw new Error('refresh_token_not_constrained');
  }

  // B100B-TBIND-039: Rotate refresh token (mark old as rotated, issue new)
  record.rotated = true;
  record.rotatedTo = generateTokenId();

  // Issue new access token
  const accessToken = await issueAccessToken({
    clientId: record.clientId,
    userId: record.userId,
    scope: record.scope,
    cnfJkt: record.cnfJkt, // Preserve sender-constraint
    expiresIn: 3600, // 1 hour
  });

  // Issue new refresh token with same constraints
  const newRefreshToken = await issueRefreshToken({
    clientId: record.clientId,
    userId: record.userId,
    scope: record.scope,
    cnfJkt: record.cnfJkt,
    clientCert: record.clientCert,
    expiresIn: 604800, // 7 days
  });

  // Update record to point to new token
  record.rotatedTo = newRefreshToken.tokenId;

  return {
    accessToken,
    refreshToken: newRefreshToken.token,
    scope: record.scope,
  };
}

/**
 * Revoke refresh token
 */
export function revokeRefreshToken(tokenId: string): boolean {
  const record = refreshTokenStore.get(tokenId);
  if (record) {
    refreshTokenStore.delete(tokenId);
    return true;
  }
  return false;
}

/**
 * Clean up expired tokens (should be called periodically)
 */
export function cleanupExpiredTokens(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [tokenId, record] of refreshTokenStore.entries()) {
    if (now > record.expiresAt) {
      refreshTokenStore.delete(tokenId);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Strict token validation for protected endpoints.
 * Enforces ES256, exact aud match, and 60s iat clock skew policy.
 */
export async function verifyAccessTokenStrict(
  token: string,
  options: StrictAccessTokenVerificationOptions,
) {
  const key = await initializeSigningKey();
  const verificationKey = await importJWK(key, 'ES256');
  const expectedIssuer = process.env.TOKEN_ISSUER || 'https://authz.vitalcv.ai';

  const verified = await jwtVerify(token, verificationKey, {
    algorithms: ['ES256'],
    audience: options.audience,
    issuer: expectedIssuer,
  });

  const payload = verified.payload as { aud?: string | string[]; iat?: number };
  if (Array.isArray(payload.aud)) {
    throw new Error('aud must be a single exact audience');
  }

  if (payload.aud !== options.audience) {
    throw new Error('audience mismatch');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!payload.iat) {
    throw new Error('iat missing');
  }

  if (Math.abs(nowSeconds - payload.iat) > options.maxClockSkewSeconds) {
    throw new Error('iat outside allowed clock skew window');
  }

  return payload;
}
