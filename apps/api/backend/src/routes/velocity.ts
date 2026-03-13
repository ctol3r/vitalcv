/**
 * velocity.ts — Wave 250
 *
 * Routes:
 *   GET /api/velocity                  — system-wide velocity (public, cached 10min)
 *   GET /api/velocity/:organizationId  — org-specific velocity (requires org membership)
 */

import type { Express, NextFunction, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import {
  computeOrganizationVelocityMetrics,
  computeVelocityMetrics,
} from '../services/velocity/velocityEngine';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

async function assertOrganizationAccess(
  clerkUserId: string,
  organizationId: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, organizationId: true },
  });

  if (user?.organizationId === organizationId) {
    return;
  }

  if (!user?.id) {
    throw new HttpError(403, 'You do not have access to this organization.');
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      active: true,
      personProfile: { userId: user.id },
      organizationProfile: { organizationId },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new HttpError(403, 'You do not have access to this organization.');
  }
}

// ── Simple in-process TTL cache ─────────────────────────────

type CacheEntry<T> = { data: T; expiresAt: number };

function makeCache<T>(ttlMs: number) {
  const store = new Map<string, CacheEntry<T>>();
  return {
    get(key: string): T | null {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.data;
    },
    set(key: string, data: T): void {
      store.set(key, { data, expiresAt: Date.now() + ttlMs });
    },
  };
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const velocityCache = makeCache<unknown>(TEN_MINUTES_MS);

// ── Route registration ────────────────────────────────────────

export function registerVelocityRoutes(app: Express): void {
  /**
   * GET /api/velocity
   * System-wide velocity metrics — public, cached 10 minutes.
   */
  app.get(
    '/api/velocity',
    asyncHandler(async (_req, res) => {
      const CACHE_KEY = 'system';
      const cached = velocityCache.get(CACHE_KEY);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json(cached);
        return;
      }

      const metrics = await computeVelocityMetrics();
      velocityCache.set(CACHE_KEY, metrics);
      res.setHeader('X-Cache', 'MISS');
      res.json(metrics);
    }),
  );

  /**
   * GET /api/velocity/:organizationId
   * Org-specific velocity — requires Clerk auth.
   */
  app.get(
    '/api/velocity/:organizationId',
    asyncHandler(async (req, res) => {
      const clerkUserId = requireClerkUserId(req);
      const { organizationId } = req.params;
      if (!organizationId?.trim()) {
        throw new HttpError(400, 'organizationId is required.');
      }

      const normalizedOrganizationId = organizationId.trim();
      await assertOrganizationAccess(clerkUserId, normalizedOrganizationId);

      const CACHE_KEY = `org:${organizationId}`;
      const cached = velocityCache.get(CACHE_KEY);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.json(cached);
        return;
      }

      try {
        const metrics = await computeOrganizationVelocityMetrics(normalizedOrganizationId);
        velocityCache.set(CACHE_KEY, metrics);
        res.setHeader('X-Cache', 'MISS');
        res.json(metrics);
      } catch (err) {
        log('error', 'velocity_org_error', {
          organizationId,
          error: err instanceof Error ? err.message : 'unknown',
        });
        throw err;
      }
    }),
  );
}
