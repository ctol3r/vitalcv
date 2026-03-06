/**
 * simulation.ts — Wave 84: Trust Simulation API
 *
 * POST /api/simulation/run — Run a trust simulation.
 */

import type { Express, Request, Response } from 'express';
import { runTrustSimulation } from '../services/simulation/simulationEngine';
import type { SimulationEvent } from '../services/simulation/graphSimulation';
import { log } from '../obs/logger';

const VALID_EVENT_TYPES = ['credential_expired', 'credential_revoked', 'credential_added', 'issuer_revoked'] as const;

export function registerSimulationRoutes(app: Express): void {
  app.post('/api/simulation/run', async (req: Request, res: Response) => {
    const { npi, eventType, credentialId, issuerNodeId, label } = req.body ?? {};

    if (!npi || !eventType) {
      res.status(400).json({ error: 'npi and eventType are required' });
      return;
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      res.status(400).json({ error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
      return;
    }

    // Build the simulation event
    let event: SimulationEvent;
    switch (eventType) {
      case 'credential_expired':
        event = { type: 'credential_expired', credentialId: credentialId ?? 'cred-unknown' };
        break;
      case 'credential_revoked':
        event = { type: 'credential_revoked', credentialId: credentialId ?? 'cred-unknown' };
        break;
      case 'credential_added':
        event = { type: 'credential_added', credentialId: credentialId ?? `cred-new-${Date.now()}`, issuerNodeId: issuerNodeId ?? 'issuer-unknown', label: label ?? 'New Credential' };
        break;
      case 'issuer_revoked':
        event = { type: 'issuer_revoked', issuerNodeId: issuerNodeId ?? 'issuer-unknown' };
        break;
      default:
        res.status(400).json({ error: 'Invalid eventType' });
        return;
    }

    try {
      const report = await runTrustSimulation(npi, event);
      res.json(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'simulation_route: failed', { npi, eventType, error: message });
      res.status(500).json({ error: 'Simulation failed' });
    }
  });
}
