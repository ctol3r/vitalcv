/**
 * B235A-API-002: PublicAPIAuthMiddleware
 *
 * Authenticates public API requests via API keys or OAuth tokens.
 * Enforces scopes per endpoint and denies unauthorized access.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKeyInfo;
  oauthToken?: OAuthTokenInfo;
  scopes?: string[];
}

export interface ApiKeyInfo {
  id: string;
  key: string;
  scopes: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  isActive: boolean;
}

export interface OAuthTokenInfo {
  token: string;
  scopes: string[];
  expiresAt: Date;
  clientId: string;
}

/**
 * API Key model (should be stored in database)
 * For now, we'll use a simple in-memory store, but in production this should be in DB
 */
interface ApiKeyRecord {
  id: string;
  keyHash: string; // Hashed API key
  scopes: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

/**
 * Scope definitions for public API
 */
export const API_SCOPES = {
  READ_CREDENTIALS: 'read:credentials',
  READ_ORGANIZATIONS: 'read:organizations',
  READ_MODULES: 'read:modules',
  READ_CONTRACTS: 'read:contracts',
  READ_COMMUNITY: 'read:community',
  READ_PROVIDERS: 'read:providers',
} as const;

/**
 * Default scopes for API keys
 */
const DEFAULT_SCOPES = [
  API_SCOPES.READ_CREDENTIALS,
  API_SCOPES.READ_ORGANIZATIONS,
  API_SCOPES.READ_MODULES,
  API_SCOPES.READ_CONTRACTS,
  API_SCOPES.READ_COMMUNITY,
  API_SCOPES.READ_PROVIDERS,
];

/**
 * Hash API key for storage (simple implementation, use crypto in production)
 */
function hashApiKey(key: string): string {
  // In production, use proper hashing like bcrypt or SHA-256
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Verify API key hash
 */
function verifyApiKey(key: string, hash: string): boolean {
  return hashApiKey(key) === hash;
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header: "Bearer <api-key>" or "ApiKey <api-key>"
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2) {
      const [scheme, token] = parts;
      if (scheme === 'Bearer' || scheme === 'ApiKey') {
        return token;
      }
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Extract OAuth token from request headers
 */
function extractOAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      // In production, verify if this is an OAuth token vs API key
      // For now, we'll check if it starts with 'oauth_' prefix
      if (parts[1].startsWith('oauth_')) {
        return parts[1];
      }
    }
  }
  return null;
}

/**
 * Load API key from database (placeholder - implement with Prisma)
 */
async function loadApiKey(
  prisma: PrismaClient,
  keyHash: string
): Promise<ApiKeyRecord | null> {
  // TODO: Implement with Prisma model for API keys
  // For now, return null to indicate key not found
  // In production, you'd have a model like:
  // const apiKey = await prisma.apiKey.findUnique({
  //   where: { keyHash },
  //   select: { id, keyHash, scopes, rateLimit, isActive, createdAt, lastUsedAt }
  // });
  return null;
}

/**
 * Verify OAuth token (placeholder - implement with OAuth provider)
 */
async function verifyOAuthToken(
  token: string
): Promise<OAuthTokenInfo | null> {
  // TODO: Implement OAuth token verification
  // This would typically involve:
  // 1. Decode JWT token
  // 2. Verify signature
  // 3. Check expiration
  // 4. Extract scopes
  return null;
}

/**
 * Middleware to authenticate API requests
 */
export function authenticatePublicAPI(prisma: PrismaClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Try API key first
      const apiKey = extractApiKey(req);
      if (apiKey) {
        const keyHash = hashApiKey(apiKey);
        const keyRecord = await loadApiKey(prisma, keyHash);

        if (keyRecord && keyRecord.isActive) {
          // Update last used timestamp
          // await prisma.apiKey.update({
          //   where: { id: keyRecord.id },
          //   data: { lastUsedAt: new Date() }
          // });

          req.apiKey = {
            id: keyRecord.id,
            key: apiKey,
            scopes: keyRecord.scopes,
            rateLimit: keyRecord.rateLimit,
            isActive: keyRecord.isActive,
          };
          req.scopes = keyRecord.scopes;
          return next();
        }
      }

      // Try OAuth token
      const oauthToken = extractOAuthToken(req);
      if (oauthToken) {
        const tokenInfo = await verifyOAuthToken(oauthToken);
        if (tokenInfo && tokenInfo.expiresAt > new Date()) {
          req.oauthToken = tokenInfo;
          req.scopes = tokenInfo.scopes;
          return next();
        }
      }

      // No valid authentication found
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Valid API key or OAuth token required',
      });
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Authentication failed',
      });
    }
  };
}

/**
 * Middleware to require specific scopes
 */
export function requireScopes(...requiredScopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userScopes = req.scopes || [];

    // Check if user has all required scopes
    const hasAllScopes = requiredScopes.every(scope =>
      userScopes.includes(scope)
    );

    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing required scopes: ${requiredScopes.join(', ')}`,
        required: requiredScopes,
        provided: userScopes,
      });
    }

    next();
  };
}

/**
 * Middleware to require at least one of the specified scopes
 */
export function requireAnyScope(...scopes: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userScopes = req.scopes || [];

    const hasAnyScope = scopes.some(scope => userScopes.includes(scope));

    if (!hasAnyScope) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Requires at least one of: ${scopes.join(', ')}`,
        required: scopes,
        provided: userScopes,
      });
    }

    next();
  };
}

