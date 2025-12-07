/**
 * B250A-DOC-002: DocumentVersion Model
 *
 * Model for document versions with content tracking and change summaries
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentVersionInput {
  documentId: string;
  versionNumber: number;
  content: string | object; // markdown or rich text JSON
  authorId: string;
  changeSummary?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  content: string | object;
  authorId: string;
  changeSummary: string | null;
  createdAt: Date;
}

/**
 * Validate document version input
 */
export function validateDocumentVersionInput(input: DocumentVersionInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.authorId || input.authorId.trim().length === 0) {
    throw new Error('authorId is required');
  }
  if (typeof input.versionNumber !== 'number' || input.versionNumber < 1) {
    throw new Error('versionNumber must be a positive integer');
  }
  if (!input.content) {
    throw new Error('content is required');
  }
}

/**
 * Create document version
 */
export async function createDocumentVersion(
  prisma: PrismaClient,
  input: DocumentVersionInput
): Promise<DocumentVersion> {
  validateDocumentVersionInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  // Check if version number already exists for this document
  const existingVersion = await prisma.documentVersion.findFirst({
    where: {
      documentId: input.documentId,
      versionNumber: input.versionNumber,
    },
  });

  if (existingVersion) {
    throw new Error(`Version ${input.versionNumber} already exists for document ${input.documentId}`);
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId: input.documentId,
      versionNumber: input.versionNumber,
      content: input.content, // Prisma handles JSON automatically
      authorId: input.authorId,
      changeSummary: input.changeSummary ?? null,
    },
  });

  // If this is being published, update document's currentVersionId
  // Note: This should be called explicitly when publishing, not automatically on create
  // The trigger logic would be handled at the service layer

  return version;
}

/**
 * Publish a version (updates document's currentVersionId)
 */
export async function publishDocumentVersion(
  prisma: PrismaClient,
  documentId: string,
  versionId: string
): Promise<{ document: any; version: DocumentVersion }> {
  // Verify version exists and belongs to document
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: versionId,
      documentId: documentId,
    },
  });

  if (!version) {
    throw new Error(`Version ${versionId} not found for document ${documentId}`);
  }

  // Update document's currentVersionId and status
  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      currentVersionId: versionId,
      status: 'PUBLISHED', // Use enum value
      publishedAt: new Date(),
    },
  });

  return {
    document,
    version,
  };
}

/**
 * Get document version by ID
 */
export async function getDocumentVersionById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentVersion | null> {
  const version = await prisma.documentVersion.findUnique({
    where: { id },
  });

  if (!version) return null;

  return version;
}

/**
 * Get all versions for a document
 */
export async function getDocumentVersions(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentVersion[]> {
  const versions = await prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
  });

  return versions.map(v => ({
    ...v,
    content: typeof v.content === 'string' ? v.content : JSON.parse(v.content as string),
  }));
}

/**
 * Get latest version for a document
 */
export async function getLatestDocumentVersion(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentVersion | null> {
  const version = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
  });

  if (!version) return null;

  return version;
}

/**
 * Get next version number for a document
 */
export async function getNextVersionNumber(
  prisma: PrismaClient,
  documentId: string
): Promise<number> {
  const latest = await prisma.documentVersion.findFirst({
    where: { documentId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });

  return latest ? latest.versionNumber + 1 : 1;
}

