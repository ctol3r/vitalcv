import type { Express, Request, Response } from 'express';
import { createViewport } from '../../../../../core/geospatial';
import { log } from '../obs/logger';
import {
  getMapClusters,
  getMapInstitutions,
  getMapNetwork,
  getMapShortages,
} from '../services/geospatial/mapAggregationService';

const MAX_VIEWPORT_WIDTH_DEGREES = 60;
const MAX_VIEWPORT_HEIGHT_DEGREES = 30;

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readLimit(value: unknown, fallback: number, max: number): number {
  const parsed = readOptionalNumber(value);
  if (parsed === undefined || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.trunc(parsed), max);
}

function parseMapQuery(req: Request): {
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  zoom: number;
  state?: string;
  specialty?: string;
  limit: number;
  minMomentumScore?: number;
  minWeight?: number;
} {
  const bboxRaw = readOptionalString(req.query.bbox);
  const zoomRaw = readOptionalNumber(req.query.zoom);

  if (!bboxRaw || zoomRaw === undefined) {
    throw new Error('bbox and zoom are required');
  }

  const viewport = createViewport(bboxRaw, zoomRaw);
  const width = viewport.bbox.maxLng - viewport.bbox.minLng;
  const height = viewport.bbox.maxLat - viewport.bbox.minLat;

  if (width > MAX_VIEWPORT_WIDTH_DEGREES || height > MAX_VIEWPORT_HEIGHT_DEGREES) {
    throw new Error('bbox is too large for map aggregation');
  }

  return {
    bbox: viewport.bbox,
    zoom: viewport.zoom,
    state: readOptionalString(req.query.state)?.toUpperCase(),
    specialty: readOptionalString(req.query.specialty),
    limit: readLimit(req.query.limit, 500, 2_000),
    minMomentumScore: readOptionalNumber(req.query.minMomentumScore),
    minWeight: readOptionalNumber(req.query.minWeight),
  };
}

function handleMapError(res: Response, error: unknown, message: string, event: string): void {
  const detail = error instanceof Error ? error.message : String(error);
  const status = /bbox|zoom|required/i.test(detail) ? 400 : 500;

  if (status >= 500) {
    log('error', event, { error: detail });
  }

  res.status(status).json({
    error: message,
    detail,
  });
}

export function registerMapRoutes(app: Express): void {
  app.get('/api/map/institutions', async (req: Request, res: Response) => {
    try {
      const response = await getMapInstitutions(parseMapQuery(req));
      res.json(response);
    } catch (error) {
      handleMapError(res, error, 'Failed to load map institutions', 'geospatial.map_institutions_failed');
    }
  });

  app.get('/api/map/clusters', async (req: Request, res: Response) => {
    try {
      const response = await getMapClusters(parseMapQuery(req));
      res.json(response);
    } catch (error) {
      handleMapError(res, error, 'Failed to load map clusters', 'geospatial.map_clusters_failed');
    }
  });

  app.get('/api/map/shortages', async (req: Request, res: Response) => {
    try {
      const response = await getMapShortages(parseMapQuery(req));
      res.json(response);
    } catch (error) {
      handleMapError(res, error, 'Failed to load map shortages', 'geospatial.map_shortages_failed');
    }
  });

  app.get('/api/map/network', async (req: Request, res: Response) => {
    try {
      const response = await getMapNetwork(parseMapQuery(req));
      res.json(response);
    } catch (error) {
      handleMapError(res, error, 'Failed to load map network', 'geospatial.map_network_failed');
    }
  });
}
