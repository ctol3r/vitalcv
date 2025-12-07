/**
 * B230C-INTL-015: RegionalSettings API
 *
 * Exposes REST endpoints for front-end apps to get/set language, currency, and region policy settings.
 * Enforces auth and rate limits.
 */

import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per user/org

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit middleware
 */
function rateLimitMiddleware(req: Request, res: Response, next: () => void) {
  const userId = (req as any).userId || req.headers['x-user-id'];
  const orgId = (req as any).orgId || req.headers['x-org-id'];
  const identifier = userId || orgId || req.ip || 'anonymous';

  const now = Date.now();
  const key = `rate_limit:regional_settings:${identifier}`;
  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute`,
      retryAfter: Math.ceil((limit.resetAt - now) / 1000),
    });
  }

  limit.count++;
  rateLimitStore.set(key, limit);
  next();
}

/**
 * Authentication middleware
 * In production, validate JWT token
 */
function authMiddleware(req: Request, res: Response, next: () => void) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.headers['x-auth-token'];
  const userId = req.headers['x-user-id'] as string;
  const orgId = req.headers['x-org-id'] as string;

  if (!token && !userId && !orgId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // In production, validate token and extract user/org ID
  // For now, accept headers
  (req as any).userId = userId;
  (req as any).orgId = orgId;
  (req as any).token = token;
  next();
}

/**
 * Validation schemas
 */
const localePreferencesSchema = z.object({
  language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/).optional(), // e.g., "en-US"
  timezone: z.string().optional(), // IANA timezone
  currency: z.string().length(3).optional(), // ISO 4217 currency code
});

const regionalPolicySchema = z.object({
  countryCode: z.string().length(2), // ISO 3166-1 alpha-2
  regionCode: z.string().optional().nullable(),
  dataRetentionDays: z.number().int().positive().optional(),
  requiresExplicitConsent: z.boolean().optional(),
  requiresCookieConsent: z.boolean().optional(),
  allowedDataJurisdictions: z.array(z.string()).optional(),
  privacyRules: z.record(z.any()).optional().nullable(),
  consentRequirements: z.record(z.any()).optional().nullable(),
});

/**
 * Get user locale preferences
 */
export async function getUserLocalePreferences(
  prisma: PrismaClient,
  userId: string
): Promise<{
  language: string | null;
  timezone: string | null;
  currency: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      language: true,
      timezone: true,
      currency: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    language: user.language || 'en-US',
    timezone: user.timezone || 'UTC',
    currency: user.currency || 'USD',
  };
}

/**
 * Update user locale preferences
 */
export async function updateUserLocalePreferences(
  prisma: PrismaClient,
  userId: string,
  preferences: {
    language?: string;
    timezone?: string;
    currency?: string;
  }
): Promise<{
  language: string | null;
  timezone: string | null;
  currency: string | null;
}> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      language: preferences.language,
      timezone: preferences.timezone,
      currency: preferences.currency,
    },
    select: {
      language: true,
      timezone: true,
      currency: true,
    },
  });

  return user;
}

/**
 * Get regional policy config for organization
 */
export async function getRegionalPolicyConfig(
  prisma: PrismaClient,
  orgId: string | null,
  countryCode?: string,
  regionCode?: string | null
) {
  const where: any = {};
  if (orgId) {
    where.orgId = orgId;
  } else {
    where.orgId = null; // Only default policies
  }
  if (countryCode) {
    where.countryCode = countryCode;
  }
  if (regionCode !== undefined) {
    where.regionCode = regionCode;
  }

  const policies = await prisma.regionalPolicyConfig.findMany({
    where,
    orderBy: [
      { orgId: 'asc' }, // Org-specific overrides first
      { countryCode: 'asc' },
      { regionCode: 'asc' },
    ],
  });

  return policies;
}

/**
 * Create or update regional policy config
 */
export async function upsertRegionalPolicyConfig(
  prisma: PrismaClient,
  orgId: string | null,
  config: {
    countryCode: string;
    regionCode?: string | null;
    dataRetentionDays?: number;
    requiresExplicitConsent?: boolean;
    requiresCookieConsent?: boolean;
    allowedDataJurisdictions?: string[];
    privacyRules?: Record<string, any> | null;
    consentRequirements?: Record<string, any> | null;
  }
) {
  const policy = await prisma.regionalPolicyConfig.upsert({
    where: {
      countryCode_regionCode_orgId: {
        countryCode: config.countryCode,
        regionCode: config.regionCode || null,
        orgId: orgId || null,
      },
    },
    update: {
      dataRetentionDays: config.dataRetentionDays,
      requiresExplicitConsent: config.requiresExplicitConsent,
      requiresCookieConsent: config.requiresCookieConsent,
      allowedDataJurisdictions: config.allowedDataJurisdictions,
      privacyRules: config.privacyRules,
      consentRequirements: config.consentRequirements,
    },
    create: {
      countryCode: config.countryCode,
      regionCode: config.regionCode || null,
      orgId: orgId || null,
      dataRetentionDays: config.dataRetentionDays || 2555,
      requiresExplicitConsent: config.requiresExplicitConsent ?? true,
      requiresCookieConsent: config.requiresCookieConsent ?? true,
      allowedDataJurisdictions: config.allowedDataJurisdictions || [],
      privacyRules: config.privacyRules,
      consentRequirements: config.consentRequirements,
    },
  });

  return policy;
}

/**
 * Delete regional policy config
 */
export async function deleteRegionalPolicyConfig(
  prisma: PrismaClient,
  policyId: string,
  orgId: string | null
) {
  // Only allow deleting org-specific overrides, not defaults
  const policy = await prisma.regionalPolicyConfig.findUnique({
    where: { id: policyId },
  });

  if (!policy) {
    throw new Error('Policy not found');
  }

  if (!policy.orgId) {
    throw new Error('Cannot delete default policies');
  }

  if (policy.orgId !== orgId) {
    throw new Error('Unauthorized: Policy belongs to different organization');
  }

  await prisma.regionalPolicyConfig.delete({
    where: { id: policyId },
  });
}

/**
 * Express route handlers
 */

/**
 * GET /api/regional-settings/user/locale
 * Get user locale preferences
 */
export function getUserLocaleHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const preferences = await getUserLocalePreferences(prisma, userId);
      res.json(preferences);
    } catch (error) {
      console.error('Error getting user locale preferences:', error);
      res.status(500).json({
        error: 'Failed to get locale preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * PUT /api/regional-settings/user/locale
 * Update user locale preferences
 */
export function updateUserLocaleHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId || req.body.userId;
      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      const validated = localePreferencesSchema.parse(req.body);
      const preferences = await updateUserLocalePreferences(prisma, userId, validated);
      res.json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error updating user locale preferences:', error);
      res.status(500).json({
        error: 'Failed to update locale preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * GET /api/regional-settings/org/policy
 * Get regional policy configs for organization
 */
export function getRegionalPolicyHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || (req.query.orgId as string) || null;
      const countryCode = req.query.countryCode as string | undefined;
      const regionCode = req.query.regionCode as string | undefined;

      const policies = await getRegionalPolicyConfig(
        prisma,
        orgId,
        countryCode,
        regionCode || null
      );
      res.json({ policies });
    } catch (error) {
      console.error('Error getting regional policy config:', error);
      res.status(500).json({
        error: 'Failed to get regional policy config',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * POST /api/regional-settings/org/policy
 * Create regional policy config
 */
export function createRegionalPolicyHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId || (req.body.orgId as string) || null;
      const validated = regionalPolicySchema.parse(req.body);

      const policy = await upsertRegionalPolicyConfig(prisma, orgId, validated);
      res.status(201).json({ policy });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error creating regional policy config:', error);
      res.status(500).json({
        error: 'Failed to create regional policy config',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * PUT /api/regional-settings/org/policy/:id
 * Update regional policy config
 */
export function updateRegionalPolicyHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const policyId = req.params.id;
      const orgId = (req as any).orgId || (req.body.orgId as string) || null;
      const validated = regionalPolicySchema.parse(req.body);

      // Get existing policy to preserve countryCode and regionCode
      const existing = await prisma.regionalPolicyConfig.findUnique({
        where: { id: policyId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Policy not found' });
      }

      const policy = await upsertRegionalPolicyConfig(prisma, orgId, {
        ...validated,
        countryCode: existing.countryCode,
        regionCode: existing.regionCode,
      });

      res.json({ policy });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', details: error.errors });
      }
      console.error('Error updating regional policy config:', error);
      res.status(500).json({
        error: 'Failed to update regional policy config',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * DELETE /api/regional-settings/org/policy/:id
 * Delete regional policy config
 */
export function deleteRegionalPolicyHandler(prisma: PrismaClient) {
  return async (req: Request, res: Response) => {
    try {
      const policyId = req.params.id;
      const orgId = (req as any).orgId || (req.query.orgId as string) || null;

      await deleteRegionalPolicyConfig(prisma, policyId, orgId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting regional policy config:', error);
      res.status(500).json({
        error: 'Failed to delete regional policy config',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

/**
 * Register all routes with Express app
 */
export function registerRegionalSettingsRoutes(
  app: any,
  prisma: PrismaClient,
  options?: {
    authMiddleware?: (req: Request, res: Response, next: () => void) => void;
    rateLimitMiddleware?: (req: Request, res: Response, next: () => void) => void;
  }
) {
  const auth = options?.authMiddleware || authMiddleware;
  const rateLimit = options?.rateLimitMiddleware || rateLimitMiddleware;

  // User locale preferences
  app.get(
    '/api/regional-settings/user/locale',
    rateLimit,
    auth,
    getUserLocaleHandler(prisma)
  );
  app.put(
    '/api/regional-settings/user/locale',
    rateLimit,
    auth,
    updateUserLocaleHandler(prisma)
  );

  // Organization regional policies
  app.get(
    '/api/regional-settings/org/policy',
    rateLimit,
    auth,
    getRegionalPolicyHandler(prisma)
  );
  app.post(
    '/api/regional-settings/org/policy',
    rateLimit,
    auth,
    createRegionalPolicyHandler(prisma)
  );
  app.put(
    '/api/regional-settings/org/policy/:id',
    rateLimit,
    auth,
    updateRegionalPolicyHandler(prisma)
  );
  app.delete(
    '/api/regional-settings/org/policy/:id',
    rateLimit,
    auth,
    deleteRegionalPolicyHandler(prisma)
  );
}

