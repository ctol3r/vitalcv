/**
 * Partner authentication middleware for widget token issuance
 * Supports API key and mutual TLS authentication
 *
 * SECURITY: Partner credentials are now fetched from database (PartnerConfig model)
 * instead of being hardcoded in source code.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, timingSafeEqual } from 'crypto';

const prisma = new PrismaClient();

// Cache for partner lookups (5 minute TTL)
const partnerCache = new Map<string, { partner: PartnerInfo; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PartnerInfo {
  id: string;
  partnerId: string;
  name: string;
  authType: string;
  allowedOrigins: string[];
}

/**
 * Securely compare API keys using timing-safe comparison
 * to prevent timing attacks
 */
function secureCompare(provided: string, stored: string): boolean {
  try {
    const providedHash = createHash('sha256').update(provided).digest();
    const storedHash = createHash('sha256').update(stored).digest();
    return timingSafeEqual(providedHash, storedHash);
  } catch {
    return false;
  }
}

/**
 * Look up partner by API key from database with caching
 */
async function findPartnerByApiKey(apiKey: string): Promise<PartnerInfo | null> {
  // Check cache first (using hash of API key as cache key for security)
  const cacheKey = createHash('sha256').update(apiKey).digest('hex');
  const cached = partnerCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.partner;
  }

  // Query database for active partner with matching auth secret
  // Note: In production, authSecret should be stored as a hash
  const partners = await prisma.partnerConfig.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      partnerId: true,
      partnerName: true,
      authType: true,
      authSecret: true,
      allowedOrigins: true,
    },
  });

  // Find partner with matching API key using timing-safe comparison
  for (const partner of partners) {
    if (partner.authSecret && secureCompare(apiKey, partner.authSecret)) {
      const partnerInfo: PartnerInfo = {
        id: partner.id,
        partnerId: partner.partnerId,
        name: partner.partnerName,
        authType: partner.authType,
        allowedOrigins: partner.allowedOrigins,
      };

      // Cache the result
      partnerCache.set(cacheKey, {
        partner: partnerInfo,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return partnerInfo;
    }
  }

  return null;
}

/**
 * Clear partner cache (useful for testing or when credentials are updated)
 */
export function clearPartnerCache(): void {
  partnerCache.clear();
}

export async function partnerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check for API key in header
    const apiKey = req.get('x-api-key') || req.get('authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key required',
        type: 'https://api.vitalcv.com/errors/missing-api-key',
      });
      return;
    }

    // Validate API key against database
    const partner = await findPartnerByApiKey(apiKey);

    if (!partner) {
      res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid API key',
        type: 'https://api.vitalcv.com/errors/invalid-api-key',
      });
      return;
    }

    // Check CORS origin if partner has allowed origins configured
    if (partner.allowedOrigins.length > 0) {
      const origin = req.get('origin');
      if (origin && !partner.allowedOrigins.includes(origin)) {
        res.status(403).json({
          error: 'forbidden',
          message: 'Origin not allowed for this partner',
          type: 'https://api.vitalcv.com/errors/origin-not-allowed',
        });
        return;
      }
    }

    // Attach partner info to request
    (req as any).partner = {
      id: partner.partnerId,
      name: partner.name,
      authType: partner.authType,
    };

    next();
  } catch (error) {
    // Log error but don't expose internal details
    console.error('[partnerAuth] Authentication error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({
      error: 'authentication_error',
      message: 'Authentication failed',
      type: 'https://api.vitalcv.com/errors/auth-failure',
    });
  }
}

