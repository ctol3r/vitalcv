/**
 * providers.ts — Wave 119: Provider Data Integrity Fabric
 *
 * GET /api/providers                        — Structured provider listing (NPI + name only)
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
import prisma from '../graphql/prisma_client';

const VALID_CONNECTORS: ConnectorId[] = ['NPPES', 'STATE_BOARD', 'OIG', 'ABMS', 'CAQH', 'NPDB'];

/**
 * P0.1 containment — the public listing publishes NPI and name only.
 *
 * `Provider` rows carry no provenance columns, so the route cannot show which
 * stored value came from a source. For the rows currently in production the
 * stored values are demonstrably not source-backed: every row shares
 * taxonomyCode `207R00000X` and providerType `Individual` (including two NPPES
 * NPI-2 organizations), and stateOfPractice disagrees with the NPPES practice
 * location on 9 of 10 rows. Publishing those fields asserts facts about real,
 * named clinicians that VitalCV cannot stand behind, so they are withheld
 * until a provenance-carrying read path exists.
 *
 * Nothing is substituted in their place — a withheld field is absent, and
 * `fieldsWithheld` names it so a caller can tell "withheld" from "empty".
 */
const WITHHELD_PROVIDER_FIELDS = [
  'providerType',
  'specialty',
  'taxonomyCode',
  'stateOfPractice',
  'affiliations',
] as const;

const WITHHELD_DISCLOSURE =
  'This listing publishes NPI and name only. Provider type, specialty, taxonomy and practice '
  + 'location are withheld because the stored values are not source-backed. Absent fields are '
  + 'withheld, not empty.';

function readQueryValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveInt(value: unknown, fallback: number, max: number): number {
  const raw = readQueryValue(value);
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

/**
 * Reachable unauthenticated on the backend's own public domain, so the web
 * proxy's headers do not cover it. Without an explicit directive an
 * intermediary may cache heuristically and keep serving a stale payload.
 */
function noStore(_req: Request, res: Response, next: () => void): void {
  res.set('Cache-Control', 'no-store');
  next();
}

export function registerProviderRoutes(app: Express): void {
  app.use('/api/providers', noStore);

  app.get('/api/providers', async (req: Request, res: Response) => {
    const limit = readPositiveInt(req.query.limit, 50, 100);
    const offset = readPositiveInt(req.query.offset, 0, 10_000);
    const query = readQueryValue(req.query.q);
    // Search only spans the published fields. Matching on a withheld column
    // would turn `?q=` into an oracle that recovers the value we refuse to
    // print — narrowing the filter is part of the containment, not a UX tweak.
    const providerWhere = query
      ? {
          OR: [
            { npi: { contains: query } },
            { fullName: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    try {
      const [total, providerRows] = await Promise.all([
        prisma.provider.count({ where: providerWhere }),
        prisma.provider.findMany({
          where: providerWhere,
          orderBy: { npi: 'asc' },
          skip: offset,
          take: limit,
          select: {
            npi: true,
            fullName: true,
          },
        }),
      ]);

      const providers = providerRows.map((provider) => ({
        npi: provider.npi,
        fullName: provider.fullName,
      }));

      res.json({
        schema: 'https://vitalcv.com/providers/v2',
        count: providers.length,
        total,
        providers,
        fieldsWithheld: [...WITHHELD_PROVIDER_FIELDS],
        disclosure: WITHHELD_DISCLOSURE,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'providers: list failed', { error: message, query, limit, offset });
      res.status(500).json({ error: 'Failed to list providers', detail: message });
    }
  });

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
