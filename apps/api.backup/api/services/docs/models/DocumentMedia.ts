/**
 * B250A-DOC-008: DocumentMedia Model
 *
 * Model for document file attachments and media references
 */

import { PrismaClient } from '@prisma/client';

export interface DocumentMediaInput {
  documentId: string;
  versionId: string;
  fileId: string; // Reference to file service
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface DocumentMedia {
  id: string;
  documentId: string;
  versionId: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

/**
 * Validate document media input
 */
export function validateDocumentMediaInput(input: DocumentMediaInput): void {
  if (!input.documentId || input.documentId.trim().length === 0) {
    throw new Error('documentId is required');
  }
  if (!input.versionId || input.versionId.trim().length === 0) {
    throw new Error('versionId is required');
  }
  if (!input.fileId || input.fileId.trim().length === 0) {
    throw new Error('fileId is required');
  }
  if (!input.fileName || input.fileName.trim().length === 0) {
    throw new Error('fileName is required');
  }
  if (!input.fileType || input.fileType.trim().length === 0) {
    throw new Error('fileType is required');
  }
  if (typeof input.fileSize !== 'number' || input.fileSize < 0) {
    throw new Error('fileSize must be a non-negative number');
  }
}

/**
 * Create document media entry
 */
export async function createDocumentMedia(
  prisma: PrismaClient,
  input: DocumentMediaInput
): Promise<DocumentMedia> {
  validateDocumentMediaInput(input);

  // Verify document exists
  const document = await prisma.document.findUnique({
    where: { id: input.documentId },
  });

  if (!document) {
    throw new Error(`Document with id "${input.documentId}" not found`);
  }

  // Verify version exists and belongs to document
  const version = await prisma.documentVersion.findFirst({
    where: {
      id: input.versionId,
      documentId: input.documentId,
    },
  });

  if (!version) {
    throw new Error(`Version ${input.versionId} not found for document ${input.documentId}`);
  }

  return prisma.documentMedia.create({
    data: {
      documentId: input.documentId,
      versionId: input.versionId,
      fileId: input.fileId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
    },
  });
}

/**
 * Get document media by ID
 */
export async function getDocumentMediaById(
  prisma: PrismaClient,
  id: string
): Promise<DocumentMedia | null> {
  return prisma.documentMedia.findUnique({
    where: { id },
  });
}

/**
 * Get all media for a document
 */
export async function getDocumentMedia(
  prisma: PrismaClient,
  documentId: string
): Promise<DocumentMedia[]> {
  return prisma.documentMedia.findMany({
    where: { documentId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get all media for a document version
 */
export async function getVersionMedia(
  prisma: PrismaClient,
  documentId: string,
  versionId: string
): Promise<DocumentMedia[]> {
  return prisma.documentMedia.findMany({
    where: {
      documentId,
      versionId,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get media by file type
 */
export async function getMediaByType(
  prisma: PrismaClient,
  documentId: string,
  fileType: string
): Promise<DocumentMedia[]> {
  return prisma.documentMedia.findMany({
    where: {
      documentId,
      fileType,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Delete document media
 */
export async function deleteDocumentMedia(
  prisma: PrismaClient,
  id: string
): Promise<DocumentMedia> {
  return prisma.documentMedia.delete({
    where: { id },
  });
}

/**
 * Delete all media for a document version
 */
export async function deleteVersionMedia(
  prisma: PrismaClient,
  documentId: string,
  versionId: string
): Promise<number> {
  const result = await prisma.documentMedia.deleteMany({
    where: {
      documentId,
      versionId,
    },
  });

  return result.count;
}

