/**
 * systemStatus.ts — Wave 90: System Status API
 *
 * GET /api/system/status — Infrastructure health status.
 */

import type { Express, Request, Response } from 'express';
import { generateSystemStatus } from '../services/system/statusEngine';
import { generateSystemPulse } from '../services/system/pulseService';
import { log } from '../obs/logger';

export function registerSystemStatusRoutes(app: Express): void {
  app.get('/api/system/status', async (_req: Request, res: Response) => {
    try {
      const status = await generateSystemStatus();
      res.json(status);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'system_status: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate system status' });
    }
  });

  app.get('/api/system/pulse', async (_req: Request, res: Response) => {
    try {
      const pulse = await generateSystemPulse();
      res.json(pulse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'system_pulse: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate system pulse' });
    }
  });
}
