/**
 * actionLog.ts — employer action endpoint (single surface).
 *
 * POST /api/employer-actions
 *   Routes "accept" to the existing Acceptance system (no write here) and
 *   persists non-accept actions (request_data | flag) to the ActionLog
 *   table.
 *
 * GET /api/employer-actions/:npi
 *   Returns the 10 most recent non-accept actions for an NPI.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const VALID_ACTIONS = new Set(['accept', 'request_data', 'flag'] as const);
type ActionKind = 'accept' | 'request_data' | 'flag';

interface ActionRequestBody {
  npi?: unknown;
  action?: unknown;
  rationale?: unknown;
}

function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && VALID_ACTIONS.has(value as ActionKind);
}

export function registerActionLogRoutes(app: Express): void {
  app.post('/api/employer-actions', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as ActionRequestBody;
    const { npi, action, rationale } = body;

    if (typeof npi !== 'string' || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }
    if (!isActionKind(action)) {
      return res.status(400).json({
        error: 'invalid_action',
        error_description: 'action must be one of: accept, request_data, flag.',
      });
    }
    if (rationale !== undefined && typeof rationale !== 'string') {
      return res.status(400).json({
        error: 'invalid_rationale',
        error_description: 'rationale must be a string when provided.',
      });
    }

    // Accept is owned by the existing Acceptance system — do not duplicate.
    if (action === 'accept') {
      log('info', 'employer_action_routed', {
        npi_prefix: npi.slice(0, 4) + '····',
        action,
        routed: 'acceptance_system',
      });
      return res.status(200).json({
        success: true,
        routed: 'acceptance_system',
      });
    }

    try {
      await prisma.actionLog.create({
        data: {
          npi,
          action,
          rationale: rationale ?? null,
        },
      });
    } catch (error) {
      log('error', 'employer_action_persist_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        action,
        message: error instanceof Error ? error.message : 'Unknown persistence error',
      });
      return res.status(500).json({
        success: false,
        error: 'persist_failed',
        error_description: 'Could not record employer action.',
      });
    }

    log('info', 'employer_action_recorded', {
      npi_prefix: npi.slice(0, 4) + '····',
      action,
    });

    return res.status(200).json({
      success: true,
      action,
      npi,
      recorded: true,
    });
  });

  app.get('/api/employer-actions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }

    // Read both surfaces in parallel. Acceptance rows are the structured
    // graph-node view; ActionLog rows are the lightweight log of
    // non-accept actions. Both are keyed by npi (Acceptance.subjectId ≡ npi
    // per Wave 13 simplification).
    const [actionsResult, acceptanceResult] = await Promise.allSettled([
      prisma.actionLog.findMany({
        where: { npi },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.acceptance.findMany({
        where: { subjectId: npi },
        orderBy: { acceptedAt: 'desc' },
        take: 10,
        select: {
          acceptanceId: true,
          subjectId: true,
          employerId: true,
          facilityId: true,
          acceptedAt: true,
          eventHash: true,
          decisionState: true,
          trustSignalsSnapshot: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

    if (actionsResult.status === 'rejected' && acceptanceResult.status === 'rejected') {
      log('error', 'employer_action_read_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        actions_error:
          actionsResult.reason instanceof Error ? actionsResult.reason.message : 'unknown',
        acceptance_error:
          acceptanceResult.reason instanceof Error ? acceptanceResult.reason.message : 'unknown',
      });
      return res
        .status(200)
        .json({ actions: [], acceptances: [], error: 'read_failed' });
    }

    const actions =
      actionsResult.status === 'fulfilled' ? actionsResult.value : [];
    const acceptances =
      acceptanceResult.status === 'fulfilled'
        ? acceptanceResult.value.map((row) => ({
            kind: 'acceptance' as const,
            acceptanceId: row.acceptanceId,
            subjectId: row.subjectId,
            employerId: row.employerId,
            facilityId: row.facilityId,
            acceptedAt: row.acceptedAt.toISOString(),
            eventHash: row.eventHash,
            decisionState: row.decisionState,
            trustSignalsSnapshot: row.trustSignalsSnapshot,
            role: row.role,
            createdAt: row.createdAt.toISOString(),
          }))
        : [];

    return res.status(200).json({ actions, acceptances });
  });
}
