/**
 * oig.ts — Wave 241
 *
 * OIG/LEIE Exclusion Check Routes
 *
 *   GET  /api/psv/oig/check/:npi  — check a single NPI (fetches name from NPPES first)
 *   POST /api/psv/oig/batch       — batch check multiple providers
 *
 * Auth: x-clerk-user-id header required.
 * Audit: checkExclusion emits COMPLIANCE events internally.
 */

import type { Express, NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/httpError';
import { log } from '../obs/logger';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { checkExclusion, batchCheckExclusions } from '../services/psv/oigLeieChecker';
import type { ExclusionCheckParams } from '../services/psv/oigLeieChecker';

// ── Helpers ────────────────────────────────────────────────────────────────────

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);
}

function requireClerkUserId(req: Request): string {
  const id = (req.headers['x-clerk-user-id'] as string | undefined)?.trim();
  if (!id) throw new HttpError(401, 'Missing x-clerk-user-id header.');
  return id;
}

// ── NPPES name resolver ────────────────────────────────────────────────────────

interface NppesName {
  firstName: string;
  lastName: string;
}

async function resolveNameFromNppes(npi: string): Promise<NppesName> {
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
    const res = await fetchWithRetry(url, undefined, {
      maxRetries: 2,
      baseDelayMs: 400,
      timeoutMs: 8_000,
      label: 'oig_nppes_resolve',
    });

    const data = (await res.json()) as any;
    const result = data?.results?.[0];
    if (!result) throw new Error('No NPPES result for NPI');

    const basic = result.basic ?? {};
    const firstName =
      (basic.first_name || basic.authorized_official_first_name || '').trim();
    const lastName =
      (basic.last_name || basic.authorized_official_last_name || '').trim();

    if (!firstName || !lastName) throw new Error('NPPES name fields missing');
    return { firstName, lastName };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('warn', 'oig_nppes_resolve_failed', { npi, error: message });
    throw new HttpError(502, `Could not resolve provider name from NPPES for NPI ${npi}: ${message}`);
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────────

export function registerOigRoutes(app: Express): void {
  /**
   * GET /api/psv/oig/check/:npi
   *
   * 1. Validates NPI format
   * 2. Fetches first/last name from NPPES
   * 3. Runs OIG LEIE exclusion check
   * 4. Returns ExclusionResult
   */
  app.get(
    '/api/psv/oig/check/:npi',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req);

      const { npi } = req.params;
      if (!npi || !/^\d{10}$/.test(npi)) {
        throw new HttpError(400, 'Invalid NPI — expected 10 digits.');
      }

      log('info', 'oig_check_route', { npi });

      const { firstName, lastName } = await resolveNameFromNppes(npi);
      const result = await checkExclusion({ firstName, lastName, npi });

      res.json({
        npi,
        firstName,
        lastName,
        ...result,
        lastVerifiedAt: result.checkedAt,
        provenance: {
          exclusionSource: 'OIG LEIE Monthly CSV',
          exclusionEndpoint: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
          nameSource: 'CMS NPPES Registry',
          nameEndpoint: 'https://npiregistry.cms.hhs.gov/api/?version=2.1',
        },
      });
    }),
  );

  /**
   * POST /api/psv/oig/batch
   *
   * Body: { providers: Array<{ firstName, lastName, npi? }> }
   * Returns: Array of ExclusionResult (in same order as input)
   */
  app.post(
    '/api/psv/oig/batch',
    asyncHandler(async (req, res) => {
      requireClerkUserId(req);

      const { providers } = req.body as { providers?: unknown };

      if (!Array.isArray(providers) || providers.length === 0) {
        throw new HttpError(400, 'Request body must include a non-empty providers array.');
      }

      if (providers.length > 100) {
        throw new HttpError(400, 'Batch limit is 100 providers per request.');
      }

      // Validate each entry
      const params: ExclusionCheckParams[] = providers.map((p: any, i: number) => {
        if (!p || typeof p !== 'object') {
          throw new HttpError(400, `providers[${i}] must be an object.`);
        }
        const firstName = typeof p.firstName === 'string' ? p.firstName.trim() : '';
        const lastName = typeof p.lastName === 'string' ? p.lastName.trim() : '';
        if (!firstName || !lastName) {
          throw new HttpError(400, `providers[${i}] must have firstName and lastName.`);
        }
        return { firstName, lastName, npi: p.npi?.trim() ?? undefined };
      });

      log('info', 'oig_batch_route', { count: params.length });

      const results = await batchCheckExclusions(params);

      res.json({
        total: results.length,
        excluded: results.filter((r) => r.excluded).length,
        results: results.map((r, i) => ({
          ...params[i],
          ...r,
          lastVerifiedAt: r.checkedAt,
        })),
        provenance: {
          exclusionSource: 'OIG LEIE Monthly CSV',
          exclusionEndpoint: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv',
        },
      });
    }),
  );
}
