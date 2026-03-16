import type { Express, Request, Response } from 'express';
import {
  getPredictionSummaryForEntity,
  listPredictionInsights,
  refreshPredictionInsights,
  type PredictionQuery,
} from '../services/predictions/predictionEngineService';
import { predictionListResponseSchema, predictionSummarySchema } from '../services/predictions/contracts';
import { buildPredictionSurfaceForEntity } from '../services/intelligenceLayer/intelligenceLayerService';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function readString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return first?.trim();
  }

  return undefined;
}

function readNumber(value: unknown): number | undefined {
  const raw = readString(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(value: unknown): boolean {
  return readString(value) !== 'false';
}

function predictionQueryFromRequest(req: Request): PredictionQuery {
  return {
    type: readString(req.query.type),
    entityType: readString(req.query.entityType),
    state: readString(req.query.state),
    confidence: readNumber(req.query.confidence),
    updatedAt: readString(req.query.updatedAt),
    limit: readNumber(req.query.limit),
    offset: readNumber(req.query.offset),
    sync: readBoolean(req.query.sync),
  };
}

export function registerPredictionRoutes(app: Express): void {
  app.get('/api/predictions', async (req: Request, res: Response) => {
    try {
      const query = predictionQueryFromRequest(req);
      const result = await listPredictionInsights(query);
      res.json(predictionListResponseSchema.parse({
        schema: 'https://vitalcv.com/predictions/v2',
        predictions: result.predictions,
        total: result.total,
        limit: Math.min(Math.max(query.limit ?? 50, 1), 200),
        offset: Math.max(query.offset ?? 0, 0),
        syncedAt: result.syncedAt,
      }));
    } catch (error) {
      log('error', 'predictions.list', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to list predictions' });
    }
  });

  app.get('/api/predictions/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!NPI_RE.test(providerId)) {
        return res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
      }

      const [result, predictionSummary] = await Promise.all([
        listPredictionInsights({
          ...predictionQueryFromRequest(req),
          entityType: 'provider',
          entityId: providerId,
        }),
        getPredictionSummaryForEntity('provider', providerId, { sync: readBoolean(req.query.sync) }),
      ]);
      const surface = await buildPredictionSurfaceForEntity('provider', providerId);

      res.json({
        schema: 'https://vitalcv.com/predictions/provider/v2',
        provider: {
          id: providerId,
          predictionSummary: predictionSummarySchema.parse(predictionSummary),
        },
        predictions: result.predictions,
        total: result.total,
        syncedAt: result.syncedAt,
        intelligence: {
          trajectories: surface.trajectories,
          networkChanges: surface.networkChanges,
          correlations: surface.correlations,
          coverage: surface.coverage,
          signalHistory: surface.signalHistory,
        },
      });
    } catch (error) {
      log('error', 'predictions.provider', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to load provider predictions' });
    }
  });

  app.get('/api/predictions/institutions/:id', async (req: Request, res: Response) => {
    try {
      const institutionId = req.params.id.trim().toLowerCase();
      const [result, predictionSummary] = await Promise.all([
        listPredictionInsights({
          ...predictionQueryFromRequest(req),
          entityType: 'institution',
          entityId: institutionId,
        }),
        getPredictionSummaryForEntity('institution', institutionId, { sync: readBoolean(req.query.sync) }),
      ]);
      const surface = await buildPredictionSurfaceForEntity('institution', institutionId);

      res.json({
        schema: 'https://vitalcv.com/predictions/institution/v2',
        institution: {
          id: institutionId,
          predictionSummary: predictionSummarySchema.parse(predictionSummary),
        },
        predictions: result.predictions,
        total: result.total,
        syncedAt: result.syncedAt,
        intelligence: {
          trajectories: surface.trajectories,
          networkChanges: surface.networkChanges,
          correlations: surface.correlations,
          signalHistory: surface.signalHistory,
        },
      });
    } catch (error) {
      log('error', 'predictions.institution', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to load institution predictions' });
    }
  });

  app.get('/api/predictions/specialties/:slug', async (req: Request, res: Response) => {
    try {
      const specialtyId = req.params.slug.trim().toLowerCase();
      const [result, predictionSummary] = await Promise.all([
        listPredictionInsights({
          ...predictionQueryFromRequest(req),
          type: 'SPECIALTY_PRESSURE',
          entityType: 'specialty',
          entityId: specialtyId,
        }),
        getPredictionSummaryForEntity('specialty', specialtyId, { sync: readBoolean(req.query.sync) }),
      ]);
      const surface = await buildPredictionSurfaceForEntity('specialty', specialtyId);

      res.json({
        schema: 'https://vitalcv.com/predictions/specialty/v2',
        specialty: {
          slug: specialtyId,
          predictionSummary: predictionSummarySchema.parse(predictionSummary),
        },
        predictions: result.predictions,
        total: result.total,
        syncedAt: result.syncedAt,
        intelligence: {
          trajectories: surface.trajectories,
          networkChanges: surface.networkChanges,
          correlations: surface.correlations,
          signalHistory: surface.signalHistory,
        },
      });
    } catch (error) {
      log('error', 'predictions.specialty', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to load specialty predictions' });
    }
  });

  app.get('/api/predictions/network/:id', async (req: Request, res: Response) => {
    try {
      const entityId = req.params.id.trim();
      const [result, predictionSummary] = await Promise.all([
        listPredictionInsights({
          ...predictionQueryFromRequest(req),
          type: 'NETWORK_SHIFT',
          entityId,
        }),
        getPredictionSummaryForEntity('provider', entityId, { sync: readBoolean(req.query.sync) }),
      ]);

      res.json({
        schema: 'https://vitalcv.com/predictions/network/v2',
        network: {
          id: entityId,
          predictionSummary: predictionSummarySchema.parse(predictionSummary),
        },
        predictions: result.predictions,
        total: result.total,
        syncedAt: result.syncedAt,
      });
    } catch (error) {
      log('error', 'predictions.network', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to load network predictions' });
    }
  });

  app.post('/api/predictions/refresh', async (_req: Request, res: Response) => {
    try {
      const predictions = await refreshPredictionInsights();
      res.json({
        schema: 'https://vitalcv.com/predictions/refresh/v2',
        refreshed: predictions.length,
        predictions,
      });
    } catch (error) {
      log('error', 'predictions.refresh', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to refresh predictions' });
    }
  });

  app.get('/api/predictions/summary', async (req: Request, res: Response) => {
    try {
      const result = await listPredictionInsights({
        sync: readBoolean(req.query.sync),
        limit: 500,
        offset: 0,
      });
      const topPrediction = result.predictions[0] ?? null;
      const byType = new Map<string, number>();
      const byState = new Map<string, number>();

      for (const prediction of result.predictions) {
        byType.set(prediction.type, (byType.get(prediction.type) ?? 0) + 1);
        byState.set(prediction.state, (byState.get(prediction.state) ?? 0) + 1);
      }

      res.json({
        schema: 'https://vitalcv.com/predictions/summary/v2',
        total: result.total,
        syncedAt: result.syncedAt,
        topPrediction,
        byType: [...byType.entries()].map(([type, count]) => ({ type, count })),
        byState: [...byState.entries()].map(([state, count]) => ({ state, count })),
      });
    } catch (error) {
      log('error', 'predictions.summary', { error: error instanceof Error ? error.message : 'unknown' });
      res.status(500).json({ error: 'Failed to load prediction summary' });
    }
  });
}
