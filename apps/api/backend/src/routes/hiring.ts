// @ts-nocheck
/**
 * hiring.ts — Wave 41 (updated Wave 42): Start Attestation + Billing Engine
 *
 * Closes the ON Loop and triggers usage-based billing.
 *
 * POST /api/hiring/accept
 * ────────────────────────
 * Records an employer's formal decision to hire a clinician.
 * Creates an EmployerAcceptance row.  Unchanged from Wave 41.
 *
 * POST /api/hiring/start  ← UPDATED in Wave 42
 * ────────────────────────
 * Records the clinician's first day.  Wave 42 additions:
 *
 *   ATOMIC TRANSACTION
 *   ─────────────────
 *   StartAttestation + AuditEvent + BillingEvent(PENDING) are written in a
 *   single Prisma transaction.  Either all three are persisted or none are —
 *   preventing orphaned billing records or untracked start events.
 *
 *   ASYNC STRIPE BILLING
 *   ────────────────────
 *   After the transaction commits, `recordSuccessfulHire()` is called
 *   fire-and-forget.  On success the BillingEvent is updated to BILLED.
 *   On failure (network error, Stripe outage) it is updated to ERROR with
 *   the error message, without rolling back the start attestation.
 *   When STRIPE_SECRET_KEY is absent it is set to SKIPPED (dev/test).
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
import { recordSuccessfulHire, VERIFIED_HIRE_AMOUNT_CENTS, VERIFIED_HIRE_CURRENCY } from '../services/billing/stripeClient';
import { computeClinicianTrustState } from '../services/trust/trustStateEngine';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import {
  DEFAULT_PILOT_POLICY,
  evaluatePilotReadiness,
  parseOrganizationRequirementsEnvelope,
  type PilotReadinessEvaluation,
} from '../services/employers/pilotPolicy';

// ── Helpers ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NPI_RE  = /^\d{10}$/;

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function isNpi(v: unknown): v is string {
  return typeof v === 'string' && NPI_RE.test(v);
}

// ── Request body shapes ────────────────────────────────────────────────────

interface AcceptBody {
  employerId:   string;
  clinicianNpi: string;
  artifactId?:  string;
}

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

async function buildPilotReadinessEvaluation(
  employerId: string,
  clinicianNpi: string,
): Promise<PilotReadinessEvaluation | null> {
  const { policy } = await getEmployerPilotContext(employerId);
  if (!policy.pilotMode) {
    return null;
  }

  const trustState = await computeClinicianTrustState(clinicianNpi);
  return evaluatePilotReadiness(trustState, policy);
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerHiringRoutes(app: Express): void {

  // ── POST /api/hiring/accept ──────────────────────────────────────────────
  app.post(
    '/api/hiring/accept',
    apiKeyAuth,
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { employerId, clinicianNpi, artifactId } = req.body as AcceptBody;

      // ── Validation ───────────────────────────────────────────────────────
      if (!employerId || typeof employerId !== 'string' || employerId.trim().length === 0) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'employerId is required.',
        });
      }
      if (!isNpi(clinicianNpi)) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'clinicianNpi must be a 10-digit string.',
        });
      }
      if (artifactId !== undefined && !isUuid(artifactId)) {
        return res.status(400).json({
          error:             'invalid_request',
          error_description: 'artifactId must be a valid UUID when provided.',
        });
      }

      // ── Prevent duplicate open acceptances ───────────────────────────────
      const existing = await prisma.employerAcceptance.findFirst({
        where: {
          employerId:   employerId.trim(),
          clinicianNpi,
          status:       'ACCEPTED',
        },
        select: { id: true },
      });

      if (existing) {
        return res.status(409).json({
          error:             'already_accepted',
          error_description: 'An active EmployerAcceptance already exists for this employer/NPI pair.',
          acceptanceId:      existing.id,
        });
      }

      // Pre-generate IDs and hash before the transaction so they can be used
      // in both the EmployerAcceptance row and the AuditEvent commitment.
      const acceptanceId = randomUUID();
      const acceptedAt   = new Date();
      const acceptanceHash = sha256ForPayload({
        acceptanceId,
        employerId:   employerId.trim(),
        clinicianNpi,
        artifactId:   artifactId ?? null,
        acceptedAt:   acceptedAt.toISOString(),
      });

      // ATOMIC: EmployerAcceptance + AuditEvent written together or neither.
      const acceptance = await prisma.$transaction(async (tx) => {
        const created = await tx.employerAcceptance.create({
          data: {
            id:           acceptanceId,
            employerId:   employerId.trim(),
            clinicianNpi,
            artifactId:   artifactId ?? null,
            status:       'ACCEPTED',
            acceptedAt,
          },
        });

        await tx.auditEvent.create({
          data: {
            id:          randomUUID(),
            type:        'EMPLOYER_ACCEPTANCE_CREATED',
            hash:        acceptanceHash,
            referenceId: acceptanceId,
            clinicianId: clinicianNpi,
            anchored:    false,
            metadata: {
              acceptanceId,
              employerId:  employerId.trim(),
              artifactId:  artifactId ?? null,
              acceptedAt:  acceptedAt.toISOString(),
            },
          },
        });

        return created;
      });

      const pilotReadiness = await buildPilotReadinessEvaluation(
        acceptance.employerId,
        acceptance.clinicianNpi,
      ).catch((error: unknown) => {
        log('warn', 'hiring_accept_pilot_readiness_failed', {
          acceptanceId: acceptance.id,
          employerId: acceptance.employerId,
          error: String(error),
        });
        return null;
      });

      log('info', 'hiring_accept', {
        acceptanceId: acceptance.id,
        employerId:   acceptance.employerId,
        npi_prefix:   clinicianNpi.slice(0, 4) + '····',
        artifactId:   artifactId ?? null,
        pilotReadiness,
      });

      void capsuleEngine.createDecisionFromAcceptance({
        subjectNpi: acceptance.clinicianNpi,
        employerId: acceptance.employerId,
        acceptanceId: acceptance.id,
        artifactId: acceptance.artifactId,
      }).catch((error: unknown) => {
        log('warn', 'hiring_accept_decision_capsule_creation_failed', {
          acceptanceId: acceptance.id,
          employerId: acceptance.employerId,
          error: String(error),
        });
      });

      return res.status(201).json({
        ok:           true,
        acceptanceId: acceptance.id,
        employerId:   acceptance.employerId,
        clinicianNpi: acceptance.clinicianNpi,
        status:       acceptance.status,
        acceptedAt:   acceptance.acceptedAt.toISOString(),
        pilotReadiness,
      });
    },
  );

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
      const billingEventId = randomUUID();

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

      // ── ATOMIC TRANSACTION ───────────────────────────────────────────────
      // StartAttestation + AuditEvent + BillingEvent(PENDING) in one TX.
      // All three rows are written or none are.
      const { attestation, auditEvent, billingEvent } = await prisma.$transaction(async (tx) => {
        const attestation = await tx.startAttestation.create({
          data: {
            id:           attestationId,
            acceptanceId,
            role:         role.trim(),
            facility:     facility.trim(),
            startedAt:    startedAtDate,
            anchoredRoot: null,
            createdAt,
          },
        });

        const auditEvent = await tx.auditEvent.create({
          data: {
            id:          randomUUID(),
            type:        'START_ATTESTED',
            hash:        attestationHash,
            referenceId: attestationId,
            clinicianId: acceptance.clinicianNpi,
            anchored:    false,
            metadata: {
              attestationId,
              acceptanceId,
              employerId:  acceptance.employerId,
              role:        role.trim(),
              facility:    facility.trim(),
              startedAt:   startedAtDate.toISOString(),
            },
          },
        });

        // BillingEvent starts PENDING; Stripe call resolves it async.
        const billingEvent = await tx.billingEvent.create({
          data: {
            id:                 billingEventId,
            employerId:         acceptance.employerId,
            startAttestationId: attestationId,
            stripeInvoiceItemId: null,
            stripeCustomerId:    null,
            amountCents:         VERIFIED_HIRE_AMOUNT_CENTS,
            currency:            VERIFIED_HIRE_CURRENCY,
            status:              'PENDING',
          },
        });

        return { attestation, auditEvent, billingEvent };
      });

      // ── ON Loop velocity metric ──────────────────────────────────────────
      const onLoopDeltaMs = startedAtDate.getTime() - acceptance.acceptedAt.getTime();

      log('info', 'hiring_start_attested', {
        attestationId,
        acceptanceId,
        billingEventId:   billingEvent.id,
        employerId:       acceptance.employerId,
        npi_prefix:       acceptance.clinicianNpi.slice(0, 4) + '····',
        role:             role.trim(),
        facility:         facility.trim(),
        startedAt:        startedAtDate.toISOString(),
        attestationHash:  attestationHash.slice(0, 16) + '…',
        auditEventId:     auditEvent.id,
        on_loop_delta_ms: onLoopDeltaMs,
      });

      // ── ASYNC STRIPE BILLING (fire-and-forget) ───────────────────────────
      // The 201 response is sent BEFORE this settles — Stripe latency never
      // blocks the employer's workflow.  BillingEvent.status tracks the result.
      void recordSuccessfulHire(
        acceptance.employerId,
        acceptance.clinicianNpi,
        attestationId,
      ).then(async (result) => {
        if (!result) {
          // STRIPE_SECRET_KEY not set — expected in dev; mark as SKIPPED.
          await prisma.billingEvent.update({
            where: { id: billingEventId },
            data:  { status: 'SKIPPED' },
          });
          log('info', 'billing_event_skipped', { billingEventId, attestationId });
          return;
        }

        await prisma.billingEvent.update({
          where: { id: billingEventId },
          data: {
            stripeInvoiceItemId: result.stripeInvoiceItemId,
            stripeCustomerId:    result.stripeCustomerId,
            status:              'BILLED',
          },
        });

        log('info', 'billing_event_billed', {
          billingEventId,
          attestationId,
          stripeInvoiceItemId: result.stripeInvoiceItemId,
          amountCents:         result.amountCents,
        });
      }).catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);

        await prisma.billingEvent.update({
          where: { id: billingEventId },
          data:  { status: 'ERROR', errorMessage: message },
        }).catch(() => { /* best-effort; don't throw in a fire-and-forget */ });

        log('error', 'billing_event_error', {
          billingEventId,
          attestationId,
          error: message,
        });
      });

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
        billing: {
          billingEventId:  billingEvent.id,
          status:          'PENDING',        // resolves async
          amountCents:     VERIFIED_HIRE_AMOUNT_CENTS,
          currency:        VERIFIED_HIRE_CURRENCY,
        },
        on_loop_delta_ms: onLoopDeltaMs,
        pilotReadiness,
      });
    },
  );
}
