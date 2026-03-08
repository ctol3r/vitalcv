/**
 * networkHealth.ts — Wave 162: Network Health Monitoring API
 *
 * GET /api/network/health          — full health summary (nodes + issuers + payers)
 * GET /api/network/health/nodes    — per-node health only
 * GET /api/network/health/issuers  — per-issuer health only
 * GET /api/network/health/payers   — federated payer health only
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  getNetworkHealthSummary,
  getNodeHealth,
  getIssuerHealth,
  getPayerHealth,
} from '../services/network/networkHealth';

export function registerNetworkHealthRoutes(app: Express): void {
  // Full summary
  app.get('/api/network/health', (_req: Request, res: Response) => {
    try {
      const summary = getNetworkHealthSummary();
      res.json(summary);
    } catch (err) {
      log('error', 'network_health_error', { error: String(err) });
      res.status(500).json({ error: 'Network health check failed' });
    }
  });

  // Per-node health
  app.get('/api/network/health/nodes', (_req: Request, res: Response) => {
    try {
      const nodes = getNodeHealth();
      res.json({ nodes, computedAt: new Date().toISOString() });
    } catch (err) {
      log('error', 'network_nodes_health_error', { error: String(err) });
      res.status(500).json({ error: 'Node health check failed' });
    }
  });

  // Per-issuer health
  app.get('/api/network/health/issuers', (_req: Request, res: Response) => {
    try {
      const issuers = getIssuerHealth();
      res.json({ issuers, computedAt: new Date().toISOString() });
    } catch (err) {
      log('error', 'issuer_health_error', { error: String(err) });
      res.status(500).json({ error: 'Issuer health check failed' });
    }
  });

  // Federated payer health
  app.get('/api/network/health/payers', (_req: Request, res: Response) => {
    try {
      const payers = getPayerHealth();
      res.json({ payers, computedAt: new Date().toISOString() });
    } catch (err) {
      log('error', 'payer_health_error', { error: String(err) });
      res.status(500).json({ error: 'Payer health check failed' });
    }
  });
}
