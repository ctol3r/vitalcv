import type { Express, Request, Response } from 'express';
import {
  strategyImpactLevelSchema,
  strategyInsightTypeSchema,
  strategyListResponseSchema,
} from '../services/strategy/contracts';
import {
  listInstitutionStrategyInsights,
  listNetworkStrategyInsights,
  listProviderStrategyInsights,
  listSpecialtyStrategyInsights,
  listStrategyInsights,
  type StrategyListQuery,
} from '../services/strategy/strategyEngineService';
import { log } from '../obs/logger';

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

function readLimit(value: unknown): number | undefined {
  const raw = readQueryValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return Math.min(parsed, 100);
}

function readConfidence(value: unknown): number | undefined {
  const raw = readQueryValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.max(0, Math.min(parsed, 1));
}

function readSync(value: unknown): boolean {
  return readQueryValue(value) === 'true';
}

function strategyQuery(req: Request): StrategyListQuery {
  const type = readQueryValue(req.query.type);
  const impactLevel = readQueryValue(req.query.impactLevel);
  const entityType = readQueryValue(req.query.entityType);

  return {
    type: type && strategyInsightTypeSchema.safeParse(type).success
      ? strategyInsightTypeSchema.parse(type)
      : undefined,
    impactLevel: impactLevel && strategyImpactLevelSchema.safeParse(impactLevel).success
      ? strategyImpactLevelSchema.parse(impactLevel)
      : undefined,
    confidence: readConfidence(req.query.confidence),
    entityType,
    limit: readLimit(req.query.limit),
    sync: readSync(req.query.sync),
  };
}

function respond(
  res: Response,
  payload: Awaited<ReturnType<typeof listStrategyInsights>>,
  filters: StrategyListQuery,
) {
  res.json(strategyListResponseSchema.parse({
    insights: payload.insights,
    total: payload.total,
    generatedAt: payload.generatedAt,
    filters: {
      type: filters.type,
      impactLevel: filters.impactLevel,
      confidence: filters.confidence,
      entityType: filters.entityType,
      limit: filters.limit,
    },
    summary: payload.summary,
  }));
}

export function registerStrategyRoutes(app: Express): void {
  app.get('/api/strategy', async (req: Request, res: Response) => {
    const filters = strategyQuery(req);

    try {
      const result = await listStrategyInsights(filters);
      respond(res, result, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_list_failed', { error: message });
      res.status(500).json({ error: 'Failed to load strategy insights', detail: message });
    }
  });

  app.get('/api/strategy/providers/:id', async (req: Request, res: Response) => {
    const filters = strategyQuery(req);

    try {
      const result = await listProviderStrategyInsights(req.params.id, filters);
      respond(res, result, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_provider_failed', { providerId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to load provider strategy insights', detail: message });
    }
  });

  app.get('/api/strategy/institutions/:id', async (req: Request, res: Response) => {
    const filters = strategyQuery(req);

    try {
      const result = await listInstitutionStrategyInsights(req.params.id, filters);
      respond(res, result, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_institution_failed', { institutionId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to load institution strategy insights', detail: message });
    }
  });

  app.get('/api/strategy/specialties/:slug', async (req: Request, res: Response) => {
    const filters = strategyQuery(req);

    try {
      const result = await listSpecialtyStrategyInsights(req.params.slug, filters);
      respond(res, result, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_specialty_failed', { specialty: req.params.slug, error: message });
      res.status(500).json({ error: 'Failed to load specialty strategy insights', detail: message });
    }
  });

  app.get('/api/strategy/networks/:id', async (req: Request, res: Response) => {
    const filters = strategyQuery(req);

    try {
      const result = await listNetworkStrategyInsights(req.params.id, filters);
      respond(res, result, filters);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_network_failed', { networkId: req.params.id, error: message });
      res.status(500).json({ error: 'Failed to load network strategy insights', detail: message });
    }
  });
}
