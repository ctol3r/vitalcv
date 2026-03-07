/**
 * payerNetwork.ts — Wave 148: Payer Credential Network API Routes
 *
 * GET  /api/payers/networks                      — All payer network topologies
 * GET  /api/payers/coverage/:payerId             — Coverage + credential requirements
 * POST /api/payers/validate                      — Validate clinician meets payer requirements
 * GET  /api/payers/nodes                         — Enriched payer nodes for GlobalTrustMap
 * GET  /api/payers/trust-score/:payerId          — Individual payer trust score
 * GET  /api/payers/throughput                    — Verification throughput stats
 */

import type { Express, Request, Response } from 'express';
import {
  listPayerNetworks,
  getPayerCoverage,
  validatePayerCredentialRequirements,
  getPayerNodes,
  getPayerTrustScore,
  getPayerVerificationThroughput,
} from '../services/payers/payerNetwork';
import { log } from '../obs/logger';

export function registerPayerNetworkRoutes(app: Express): void {
  app.get('/api/payers/networks', (_req: Request, res: Response) => {
    try {
      const networks = listPayerNetworks();
      res.json({ networks, count: networks.length });
    } catch (err) {
      log('error', 'payer_networks_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to list payer networks' });
    }
  });

  app.get('/api/payers/coverage/:payerId', (req: Request, res: Response) => {
    try {
      const coverage = getPayerCoverage(req.params.payerId);
      if (!coverage) {
        res.status(404).json({ error: 'Payer not found' });
        return;
      }
      res.json(coverage);
    } catch (err) {
      log('error', 'payer_coverage_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to get payer coverage' });
    }
  });

  app.post('/api/payers/validate', async (req: Request, res: Response) => {
    try {
      const { npi, payerId } = req.body as { npi: string; payerId: string };
      if (!npi || !payerId) {
        res.status(400).json({ error: 'Missing npi or payerId' });
        return;
      }
      const result = await validatePayerCredentialRequirements(npi, payerId);
      res.json(result);
    } catch (err) {
      log('error', 'payer_validate_route_error', { error: String(err) });
      res.status(500).json({ error: 'Payer validation failed' });
    }
  });

  app.get('/api/payers/nodes', (_req: Request, res: Response) => {
    try {
      const nodes = getPayerNodes();
      res.json({ nodes, count: nodes.length });
    } catch (err) {
      log('error', 'payer_nodes_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to get payer nodes' });
    }
  });

  app.get('/api/payers/trust-score/:payerId', (req: Request, res: Response) => {
    try {
      const score = getPayerTrustScore(req.params.payerId);
      if (!score) {
        res.status(404).json({ error: 'Payer not found' });
        return;
      }
      res.json(score);
    } catch (err) {
      log('error', 'payer_trust_score_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to get payer trust score' });
    }
  });

  app.get('/api/payers/throughput', (_req: Request, res: Response) => {
    try {
      const throughput = getPayerVerificationThroughput();
      res.json({ payers: throughput, count: throughput.length });
    } catch (err) {
      log('error', 'payer_throughput_route_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to get throughput' });
    }
  });
}
