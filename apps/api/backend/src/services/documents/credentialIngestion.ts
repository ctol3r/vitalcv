/**
 * credentialIngestion.ts — Wave 238: Holder Credential Onboarding
 *
 * Converts parsed document extractions into CandidateCredential Prisma records.
 * Provides ingest, confirm, and list operations.
 */

import type { CandidateCredential } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { appendAuditEvent, newTraceId } from '../audit/auditLedger';
import type { DocumentExtractionResult } from '../ai/documentPipeline';
import { log } from '../../obs/logger';

// ── ingestCredential ──────────────────────────────────────────────────────────

/**
 * Creates a CandidateCredential record from a parsed document extraction.
 * Sets status = "UNVERIFIED" and emits an ISSUANCE audit event.
 */
export async function ingestCredential(
  clerkUserId: string,
  extraction: DocumentExtractionResult,
): Promise<{ credentialId: string; status: string }> {
  const traceId = newTraceId();

  const data: Prisma.InputJsonValue = {
    documentType: extraction.documentType,
    extractedFields: extraction.extractedFields as unknown as Prisma.InputJsonValue,
    overallConfidence: extraction.overallConfidence,
    processingTimeMs: extraction.processingTimeMs,
  };

  const credential = await prisma.candidateCredential.create({
    data: {
      candidateCredentialId: extraction.documentId,
      clinicianId: clerkUserId,
      data,
      status: 'UNVERIFIED',
    },
  });

  appendAuditEvent({
    traceId,
    category: ['ISSUANCE'],
    actor: clerkUserId,
    resource: credential.id,
    requestFields: {
      documentId: extraction.documentId,
      documentType: extraction.documentType,
    },
    resultFields: {
      credentialId: credential.id,
      status: credential.status,
    },
    severity: 'INFO',
  });

  log('info', 'credential_ingested', {
    credentialId: credential.id,
    clerkUserId,
    documentType: extraction.documentType,
    traceId,
  });

  return { credentialId: credential.id, status: credential.status };
}

// ── confirmCredential ─────────────────────────────────────────────────────────

/**
 * Merges user corrections into the credential data and sets status to
 * "PENDING_VERIFICATION". Emits an audit event.
 */
export async function confirmCredential(
  credentialId: string,
  corrections: Record<string, string>,
): Promise<{ status: string }> {
  const traceId = newTraceId();

  const existing = await prisma.candidateCredential.findUnique({
    where: { id: credentialId },
  });

  if (!existing) {
    throw new Error(`CandidateCredential not found: ${credentialId}`);
  }

  const existingData = (existing.data ?? {}) as Record<string, unknown>;

  // Merge corrections into extractedFields values
  let extractedFields = (existingData.extractedFields as Array<{ field: string; value: string; confidence: number }>) ?? [];
  if (Object.keys(corrections).length > 0) {
    extractedFields = extractedFields.map((f) =>
      corrections[f.field] !== undefined
        ? { ...f, value: corrections[f.field], corrected: true }
        : f,
    );
  }

  const updatedData = {
    ...existingData,
    extractedFields,
    corrections,
  };

  const updated = await prisma.candidateCredential.update({
    where: { id: credentialId },
    data: {
      data: updatedData,
      status: 'PENDING_VERIFICATION',
    },
  });

  appendAuditEvent({
    traceId,
    category: ['ISSUANCE'],
    actor: existing.clinicianId,
    resource: credentialId,
    requestFields: { credentialId, correctionCount: Object.keys(corrections).length },
    resultFields: { status: updated.status },
    severity: 'INFO',
  });

  log('info', 'credential_confirmed', {
    credentialId,
    status: updated.status,
    traceId,
  });

  return { status: updated.status };
}

// ── listCredentials ───────────────────────────────────────────────────────────

/**
 * Lists all CandidateCredential records for the given Clerk user ID,
 * ordered by most recently created first.
 */
export async function listCredentials(clerkUserId: string): Promise<CandidateCredential[]> {
  return prisma.candidateCredential.findMany({
    where: { clinicianId: clerkUserId },
    orderBy: { createdAt: 'desc' },
  });
}
