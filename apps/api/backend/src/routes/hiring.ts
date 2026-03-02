/**
 * hiring.ts — Wave 41: Start Attestation Engine
 *
 * Closes the ON Loop: Recognition → Acceptance → Start.
 *
 * POST /api/hiring/accept
 * ────────────────────────
 * Records an employer's formal decision to hire a clinician after reviewing
 * their verified credential bundle.  Creates an EmployerAcceptance row.
 *
 * POST /api/hiring/start
 * ────────────────────────
 * Records the clinician's first day — the moment they start practising at
 * the facility.  Creates a StartAttestation row, then immediately submits
 * a cryptographic hash to the Wave 35 AuditEvent ledger so the
 * merkleBatcher can anchor it in the next Merkle batch cycle.
 *
 * SECURITY
 * ────────
 * Both routes sit behind apiKeyAuth (added to allowlist below).
 * artifactId on /accept is optional — callers should supply it when the
 * acceptance is tied to a specific VerificationArtifact (best practice).
 *
 * ON LOOP METRIC
 * ──────────────
 * The millisecond delta between EmployerAcceptance.acceptedAt and
 * StartAttestation.startedAt is VitalCV's core "time-to-hire velocity"
 * metric.  Both timestamps are stored with UTC precision.
 */

import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { apiKeyAuth, publicApiRateLimit } from '../middleware/publicSafety';
import { sha256ForPayload } from '../utils/deterministic';

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

      // ── Create EmployerAcceptance ────────────────────────────────────────
      const acceptance = await prisma.employerAcceptance.create({
        data: {
          id:           randomUUID(),
          employerId:   employerId.trim(),
          clinicianNpi,
          artifactId:   artifactId ?? null,
          status:       'ACCEPTED',
          acceptedAt:   new Date(),
        },
      });

      log('info', 'hiring_accept', {
        acceptanceId: acceptance.id,
        employerId:   acceptance.employerId,
        npi_prefix:   clinicianNpi.slice(0, 4) + '····',
        artifactId:   artifactId ?? null,
      });

      return res.status(201).json({
        ok:           true,
        acceptanceId: acceptance.id,
        employerId:   acceptance.employerId,
        clinicianNpi: acceptance.clinicianNpi,
        status:       acceptance.status,
        acceptedAt:   acceptance.acceptedAt.toISOString(),
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
        select: { id: true, clinicianNpi: true, employerId: true, status: true },
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
          error:             'already_started',
          error_description: 'A StartAttestation already exists for this acceptance.',
          startAttestationId: existingStart.id,
        });
      }

      const startedAtDate = new Date(startedAt);
      const createdAt     = new Date();
      const attestationId = randomUUID();

      // ── Compute cryptographic hash of the attestation ────────────────────
      // This hash is what gets submitted to the merkleBatcher — it binds
      // the employer, clinician, role, facility, and start timestamp into
      // a single tamper-evident commitment.
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

      // ── Create StartAttestation ──────────────────────────────────────────
      const attestation = await prisma.startAttestation.create({
        data: {
          id:           attestationId,
          acceptanceId,
          role:         role.trim(),
          facility:     facility.trim(),
          startedAt:    startedAtDate,
          anchoredRoot: null, // populated by merkleBatcher on next cycle
          createdAt,
        },
      });

      // ── Submit hash to Wave 35 merkleBatcher (via AuditEvent) ───────────
      // Creating an AuditEvent with anchored:false is the contract — the
      // anchorWorker will include it in the next Merkle batch, stamp
      // merkleRoot on both this AuditEvent AND update StartAttestation.anchoredRoot
      // in a follow-up (or callers can poll /api/audit/proof/:hash).
      const auditEvent = await prisma.auditEvent.create({
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

      // ON Loop delta: acceptedAt → startedAt (milliseconds)
      const acceptanceRow = await prisma.employerAcceptance.findUnique({
        where:  { id: acceptanceId },
        select: { acceptedAt: true },
      });
      const onLoopDeltaMs = acceptanceRow
        ? startedAtDate.getTime() - acceptanceRow.acceptedAt.getTime()
        : null;

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
          anchoredRoot:    null, // Wave 35 merkleBatcher anchors asynchronously
          status:          'PENDING_ANCHOR',
        },
        on_loop_delta_ms: onLoopDeltaMs,
      });
    },
  );
}
