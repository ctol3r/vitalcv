/**
 * providers.ts — Wave 119: Provider Data Integrity Fabric
 *
 * GET /api/providers/health                 — Smoke test all connectors
 * GET /api/providers/health/diagnostics     — Connector diagnostics + recommendations
 * GET /api/providers/health/alerts          — Recent connector alerts
 * GET /api/providers/health/:connector      — Smoke test single connector
 * GET /api/providers/provenance/:npi        — Provenance chain for an NPI
 * GET /api/providers/provenance/health      — Provenance freshness summary
 */

import type { Express, Request, Response } from 'express';
import { runProviderSmokeTests, runSingleSmokeTest, type ConnectorId } from '../services/providers/providerSmokeTest';
import { getProvenanceChain, getProvenanceHealth } from '../services/providers/providerSourceProvenance';
import { getConnectorAlerts, getConnectorDiagnostics } from '../services/providers/connectors/connectorHealthTracker';
import { log } from '../obs/logger';
import { buildProviderInvestigationPayload } from '../services/investigation/investigationWorkbenchService';

const VALID_CONNECTORS: ConnectorId[] = ['NPPES', 'STATE_BOARD', 'OIG', 'ABMS', 'CAQH', 'NPDB'];

export function registerProviderRoutes(app: Express): void {
  app.get('/api/providers/health', async (_req: Request, res: Response) => {
    try {
      const suite = await runProviderSmokeTests();
      res.json(suite);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'providers: smoke test failed', { error: msg });
      res.status(500).json({ error: 'Smoke test suite failed' });
    }
  });

  app.get('/api/providers/health/diagnostics', (_req: Request, res: Response) => {
    try {
      res.json(getConnectorDiagnostics());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'providers: diagnostics failed', { error: msg });
      res.status(500).json({ error: 'Diagnostics failed' });
    }
  });

  app.get('/api/providers/health/alerts', (_req: Request, res: Response) => {
    try {
      res.json({
        alerts: getConnectorAlerts(50),
        reportedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'providers: alerts failed', { error: msg });
      res.status(500).json({ error: 'Alert retrieval failed' });
    }
  });

  app.get('/api/providers/health/:connector', async (req: Request, res: Response) => {
    const connector = req.params.connector?.toUpperCase() as ConnectorId;
    if (!VALID_CONNECTORS.includes(connector)) {
      res.status(400).json({ error: `Invalid connector. Valid: ${VALID_CONNECTORS.join(', ')}` });
      return;
    }
    try {
      const result = await runSingleSmokeTest(connector);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'providers: single smoke test failed', { connector, error: msg });
      res.status(500).json({ error: 'Smoke test failed' });
    }
  });

  app.get('/api/providers/provenance/health', (_req: Request, res: Response) => {
    res.json(getProvenanceHealth());
  });

  app.get('/api/providers/provenance/:npi', (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || npi.length !== 10) {
      res.status(400).json({ error: 'Valid 10-digit NPI required' });
      return;
    }
    res.json(getProvenanceChain(npi));
  });

  app.get('/api/providers/:id/investigation', async (req: Request, res: Response) => {
    const providerId = req.params.id.trim();
    if (!/^\d{10}$/.test(providerId)) {
      res.status(400).json({ error: 'Provider investigation requires a 10-digit NPI' });
      return;
    }

    try {
      res.json({
        schema: 'https://vitalcv.com/providers/investigation/v1',
        ...(await buildProviderInvestigationPayload(providerId)),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      log('error', 'providers: investigation failed', { providerId, error: detail });
      res.status(500).json({ error: 'Failed to build provider investigation', detail });
    }
  });
}
