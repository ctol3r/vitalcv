import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { buildLiveFeed, getCachedLiveFeedSnapshot } from '../services/feed/liveFeedService';

function readLimit(value: unknown): number {
  if (typeof value !== 'string') {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

export function registerFeedRoutes(app: Express): void {
  app.get('/api/feed/live', async (req: Request, res: Response) => {
    try {
      const feed = await buildLiveFeed(readLimit(req.query.limit));
      res.json(feed);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const cached = getCachedLiveFeedSnapshot('backend_failure');
      if (cached) {
        log('warn', 'feed_live_cache_fallback', {
          event: 'intelligence_failure_detected',
          layer: 'api',
          route: '/api/feed/live',
          reason: 'backend_failure',
          error: detail,
          recoveryTriggered: false,
        });
        return res.json(cached);
      }

      log('error', 'feed_live_failed', {
        event: 'intelligence_failure_detected',
        layer: 'api',
        route: '/api/feed/live',
        reason: 'backend_failure',
        error: detail,
      });
      res.status(500).json({ error: 'Failed to build live feed', detail });
    }
  });
}
