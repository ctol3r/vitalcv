/**
 * providers.ts — Wave 119: Provider Data Integrity Fabric
 *
 * GET /api/providers                        — Structured provider listing
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
const AFFILIATION_EDGE_TYPES = [
  'affiliated_with',
  'employed_by',
  'member_of',
  'practices_at',
  'works_at',
  'credentialed_at',
] as const;

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

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    ordered.push(trimmed);
  }

  return ordered;
}

export function registerProviderRoutes(app: Express): void {
  app.get('/api/providers', async (req: Request, res: Response) => {
    const limit = readPositiveInt(req.query.limit, 50, 100);
    const offset = readPositiveInt(req.query.offset, 0, 10_000);
    const query = readQueryValue(req.query.q);
    const providerWhere = query
      ? {
          OR: [
            { npi: { contains: query } },
            { fullName: { contains: query, mode: 'insensitive' as const } },
            { providerType: { contains: query, mode: 'insensitive' as const } },
            { taxonomyCode: { contains: query, mode: 'insensitive' as const } },
            { stateOfPractice: { contains: query, mode: 'insensitive' as const } },
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
            providerType: true,
            taxonomyCode: true,
            stateOfPractice: true,
          },
        }),
      ]);

      const graphNodes = providerRows.length === 0
        ? []
        : await prisma.graphNode.findMany({
            where: {
              OR: providerRows.map((provider) => ({
                type: 'clinician',
                metadata: {
                  path: ['npi'],
                  equals: provider.npi,
                },
              })),
            },
            select: {
              id: true,
              metadata: true,
            },
          });

      const nodeByNpi = new Map<string, { id: string; metadata: Record<string, unknown> }>();
      for (const node of graphNodes) {
        const metadata = asRecord(node.metadata);
        const npi = typeof metadata.npi === 'string' ? metadata.npi : null;
        if (npi) {
          nodeByNpi.set(npi, {
            id: node.id,
            metadata,
          });
        }
      }

      const affiliationEdges = graphNodes.length === 0
        ? []
        : await prisma.graphEdge.findMany({
            where: {
              sourceNodeId: { in: graphNodes.map((node) => node.id) },
              edgeType: { in: [...AFFILIATION_EDGE_TYPES] },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              sourceNodeId: true,
              targetNode: {
                select: {
                  label: true,
                },
              },
            },
          });

      const affiliationsByNodeId = new Map<string, string[]>();
      for (const edge of affiliationEdges) {
        const current = affiliationsByNodeId.get(edge.sourceNodeId) ?? [];
        current.push(edge.targetNode.label);
        affiliationsByNodeId.set(edge.sourceNodeId, current);
      }

      const providers = providerRows.map((provider) => {
        const graphNode = nodeByNpi.get(provider.npi);
        const specialty = (
          typeof graphNode?.metadata.specialty === 'string' && graphNode.metadata.specialty.trim().length > 0
            ? graphNode.metadata.specialty.trim()
            : provider.taxonomyCode
        );
        const affiliations = uniqueStrings([
          ...(graphNode ? affiliationsByNodeId.get(graphNode.id) ?? [] : []),
          typeof graphNode?.metadata.institution === 'string' ? graphNode.metadata.institution : null,
        ]);

        return {
          npi: provider.npi,
          fullName: provider.fullName,
          providerType: provider.providerType,
          specialty,
          taxonomyCode: provider.taxonomyCode,
          stateOfPractice: provider.stateOfPractice,
          affiliations,
        };
      });

      res.json({
        schema: 'https://vitalcv.com/providers/v1',
        count: providers.length,
        total,
        providers,
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
