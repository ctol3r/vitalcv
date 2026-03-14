/**
 * trustStateEngine.ts (routes) — Wave 243: Trust State Engine Routes
 *
 * Routes:
 *   GET  /api/trust-state/:npi          — get current trust state (cached ≤1h or fresh)
 *   POST /api/trust-state/:npi/refresh  — force recomputation (requires x-clerk-user-id)
 *   GET  /api/trust-state/:npi/history  — past trust state snapshots
 */

import type { Express, Request, Response } from 'express';
import { CrsEngine } from '../../../../../packages/crs';
import {
  TrustStateResolver,
  type AcceptanceScopeRecord,
  type TrustStateResolverDependencies,
  type TrustStateScope,
} from '../../../../../packages/trust-state';
import prisma from '../graphql/prisma_client';
import {
  computeClinicianTrustState,
  refreshTrustState,
  getTrustStateHistory,
  getCachedTrustState,
} from '../services/trust/trustStateEngine';
import { appendAuditEvent } from '../services/audit/auditLedger';
import { PrismaBackedPsvStore } from '../services/psv/PrismaBackedPsvStore';
import { log } from '../obs/logger';

// ── NPI validation ────────────────────────────────────────────────────────────

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

function readScope(req: Request): Partial<TrustStateScope> | undefined {
  const employer_id =
    typeof req.query.employer_id === 'string' ? req.query.employer_id.trim() : '';
  const facility_id =
    typeof req.query.facility_id === 'string' ? req.query.facility_id.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';

  if (!employer_id && !facility_id && !role) {
    return undefined;
  }

  return {
    ...(employer_id ? { employer_id } : {}),
    ...(facility_id ? { facility_id } : {}),
    ...(role ? { role } : {}),
  };
}

function mapAcceptanceRowToScopeRecord(row: {
  subjectId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: Date;
  acceptanceId: string;
  eventHash: string;
}): AcceptanceScopeRecord {
  return {
    clinician_id: row.subjectId,
    employer_id: row.employerId,
    facility_id: row.facilityId,
    role: '',
    accepted_at: row.acceptedAt.toISOString(),
    acceptance_id: row.acceptanceId,
    hash_anchor: row.eventHash,
    employer_proof: {
      type: 'PrismaAcceptanceEventHash',
      verificationMethod: `urn:vitalcv:acceptance:${row.acceptanceId}`,
      proofValue: row.eventHash,
    },
  };
}

export function buildTrustStateResolverDeps(): TrustStateResolverDependencies {
  const receipts = new PrismaBackedPsvStore();
  const crsEngine = new CrsEngine({
    receipts,
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.acceptance.count({ where: { subjectId: clinician_id } })) > 0;
      },
    },
  });

  return {
    receipts,
    crs: {
      computeForClinician: (input) => crsEngine.computeForClinician(input),
    },
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.acceptance.count({ where: { subjectId: clinician_id } })) > 0;
      },
      async listByClinician(clinician_id: string): Promise<AcceptanceScopeRecord[]> {
        const rows = await prisma.acceptance.findMany({
          where: { subjectId: clinician_id },
        });

        return rows.map(mapAcceptanceRowToScopeRecord);
      },
    },
    starts: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.start.count({ where: { subjectId: clinician_id } })) > 0;
      },
    },
    audit: {
      append: async (event) => {
        const auditEntry = appendAuditEvent({
          category: 'TRUST_STATE_CHANGE',
          actor: 'system:trust-state-resolver',
          resource: `clinician:${event.clinician_id}`,
          requestFields: {
            clinician_id: event.clinician_id,
            event_type: event.event_type,
            occurred_at: event.occurred_at,
          },
          resultFields: event.metadata,
          severity: event.event_type === 'TRUST_STATE_DECAY' ? 'WARNING' : 'INFO',
        });

        return { audit_packet_id: auditEntry.eventId };
      },
    },
    now: () => new Date(),
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerTrustStateEngineRoutes(app: Express): void {

  /**
   * GET /api/trust-state/:npi
   * Returns the current trust state. Uses cache if computed within the last hour;
   * otherwise computes fresh (no side effects).
   */
  app.get('/api/trust-state/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      // Try cache first
      const cached = await getCachedTrustState(npi);
      if (cached) {
        return res.status(200).json({ ...cached, cached: true });
      }

      // Fresh computation (no DB write)
      const state = await computeClinicianTrustState(npi);
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_get_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to compute trust state' });
    }
  });

  /**
   * POST /api/trust-state/:npi/refresh
   * Forces recomputation and persists snapshot. Requires x-clerk-user-id header.
   */
  app.post('/api/trust-state/:npi/refresh', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const clerkUserId = req.headers['x-clerk-user-id'];

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required — x-clerk-user-id header missing' });
    }

    try {
      const state = await refreshTrustState(npi);
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_refresh_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to refresh trust state' });
    }
  });

  /**
   * GET /api/trust-state/:npi/history
   * Returns past trust state snapshots (most recent first).
   */
  app.get('/api/trust-state/:npi/history', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? Math.min(parseInt(limitRaw, 10) || 10, 50) : 10;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      const history = await getTrustStateHistory(npi, limit);
      return res.status(200).json({ npi, history, count: history.length });
    } catch (err) {
      log('error', 'trust_state_history_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to retrieve trust state history' });
    }
  });

  app.get('/api/trust-state/:npi/domain', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      const resolver = new TrustStateResolver(buildTrustStateResolverDeps());
      const state = await resolver.resolve(npi, readScope(req));
      return res.status(200).json(state);
    } catch (err) {
      log('error', 'trust_state_domain_get_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to compute domain trust state' });
    }
  });
}
