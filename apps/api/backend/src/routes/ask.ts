/**
 * Ask VitalCV Routes — Wave 185
 *
 * POST /api/ask
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { ask } from '../services/search/askService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

export function registerAskRoutes(app: Express): void {
  app.post(
    '/api/ask',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        q?: string;
        query?: string;
        context?: {
          employerSlug?: string;
          employerName?: string;
          opportunityId?: string;
        };
        filters?: {
          employer?: string;
          type?: string;
          state?: string;
          hiringType?: string;
        };
      };

      const q = body.q?.trim() || body.query?.trim();
      if (!q) {
        throw new HttpError(400, 'q (query string) is required.');
      }
      if (q.length > 500) {
        throw new HttpError(400, 'Query must be 500 characters or fewer.');
      }

      const requestContext = await resolveSearchRequestContext(req, q);
      const result = await ask({
        q,
        requestContext,
        context: body.context,
        filters: body.filters,
      });

      res.json(result);
    }),
  );
}
