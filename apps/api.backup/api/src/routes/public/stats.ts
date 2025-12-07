/**
 * Public Marketing Stats Endpoint
 * B133C-MKT-003
 *
 * Returns aggregate platform statistics for marketing purposes:
 * - Total VCs issued
 * - Total organizations (partners)
 * - Total job postings
 *
 * Caches results for 5 minutes to reduce database load.
 * No PHI/PII is exposed in this endpoint.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
let cachedStats: PublicStats | null = null;
let cacheTimestamp = 0;

export interface PublicStats {
  vcsIssued: number;
  organizationsLive: number;
  jobsPosted: number;
  lastUpdated: string;
}

/**
 * GET /public/stats
 *
 * Returns aggregate platform statistics without any PHI/PII.
 * Results are cached for 5 minutes.
 *
 * Response:
 * {
 *   "vcsIssued": 12500,
 *   "organizationsLive": 45,
 *   "jobsPosted": 320,
 *   "lastUpdated": "2025-11-12T10:30:00.000Z"
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = Date.now();

    // Return cached stats if still fresh
    if (cachedStats && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      return res.status(200).json({
        ...cachedStats,
        cached: true,
        cacheAge: Math.floor((now - cacheTimestamp) / 1000), // seconds
      });
    }

    // Fetch fresh stats from database
    const [vcsIssued, organizationsLive, jobsPosted] = await Promise.all([
      // Count all issued credentials (VCs)
      prisma.credential.count({
        where: {
          status: 'active',
          issuedAt: {
            lte: new Date(),
          },
        },
      }),

      // Count active partner organizations
      prisma.partnerConfig.count({
        where: {
          isActive: true,
        },
      }),

      // Count all active job postings
      prisma.jobPosting.count({
        where: {
          status: 'active',
        },
      }),
    ]);

    // Update cache
    cachedStats = {
      vcsIssued,
      organizationsLive,
      jobsPosted,
      lastUpdated: new Date().toISOString(),
    };
    cacheTimestamp = now;

    // Set cache headers for CDN/browser caching
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.set('X-Cache-Status', 'MISS');

    return res.status(200).json(cachedStats);
  } catch (error) {
    console.error('[Public Stats] Error fetching stats:', error);

    // If cache exists, return stale data rather than error
    if (cachedStats) {
      res.set('X-Cache-Status', 'STALE');
      return res.status(200).json({
        ...cachedStats,
        stale: true,
      });
    }

    return res.status(500).json({
      error: 'Failed to fetch platform statistics',
      vcsIssued: 0,
      organizationsLive: 0,
      jobsPosted: 0,
    });
  }
});

/**
 * GET /public/stats/refresh
 *
 * Force refresh the stats cache (admin/internal use).
 * Should be protected in production or rate-limited.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Clear cache
    cachedStats = null;
    cacheTimestamp = 0;

    // Fetch fresh stats
    const response = await router.stack[0].handle(req, res);

    return res.status(200).json({
      message: 'Stats cache refreshed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Public Stats] Error refreshing cache:', error);
    return res.status(500).json({
      error: 'Failed to refresh stats cache',
    });
  }
});

/**
 * Export cache management functions for testing
 */
export function clearStatsCache(): void {
  cachedStats = null;
  cacheTimestamp = 0;
}

export function getStatsCacheAge(): number {
  return Date.now() - cacheTimestamp;
}

export default router;

