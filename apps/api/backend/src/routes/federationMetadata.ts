/**
 * federationMetadata.ts routes — Wave 113 + Substrate Phase 4
 *
 * GET  /api/federation/entity/:id       — Fetch entity configuration
 * GET  /api/federation/trust/:id        — Validate federation trust for entity
 * POST /api/federation/entity           — Register/cache a new entity config
 * GET  /api/federation/entities         — List all cached entities
 * GET  /api/federation/health           — Network-wide federation health
 * GET  /api/federation/health/:entity   — Per-entity trust chain health
 * GET  /.well-known/openid-federation   — VitalCV's own entity configuration
 */

import type { Express, Request, Response } from 'express';
import {
  fetchEntityConfiguration,
  validateFederationTrust,
  cacheFederationMetadata,
  listFederationEntities,
  buildVitalCVEntityConfiguration,
  checkFederationHealth,
  type FederationHealthReport,
} from '../services/federation/federationMetadata';
import { log } from '../obs/logger';

export function registerFederationMetadataRoutes(app: Express): void {

  // ── GET /.well-known/openid-federation ────────────────────────────
  app.get('/.well-known/openid-federation', (_req: Request, res: Response) => {
    try {
      const config = buildVitalCVEntityConfiguration();
      res.setHeader('Content-Type', 'application/entity-statement+jwt');
      res.json(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/federation/entity/:id ────────────────────────────────
  app.get('/api/federation/entity/:id', async (req: Request, res: Response) => {
    try {
      const entityId = decodeURIComponent(req.params.id);
      const config = await fetchEntityConfiguration(entityId);
      if (!config) {
        res.status(404).json({ error: `Entity configuration not found for: ${entityId}` });
        return;
      }
      res.json(config);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_entity_fetch_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/federation/trust/:id ─────────────────────────────────
  app.get('/api/federation/trust/:id', async (req: Request, res: Response) => {
    try {
      const entityId = decodeURIComponent(req.params.id);
      const result = await validateFederationTrust(entityId);
      const status = result.trusted ? 200 : 422;
      res.status(status).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_trust_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── POST /api/federation/entity ───────────────────────────────────
  app.post('/api/federation/entity', (req: Request, res: Response) => {
    try {
      const { entityId, configuration, trustVerified, trustChainLength } = req.body ?? {};

      if (!entityId || typeof entityId !== 'string') {
        res.status(400).json({ error: 'entityId is required' });
        return;
      }
      if (!configuration || typeof configuration !== 'object') {
        res.status(400).json({ error: 'configuration object is required' });
        return;
      }

      const cached = cacheFederationMetadata(
        entityId,
        configuration,
        Boolean(trustVerified),
        typeof trustChainLength === 'number' ? trustChainLength : 0,
      );

      res.status(201).json(cached);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_entity_register_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/federation/entities ─────────────────────────────────
  app.get('/api/federation/entities', (_req: Request, res: Response) => {
    try {
      const entities = listFederationEntities();
      res.json({ entities, count: entities.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/federation/health ── Phase 4: network-wide health ────
  app.get('/api/federation/health', async (_req: Request, res: Response) => {
    try {
      const report = await checkFederationHealth();
      const httpStatus = report.overallStatus === 'healthy' ? 200
        : report.overallStatus === 'degraded' ? 207
        : 503;
      res.status(httpStatus).json(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_health_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  // ── GET /api/federation/health/:entity ── Phase 4: per-entity ─────
  app.get('/api/federation/health/:entity', async (req: Request, res: Response) => {
    try {
      const entityId = decodeURIComponent(req.params.entity);
      const report = await checkFederationHealth(entityId);
      const entityResult = report.entityResults.find((r) => r.entityId === entityId);
      if (!entityResult) {
        res.status(404).json({ error: `Entity ${entityId} not found in federation` });
        return;
      }
      res.json({
        ...entityResult,
        overallStatus: report.overallStatus,
        checkedAt: report.checkedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'federation_health_entity_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });
}
