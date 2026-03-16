import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  buildInstitutionIntelligenceAggregate,
  buildNetworkIntelligenceAggregate,
  buildProviderIntelligenceAggregate,
  buildSpecialtyIntelligenceAggregate,
} from '../services/intelligence/intelligenceAggregateService';
import { listIntelligenceFeed } from '../services/intelligence/intelligenceFeedService';

const NPI_RE = /^\d{10}$/;

function readLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 200);
}

function readIncludeTypes(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function registerIntelligenceAggregateRoutes(app: Express): void {
  app.get('/api/intelligence/feed', async (req: Request, res: Response) => {
    try {
      const entityType = typeof req.query.entityType === 'string' ? req.query.entityType.trim() : undefined;
      const entityId = typeof req.query.entityId === 'string' ? req.query.entityId.trim() : undefined;
      const feed = await listIntelligenceFeed({
        entityType,
        entityId,
        includeTypes: readIncludeTypes(req.query.includeTypes),
        limit: readLimit(typeof req.query.limit === 'string' ? req.query.limit : undefined, 40),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/feed/v1',
        generatedAt: feed.generatedAt,
        items: feed.items,
        total: feed.items.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.feed_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load intelligence feed', detail });
    }
  });

  app.get('/api/intelligence/aggregates/providers/:npi', async (req: Request, res: Response) => {
    try {
      const npi = req.params.npi.trim();
      if (!NPI_RE.test(npi)) {
        return res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
      }

      const aggregate = await buildProviderIntelligenceAggregate(npi);
      res.json({
        schema: 'https://vitalcv.com/intelligence/aggregate/provider/v1',
        aggregate,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.aggregate_provider_failed', { error: detail });
      res.status(500).json({ error: 'Failed to build provider aggregate', detail });
    }
  });

  app.get('/api/intelligence/aggregates/institutions/:id', async (req: Request, res: Response) => {
    try {
      const aggregate = await buildInstitutionIntelligenceAggregate(req.params.id.trim().toLowerCase());
      res.json({
        schema: 'https://vitalcv.com/intelligence/aggregate/institution/v1',
        aggregate,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.aggregate_institution_failed', { error: detail });
      res.status(500).json({ error: 'Failed to build institution aggregate', detail });
    }
  });

  app.get('/api/intelligence/aggregates/specialties/:id', async (req: Request, res: Response) => {
    try {
      const aggregate = await buildSpecialtyIntelligenceAggregate(req.params.id.trim().toLowerCase());
      res.json({
        schema: 'https://vitalcv.com/intelligence/aggregate/specialty/v1',
        aggregate,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.aggregate_specialty_failed', { error: detail });
      res.status(500).json({ error: 'Failed to build specialty aggregate', detail });
    }
  });

  app.get('/api/intelligence/aggregates/network/:id', async (req: Request, res: Response) => {
    try {
      const aggregate = await buildNetworkIntelligenceAggregate(req.params.id.trim());
      res.json({
        schema: 'https://vitalcv.com/intelligence/aggregate/network/v1',
        aggregate,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.aggregate_network_failed', { error: detail });
      res.status(500).json({ error: 'Failed to build network aggregate', detail });
    }
  });
}
