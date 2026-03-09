/**
 * Wave 186 — Employer Knowledge Layer
 * routes/employers.ts
 */

import type { Application, NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { emitAnalyticsEvent } from '../services/audit/auditService';
import {
  compareEmployers,
  getEmployerBySlug,
  listEmployers,
  searchEmployers,
} from '../services/employers/employerService';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import { HttpError } from '../utils/httpError';

const router = Router();

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * GET /api/employers
 * List employers with optional filters.
 * Query: specialty, state, hiringStatus, hiringType, limit, offset
 */
router.get('/', asyncHandler(async (req, res) => {
  const { specialty, state, hiringStatus, hiringType } = req.query;
  const result = await listEmployers({
    specialty: typeof specialty === 'string' ? specialty : undefined,
    state: typeof state === 'string' ? state : undefined,
    hiringStatus: typeof hiringStatus === 'string' ? hiringStatus : undefined,
    hiringType: typeof hiringType === 'string' ? hiringType : undefined,
    limit: parsePositiveInt(req.query.limit, 20),
    offset: parsePositiveInt(req.query.offset, 0),
  });

  res.json(result);
}));

/**
 * GET /api/employers/search?q=...
 * Full-text employer search by name / specialty / state / tagline.
 */
router.get('/search', asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  if (!q.trim()) {
    throw new HttpError(400, 'Missing query parameter q.');
  }

  const employers = await searchEmployers(q);
  res.json({ employers, total: employers.length, query: q.trim() });
}));

/**
 * GET /api/employers/compare?slugs=a,b,c
 * Compare up to 4 employers side-by-side.
 */
router.get('/compare', asyncHandler(async (req, res) => {
  const raw = typeof req.query.slugs === 'string' ? req.query.slugs : '';
  const slugs = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (slugs.length < 2) {
    throw new HttpError(400, 'Provide at least 2 slugs.');
  }

  const context = await resolveSearchRequestContext(req);
  const result = await compareEmployers(slugs);

  await emitAnalyticsEvent({
    type: 'employer_compare_started',
    referenceId: slugs.join(','),
    organizationId: context.organizationId,
    metadata: {
      slugs,
      count: result.employers.length,
      aclLevel: context.aclLevel,
    },
  });

  res.json(result);
}));

/**
 * GET /api/employers/:slug
 * Full employer profile by slug.
 */
router.get('/:slug', asyncHandler(async (req, res) => {
  const slug = req.params.slug?.trim();
  if (!slug) {
    throw new HttpError(400, 'Employer slug is required.');
  }

  const context = await resolveSearchRequestContext(req);
  const employer = await getEmployerBySlug(slug);
  if (!employer) {
    throw new HttpError(404, 'Employer not found.');
  }

  await emitAnalyticsEvent({
    type: 'employer_page_viewed',
    referenceId: employer.slug,
    organizationId: context.organizationId,
    metadata: {
      slug: employer.slug,
      aclLevel: context.aclLevel,
      verified: employer.verified,
    },
  });

  res.json({ employer });
}));

export function registerEmployerRoutes(app: Application): void {
  app.use('/api/employers', router);
}
