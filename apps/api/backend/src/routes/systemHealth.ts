/**
 * systemHealth.ts — Wave 249: Trust Spine Hardening
 *
 * Public monitoring endpoints for the trust pipeline.
 * Results are cached in-process for 5 minutes to avoid expensive queries
 * on every dashboard poll.
 *
 * Routes:
 *   GET /api/system/trust-health         — full pipeline integrity report
 *   GET /api/system/trust-health/orphans — orphaned credential report
 *   GET /api/system/trust-health/graph   — graph integrity report
 *   GET /api/system/source-runtime       — source liveness truth registry
 */

import type { Express, Request, Response } from 'express';
import {
  validatePipelineIntegrity,
  detectOrphanedCredentials,
  validateGraphIntegrity,
  type IntegrityReport,
  type OrphanReport,
  type GraphIntegrityReport,
} from '../services/integrity/trustSpine';
import { log } from '../obs/logger';
import { registerSourceRuntimeRoutes } from './sourceRuntime';

// ── In-process cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

let integrityCache: CacheEntry<IntegrityReport> | null = null;
let orphanCache: CacheEntry<OrphanReport> | null = null;
let graphCache: CacheEntry<GraphIntegrityReport> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  return entry !== null && Date.now() < entry.expiresAt;
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleTrustHealth(_req: Request, res: Response): Promise<void> {
  try {
    if (isFresh(integrityCache)) {
      res.setHeader('X-Cache', 'HIT');
      res.json(integrityCache.value);
      return;
    }

    const report = await validatePipelineIntegrity();
    integrityCache = { value: report, expiresAt: Date.now() + CACHE_TTL_MS };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(report);
  } catch (err) {
    log('error', 'system_health: integrity_error', { error: String(err) });
    res.status(500).json({
      status: 'CRITICAL',
      error: 'Failed to compute integrity report',
      computedAt: new Date().toISOString(),
    });
  }
}

async function handleOrphans(_req: Request, res: Response): Promise<void> {
  try {
    if (isFresh(orphanCache)) {
      res.setHeader('X-Cache', 'HIT');
      res.json(orphanCache.value);
      return;
    }

    const report = await detectOrphanedCredentials();
    orphanCache = { value: report, expiresAt: Date.now() + CACHE_TTL_MS };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(report);
  } catch (err) {
    log('error', 'system_health: orphan_error', { error: String(err) });
    res.status(500).json({ error: 'Failed to compute orphan report', computedAt: new Date().toISOString() });
  }
}

async function handleGraph(_req: Request, res: Response): Promise<void> {
  try {
    if (isFresh(graphCache)) {
      res.setHeader('X-Cache', 'HIT');
      res.json(graphCache.value);
      return;
    }

    const report = await validateGraphIntegrity();
    graphCache = { value: report, expiresAt: Date.now() + CACHE_TTL_MS };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(report);
  } catch (err) {
    log('error', 'system_health: graph_error', { error: String(err) });
    res.status(500).json({ error: 'Failed to compute graph integrity report', computedAt: new Date().toISOString() });
  }
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerSystemHealthRoutes(app: Express): void {
  // Most specific routes first to avoid Express matching /graph as :subpath on the base
  app.get('/api/system/trust-health/orphans', handleOrphans);
  app.get('/api/system/trust-health/graph', handleGraph);
  app.get('/api/system/trust-health', handleTrustHealth);
  registerSourceRuntimeRoutes(app);

  log('info', 'system_health: routes_registered', {
    routes: [
      'GET /api/system/trust-health',
      'GET /api/system/trust-health/orphans',
      'GET /api/system/trust-health/graph',
      'GET /api/system/source-runtime',
      'GET /api/system/source-runtime/:sourceId',
    ],
  });
}
