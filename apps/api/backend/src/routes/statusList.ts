/**
 * statusList.ts — Wave 40: Continuous Trust & Revocation Engine
 *
 * GET /api/credentials/status-list
 *
 * Public, heavily cached endpoint that returns the current W3C Bitstring
 * Status List Credential. Verifiers download this once and perform offline
 * revocation checks without per-credential API calls to VitalCV.
 *
 * CACHING STRATEGY
 * ────────────────
 * • HTTP: `Cache-Control: public, max-age=300, stale-while-revalidate=60`
 *   → Verifiers / CDNs may cache for 5 min; serve stale up to 1 min while
 *   revalidating in the background.
 * • In-memory: `statusListManager.getStatusListCredential()` maintains a
 *   version-keyed cache that is invalidated on every `setRevoked()` call.
 *   Typical hot-path latency is sub-millisecond.
 * • `ETag` header based on credential version for conditional GET support.
 *
 * RATE LIMITING
 * ─────────────
 * `publicApiRateLimit` — 100 req / 10 min / IP.
 * Verifiers with high query volume should cache locally and use
 * `If-None-Match` / `If-Modified-Since` headers.
 *
 * W3C REFERENCE
 * ─────────────
 * https://www.w3.org/TR/vc-bitstring-status-list/
 */

import type { Express, Request, Response } from 'express';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { getStatusListCredential } from '../services/ledger/statusListManager';
import { log } from '../obs/logger';

// ── Route registration ─────────────────────────────────────────────────────

export function registerStatusListRoutes(app: Express): void {
  /**
   * GET /api/credentials/status-list
   *
   * Returns a W3C BitstringStatusListCredential.
   * Content-Type: application/vc+ld+json (W3C VC data model media type).
   */
  app.get(
    '/api/credentials/status-list',
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      try {
        const credential = await getStatusListCredential();

        // Build a lightweight ETag from the proof value (contains version)
        const eTag = `"${Buffer.from(credential.proof?.proofValue ?? 'v0').toString('base64url').slice(0, 16)}"`;

        // Conditional GET support
        if (req.headers['if-none-match'] === eTag) {
          res.status(304).end();
          return;
        }

        res.setHeader('Content-Type',  'application/vc+ld+json');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
        res.setHeader('ETag',          eTag);
        res.setHeader('Vary',          'Accept-Encoding');

        log('info', 'status_list_served', {
          eTag,
          ip: req.ip ?? 'unknown',
        });

        res.status(200).json(credential);
      } catch (err) {
        log('error', 'status_list_route_error', {
          error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({
          error:             'internal_error',
          error_description: 'Failed to retrieve status list.',
        });
      }
    },
  );
}
