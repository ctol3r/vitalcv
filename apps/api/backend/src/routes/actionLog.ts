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

    try {
      const actions = await prisma.actionLog.findMany({
        where: { npi },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      return res.status(200).json({ actions });
    } catch (error) {
      log('error', 'employer_action_read_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        message: error instanceof Error ? error.message : 'Unknown read error',
      });
      // Always return a usable shape — empty list rather than partial/undefined.
      return res.status(200).json({ actions: [], error: 'read_failed' });
    }
  });
}
