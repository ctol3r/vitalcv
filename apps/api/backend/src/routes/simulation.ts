/**
 * simulation.ts — Wave 248: Trust Simulation API (Live)
 *
 * POST /api/simulation/run        — Legacy graph-based simulation (Wave 84)
 * POST /api/simulation/revocation — Live: simulate credential revocation
 * POST /api/simulation/expiration — Live: simulate license expiration
 * POST /api/simulation/compliance — Live: simulate new compliance rule
 */

import type { Express, Request, Response } from 'express';
import { runTrustSimulation } from '../services/simulation/simulationEngine';
import type { SimulationEvent } from '../services/simulation/graphSimulation';
import {
  simulateCredentialRevocation,
  simulateLicenseExpiration,
  simulateComplianceRule,
} from '../services/simulation/liveSimulationEngine';
import { log } from '../obs/logger';
import { requireInternalSecret } from '../middleware/internalSecret';

const VALID_EVENT_TYPES = ['credential_expired', 'credential_revoked', 'credential_added', 'issuer_revoked'] as const;

/**
 * AUTHORIZATION (2026-08-09). All four simulation writes had no authorization
 * beyond the global tenant guard, which accepted the mere PRESENCE of a
 * caller-supplied `x-org-id`.
 *
 * Their web proxies (`app/api/simulation/*`) hold NO auth of their own, so
 * "forward the operator secret from the proxy" — the fix used for
 * app/api/internal/* in batch 2 — is the WRONG move here: it would launder the
 * secret to any anonymous caller of the web origin. Gating the backend is
 * correct, and costs nothing: the only consumers, `LiveSimulationPanel` and
 * `SimulationControlPanel`, are imported by no page, so the proxies front dead
 * UI and will simply 403.
 */
export function registerSimulationRoutes(app: Express): void {

  // ── Live: get simulation results ─────────────────────────────────────────
  app.get('/api/simulation/:id/results', async (req: Request, res: Response) => {
    const { id } = req.params;
    // In a real system, we'd fetch this from the database or Redis using the simulation ID.
    // For now, we return a synthesized mocked result based on the ID.
    try {
      res.json({
        simulationId: id,
        status: 'COMPLETE',
        result: {
          estimatedImpact: {
            hospitalsAffected: 1,
            privilegesImpacted: 1,
            revenueImpact: {
              dailyRevenue: 2500,
              daysUntilReplacement: 90,
              totalAtRisk: 225000
            },
            staffingGap: {
              uncoveredShifts: 51,
              affectedLocations: ['Mocked Location']
            }
          }
        }
      });
    } catch (err) {
      log('error', 'simulation_route: fetch_results_failed', { id, error: String(err) });
      res.status(500).json({ error: 'Failed to fetch simulation results' });
    }
  });


  // ── Legacy: graph-based simulation ────────────────────────────────────────
  app.post('/api/simulation/run', requireInternalSecret, async (req: Request, res: Response) => {
    const { npi, eventType, credentialId, issuerNodeId, label } = req.body ?? {};

    if (!npi || !eventType) {
      res.status(400).json({ error: 'npi and eventType are required' });
      return;
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      res.status(400).json({ error: `eventType must be one of: ${VALID_EVENT_TYPES.join(', ')}` });
      return;
    }

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

  // ── Live: credential revocation simulation ─────────────────────────────────
  app.post('/api/simulation/revocation', requireInternalSecret, async (req: Request, res: Response) => {
    const { npi, credentialType } = req.body ?? {};

    if (!npi || !credentialType) {
      res.status(400).json({ error: 'npi and credentialType are required' });
      return;
    }

    if (!/^\d{10}$/.test(String(npi))) {
      res.status(400).json({ error: 'npi must be a 10-digit number' });
      return;
    }

    try {
      const result = await simulateCredentialRevocation({ npi: String(npi), credentialType: String(credentialType) });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'simulation_route: revocation_failed', { npi, credentialType, error: message });
      res.status(500).json({ error: 'Revocation simulation failed' });
    }
  });

  // ── Live: license expiration simulation ───────────────────────────────────
  app.post('/api/simulation/expiration', requireInternalSecret, async (req: Request, res: Response) => {
    const { npi, expirationDate } = req.body ?? {};

    if (!npi || !expirationDate) {
      res.status(400).json({ error: 'npi and expirationDate are required' });
      return;
    }

    if (!/^\d{10}$/.test(String(npi))) {
      res.status(400).json({ error: 'npi must be a 10-digit number' });
      return;
    }

    const parsed = new Date(String(expirationDate));
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'expirationDate must be a valid ISO date string' });
      return;
    }

    try {
      const result = await simulateLicenseExpiration({ npi: String(npi), expirationDate: String(expirationDate) });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'simulation_route: expiration_failed', { npi, expirationDate, error: message });
      res.status(500).json({ error: 'Expiration simulation failed' });
    }
  });

  // ── Live: compliance rule simulation ──────────────────────────────────────
  app.post('/api/simulation/compliance', requireInternalSecret, async (req: Request, res: Response) => {
    const { rule, specialty, state } = req.body ?? {};

    if (!rule) {
      res.status(400).json({ error: 'rule is required' });
      return;
    }

    try {
      const result = await simulateComplianceRule({
        rule: String(rule),
        specialty: specialty ? String(specialty) : undefined,
        state: state ? String(state) : undefined,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'simulation_route: compliance_failed', { rule, error: message });
      res.status(500).json({ error: 'Compliance simulation failed' });
    }
  });
}
