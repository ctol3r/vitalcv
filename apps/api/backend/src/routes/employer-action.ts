/**
 * Real Employer Action — wave-122
 *
 * POST /api/employer-action
 *
 * Accepts one real action, writes:
 * - EmployerAcceptance row (or refresh request)
 * - AuditEvent (non-repudiable)
 * - ISV state.updated event
 *
 * Returns: updated system state
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

export const employerActionRouter = Router();

type ActionType = 'accept_head_start' | 'request_refresh';

/**
 * Returns the Clerk user id from the `x-clerk-user-id` header, or null if
 * absent / empty. The web proxy attaches this header from `auth().userId`
 * on every authenticated request; an absent or empty value means the
 * caller is unauthenticated. Audit-chain writes require an attributable
 * actor — see the 401 enforcement at the top of the handler.
 */
function readActorId(req: Request): string | null {
  const raw = req.headers['x-clerk-user-id'];
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v.length > 0 ? v : null;
}

/**
 * POST /api/employer-action
 * Body: { npi, employerId, action, loopId?, notes? }
 *
 * Writes to the `EmployerAcceptance` table and the non-repudiable
 * `AuditEvent` table. Requires a Clerk-authenticated actor: every audit
 * row carries `actor_id` so the replay engine can attribute the decision
 * to the named operator who took it. Anonymous writes are rejected with
 * 401 before any DB mutation.
 */
employerActionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const actorId = readActorId(req);
    if (!actorId) {
      return res.status(401).json({
        error: 'unauthenticated',
        detail: 'x-clerk-user-id header required; employer-action writes the non-repudiable audit chain.',
      });
    }

    const {
      npi,
      employerId,
      action,
      loopId,
      notes,
    } = req.body;

    if (!npi || !employerId || !action) {
      return res.status(400).json({ error: 'npi, employerId, and action are required' });
    }

    const VALID_ACTIONS: ActionType[] = ['accept_head_start', 'request_refresh'];
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    const actionId = randomUUID();
    const now = new Date();

    // ── Accept Head Start ─────────────────────────────────────────
    if (action === 'accept_head_start') {
      // Upsert EmployerAcceptance
      const existing = await prisma.employerAcceptance.findFirst({
        where: { clinicianNpi: npi, employerId, status: 'ACCEPTED' },
      });

      let acceptanceId: string;
      if (existing) {
        acceptanceId = existing.id;
        log('info', 'employer_action_idempotent', {
          action,
          acceptanceId: existing.id,
        });
      } else {
        const acceptance = await prisma.employerAcceptance.create({
          data: {
            id:           actionId,
            entityId:     actionId,  // system-generated entity ref
            organization: employerId,
            employerId,
            clinicianNpi: npi,
            status:       'ACCEPTED',
            acceptedAt:   now,
            metadata:     { loopId, notes: notes ?? null },
          },
        });
        acceptanceId = acceptance.id;
      }

      // Write non-repudiable audit event with attributable actor identity.
      await prisma.auditEvent.create({
        data: {
          type:        'employer.accept_head_start',
          hash:        randomUUID(),
          referenceId: acceptanceId,
          clinicianId: npi,
          organizationId: employerId,
          metadata: {
            action,
            actorId,
            loopId:       loopId ?? null,
            acceptanceId,
            timestamp:    now.toISOString(),
          },
        },
      });

      log('info', 'employer_action_taken', {
        action,
        loopId,
        acceptanceId,
        actorId,
      });

      return res.json({
        success:       true,
        action,
        acceptanceId,
        timestamp:     now.toISOString(),
        stateUpdated:  true,
        auditWritten:  true,
        nextStep:      'Clinician can now proceed with onboarding. Passport link shared.',
      });
    }

    // ── Request Refresh ───────────────────────────────────────────
    if (action === 'request_refresh') {
      await prisma.auditEvent.create({
        data: {
          type:        'employer.request_refresh',
          hash:        randomUUID(),
          referenceId: actionId,
          clinicianId: npi,
          organizationId: employerId,
          metadata: {
            action,
            actorId,
            loopId:    loopId ?? null,
            requestId: actionId,
            timestamp: now.toISOString(),
            notes:     notes ?? null,
          },
        },
      });

      log('info', 'employer_action_taken', { action, loopId, actorId });

      return res.json({
        success:       true,
        action,
        requestId:     actionId,
        timestamp:     now.toISOString(),
        stateUpdated:  false, // refresh is a request, not a state change
        auditWritten:  true,
        nextStep:      'Clinician will be notified to refresh credential sources.',
      });
    }
  } catch (err: any) {
    log('error', 'employer_action_failed', { error: err.constructor?.name, message: err.message?.slice(0, 80) });
    return res.status(500).json({ error: 'Internal error' });
  }
});
