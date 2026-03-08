/**
 * Wave 186 — Employer Knowledge Layer
 * routes/employers.ts
 */

import { Router, Request, Response } from 'express';
import {
  listEmployers,
  getEmployerBySlug,
  compareEmployers,
  searchEmployers,
} from '../services/employers/employerService';

const router = Router();

/**
 * GET /api/employers
 * List employers with optional filters.
 * Query: specialty, state, hiringStatus, hiringType, limit, offset
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { specialty, state, hiringStatus, hiringType, limit, offset } = req.query;
    const employers = await listEmployers({
      specialty: specialty as string | undefined,
      state: state as string | undefined,
      hiringStatus: hiringStatus as string | undefined,
      hiringType: hiringType as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    res.json({ employers, total: employers.length });
  } catch (err) {
    console.error('[employers] list error', err);
    res.status(500).json({ error: 'Failed to list employers' });
  }
});

/**
 * GET /api/employers/search?q=...
 * Full-text employer search by name / specialty / state / tagline.
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) ?? '';
    if (!q.trim()) {
      res.status(400).json({ error: 'Missing query parameter q' });
      return;
    }
    const employers = await searchEmployers(q);
    res.json({ employers, query: q });
  } catch (err) {
    console.error('[employers] search error', err);
    res.status(500).json({ error: 'Employer search failed' });
  }
});

/**
 * GET /api/employers/compare?slugs=a,b,c
 * Compare up to 4 employers side-by-side.
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    const raw = (req.query.slugs as string) ?? '';
    const slugs = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (slugs.length < 2) {
      res.status(400).json({ error: 'Provide at least 2 slugs' });
      return;
    }
    const result = await compareEmployers(slugs);
    res.json(result);
  } catch (err) {
    console.error('[employers] compare error', err);
    res.status(500).json({ error: 'Employer compare failed' });
  }
});

/**
 * GET /api/employers/:slug
 * Full employer profile by slug.
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const employer = await getEmployerBySlug(slug);
    if (!employer) {
      res.status(404).json({ error: 'Employer not found' });
      return;
    }
    console.log(JSON.stringify({ event: 'employer.profile.view', slug }));
    res.json({ employer });
  } catch (err) {
    console.error('[employers] profile error', err);
    res.status(500).json({ error: 'Failed to load employer profile' });
  }
});

export function registerEmployerRoutes(app: import('express').Application): void {
  app.use('/api/employers', router);
}
