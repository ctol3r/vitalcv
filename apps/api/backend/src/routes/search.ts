/**
 * Search Routes — Wave 184
 *
 * POST /api/search/query
 * POST /api/search/suggest
 * GET  /api/search/index-status
 * POST /api/search/reindex (admin only)
 */

import { SearchAclLevel, SearchObjectType } from '@prisma/client';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  getIndexStatus,
  querySearch,
  seedPublicPages,
  suggestSearch,
} from '../services/search/searchIndex';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function resolveAcl(req: Request): SearchAclLevel {
  const clerkId = req.headers['x-clerk-user-id'];
  const role    = (req.headers['x-clerk-user-role'] as string | undefined)?.toUpperCase();
  if (!clerkId) return 'PUBLIC';
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'VERIFIER') return 'VERIFIER';
  return 'AUTHENTICATED';
}

export function registerSearchRoutes(app: Express): void {

  /**
   * POST /api/search/query
   * Body: { q: string; types?: string[]; limit?: number; offset?: number; filters?: object }
   */
  app.post(
    '/api/search/query',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        q?: string;
        types?: string[];
        limit?: number;
        offset?: number;
        filters?: Record<string, unknown>;
      };

      if (!body.q?.trim()) {
        throw new HttpError(400, 'q (query string) is required.');
      }

      const validTypes = Object.values(SearchObjectType);
      const types = body.types?.filter((t) => validTypes.includes(t as SearchObjectType)) as SearchObjectType[] | undefined;

      const result = await querySearch({
        q:        body.q.trim(),
        types,
        aclLevel: resolveAcl(req),
        limit:    Math.min(body.limit ?? 10, 50),
        offset:   body.offset ?? 0,
      });

      res.json(result);
    }),
  );

  /**
   * POST /api/search/suggest
   * Body: { q: string; limit?: number }
   */
  app.post(
    '/api/search/suggest',
    asyncHandler(async (req, res) => {
      const { q, limit } = req.body as { q?: string; limit?: number };
      if (!q) throw new HttpError(400, 'q is required.');
      const result = await suggestSearch(q.trim(), limit ?? 5);
      res.json(result);
    }),
  );

  /**
   * GET /api/search/index-status
   */
  app.get(
    '/api/search/index-status',
    asyncHandler(async (_req, res) => {
      const status = await getIndexStatus();
      res.json(status);
    }),
  );

  /**
   * POST /api/search/reindex
   * Admin only — seeds public pages into the index.
   */
  app.post(
    '/api/search/reindex',
    asyncHandler(async (req, res) => {
      const clerkId = req.headers['x-clerk-user-id'];
      const role    = (req.headers['x-clerk-user-role'] as string | undefined)?.toUpperCase();
      if (!clerkId || role !== 'ADMIN') {
        throw new HttpError(403, 'Admin access required for reindex.');
      }

      const count = await seedPublicPages();
      res.json({ indexed: count, seededAt: new Date().toISOString() });
    }),
  );
}
