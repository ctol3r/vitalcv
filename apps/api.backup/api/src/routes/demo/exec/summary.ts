/**
 * S72-D3-C-002: Exec snapshot API
 *
 * GET /demo/exec/summary
 * Returns the demoMetrics payload
 * Always returns 200 status with metrics counts
 * Uses demoMetrics service
 */

import { Router, Request, Response } from 'express';
import { getDemoMetrics } from '../../../services/demoMetrics.js';
import { requireDemo } from '../../../config/demo.js';

const router = Router();

/**
 * GET /demo/exec/summary
 * Returns executive summary metrics for demo dashboard
 *
 * Response:
 * {
 *   issuedVCs: number,
 *   verifications: number,
 *   privileges: number,
 *   applications: number,
 *   payerEnrollments: number
 * }
 */
router.get('/demo/exec/summary', requireDemo(), async (req: Request, res: Response) => {
  try {
    const metrics = await getDemoMetrics();

    // Always return 200 with metrics
    res.status(200).json(metrics);
  } catch (error) {
    console.error('Error in /demo/exec/summary:', error);

    // Even on error, return 200 with zero metrics
    // This ensures the frontend always gets valid data
    res.status(200).json({
      issuedVCs: 0,
      verifications: 0,
      privileges: 0,
      applications: 0,
      payerEnrollments: 0
    });
  }
});

export default router;

