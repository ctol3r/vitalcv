// @ts-nocheck
//
// WHAT THIS SUPPRESSION IS HIDING — measured 2026-08-11 by removing it (VCD-01e).
// Seven errors remain, all the same defect class and all in the start route:
// EmployerAcceptance.clinicianNpi and .employerId are nullable columns
// (deliberately — see migration 20260717000000), and the handler treats both as
// non-null. Lines ~220, 243, 254, 264, 280, 294, 295.
//
// Fixing them is a real decision, not a cast: it means choosing what a start
// attestation should do when its parent acceptance has no NPI or no employer.
// That is its own wave. Until then, be aware that `tsc` verifies NOTHING in
// this file — a green typecheck on a change here is not evidence.
/**
 * hiring.ts — Start Attestation
 *
 * Closes the ON Loop. Recording a start raises no charge — see VCD-01b below.
 *
 * `POST /api/hiring/accept` was closed in VCD-01e; the reasoning sits at the
 * former registration site further down. Employer acceptance is recorded by
 * `POST /api/employer-review/:entityId/accept`, which captures what was
 * accepted — entity, organization, application, packet hash, and a frozen
 * snapshot of the source coverage the reviewer saw.
 *
 * POST /api/hiring/start
 * ────────────────────────
 * Records the clinician's first day.
 *
 *   ATOMIC TRANSACTION
 *   ─────────────────
 *   StartAttestation + AuditEvent are written in a single Prisma transaction.
 *   Either both are persisted or neither is.
 *
 *   NO BILLING — VCD-01b, founder ruling 2026-08-11
 *   ───────────────────────────────────────────────
 *   Wave 42 also wrote a BillingEvent inside that transaction and then called
 *   `recordSuccessfulHire()` fire-and-forget, creating a $37.99 Stripe
 *   InvoiceItem against the employer.
 *
 *   VCD-00 found the other wired start writer —
 *   `POST /api/employer-review/:entityId/confirm-start`, the one the employer
 *   UI actually uses — never billed. So the same business fact billed or did
 *   not depending on which door it came through, and the door in the product
 *   was the silent one. Closing that the other way would have invoiced pilot
 *   participants who never agreed a price.
 *
 *   Billing is therefore off the start path entirely until there is a signed
 *   commercial scope to bill against. The machinery is intact and
 *   unreferenced — `services/billing/stripeClient.ts` and the `BillingEvent`
 *   model are untouched — so reintroduction behind a real commercial gate is a
 *   small explicit change, not a rebuild.
 *
 *   `apps/api/backend/src/routes/__tests__/startPathDoesNotBill.test.ts`
 *   asserts both start routes stay free of it.
 *
 * SECURITY
 * ────────
 * Both routes sit behind apiKeyAuth + publicApiRateLimit.
 */

import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { apiKeyAuth, publicApiRateLimit } from '../middleware/publicSafety';
import { sha256ForPayload } from '../utils/deterministic';
import { recordStart } from '../services/hiring/startWriter';
import { computeClinicianTrustState } from '../services/trust/trustStateEngine';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import {
  DEFAULT_PILOT_POLICY,
  evaluatePilotReadiness,
  parseOrganizationRequirementsEnvelope,
} from '../services/employers/pilotPolicy';

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

// ── Request body shapes ────────────────────────────────────────────────────

interface StartBody {
  acceptanceId: string;
  role:         string;
  facility:     string;
  /** ISO 8601 timestamp — may be future-dated for pre-scheduled starts. */
  startedAt:    string;
}

async function getEmployerPilotContext(employerId: string): Promise<{
  organizationId?: string;
  policy: typeof DEFAULT_PILOT_POLICY;
}> {
  const profile = await prisma.organizationProfile.findUnique({
    where: { organizationId: employerId },
    select: { organizationId: true, requirements: true },
  });

  if (!profile) {
    return { policy: DEFAULT_PILOT_POLICY };
  }

  const envelope = parseOrganizationRequirementsEnvelope(profile.requirements, []);
  return {
    organizationId: profile.organizationId,
    policy: {
      pilotMode: envelope.pilotMode,
      organizationAcceptanceRules: envelope.organizationAcceptanceRules,
      trustAcceptanceContracts: envelope.trustAcceptanceContracts,
    },
  };
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerHiringRoutes(app: Express): void {

  // `POST /api/hiring/accept` was closed here (VCD-01e, founder ruling
  // 2026-08-11). It recorded an EmployerAcceptance carrying employerId,
  // clinicianNpi, artifactId, status and acceptedAt and nothing else — no
  // entityId, no organization, no applicationId, no packetHash, no source
  // snapshot. An acceptance with no record of what was accepted.
  //
  // The live employer accept never used it: /review/[entityId] and
  // /verify/[npi] go through POST /api/employer-review/:entityId/accept,
  // which records all of that plus a frozen snapshot of the source coverage
  // the reviewer saw. The only caller here was StartClinicianAction.tsx,
  // rendered solely from app/_archive/ — a folder Next excludes from routing.
  //
  // Its employerId also came from the request body behind apiKeyAuth, so a
  // shared-key holder could name any employer.
  //
  // See routes/__tests__/thinAcceptDoorClosed.test.ts. Reopening this needs a
  // server-derived employerId and the same packet linkage the live path records.

  // ── POST /api/hiring/start ───────────────────────────────────────────────
  app.post(
    '/api/hiring/start',
    apiKeyAuth,
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { acceptanceId, role, facility, startedAt } = req.body as StartBody;

      // ── Validation ───────────────────────────────────────────────────────
      if (!isUuid(acceptanceId)) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'acceptanceId must be a valid UUID.',
        });
      }
      if (!role || typeof role !== 'string' || role.trim().length === 0) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'role is required.',
        });
      }
      if (!facility || typeof facility !== 'string' || facility.trim().length === 0) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'facility is required.',
        });
      }
      if (!startedAt || isNaN(Date.parse(startedAt))) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'startedAt must be a valid ISO 8601 timestamp.',
        });
      }

      // ── Resolve parent acceptance ────────────────────────────────────────
      const acceptance = await prisma.employerAcceptance.findUnique({
        where:  { id: acceptanceId },
        select: { id: true, clinicianNpi: true, employerId: true, status: true, acceptedAt: true },
      });

      if (!acceptance) {
        return res.status(404).json({
          error:             'not_found',
          error_description: `EmployerAcceptance ${acceptanceId} not found.`,
        });
      }

      if (acceptance.status !== 'ACCEPTED') {
        return res.status(409).json({
          error:             'acceptance_not_active',
          error_description: `EmployerAcceptance is in status "${acceptance.status}" — only ACCEPTED records can have a start attested.`,
        });
      }

      // ── Idempotency guard ────────────────────────────────────────────────
      const existingStart = await prisma.startAttestation.findFirst({
        where:  { acceptanceId },
        select: { id: true },
      });

      if (existingStart) {
        return res.status(409).json({
          error:               'already_started',
          error_description:   'A StartAttestation already exists for this acceptance.',
          startAttestationId:  existingStart.id,
        });
      }

      // ── Prepare deterministic IDs and hashes ─────────────────────────────
      const startedAtDate  = new Date(startedAt);
      const createdAt      = new Date();
      const attestationId  = randomUUID();

      // Binds employer + clinician + role + facility + timestamp into a single
      // tamper-evident commitment for the Wave 35 Merkle ledger.
      const attestationHash = sha256ForPayload({
        attestationId,
        acceptanceId,
        employerId:   acceptance.employerId,
        clinicianNpi: acceptance.clinicianNpi,
        role:         role.trim(),
        facility:     facility.trim(),
        startedAt:    startedAtDate.toISOString(),
        createdAt:    createdAt.toISOString(),
      });

      // StartAttestation + AuditEvent, atomically, through the single start
      // writer (VCD-01c). createdAt is pinned because the hash above commits
      // to it. (A BillingEvent was written here until VCD-01b — see the
      // module header.)
      const { attestation, auditEvent } = await recordStart({
        attestationId,
        acceptanceId,
        clinicianNpi: acceptance.clinicianNpi,
        role,
        facility,
        startedAt: startedAtDate,
        createdAt,
        attestationHash,
        auditMetadata: {
          attestationId,
          acceptanceId,
          employerId:  acceptance.employerId,
          role:        role.trim(),
          facility:    facility.trim(),
          startedAt:   startedAtDate.toISOString(),
        },
      });

      // ── ON Loop velocity metric ──────────────────────────────────────────
      const onLoopDeltaMs = startedAtDate.getTime() - acceptance.acceptedAt.getTime();

      log('info', 'hiring_start_attested', {
        attestationId,
        acceptanceId,
        employerId:       acceptance.employerId,
        npi_prefix:       acceptance.clinicianNpi.slice(0, 4) + '····',
        role:             role.trim(),
        facility:         facility.trim(),
        startedAt:        startedAtDate.toISOString(),
        attestationHash:  attestationHash.slice(0, 16) + '…',
        auditEventId:     auditEvent.id,
        on_loop_delta_ms: onLoopDeltaMs,
      });

      // Recording a start raises no charge. See the module header (VCD-01b).

      const pilotContext = await getEmployerPilotContext(acceptance.employerId).catch((error: unknown) => {
        log('warn', 'hiring_start_pilot_policy_lookup_failed', {
          acceptanceId,
          employerId: acceptance.employerId,
          error: String(error),
        });
        return { organizationId: undefined, policy: DEFAULT_PILOT_POLICY };
      });

      const pilotReadiness = pilotContext.policy.pilotMode
        ? await computeClinicianTrustState(acceptance.clinicianNpi)
            .then((trustState) => evaluatePilotReadiness(trustState, pilotContext.policy))
            .catch((error: unknown) => {
              log('warn', 'hiring_start_pilot_readiness_failed', {
                acceptanceId,
                employerId: acceptance.employerId,
                error: String(error),
              });
              return null;
            })
        : null;

      // SEAL: fire-and-forget start outcome capture
      {
        const { captureStartOutcome } = await import('../services/seal/sealEventCapture');
        void captureStartOutcome({
          entityId:              acceptance.clinicianNpi, // NPI as proxy until entityId available
          startedAt:             attestation.startedAt,
          blockersAtStart:       [],
          sourceCoverageAtStart: { live: ['NPPES', 'OIG / LEIE'], gated: [], mock: ['CMS PECOS'], notChecked: [] },
          metadata:              {
            startAttestationId: attestation.id,
            acceptanceId,
            role:               attestation.role,
            facility:           attestation.facility,
          },
        }).catch(() => void 0); // never fail the hire on SEAL capture error
      }

      void capsuleEngine.createDecisionFromHire({
        subjectNpi: acceptance.clinicianNpi,
        employerId: acceptance.employerId,
        organizationId: pilotContext.organizationId,
        acceptanceId,
        startAttestationId: attestation.id,
        role: attestation.role,
        facility: attestation.facility,
        startedAt: attestation.startedAt.toISOString(),
      }).catch((error: unknown) => {
        log('warn', 'hiring_start_decision_capsule_creation_failed', {
          acceptanceId,
          startAttestationId: attestation.id,
          employerId: acceptance.employerId,
          error: String(error),
        });
      });

      // ── 201 response ─────────────────────────────────────────────────────
      return res.status(201).json({
        ok:                 true,
        startAttestationId: attestation.id,
        acceptanceId,
        role:               attestation.role,
        facility:           attestation.facility,
        startedAt:          attestation.startedAt.toISOString(),
        createdAt:          attestation.createdAt.toISOString(),
        merkle: {
          auditEventId:    auditEvent.id,
          attestationHash: attestationHash,
          anchoredRoot:    null,
          status:          'PENDING_ANCHOR',
        },
        on_loop_delta_ms: onLoopDeltaMs,
        pilotReadiness,
      });
    },
  );
}
