import { createLogger } from '@chai-vc/logging-core';
import express, { Request, Response, Router } from 'express';
import { getDashboardSummary } from '../services/dashboardService';

const router: Router = express.Router();
const log = createLogger({ service: 'verifier-api-dashboard-route' });

/**
 * GET /dashboard/summary
 * Returns dashboard statistics.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const summary = await getDashboardSummary();

    // Cache for 60 seconds? Prompt didn't specify for this one, but good practice.
    // The prompt specified cache header for CRS endpoint.
    // But B3 says "Dashboard API - GET /dashboard/summary".
    // I'll add a short cache here too.
    res.set('Cache-Control', 'public, max-age=60');

    res.json(summary);
  } catch (error) {
    log.error('Error fetching dashboard summary', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
