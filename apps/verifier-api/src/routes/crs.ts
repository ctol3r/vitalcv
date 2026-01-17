import { createLogger } from '@chai-vc/logging-core';
import express, { Request, Response, Router } from 'express';
import {
  computeCRS,
  CRS_REQUIREMENT_KEYS,
  CRSInput,
  CRSRequirementKey,
} from '../services/crsService';
import { updateDashboardStats } from '../services/dashboardService';

const router: Router = express.Router();
const log = createLogger({ service: 'verifier-api-crs-route' });

// Simple in-memory rate limiter: IP -> timestamp[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

const CRS_CACHE_TTL_MS = 5 * 60 * 1000;
const crsCache = new Map<
  string,
  { score: number; missingRequirements: CRSRequirementKey[]; computedAt: string; expiresAt: number }
>();

const normalizeRequirements = (
  requirements?: Partial<Record<CRSRequirementKey, boolean>>,
): Record<CRSRequirementKey, boolean> =>
  CRS_REQUIREMENT_KEYS.reduce<Record<CRSRequirementKey, boolean>>((acc, key) => {
    acc[key] = requirements?.[key] === true;
    return acc;
  }, {} as Record<CRSRequirementKey, boolean>);

const buildCacheKey = (input: CRSInput) =>
  JSON.stringify({
    requirements: normalizeRequirements(input.requirements),
  });

const rateLimiter = (req: Request, res: Response, next: express.NextFunction) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  let timestamps = rateLimitMap.get(ip) || [];
  // Filter out old timestamps
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  next();
};

/**
 * POST /crs/compute
 * Computes the CRS score for a given input.
 */
router.post('/compute', rateLimiter, async (req: Request, res: Response) => {
  try {
    const input: CRSInput = req.body;

    // Basic validation
    if (
      !input.requirements ||
      typeof input.requirements !== 'object' ||
      Array.isArray(input.requirements)
    ) {
      res.status(400).json({ error: 'Invalid input: requirements object is required' });
      return;
    }

    const requirementKeys = Object.keys(input.requirements);
    const invalidKeys = requirementKeys.filter(
      (key) => !CRS_REQUIREMENT_KEYS.includes(key as CRSRequirementKey),
    );
    if (invalidKeys.length > 0) {
      res.status(400).json({
        error: 'Invalid requirement keys',
        invalidKeys,
        allowedKeys: CRS_REQUIREMENT_KEYS,
      });
      return;
    }

    const invalidValues = requirementKeys.filter((key) => {
      const value = (input.requirements as Record<string, unknown>)[key];
      return typeof value !== 'boolean';
    });
    if (invalidValues.length > 0) {
      res.status(400).json({
        error: 'Invalid requirement values',
        invalidKeys: invalidValues,
      });
      return;
    }

    const cacheKey = buildCacheKey(input);
    const now = Date.now();
    const cached = crsCache.get(cacheKey);
    const isCacheHit = Boolean(cached && cached.expiresAt > now);

    const computedAt = isCacheHit ? cached!.computedAt : new Date().toISOString();
    const result = isCacheHit ? cached! : computeCRS(input);
    if (!isCacheHit) {
      crsCache.set(cacheKey, {
        score: result.score,
        missingRequirements: result.missingRequirements,
        computedAt,
        expiresAt: now + CRS_CACHE_TTL_MS,
      });
    }

    // Update stats (fire and forget)
    updateDashboardStats(
      result.score,
      input.revocationStatus === 'revoked',
      input.revocationStatus === 'unknown',
    );

    // Set Cache-Control header (5 min)
    res.set('Cache-Control', 'public, max-age=300');

    res.json({
      score: result.score,
      missingRequirements: result.missingRequirements,
      computedAt,
      breakdown: {
        input,
        computedAt,
        cached: isCacheHit,
      },
    });
  } catch (error) {
    log.error('Error computing CRS', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
