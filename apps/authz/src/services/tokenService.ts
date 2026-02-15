/**
 * B100B-TBIND-039: Access/Refresh Token Service
 *
 * Implements:
 * - Access tokens with cnf.jkt claim embedded when DPoP is used
 * - Refresh tokens that are sender-constrained (require DPoP/mTLS)
 * - Refresh token rotation (rotate-on-use)
 */

import { SignJWT, jwtVerify, importJWK, type JWK } from 'jose';
import { randomBytes, randomUUID } from 'crypto';
import prisma from '../db';

type StrictAccessTokenVerificationOptions = {
  audience: string;
  maxClockSkewSeconds: number;
};

type SignableJwk = JWK;

let cachedSigningKey: SignableJwk | null = null;

function resolveSigningKey(): SignableJwk {
  const raw = process.env.SIGNING_KEY_JWK;
  if (!raw || !raw.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SIGNING_KEY_JWK is required in production');
    }
    throw new Error('SIGNING_KEY_JWK is required');
  }

  try {
    const parsed = JSON.parse(raw) as SignableJwk;
    return parsed;
  } catch {
    throw new Error('SIGNING_KEY_JWK must be valid JSON');
  }
}

async function initializeSigningKey(): Promise<JWK> {
  if (cachedSigningKey) {
    return cachedSigningKey;
  }
  const key = resolveSigningKey();
  cachedSigningKey = key;
  return key;
}

function parseRefreshTokenPayload(raw: string): { id: string; type: string } {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as { id: string; type: string };
  } catch {
    throw new Error('invalid_refresh_token');
  }
}

function generateTokenId(): string {
  return `token_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

/**
 * Issue an access token with cnf.jkt claim
 */
export async function issueAccessToken(params: {
  clientId?: string;
  userId?: string;
  scope: string[];
  cnfJkt?: string;
  expiresIn?: number;
}): Promise<string> {
  const { clientId, userId, scope, cnfJkt, expiresIn = 3600 } = params;
  const key = await initializeSigningKey();
  const privateKey = await importJWK(key, 'ES256');

  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    iss: process.env.TOKEN_ISSUER || 'https://authz.vitalcv.ai',
    sub: userId || clientId || 'anonymous',
    aud: process.env.TOKEN_AUDIENCE || 'https://api.vitalcv.ai',
    exp: now + expiresIn,
    iat: now,
    scope: scope.join(' '),
  };

  if (cnfJkt) {
    payload.cnf = {
      jkt: cnfJkt,
    };
  }

  if (clientId) {
    payload.client_id = clientId;
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(privateKey);
}

/**
 * Issue a refresh token with sender-constraint
 */
export async function issueRefreshToken(params: {
  clientId?: string;
  userId?: string;
  scope: string[];
  cnfJkt?: string;
  clientCert?: string;
  expiresIn?: number;
}): Promise<{ token: string; tokenId: string }> {
  const { clientId, userId, scope, cnfJkt, clientCert, expiresIn = 604800 } = params;

  if (!cnfJkt && !clientCert) {
    throw new Error('Refresh tokens must be sender-constrained (require DPoP or mTLS)');
  }

  const tokenId = randomUUID();
  const now = Date.now();
  const issuedAt = new Date(now);
  const expiresAt = new Date(now + expiresIn * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenId,
      clientId,
      userId,
      scope: scope.join(' '),
      cnfJkt,
      clientCert,
      issuedAt,
      expiresAt,
      rotated: false,
    },
  });

  const token = Buffer.from(
    JSON.stringify({ id: tokenId, type: 'refresh', iat: Math.floor(now / 1000) }),
  ).toString('base64url');

  return { token, tokenId };
}

/**
 * Validate and rotate refresh token
 */
export async function validateAndRotateRefreshToken(
  refreshToken: string,
  cnfJkt?: string,
  clientCert?: string,
): Promise<{ accessToken: string; refreshToken: string; scope: string[] }> {
  const tokenData = parseRefreshTokenPayload(refreshToken);

  if (!tokenData.id || tokenData.type !== 'refresh') {
    throw new Error('invalid_refresh_token');
  }

  const record = await prisma.refreshToken.findUnique({
    where: {
      tokenId: tokenData.id,
    },
  });

  if (!record) {
    throw new Error('invalid_refresh_token');
  }

  if (record.rotated) {
    throw new Error('refresh_token_already_used');
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await prisma.refreshToken.delete({ where: { tokenId: tokenData.id } });
    throw new Error('refresh_token_expired');
  }

  if (record.cnfJkt) {
    if (!cnfJkt || cnfJkt !== record.cnfJkt) {
      throw new Error('sender_constraint_mismatch');
    }
  } else if (record.clientCert) {
    if (!clientCert || clientCert !== record.clientCert) {
      throw new Error('sender_constraint_mismatch');
    }
  } else {
    throw new Error('refresh_token_not_constrained');
  }

  const rotatedTo = generateTokenId();
  await prisma.refreshToken.update({
    where: {
      tokenId: tokenData.id,
    },
    data: {
      rotated: true,
      rotatedTo,
    },
  });

  const accessToken = await issueAccessToken({
    clientId: record.clientId ?? undefined,
    userId: record.userId ?? undefined,
    scope: record.scope.split(' '),
    cnfJkt: record.cnfJkt ?? undefined,
    expiresIn: 3600,
  });

  const nextRefresh = await issueRefreshToken({
    clientId: record.clientId ?? undefined,
    userId: record.userId ?? undefined,
    scope: record.scope.split(' '),
    cnfJkt: record.cnfJkt ?? undefined,
    clientCert: record.clientCert ?? undefined,
    expiresIn: 604800,
  });

  await prisma.refreshToken.update({
    where: {
      tokenId: tokenData.id,
    },
    data: {
      rotatedTo: nextRefresh.tokenId,
    },
  });

  return {
    accessToken,
    refreshToken: nextRefresh.token,
    scope: record.scope.split(' '),
  };
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(tokenId: string): Promise<boolean> {
  const result = await prisma.refreshToken.deleteMany({ where: { tokenId } });
  return result.count > 0;
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const now = new Date();
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lte: now } }, { rotated: true }],
    },
  });
  return result.count;
}

/**
 * Strict token validation for protected endpoints.
 * Enforces ES256, exact aud match, and clock skew policy.
 */
export async function verifyAccessTokenStrict(
  token: string,
  options: StrictAccessTokenVerificationOptions,
) {
  const key = await initializeSigningKey();
  const verificationKey = await importJWK(key, 'ES256');

  const verified = await jwtVerify(token, verificationKey, {
    algorithms: ['ES256'],
    audience: options.audience,
    issuer: process.env.TOKEN_ISSUER || 'https://authz.vitalcv.ai',
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

  return verified.payload;
}
