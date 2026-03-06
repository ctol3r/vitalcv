/**
 * telemetry.ts — Wave 89: Telemetry + Network Map APIs
 *
 * GET /api/system/telemetry — Network telemetry.
 * GET /api/network/map — Global network map.
 */

import type { Express, Request, Response } from 'express';
import { generateNetworkTelemetry } from '../services/system/telemetryEngine';
import { generateNetworkMap } from '../services/network/networkMap';
import { log } from '../obs/logger';

export function registerTelemetryRoutes(app: Express): void {
  app.get('/api/system/telemetry', async (_req: Request, res: Response) => {
    try {
      const telemetry = await generateNetworkTelemetry();
      res.json(telemetry);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'telemetry: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate telemetry' });
    }
  });

  app.get('/api/network/map', async (_req: Request, res: Response) => {
    try {
      const map = await generateNetworkMap();
      res.json(map);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'network_map: failed', { error: message });
      res.status(500).json({ error: 'Failed to generate network map' });
    }
  });
}
