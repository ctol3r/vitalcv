/**
 * sourceRuntime.ts — public source-runtime transparency endpoints.
 *
 * These routes report whether a source is actually live. They do not report
 * source secrets and they do not turn runtime health into a credential verdict.
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  getSourceRuntimeState,
  listSourceRuntimeStates,
  type SourceRuntimeState,
} from '../services/identity/sourceRuntimeState';

export interface SourceRuntimeRouteDependencies {
  listStates?: () => Promise<SourceRuntimeState[]>;
  getState?: (sourceId: string) => Promise<SourceRuntimeState | null>;
}

function normalizeSourceId(value: string): string {
  return value.trim().toUpperCase();
}

export function registerSourceRuntimeRoutes(
  app: Express,
  dependencies: SourceRuntimeRouteDependencies = {},
): void {
  const listStates = dependencies.listStates ?? (() => listSourceRuntimeStates());
  const getState = dependencies.getState ?? ((sourceId: string) => getSourceRuntimeState(sourceId));

  app.get('/api/system/source-runtime', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const sources = await listStates();
      res.json({
        computedAt: new Date().toISOString(),
        liveDefinition: 'canonical adapter + enabled configuration + required access + successful fresh persisted run and artifact',
        sources,
      });
    } catch (error) {
      log('error', 'source_runtime: list_failed', { error: String(error) });
      res.status(503).json({
        error: 'source_runtime_unavailable',
        error_description: 'Source runtime state could not be computed. No source should be inferred live or clear.',
      });
    }
  });

  app.get('/api/system/source-runtime/:sourceId', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const sourceId = normalizeSourceId(req.params.sourceId ?? '');
    if (!sourceId) {
      res.status(400).json({ error: 'source_id_required' });
      return;
    }

    try {
      const source = await getState(sourceId);
      if (!source) {
        res.status(404).json({
          error: 'source_not_registered',
          sourceId,
        });
        return;
      }

      res.json(source);
    } catch (error) {
      log('error', 'source_runtime: source_failed', { sourceId, error: String(error) });
      res.status(503).json({
        error: 'source_runtime_unavailable',
        sourceId,
        error_description: 'Source runtime state could not be computed. No source should be inferred live or clear.',
      });
    }
  });

  log('info', 'source_runtime: routes_registered', {
    routes: [
      'GET /api/system/source-runtime',
      'GET /api/system/source-runtime/:sourceId',
    ],
  });
}
