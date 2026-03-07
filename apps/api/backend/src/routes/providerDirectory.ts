/**
 * providerDirectory.ts — Wave 143 + 149: Provider Directory Distribution API Routes
 *
 * GET  /api/directory            — Structured JSON directory
 * GET  /api/directory/fhir       — FHIR R4 Bundle export
 * GET  /api/directory/csv        — CSV download
 * POST /api/directory/publish    — Publish a snapshot (Wave 149)
 * GET  /api/directory/snapshot/:id — Retrieve snapshot (Wave 149)
 * GET  /api/directory/snapshots  — List all snapshots (Wave 149)
 * GET  /api/directory/verify/:id — Verify snapshot integrity (Wave 149)
 * GET  /api/directory/signed     — Generate signed directory (Wave 149)
 */

import type { Express, Request, Response } from 'express';
import {
  generateDirectory,
  exportFHIRDirectory,
  exportCSVDirectory,
  publishDirectorySnapshot,
  getDirectorySnapshot,
  listDirectorySnapshots,
  verifyDirectoryIntegrity,
  generateSignedDirectory,
} from '../services/providers/providerDirectory';
import { log } from '../obs/logger';

function parsePositiveInteger(value: unknown): number | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseDirectoryQuery(req: Request) {
  return {
    page: parsePositiveInteger(req.query.page),
    pageSize: parsePositiveInteger(req.query.pageSize),
    limit: parsePositiveInteger(req.query.limit),
    minTrustScore: parsePositiveInteger(req.query.minTrustScore),
  };
}

export function registerProviderDirectoryRoutes(app: Express): void {
  /**
   * GET /api/directory?page=1&pageSize=200&limit=200&minTrustScore=50
   * Structured provider directory.
   */
  app.get('/api/directory', async (req: Request, res: Response) => {
    try {
      const dir = await generateDirectory(parseDirectoryQuery(req));
      res.json(dir);
    } catch (err) {
      log('error', 'directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'Directory generation failed' });
    }
  });

  /**
   * GET /api/directory/fhir?page=1&pageSize=200&limit=200&minTrustScore=50
   * FHIR R4 Bundle (application/fhir+json).
   */
  app.get('/api/directory/fhir', async (req: Request, res: Response) => {
    try {
      const bundle = await exportFHIRDirectory(parseDirectoryQuery(req));
      res.setHeader('Content-Type', 'application/fhir+json');
      res.json(bundle);
    } catch (err) {
      log('error', 'fhir_directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'FHIR directory export failed' });
    }
  });

  /**
   * GET /api/directory/csv?page=1&pageSize=200&limit=200&minTrustScore=50
   * CSV download.
   */
  app.get('/api/directory/csv', async (req: Request, res: Response) => {
    try {
      const csv = await exportCSVDirectory(parseDirectoryQuery(req));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="vitalcv-directory-${Date.now()}.csv"`);
      res.setHeader('X-VitalCV-Integrity-Hash', csv.integrityHash);
      res.setHeader('X-VitalCV-Page', String(csv.pageInfo.page));
      res.setHeader('X-VitalCV-Page-Size', String(csv.pageInfo.pageSize));
      res.setHeader('X-VitalCV-Total-Available', String(csv.pageInfo.totalAvailable));
      res.setHeader('X-VitalCV-Has-Next-Page', String(csv.pageInfo.hasNextPage));
      res.send(csv.content);
    } catch (err) {
      log('error', 'csv_directory_route_error', { error: String(err) });
      res.status(500).json({ error: 'CSV directory export failed' });
    }
  });

  // ── Wave 149: Directory Network Distribution ────────────────────────────────

  /**
   * POST /api/directory/publish
   * Publish a point-in-time directory snapshot.
   */
  app.post('/api/directory/publish', async (req: Request, res: Response) => {
    try {
      const publishedBy = (req.body as Record<string, string>)?.publishedBy ?? 'system';
      const result = await publishDirectorySnapshot(publishedBy, parseDirectoryQuery(req));
      res.status(201).json(result);
    } catch (err) {
      log('error', 'directory_publish_route_error', { error: String(err) });
      res.status(500).json({ error: 'Directory publish failed' });
    }
  });

  /**
   * GET /api/directory/snapshots
   * List all published snapshots (metadata only).
   */
  app.get('/api/directory/snapshots', (_req: Request, res: Response) => {
    try {
      const snapshots = listDirectorySnapshots();
      res.json({ snapshots, count: snapshots.length });
    } catch (err) {
      log('error', 'directory_snapshots_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to list snapshots' });
    }
  });

  /**
   * GET /api/directory/snapshot/:id
   * Retrieve a specific snapshot.
   */
  app.get('/api/directory/snapshot/:id', (req: Request, res: Response) => {
    try {
      const snapshot = getDirectorySnapshot(req.params.id);
      if (!snapshot) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      res.json(snapshot);
    } catch (err) {
      log('error', 'directory_snapshot_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to retrieve snapshot' });
    }
  });

  /**
   * GET /api/directory/verify/:id
   * Verify the integrity of a published snapshot.
   */
  app.get('/api/directory/verify/:id', (req: Request, res: Response) => {
    try {
      const result = verifyDirectoryIntegrity(req.params.id);
      if (!result) {
        res.status(404).json({ error: 'Snapshot not found' });
        return;
      }
      res.json(result);
    } catch (err) {
      log('error', 'directory_verify_route_error', { error: String(err) });
      res.status(500).json({ error: 'Integrity verification failed' });
    }
  });

  /**
   * GET /api/directory/signed
   * Generate a signed directory envelope for federation.
   */
  app.get('/api/directory/signed', async (req: Request, res: Response) => {
    try {
      const signed = await generateSignedDirectory(parseDirectoryQuery(req));
      res.json(signed);
    } catch (err) {
      log('error', 'directory_signed_route_error', { error: String(err) });
      res.status(500).json({ error: 'Signed directory generation failed' });
    }
  });
}
