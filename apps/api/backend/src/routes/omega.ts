/**
 * omega.ts — HTTP surface for the Omega Orchestrator.
 *
 * Validates the incoming request envelope, delegates to orchestrateOmega
 * (no logic here), and returns the orchestrator's response verbatim.
 * Status code is derived from OmegaResponse.status so operators can
 * distinguish "no such NPI" from "core ok but subsystems degraded".
 */

import type { Express, Request, Response } from 'express';
import { orchestrateOmega } from '../orchestrator/vcv-omega';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

interface OmegaRequestBody {
  npi?: unknown;
  orgId?: unknown;
  role?: unknown;
  persist?: unknown;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

export function registerOmegaRoutes(app: Express): void {
  app.post('/api/omega', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as OmegaRequestBody;
    const { npi, orgId, role, persist } = body;

    if (typeof npi !== 'string' || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'npi must be a 10-digit string.',
      });
    }
    if (!isOptionalString(orgId)) {
      return res.status(400).json({
        error: 'invalid_orgId',
        error_description: 'orgId must be a string when provided.',
      });
    }
    if (!isOptionalString(role)) {
      return res.status(400).json({
        error: 'invalid_role',
        error_description: 'role must be a string when provided.',
      });
    }
    if (!isOptionalBoolean(persist)) {
      return res.status(400).json({
        error: 'invalid_persist',
        error_description: 'persist must be a boolean when provided.',
      });
    }

    try {
      const result = await orchestrateOmega({
        subject: { npi },
        context: { orgId, role, persist },
      });

      const status = result.status === 'not_found' ? 404 : 200;

      log('info', 'omega_request_served', {
        npi_prefix: npi.slice(0, 4) + '····',
        result_status: result.status,
        role: result.context.role,
        persist: result.context.persist,
      });

      return res.status(status).json(result);
    } catch (error) {
      log('error', 'omega_request_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'omega_failed',
        error_description: 'Could not orchestrate Omega request.',
      });
    }
  });
}
