/**
 * providerDirectory.ts — Wave 143: Provider Directory Distribution API Routes
 *
 * GET /api/directory          — Structured JSON directory
 * GET /api/directory/fhir     — FHIR R4 Bundle export
 * GET /api/directory/csv      — CSV download
 */

import type { Express, Request, Response } from 'express';
import {
  generateDirectory,
  exportFHIRDirectory,
  exportCSVDirectory,
} from '../services/providers/providerDirectory';
import { log } from '../obs/logger';

export function registerProviderDirectoryRoutes(app: Express): void {
  /**
   * GET /api/directory?limit=200&minTrustScore=50
   * Structured provider directory.
   */
  app.get('/api/directory', async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500));
      const minTrustScore = Math.max(0, Math.min(100, Number(req.query.minTrustScore) || 0));
      const dir = await generateDirectory({ limit, minTrustScore });
      res.json(dir);
    } catch (err) {
      log('error', 'directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'Directory generation failed' });
    }
  });

  /**
   * GET /api/directory/fhir?limit=200
   * FHIR R4 Bundle (application/fhir+json).
   */
  app.get('/api/directory/fhir', async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500));
      const bundle = await exportFHIRDirectory({ limit });
      res.setHeader('Content-Type', 'application/fhir+json');
      res.json(bundle);
    } catch (err) {
      log('error', 'fhir_directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'FHIR directory export failed' });
    }
  });

  /**
   * GET /api/directory/csv?limit=200&minTrustScore=50
   * CSV download.
   */
  app.get('/api/directory/csv', async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 500));
      const minTrustScore = Math.max(0, Math.min(100, Number(req.query.minTrustScore) || 0));
      const csv = await exportCSVDirectory({ limit, minTrustScore });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vitalcv-directory-${Date.now()}.csv"`);
      res.send(csv);
    } catch (err) {
      log('error', 'csv_directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'CSV directory export failed' });
    }
  });
}
