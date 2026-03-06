/**
 * monitoringEvents.ts — Wave 85: Monitoring Events API
 *
 * GET /api/monitoring/events — Returns current monitoring alerts.
 */

import type { Express, Request, Response } from 'express';
import { generateAlerts } from '../services/monitoring/alertEngine';
import { log } from '../obs/logger';

export function registerMonitoringEventsRoutes(app: Express): void {
  app.get('/api/monitoring/events', async (_req: Request, res: Response) => {
    try {
      const alerts = await generateAlerts();
      res.json(alerts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'monitoring_events: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate monitoring events' });
    }
  });
}
