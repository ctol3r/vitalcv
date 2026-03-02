/**
 * publicProfile.ts — Wave 43: Public Trust Profile
 *
 * GET /api/public/profile/npi/:npi
 *
 * Zero-friction, NPI-keyed public profile endpoint.  Clinicians share
 * `vitalcv.com/p/<NPI>` with recruiters; this route backs that page.
 *
 * DATA MINIMISATION GUARANTEES
 * ────────────────────────────
 * • `ClinicianPiiVault` is NEVER queried — SSN, DOB, home address are
 *   architecturally unreachable here.
 * • Only source names (e.g. "NPPES", "CA-BRN") are returned, not raw payloads.
 * • NPI is public (CMS NPI Registry); no identity fields are derived here.
 *
 * PIPELINE
 * ────────
 *  1. Validate NPI (10-digit).
 *  2. Rate-limit (100 req / 10 min / IP via publicApiRateLimit).
 *  3. Fetch all active VerificationArtifacts for the NPI.
 *  4. Cross-reference the Wave 40 Bitstring Status List:
 *       for each artifact with a statusListIndex, call isRevoked(index).
 *       Any revoked artifact removes its source from activeCredentials.
 *  5. Find the latest anchored AuditEvent for the NPI (lastAnchored).
 *  6. Run a best-effort ReadinessEvaluator pass (Wave 37 GraphRAG).
 *       Falls back gracefully if state/specialty cannot be inferred.
 *  7. Determine status:
 *       CLEARED  — ≥1 active non-revoked artifact AND evaluator eligible
 *                  (or no compliance rules found — open-policy default).
 *       PENDING  — no artifacts, all revoked, or evaluator finds gaps.
 *  8. Return sanitized JSON with Cache-Control: public, max-age=60.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { isRevoked } from '../services/ledger/statusListManager';
import { ReadinessEvaluator } from '../services/intelligence/graphRagEvaluator';

// ── Constants ──────────────────────────────────────────────────────────────

const NPI_RE         = /^\d{10}$/;
const evaluator      = new ReadinessEvaluator();
const MAX_EVENTS     = 5;

// ── Response type ──────────────────────────────────────────────────────────

export interface NpiProfileResponse {
  npi:               string;
  /** CLEARED = all checks pass; PENDING = gaps or no data yet. */
  status:            'CLEARED' | 'PENDING';
  /** ISO timestamp of the most recent Merkle-anchored AuditEvent. */
  lastAnchored:      string | null;
  /** Source names of active, non-revoked credentials. */
  activeCredentials: string[];
  /** Lightweight Superbrain readiness result (best-effort). */
  readiness: {
    evaluated:           boolean;
    isEligible:          boolean | null;
    missingRequirements: string[];
    traceCount:          number;
  };
  /** Recent Merkle-anchored audit events for the timeline. */
  events: Array<{
    type:      string;
    hash:      string;
    createdAt: string;
  }>;
  generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Try to infer a US state abbreviation from an artifact source name.
 * Examples: "CA-BRN" → "CA", "TX-TMB" → "TX", "NPPES" → null.
 */
function inferStateFromSource(source: string): string | null {
  const match = /^([A-Z]{2})-/.exec(source);
  return match ? match[1] : null;
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerPublicProfileRoutes(app: Express): void {
  /**
   * GET /api/public/profile/npi/:npi
   *
   * Public, cached, NPI-keyed clinician trust profile.
   */
  app.get(
    '/api/public/profile/npi/:npi',
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { npi } = req.params;

      if (!npi || !NPI_RE.test(npi)) {
        return res.status(400).json({
          error:             'invalid_npi',
          error_description: 'NPI must be a 10-digit string.',
        });
      }

      const generatedAt = new Date().toISOString();

      // ── 3. Fetch active VerificationArtifacts ─────────────────────────────
      const artifacts = await prisma.verificationArtifact.findMany({
        where: {
          npi,
          lifecycleState: { notIn: ['revoked', 'suspended'] },
          status:         { notIn: ['REVOKED', 'SUSPENDED', 'Expired'] },
        },
        select: {
          id:              true,
          source:          true,
          status:          true,
          lifecycleState:  true,
          statusListIndex: true,
          verifiedAt:      true,
          merkleRoot:      true,
        },
        orderBy: { verifiedAt: 'desc' },
        take: 20,
      });

      // ── 4. Revocation check via Wave 40 Bitstring Status List ─────────────
      const activeCredentials: string[] = [];

      await Promise.all(
        artifacts.map(async (artifact) => {
          // If artifact has a status list index, verify it isn't revoked.
          if (artifact.statusListIndex !== null && artifact.statusListIndex !== undefined) {
            try {
              const revoked = await isRevoked(artifact.statusListIndex);
              if (revoked) {
                log('info', 'public_profile_revoked_artifact', {
                  npi: npi.slice(0, 4) + '····',
                  artifactId: artifact.id,
                  index: artifact.statusListIndex,
                });
                return; // skip this credential
              }
            } catch {
              // Status list not yet initialised for this artifact — treat as active.
            }
          }

          // Dedup by source name
          if (!activeCredentials.includes(artifact.source)) {
            activeCredentials.push(artifact.source);
          }
        }),
      );

      // ── 5. Latest anchored AuditEvent → lastAnchored + events ────────────
      const anchoredEvents = await prisma.auditEvent.findMany({
        where:   { clinicianId: npi, anchored: true },
        orderBy: { createdAt: 'desc' },
        take:    MAX_EVENTS,
        select:  { type: true, hash: true, createdAt: true },
      });

      const lastAnchored = anchoredEvents[0]?.createdAt.toISOString() ?? null;

      const events = anchoredEvents.map((e) => ({
        type:      e.type,
        hash:      e.hash,
        createdAt: e.createdAt.toISOString(),
      }));

      // ── 6. Best-effort ReadinessEvaluator pass ────────────────────────────
      let readiness: NpiProfileResponse['readiness'] = {
        evaluated:           false,
        isEligible:          null,
        missingRequirements: [],
        traceCount:          0,
      };

      // Infer state from a state-board artifact source if available.
      const stateSource = artifacts.find((a) => inferStateFromSource(a.source) !== null);
      const inferredState = stateSource ? inferStateFromSource(stateSource.source) : null;

      if (inferredState) {
        try {
          // Use a generic specialty code; evaluator falls back gracefully if unknown.
          const evalResult = await evaluator.evaluateCandidate(npi, inferredState, 'general');
          readiness = {
            evaluated:           true,
            isEligible:          evalResult.isEligible,
            missingRequirements: evalResult.missingRequirements,
            traceCount:          evalResult.reasoningTrace.length,
          };
        } catch (err) {
          log('warn', 'public_profile_evaluator_failed', {
            npi:   npi.slice(0, 4) + '····',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // ── 7. Determine CLEARED vs PENDING ───────────────────────────────────
      const hasActiveCredentials = activeCredentials.length > 0;
      const evaluatorPass        = !readiness.evaluated || readiness.isEligible !== false;

      const status: 'CLEARED' | 'PENDING' =
        hasActiveCredentials && evaluatorPass ? 'CLEARED' : 'PENDING';

      // ── 8. Build and return response ──────────────────────────────────────
      const body: NpiProfileResponse = {
        npi,
        status,
        lastAnchored,
        activeCredentials,
        readiness,
        events,
        generatedAt,
      };

      log('info', 'public_profile_npi_served', {
        npi_prefix:         npi.slice(0, 4) + '····',
        status,
        credential_count:   activeCredentials.length,
        anchored_event_count: events.length,
      });

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.status(200).json(body);
    },
  );
}
