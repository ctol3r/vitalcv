/**
 * Search Routes — Wave 184
 *
 * POST /api/search/query
 * POST /api/search/suggest
 * GET  /api/search/index-status
 * POST /api/search/reindex (admin only)
 */

import { SearchObjectType } from '@prisma/client';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  getIndexStatus,
  querySearch,
  seedPublicPages,
  suggestSearch,
} from '../services/search/searchIndex';
import {
  predictSearchSuggestions,
  recordQueryHistory,
} from '../services/intelligence/queryPredictionService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerSearchRoutes(app: Express): void {
  app.post(
    '/api/search/query',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        q?: string;
        query?: string;
        types?: string[];
        limit?: number;
        offset?: number;
        filters?: Record<string, string | number | boolean | undefined>;
      };

      const q = body.q?.trim() || body.query?.trim();
      if (!q) {
        throw new HttpError(400, 'q (query string) is required.');
      }

      const validTypes = new Set(Object.values(SearchObjectType));
      const types = body.types?.filter((type) => validTypes.has(type as SearchObjectType)) as SearchObjectType[] | undefined;
      const requestContext = await resolveSearchRequestContext(req, q);

      const result = await querySearch({
        q,
        types,
        aclLevel: requestContext.aclLevel,
        orgId: requestContext.organizationId,
        roles: requestContext.membershipRoles,
        limit: Math.min(body.limit ?? 10, 50),
        offset: Math.max(body.offset ?? 0, 0),
        filters: body.filters,
      });

      await recordQueryHistory({
        query: q,
        resultCount: result.total,
        context: {
          aclLevel: requestContext.aclLevel,
          organizationId: requestContext.organizationId,
          clerkUserId: requestContext.clerkUserId,
          clerkUserEmail: requestContext.clerkUserEmail,
        },
      });

      res.json(result);
    }),
  );

  app.post(
    '/api/search/suggest',
    asyncHandler(async (req, res) => {
      const body = req.body as { q?: string; query?: string; limit?: number };
      const q = body.q?.trim() || body.query?.trim();
      if (!q) {
        throw new HttpError(400, 'q is required.');
      }

      const requestContext = await resolveSearchRequestContext(req, q);
      const baseResult = await suggestSearch(q, body.limit ?? 5, {
        aclLevel: requestContext.aclLevel,
        orgId: requestContext.organizationId,
        roles: requestContext.membershipRoles,
      });
      const result = await predictSearchSuggestions({
        query: q,
        limit: body.limit ?? 5,
        baseSuggestions: baseResult.suggestions,
        context: {
          aclLevel: requestContext.aclLevel,
          organizationId: requestContext.organizationId,
          clerkUserId: requestContext.clerkUserId,
          clerkUserEmail: requestContext.clerkUserEmail,
        },
      });

      await recordQueryHistory({
        query: q,
        resultCount: result.suggestions.length,
        context: {
          aclLevel: requestContext.aclLevel,
          organizationId: requestContext.organizationId,
          clerkUserId: requestContext.clerkUserId,
          clerkUserEmail: requestContext.clerkUserEmail,
        },
      });

      res.json(result);
    }),
  );

  app.get(
    '/api/search/index-status',
    asyncHandler(async (_req, res) => {
      const status = await getIndexStatus();
      res.json(status);
    }),
  );

  app.post(
    '/api/search/reindex',
    asyncHandler(async (req, res) => {
      const requestContext = await resolveSearchRequestContext(req);
      if (!requestContext.clerkUserId || requestContext.aclLevel !== 'ADMIN') {
        throw new HttpError(403, 'Admin access required for reindex.');
      }

      const count = await seedPublicPages();
      res.json({ indexed: count, seededAt: new Date().toISOString() });
    }),
  );
}
