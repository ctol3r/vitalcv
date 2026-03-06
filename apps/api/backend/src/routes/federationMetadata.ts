/**
 * federationMetadata.ts routes — Wave 113: OpenID Federation API
 *
 * GET  /api/federation/entity/:id       — Fetch entity configuration
 * GET  /api/federation/trust/:id        — Validate federation trust for entity
 * POST /api/federation/entity           — Register/cache a new entity config
 * GET  /api/federation/entities         — List all cached entities
 * GET  /.well-known/openid-federation   — VitalCV's own entity configuration
 */

import type { Express, Request, Response } from 'express';
import {
  fetchEntityConfiguration,
  validateFederationTrust,
  cacheFederationMetadata,
  listFederationEntities,
  buildVitalCVEntityConfiguration,
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
}
