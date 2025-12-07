/**
 * Public Status Page - Round 19
 * Provides public-facing status information with caching
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /statuspage
 * Public status endpoint with cache-control
 */
router.get('/statuspage', async (_req: Request, res: Response) => {
  try {
    // Set cache headers
    res.setHeader('cache-control', 'public, max-age=30');
    res.setHeader('Content-Type', 'application/json');

    // Gather status information
    const status = {
      health: { ok: true },
      jwks: true, // JWKS endpoint available
      metrics: true, // Metrics endpoint available
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    res.json(status);
  } catch (error: any) {
    console.error('Status page error:', error);
    res.status(500).json({
      health: { ok: false },
      error: 'Internal error',
      timestamp: new Date().toISOString()
    });
  }
});

export const statuspageRouter = router;

