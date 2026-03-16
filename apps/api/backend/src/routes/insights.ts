import type { Express, Request, Response } from 'express';
import {
  listInstitutionInsights,
  listProviderInsights,
  listSpecialtyInsights,
} from '../services/intelligence/providerIntelligenceService';
import { log } from '../obs/logger';

function readLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, 100);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readSync(value: unknown): boolean {
  return value !== 'false';
}

export function registerIntelligenceInsightRoutes(app: Express): void {
  app.get('/api/insights/providers', async (req: Request, res: Response) => {
    try {
      const result = await listProviderInsights({
        sync: readSync(req.query.sync),
        limit: readLimit(req.query.limit, 25),
      });

      res.json({
        schema: 'https://vitalcv.com/insights/providers/v1',
        generatedAt: result.generatedAt,
        connectors: result.connectors,
        insights: result.insights,
        total: result.insights.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'insights.providers_failed', { error: message });
      res.status(500).json({ error: 'Failed to load provider insights', detail: message });
    }
  });

  app.get('/api/insights/specialties', async (req: Request, res: Response) => {
    try {
      const result = await listSpecialtyInsights({
        sync: readSync(req.query.sync),
        limit: readLimit(req.query.limit, 25),
        severity: readString(req.query.severity),
      });

      res.json({
        schema: 'https://vitalcv.com/insights/specialties/v1',
        generatedAt: result.generatedAt,
        connectors: result.connectors,
        insights: result.insights,
        total: result.insights.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'insights.specialties_failed', { error: message });
      res.status(500).json({ error: 'Failed to load specialty insights', detail: message });
    }
  });

  app.get('/api/insights/institutions', async (req: Request, res: Response) => {
    try {
      const result = await listInstitutionInsights({
        sync: readSync(req.query.sync),
        limit: readLimit(req.query.limit, 25),
        state: readString(req.query.state),
      });

      res.json({
        schema: 'https://vitalcv.com/insights/institutions/v1',
        generatedAt: result.generatedAt,
        connectors: result.connectors,
        insights: result.insights,
        total: result.insights.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'insights.institutions_failed', { error: message });
      res.status(500).json({ error: 'Failed to load institution insights', detail: message });
    }
  });
}
