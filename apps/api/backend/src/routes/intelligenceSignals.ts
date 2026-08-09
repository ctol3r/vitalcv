import type { Express, Request, Response } from 'express';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';
import {
  buildIntelligenceFeed,
  getGeographyPressureIndex,
  getInstitutionMomentumIndex,
  getProviderInfluenceScore,
  getProviderIntelligenceSummary,
  getProviderTrustScore,
  getSpecialtyPressureIndex,
  listGeographyPressureIndexes,
  listInstitutionMomentumIndexes,
  listProviderInfluenceScores,
  listSpecialtyPressureIndexes,
} from '../services/intelligence/intelligenceSignalsService';

const NPI_RE = /^\d{10}$/;

function readBoolean(value: unknown): boolean {
  return value !== 'false';
}

function readLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function validateProviderId(res: Response, id: string): boolean {
  if (!NPI_RE.test(id)) {
    res.status(400).json({ error: 'Provider id must be a 10-digit NPI' });
    return false;
  }

  return true;
}

export function registerIntelligenceSignalRoutes(app: Express): void {
  app.get('/api/trust/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!validateProviderId(res, providerId)) {
        return;
      }

      const trust = await getProviderTrustScore(providerId, {
        sync: readBoolean(req.query.sync),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/trust/provider/v1',
        trust,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.trust_provider_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load provider trust score', detail });
    }
  });

  /**
   * AUTHORIZATION (2026-08-08). Reachable by any anonymous caller who set
   * `x-org-id` to any value — behind the global tenant guard, which accepted
   * mere PRESENCE of a caller-supplied org id, and this route never reads it.
   * Measured in production: 25 providers, 22 with check-digit-valid NPIs (real
   * registrants), each with a display label, influence score, percentile, tier
   * and rank. A public ranking of named clinicians that nobody consented to.
   *
   * No caller exists anywhere in the repo. Operator secret is the fail-closed
   * holding position; a product surface would warrant a verified session.
   */
  app.get('/api/influence/providers', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const result = await listProviderInfluenceScores({
        sync: readBoolean(req.query.sync),
        limit: readLimit(req.query.limit, 25, 500),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/influence/providers/v1',
        generatedAt: result.generatedAt,
        scores: result.scores,
        total: result.scores.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.provider_influence_list_failed', { error: detail });
      res.status(500).json({ error: 'Failed to list provider influence scores', detail });
    }
  });

  app.get('/api/influence/providers/:id', async (req: Request, res: Response) => {
    try {
      const providerId = req.params.id.trim();
      if (!validateProviderId(res, providerId)) {
        return;
      }

      const influence = await getProviderInfluenceScore(providerId, {
        sync: readBoolean(req.query.sync),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/influence/provider/v1',
        influence,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.provider_influence_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load provider influence score', detail });
    }
  });

  app.get('/api/pressure/specialties', async (req: Request, res: Response) => {
    try {
      const result = await listSpecialtyPressureIndexes({
        sync: readBoolean(req.query.sync),
        limit: readLimit(req.query.limit, 50, 500),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/pressure/specialties/v1',
        generatedAt: result.generatedAt,
        specialties: result.specialties,
        total: result.specialties.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.specialty_pressure_list_failed', { error: detail });
      res.status(500).json({ error: 'Failed to list specialty pressure indexes', detail });
    }
  });

  app.get('/api/pressure/specialties/:slug', async (req: Request, res: Response) => {
    try {
      const pressure = await getSpecialtyPressureIndex(req.params.slug.trim(), {
        sync: readBoolean(req.query.sync),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/pressure/specialty/v1',
        pressure,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.specialty_pressure_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load specialty pressure index', detail });
    }
  });

  app.get('/api/pressure/geography', async (req: Request, res: Response) => {
    try {
      const result = await listGeographyPressureIndexes({
        limit: readLimit(req.query.limit, 50, 500),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/pressure/geography/v1',
        generatedAt: result.generatedAt,
        geographies: result.geographies,
        total: result.geographies.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.geography_pressure_list_failed', { error: detail });
      res.status(500).json({ error: 'Failed to list geography pressure indexes', detail });
    }
  });

  app.get('/api/pressure/geography/:id', async (req: Request, res: Response) => {
    try {
      const pressure = await getGeographyPressureIndex(req.params.id.trim());
      res.json({
        schema: 'https://vitalcv.com/intelligence/pressure/geography-entity/v1',
        pressure,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.geography_pressure_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load geography pressure index', detail });
    }
  });

  app.get('/api/institutions/:id/momentum', async (req: Request, res: Response) => {
    try {
      const momentum = await getInstitutionMomentumIndex(req.params.id.trim(), {
        sync: readBoolean(req.query.sync),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/institution-momentum/v1',
        momentum,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.institution_momentum_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load institution momentum', detail });
    }
  });

  app.get('/api/institutions/momentum', async (req: Request, res: Response) => {
    try {
      const result = await listInstitutionMomentumIndexes({
        sync: readBoolean(req.query.sync),
        limit: readLimit(req.query.limit, 50, 500),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/institutions/momentum/v1',
        generatedAt: result.generatedAt,
        institutions: result.institutions,
        total: result.institutions.length,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.institution_momentum_list_failed', { error: detail });
      res.status(500).json({ error: 'Failed to list institution momentum indexes', detail });
    }
  });

  app.get('/api/provider-intelligence/:npi', async (req: Request, res: Response) => {
    try {
      const npi = req.params.npi.trim();
      if (!validateProviderId(res, npi)) {
        return;
      }

      const summary = await getProviderIntelligenceSummary(npi, {
        sync: readBoolean(req.query.sync),
        limit: readLimit(req.query.limit, 20, 50),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/provider/v1',
        ...summary,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.provider_summary_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load provider intelligence summary', detail });
    }
  });

  app.get('/api/provider-intelligence/:npi/feed', async (req: Request, res: Response) => {
    try {
      const npi = req.params.npi.trim();
      if (!validateProviderId(res, npi)) {
        return;
      }

      const feed = await buildIntelligenceFeed({
        providerNpi: npi,
        sync: readBoolean(req.query.sync),
        limit: readLimit(req.query.limit, 25, 100),
      });

      res.json({
        schema: 'https://vitalcv.com/intelligence/provider-feed/v1',
        ...feed,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'intelligence.provider_feed_failed', { error: detail });
      res.status(500).json({ error: 'Failed to load normalized provider intelligence feed', detail });
    }
  });
}
