/**
 * documentStore.ts — Wave 237: Durable Document Extraction Storage
 *
 * Replaces the in-memory Map with Prisma-backed VerificationArtifact records.
 * source = "DOCUMENT_PARSE" distinguishes these from PSV/verification artifacts.
 */

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import type { DocumentExtractionResult } from '../ai/documentPipeline';
import { log } from '../../obs/logger';

// ── Allowed MIME types ────────────────────────────────────────────────

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]);

export function isAllowedMimeType(mimetype: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimetype);
}

// ── Status mapping ────────────────────────────────────────────────────

function confidenceToStatus(overallConfidence: number): string {
  if (overallConfidence >= 0.9) return 'VERIFIED';
  if (overallConfidence >= 0.7) return 'PENDING';
  return 'NEEDS_REVIEW';
}

// ── SHA-256 checksum ──────────────────────────────────────────────────

function checksumPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Persist a DocumentExtractionResult as a VerificationArtifact.
 * Returns the artifact id (= documentId reference).
 */
export async function storeExtraction(
  clerkUserId: string,
  extraction: DocumentExtractionResult,
): Promise<string> {
  const rawPayload = extraction as unknown as Prisma.InputJsonValue;
  const checksum = checksumPayload(rawPayload);
  const status = confidenceToStatus(extraction.overallConfidence);

  const artifact = await prisma.verificationArtifact.create({
    data: {
      id: extraction.documentId,
      npi: clerkUserId,          // use clerkUserId as npi placeholder for doc artifacts
      source: 'DOCUMENT_PARSE',
      status,
      rawPayload,
      checksum,
      verifiedAt: new Date(),
    },
  });

  log('info', 'document_store_saved', {
    artifactId: artifact.id,
    status,
    checksum,
  });

  return artifact.id;
}

/**
 * Retrieve a DocumentExtractionResult by documentId.
 * Returns null if not found or if the artifact is not a DOCUMENT_PARSE record.
 */
export async function getExtraction(
  documentId: string,
): Promise<DocumentExtractionResult | null> {
  const artifact = await prisma.verificationArtifact.findFirst({
    where: {
      id: documentId,
      source: 'DOCUMENT_PARSE',
    },
  });

  if (!artifact || !artifact.rawPayload) return null;

  return artifact.rawPayload as unknown as DocumentExtractionResult;
}

/**
 * List all document extractions for a given Clerk user.
 */
export async function listExtractions(
  clerkUserId: string,
): Promise<DocumentExtractionResult[]> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi: clerkUserId,
      source: 'DOCUMENT_PARSE',
    },
    orderBy: { createdAt: 'desc' },
  });

  return artifacts
    .filter((a) => a.rawPayload != null)
    .map((a) => a.rawPayload as unknown as DocumentExtractionResult);
}
