/**
 * Ask VitalCV Routes — Wave 185
 *
 * POST /api/ask
 */

import { SearchAclLevel } from '@prisma/client';
import type { Express, NextFunction, Request, Response } from 'express';
import { ask } from '../services/search/askService';
import { HttpError } from '../utils/httpError';

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function resolveAcl(req: Request): SearchAclLevel {
  const clerkId = req.headers['x-clerk-user-id'];
  const role    = (req.headers['x-clerk-user-role'] as string | undefined)?.toUpperCase();
  if (!clerkId) return 'PUBLIC';
  if (role === 'ADMIN')    return 'ADMIN';
  if (role === 'VERIFIER') return 'VERIFIER';
  return 'AUTHENTICATED';
}

export function registerAskRoutes(app: Express): void {
  /**
   * POST /api/ask
   * Body: { q: string }
   * Returns: AskResponse with answer, sources, suggestedActions, guardrail state
   */
  app.post(
    '/api/ask',
    asyncHandler(async (req, res) => {
      const { q } = req.body as { q?: string };
      if (!q?.trim()) throw new HttpError(400, 'q (query string) is required.');
      if (q.length > 500) throw new HttpError(400, 'Query must be 500 characters or fewer.');

      const result = await ask(q.trim(), resolveAcl(req));
      res.json(result);
    }),
  );
}
