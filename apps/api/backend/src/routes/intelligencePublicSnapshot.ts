import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  getPublicGraphSnapshot,
  getPublicWorkbenchSnapshot,
  listPublicFindingsSnapshot,
  listPublicProvidersSnapshot,
  listPublicStorylinesSnapshot,
} from '../services/intelligence/publicSnapshotService';

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return first?.trim();
  }

  return undefined;
}

function readPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(readQueryValue(value));
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.trunc(parsed), max);
}

function readMinConfidence(value: unknown): number | undefined {
  const parsed = Number(readQueryValue(value));
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, parsed));
}

export function registerIntelligencePublicSnapshotRoutes(app: Express): void {
  app.get('/api/intelligence/public/providers', async (req: Request, res: Response) => {
    try {
      const payload = await listPublicProvidersSnapshot({
        query: readQueryValue(req.query.q),
        page: readPositiveInt(req.query.page, 1, 200),
        pageSize: readPositiveInt(req.query.pageSize ?? req.query.limit, 12, 100),
        minTrustScore: readQueryValue(req.query.minTrustScore)
          ? readPositiveInt(req.query.minTrustScore, 0, 100)
          : undefined,
      });
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'public_snapshot_providers_failed', { error: message });
      res.status(500).json({ error: 'Failed to load public providers snapshot' });
    }
  });

  app.get('/api/intelligence/public/findings', async (req: Request, res: Response) => {
    try {
      const limit = readPositiveInt(req.query.limit, 10, 100);
      const offset = readQueryValue(req.query.offset)
        ? Math.max(0, Number(readQueryValue(req.query.offset)) || 0)
        : 0;

      const payload = await listPublicFindingsSnapshot({
        provider: readQueryValue(req.query.provider),
        severity: readQueryValue(req.query.severity),
        status: readQueryValue(req.query.status),
        findingType: readQueryValue(req.query.type),
        investigatorId: readQueryValue(req.query.investigatorId),
        dateFrom: readQueryValue(req.query.dateFrom),
        dateTo: readQueryValue(req.query.dateTo),
        minConfidence: readMinConfidence(req.query.minConfidence),
        limit,
        offset,
      });
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'public_snapshot_findings_failed', { error: message });
      res.status(500).json({ error: 'Failed to load public findings snapshot' });
    }
  });

  app.get('/api/intelligence/public/storylines', async (req: Request, res: Response) => {
    try {
      const payload = await listPublicStorylinesSnapshot({
        provider: readQueryValue(req.query.provider),
        severity: readQueryValue(req.query.severity),
        status: readQueryValue(req.query.status),
        storylineType: readQueryValue(req.query.storylineType),
        perspective: readQueryValue(req.query.perspective),
        limit: readPositiveInt(req.query.limit, 24, 100),
      });
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'public_snapshot_storylines_failed', { error: message });
      res.status(500).json({ error: 'Failed to load public storylines snapshot' });
    }
  });

  app.get('/api/intelligence/public/graph', async (req: Request, res: Response) => {
    try {
      const payload = await getPublicGraphSnapshot({
        npi: readQueryValue(req.query.npi),
        limit: readPositiveInt(req.query.limit, 60, 240),
      });
      res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'public_snapshot_graph_failed', { error: message });
      res.status(500).json({ error: 'Failed to load public graph snapshot' });
    }
  });

  app.get('/api/intelligence/public/investigation-workbench', async (req: Request, res: Response) => {
    try {
      const payload = await getPublicWorkbenchSnapshot({
        npi: readQueryValue(req.query.npi),
        findingId: readQueryValue(req.query.findingId),
        storylineId: readQueryValue(req.query.storylineId),
      });

      if (!payload) {
        res.status(404).json({ error: 'Public investigation snapshot not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/workbench/public-snapshot/v1',
        ...payload,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'public_snapshot_workbench_failed', { error: message });
      res.status(500).json({ error: 'Failed to load public investigation snapshot' });
    }
  });
}
