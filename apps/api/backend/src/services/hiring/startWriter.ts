/**
 * startWriter.ts — the LEGACY start writer (superseded; ADR 0007 amendment,
 * start-writer succession).
 *
 * The canonical start writer is now
 * `services/activation/applicationStartCommandService.ts` — the one
 * application-bound start command. This module remains for exactly one caller:
 * the entity-scoped `POST /api/employer-review/:entityId/confirm-start` path
 * (routes/employerActions.ts), whose migration onto the command is the ADR's
 * recorded follow-up. Do not point new callers here.
 *
 * ORIGINAL RATIONALE (still what this module guarantees for its caller):
 * VCD-00 found two wired start writers, each with its own hand-rolled
 * transaction. Both were correct — each wrote its `StartAttestation` and its
 * `START_ATTESTED` `AuditEvent` inside one `$transaction`. The risk was that
 * nothing made that structural: a third writer could add a start with no audit
 * row and nothing would object. `START_ATTESTED` is one of the five canonical
 * non-repudiation events, so a start without one is an unprovable claim.
 *
 * The pairing is structural: the allowlist in
 * `src/__tests__/acceptanceWriterInventory.test.ts` names the only modules
 * that may call `startAttestation.create`, and
 * `apps/api/backend/src/services/hiring/__tests__/startWriter.test.ts` asserts
 * the routes go through their allowlisted writer and that the two rows are
 * inseparable.
 *
 * WHAT THIS DELIBERATELY DOES NOT UNIFY
 * The two callers commit to *different* hash payloads:
 *
 *   hiring/start   { attestationId, acceptanceId, employerId, clinicianNpi,
 *                    role, facility, startedAt, createdAt }
 *   confirm-start  { attestationId, acceptanceId, entityId, employerId,
 *                    clinicianNpi, startedAt, role, facility }
 *
 * `attestationHash` is a tamper-evident commitment feeding the Merkle ledger.
 * Unifying the payload would change what future rows commit to on at least one
 * path, and leave old and new rows hashed under different schemes with nothing
 * recording which. So the hash stays computed by the caller and is passed in
 * verbatim; likewise the audit metadata, which carries caller-specific context
 * (confirm-start attaches `entityId` and runtime-trust fields that hiring has
 * no equivalent of). Unifying either is a separate, deliberate wave — not a
 * side effect of centralising persistence.
 *
 * `createdAt` is accepted for the same reason: hiring/start commits to it in
 * its hash, so it must be the same instant in the row and in the payload.
 * Callers that do not commit to it omit it and take the column default.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma, StartAttestation, AuditEvent } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

export type RecordStartInput = {
  /** Pre-generated so the caller can bind it into its hash before the write. */
  attestationId: string;
  acceptanceId: string;
  /** The subject, recorded on the audit row as `clinicianId`. */
  clinicianNpi: string;
  role: string;
  facility: string;
  startedAt: Date;
  /**
   * Pin only when the caller's `attestationHash` commits to it; otherwise the
   * column default (`now()`) applies.
   */
  createdAt?: Date;
  /** The caller's tamper-evident commitment. Stored verbatim. */
  attestationHash: string;
  /** Defaults to a fresh uuid when the caller does not need to know it up front. */
  auditEventId?: string;
  /** Caller-specific context. Stored verbatim as the audit row's metadata. */
  auditMetadata: Prisma.InputJsonValue;
};

export type RecordStartResult = {
  attestation: StartAttestation;
  auditEvent: AuditEvent;
};

/**
 * Persist a start and its non-repudiation audit row atomically.
 *
 * Both rows are written or neither is. Callers must have already resolved and
 * authorized the parent acceptance — this function performs no authorization
 * and no duplicate-start check; those differ per route and stay there.
 */
export async function recordStart(input: RecordStartInput): Promise<RecordStartResult> {
  const {
    attestationId,
    acceptanceId,
    clinicianNpi,
    role,
    facility,
    startedAt,
    createdAt,
    attestationHash,
    auditEventId = randomUUID(),
    auditMetadata,
  } = input;

  return prisma.$transaction(async (tx) => {
    const attestation = await tx.startAttestation.create({
      data: {
        id: attestationId,
        acceptanceId,
        role: role.trim(),
        facility: facility.trim(),
        startedAt,
        anchoredRoot: null,
        ...(createdAt ? { createdAt } : {}),
      },
    });

    const auditEvent = await tx.auditEvent.create({
      data: {
        id: auditEventId,
        type: 'START_ATTESTED',
        hash: attestationHash,
        referenceId: attestationId,
        clinicianId: clinicianNpi,
        anchored: false,
        metadata: auditMetadata,
      },
    });

    return { attestation, auditEvent };
  });
}
