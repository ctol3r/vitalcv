import type { Express, Request, Response } from 'express';
import { refreshPredictionInsights } from '../services/predictions/predictionEngineService';
import {
  buildPredictionSurfaceForEntity,
  createIntelligenceWatch,
  deleteIntelligenceWatch,
  detectProviderTrajectories,
  getIntelligenceWatch,
  getProviderCoverageScore,
  listIntelligenceFeed,
  listIntelligenceWatches,
  listNetworkChanges,
  listSignalCorrelations,
  listSignalHistory,
} from '../services/intelligenceLayer/intelligenceLayerService';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function readLimit(value: unknown, fallback = 25): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : fallback;
}

function readBoolean(value: unknown): boolean {
  return value !== 'false';
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function maybeSync(sync: boolean): Promise<void> {
  if (!sync) {
    return;
  }

  await refreshPredictionInsights();
}

export function registerIntelligenceLayerRoutes(app: Express): void {
  app.get('/api/intelligence/feed', async (req: Request, res: Response) => {
    try {
      await maybeSync(readBoolean(req.query.sync));
      const feed = await listIntelligenceFeed({
        entityType: readString(req.query.entityType),
        entityId: readString(req.query.entityId),
        limit: readLimit(req.query.limit, 50),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence-feed/v1',
        total: feed.length,
        items: feed,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.feed_failed', { error: message });
      res.status(500).json({ error: 'Failed to load intelligence feed', detail: message });
    }
  });

  app.get('/api/intelligence/signals/:entityType/:entityId/history', async (req: Request, res: Response) => {
    try {
      await maybeSync(readBoolean(req.query.sync));
      const history = await listSignalHistory({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        signalType: readString(req.query.signalType) as Parameters<typeof listSignalHistory>[0]['signalType'],
        limit: readLimit(req.query.limit, 40),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence-signal-history/v1',
        count: history.length,
        history,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.signal_history_failed', { error: message });
      res.status(500).json({ error: 'Failed to load signal history', detail: message });
    }
  });

  app.get('/api/intelligence/trajectories/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!NPI_RE.test(providerId)) {
        return res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
      }

      await maybeSync(readBoolean(req.query.sync));
      const trajectories = await detectProviderTrajectories(providerId);
      res.json({
        schema: 'https://vitalcv.com/provider-trajectories/v1',
        providerId,
        trajectories,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.trajectories_failed', { error: message });
      res.status(500).json({ error: 'Failed to load provider trajectories', detail: message });
    }
  });

  app.get('/api/intelligence/network-changes', async (req: Request, res: Response) => {
    try {
      await maybeSync(readBoolean(req.query.sync));
      const changes = await listNetworkChanges({
        entityType: readString(req.query.entityType),
        entityId: readString(req.query.entityId),
        limit: readLimit(req.query.limit, 25),
      });

      res.json({
        schema: 'https://vitalcv.com/network-changes/v1',
        total: changes.length,
        changes,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.network_changes_failed', { error: message });
      res.status(500).json({ error: 'Failed to load network changes', detail: message });
    }
  });

  app.get('/api/intelligence/coverage/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!NPI_RE.test(providerId)) {
        return res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
      }

      await maybeSync(readBoolean(req.query.sync));
      const coverage = await getProviderCoverageScore(providerId);
      res.json({
        schema: 'https://vitalcv.com/provider-coverage/v1',
        providerId,
        coverage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.coverage_failed', { error: message });
      res.status(500).json({ error: 'Failed to load provider coverage', detail: message });
    }
  });

  app.get('/api/intelligence/correlations', async (req: Request, res: Response) => {
    try {
      await maybeSync(readBoolean(req.query.sync));
      const correlations = await listSignalCorrelations({
        entityType: readString(req.query.entityType),
        entityId: readString(req.query.entityId),
        limit: readLimit(req.query.limit, 25),
      });

      res.json({
        schema: 'https://vitalcv.com/signal-correlations/v1',
        total: correlations.length,
        correlations,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.correlations_failed', { error: message });
      res.status(500).json({ error: 'Failed to load signal correlations', detail: message });
    }
  });

  app.get('/api/watch', async (_req: Request, res: Response) => {
    try {
      const watches = await listIntelligenceWatches();
      res.json({
        schema: 'https://vitalcv.com/watch/v1',
        total: watches.length,
        watches,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.watch_list_failed', { error: message });
      res.status(500).json({ error: 'Failed to load watch targets', detail: message });
    }
  });

  app.post('/api/watch', async (req: Request, res: Response) => {
    try {
      const { name, ownerOrganizationId, targetType, targetValue, subscribedSignals } = req.body ?? {};
      if (
        targetType !== 'provider'
        && targetType !== 'institution'
        && targetType !== 'specialty'
        && targetType !== 'network_cluster'
      ) {
        return res.status(400).json({ error: 'targetType must be provider, institution, specialty, or network_cluster' });
      }
      if (typeof targetValue !== 'string' || targetValue.trim().length === 0) {
        return res.status(400).json({ error: 'targetValue is required' });
      }
      if (targetType === 'provider' && !NPI_RE.test(targetValue.trim())) {
        return res.status(400).json({ error: 'Provider watch targets must use a 10-digit NPI' });
      }

      const watch = await createIntelligenceWatch({
        name: typeof name === 'string' ? name : undefined,
        ownerOrganizationId: typeof ownerOrganizationId === 'string' ? ownerOrganizationId : null,
        targetType,
        targetValue,
        subscribedSignals: Array.isArray(subscribedSignals)
          ? subscribedSignals.filter((entry): entry is string => typeof entry === 'string')
          : undefined,
      });

      res.status(201).json({
        schema: 'https://vitalcv.com/watch/v1',
        watch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.watch_create_failed', { error: message });
      res.status(500).json({ error: 'Failed to create watch target', detail: message });
    }
  });

  app.get('/api/watch/:id', async (req: Request, res: Response) => {
    try {
      await maybeSync(readBoolean(req.query.sync));
      const watch = await getIntelligenceWatch(req.params.id);
      if (!watch) {
        return res.status(404).json({ error: 'Watch target not found' });
      }

      res.json({
        schema: 'https://vitalcv.com/watch-detail/v1',
        watch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.watch_detail_failed', { error: message });
      res.status(500).json({ error: 'Failed to load watch target', detail: message });
    }
  });

  app.delete('/api/watch/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await deleteIntelligenceWatch(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Watch target not found' });
      }

      res.status(204).send();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.watch_delete_failed', { error: message });
      res.status(500).json({ error: 'Failed to delete watch target', detail: message });
    }
  });

  app.get('/api/intelligence/predictions/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!NPI_RE.test(providerId)) {
        return res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
      }

      await maybeSync(readBoolean(req.query.sync));
      const surface = await buildPredictionSurfaceForEntity('provider', providerId);
      res.json({
        schema: 'https://vitalcv.com/provider-prediction-surface/v1',
        providerId,
        ...surface,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'intelligence_layer.provider_prediction_surface_failed', { error: message });
      res.status(500).json({ error: 'Failed to load provider prediction surface', detail: message });
    }
  });
}
