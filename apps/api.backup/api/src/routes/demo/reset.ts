/**
 * B146A-QA-006: Demo reset endpoint with authentication and rate limiting
 *
 * POST /api/demo/reset
 *
 * Resets all demo data. Protected by:
 * - DEMO_RESET_TOKEN header or env variable
 * - Rate limiting (N requests per day)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { resetDemoData } from '../../../../../scripts/seed-pilot-demo';

const router = Router();
const prisma = new PrismaClient();

// B146A-QA-006: Rate limiter - max N requests per day (default: 5)
const resetRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: parseInt(process.env.DEMO_RESET_RATE_LIMIT || '5', 10),
  message: {
    error: 'rate_limit_exceeded',
    message: 'Demo reset rate limit exceeded. Maximum 5 resets per day.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting if token is invalid (will be rejected by auth check)
    return false;
  },
});

/**
 * Middleware to check DEMO_RESET_TOKEN
 */
function checkDemoResetToken(req: Request, res: Response, next: Function) {
  const token = req.headers['x-demo-reset-token'] as string || process.env.DEMO_RESET_TOKEN;
  const expectedToken = process.env.DEMO_RESET_TOKEN;

  if (!expectedToken) {
    console.error('[demo/reset] DEMO_RESET_TOKEN not configured in environment');
    return res.status(500).json({
      error: 'configuration_error',
      message: 'Demo reset token not configured',
    });
  }

  if (!token || token !== expectedToken) {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid or missing DEMO_RESET_TOKEN',
    });
  }

  next();
}

/**
 * POST /api/demo/reset
 * Reset all demo data
 *
 * Security:
 * - Requires DEMO_RESET_TOKEN header or env variable
 * - Rate limited to N requests per day (default: 5)
 */
router.post(
  '/reset',
  resetRateLimiter,
  checkDemoResetToken,
  async (req: Request, res: Response) => {
    try {
      console.log('[demo/reset] Starting demo data reset...');

      // Call the reset function from seed script
      await resetDemoData();

      console.log('[demo/reset] Demo data reset completed successfully');

      return res.json({
        success: true,
        message: 'Demo data reset completed successfully',
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      console.error('[demo/reset] Error resetting demo data:', error);

      return res.status(500).json({
        error: 'reset_failed',
        message: 'Failed to reset demo data',
        details: error.message,
      });
    }
  }
);

export default router;

